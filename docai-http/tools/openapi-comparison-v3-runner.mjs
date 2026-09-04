import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { gradeParsedResponse } from "./openapi-comparison-v3-grader.mjs";
import { parseProviderText } from "./openapi-comparison-v3-parser.mjs";
import { validatePromptRecord } from "./openapi-comparison-v3-prompt.mjs";
import {
  ProviderResponseError,
  ProviderTransportError,
} from "./openapi-comparison-v3-provider-errors.mjs";
import {
  isExceptionalRun,
  validateEvaluationRecord,
} from "./openapi-comparison-v3-record.mjs";
import { buildCalibrationSchedule } from "./openapi-comparison-v3-utils.mjs";

const BATCH_ID = "calibration";
const CALIBRATION_REQUESTS = 24;
const ATTEMPT_CAP = 100;
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const VALIDATED_PREFLIGHTS = new WeakMap();
const ATTEMPT_STATUSES = new Set([
  "response",
  "transport-error",
  "provider-error",
  "implementation-defect",
]);
const IMMEDIATE_PROVIDER_STOPS = new Set([
  "authentication_error",
  "billing_error",
  "model_unavailable",
]);

export const CALIBRATION_RUNNER_REVISION_FILES = [
  "docai-http/tools/openapi-comparison-v3-runner.mjs",
  "docai-http/tools/openapi-comparison-v3-parser.mjs",
  "docai-http/tools/openapi-comparison-v3-grader.mjs",
  "docai-http/tools/openapi-comparison-v3-prompt.mjs",
  "docai-http/tools/openapi-comparison-v3-record.mjs",
  "docai-http/tools/openapi-comparison-v3-contract.mjs",
  "docai-http/tools/openapi-comparison-v3-context.mjs",
  "docai-http/tools/openapi-comparison-v3-utils.mjs",
  "docai-http/tools/openapi-comparison-v2-context.mjs",
  "docai-http/tools/openapi-comparison-v2-contract.mjs",
  "docai-http/tools/openapi-comparison-v2-utils.mjs",
  "docai-http/tools/openapi-comparison-v3-provider-errors.mjs",
  "docai-http/tools/openapi-comparison-v3-provider-adapter-utils.mjs",
  "docai-http/tools/openapi-comparison-v3-openai-adapter.mjs",
  "docai-http/tools/openapi-comparison-v3-anthropic-adapter.mjs",
  "docai-http/tools/openapi-comparison-v3-google-adapter.mjs",
  "docai-http/tools/check-openapi-comparison-v3-runs.mjs",
  "docai-http/tools/run-openapi-comparison-v3-calibration.mjs",
  "docai-http/tools/openapi-comparison-v3-calibration-gate.mjs",
  "docai-http/tools/check-openapi-comparison-v3-calibration.mjs",
  "docai-http/tools/openapi-comparison-v3-adjudication.mjs",
  "docai-http/tools/check-openapi-comparison-v3-adjudication.mjs",
  "docai-http/tools/openapi-comparison-v3-strict-json.mjs",
  "docai-http/tools/estimate-openapi-comparison-v3-cost.mjs",
  "docai-http/tools/freeze-openapi-comparison-v3.mjs",
  "docai-http/benchmarks/openapi-comparison/v2/plan.json",
  "docai-http/benchmarks/openapi-comparison/v2/contracts.json",
  "docai-http/benchmarks/openapi-comparison/v3/plan.json",
  "docai-http/benchmarks/openapi-comparison/v3/contracts.json",
  "docai-http/benchmarks/openapi-comparison/v3/continuity/tasks.json",
  "docai-http/benchmarks/openapi-comparison/v3/calibration-schedule.jsonl",
  "docai-http/benchmarks/openapi-comparison/v3/private/prompts/calibration.jsonl",
  "docai-http/benchmarks/openapi-comparison/v3/private/contexts/calibration-metrics.json",
  "docai-http/benchmarks/openapi-comparison/v3/model-resolutions.json",
  "docai-http/benchmarks/openapi-comparison/v3/cost-estimate.json",
  "docai-http/benchmarks/openapi-comparison/v3/freeze-manifest.json",
];

export class MemoryRunStore {
  constructor() {
    this.attempts = [];
    this.runs = [];
    this.checkpoints = new Map();
  }

  listAttempts(batchId = BATCH_ID) {
    return snapshotJson(this.attempts.filter((record) => (
      record.batch_id === undefined || record.batch_id === batchId
    )), "memory attempts");
  }

  listRuns(batchId = BATCH_ID) {
    return snapshotJson(this.runs.filter((record) => (
      record.batch_id === undefined || record.batch_id === batchId
    )), "memory runs");
  }

  appendAttempt(record) {
    this.attempts.push(snapshotJson(record, "attempt record"));
  }

  appendRun(record) {
    this.runs.push(snapshotJson(record, "run record"));
  }

  readCheckpoint(batchId = BATCH_ID) {
    return this.checkpoints.has(batchId)
      ? snapshotJson(this.checkpoints.get(batchId), "checkpoint")
      : null;
  }

  writeCheckpoint(batchId, checkpoint) {
    this.checkpoints.set(batchId, snapshotJson(checkpoint, "checkpoint"));
  }
}

export class FileRunStore {
  constructor({ runsDir, checkpointsDir }) {
    if (typeof runsDir !== "string" || runsDir.trim() === "") {
      throw new TypeError("runsDir must be a non-empty string");
    }
    if (typeof checkpointsDir !== "string" || checkpointsDir.trim() === "") {
      throw new TypeError("checkpointsDir must be a non-empty string");
    }
    this.runsDir = initializePrivateDirectory(runsDir);
    this.checkpointsDir = initializePrivateDirectory(checkpointsDir);
  }

  listAttempts(batchId = BATCH_ID) {
    return readJsonLines(this.logFile(batchId, "attempts.jsonl"));
  }

  listRuns(batchId = BATCH_ID) {
    return readJsonLines(this.logFile(batchId, "runs.jsonl"));
  }

  appendAttempt(record) {
    appendJsonLine(this.logFile(record.batch_id, "attempts.jsonl"), record);
  }

  appendRun(record) {
    appendJsonLine(this.logFile(record.batch_id, "runs.jsonl"), record);
  }

  readCheckpoint(batchId = BATCH_ID) {
    const file = this.checkpointFile(batchId);
    if (!fs.existsSync(file)) return null;
    secureRegularFile(file);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  writeCheckpoint(batchId, checkpoint) {
    const file = this.checkpointFile(batchId);
    const value = snapshotJson(checkpoint, "checkpoint");
    secureDirectory(path.dirname(file));
    if (fs.existsSync(file)) secureRegularFile(file);
    const temporary = `${file}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  logFile(batchId, name) {
    requireBatchId(batchId);
    secureDirectory(this.runsDir);
    const directory = path.join(this.runsDir, batchId);
    secureDirectory(directory);
    return path.join(directory, name);
  }

  checkpointFile(batchId) {
    requireBatchId(batchId);
    secureDirectory(this.checkpointsDir);
    return path.join(this.checkpointsDir, `${batchId}.json`);
  }
}

export function selectCalibrationPrompts({ plan, prompts }) {
  validateCalibrationPlan(plan);
  if (!Array.isArray(prompts)) throw new TypeError("prompts must be an array");

  const selected = prompts.map((prompt) => validatePromptRecord(prompt))
    .sort((left, right) => left.calibration_ordinal - right.calibration_ordinal);
  if (selected.length !== CALIBRATION_REQUESTS) {
    throw new Error(`calibration requires exactly ${CALIBRATION_REQUESTS} prompts`);
  }
  if (new Set(selected.map((prompt) => prompt.run_id)).size !== selected.length) {
    throw new Error("calibration prompts must have unique run identities");
  }

  const expected = buildCalibrationSchedule(plan);
  selected.forEach((prompt, index) => {
    const identity = promptIdentity(prompt);
    if (!isDeepStrictEqual(identity, expected[index])) {
      throw new Error(`calibration prompt ${prompt.run_id} does not match canonical ordinal ${index + 1}`);
    }
  });
  return selected;
}

export function validateLiveCalibrationPreflight({
  plan,
  prompts,
  adapters = {},
  modelResolutions = {},
  costEstimate,
  freezeManifest,
  validateFreezeArtifacts,
  runnerRevision,
} = {}) {
  const selected = selectCalibrationPrompts({ plan, prompts });
  if (plan.status !== "calibration-frozen") {
    throw new Error("Live preflight requires a calibration-frozen plan");
  }
  validateAdaptersForPlan(plan, adapters, { requireExecute: true });
  for (const target of plan.targets) {
    if (adapters[target.provider].api_key_status !== "present") {
      throw new Error(`${target.provider} API key is required for Live calibration`);
    }
  }
  if (typeof runnerRevision !== "string" || runnerRevision.trim() === "") {
    throw new Error("Live preflight runner revision is required");
  }

  const normalizedModels = normalizeModelResolutions(plan, modelResolutions);
  validateCostEstimate(plan, costEstimate);
  if (!freezeManifest || typeof freezeManifest !== "object" || Array.isArray(freezeManifest)
      || freezeManifest.benchmark_id !== plan.benchmark_id
      || freezeManifest.plan_version !== plan.plan_version) {
    throw new Error("freeze manifest does not match the approved plan");
  }
  if (freezeManifest.status !== undefined && freezeManifest.status !== "frozen") {
    throw new Error("freeze manifest must be frozen");
  }
  if (typeof validateFreezeArtifacts !== "function") {
    throw new Error("freeze artifact validation hook is required");
  }
  const freezeResult = validateFreezeArtifacts({
    plan,
    prompts: selected,
    modelResolutions: normalizedModels,
    costEstimate,
    freezeManifest,
    runnerRevision,
  });
  if (freezeResult !== true && freezeResult?.valid !== true) {
    throw new Error("freeze artifact validation failed");
  }

  const validated = Object.freeze({
    preflight_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    runner_revision: runnerRevision,
    token_ceiling: costEstimate.calibration.total_tokens_ceiling,
    cost_ceiling_usd: costEstimate.calibration.cost_ceiling_usd,
  });
  VALIDATED_PREFLIGHTS.set(validated, {
    prompt_identities: snapshotJson(selected.map(promptIdentity), "preflight prompt identities"),
    model_resolutions: normalizedModels,
    token_ceiling: validated.token_ceiling,
    cost_ceiling_usd: validated.cost_ceiling_usd,
    runner_revision: runnerRevision,
  });
  return validated;
}

export async function runApprovedCalibration({
  plan,
  prompts,
  execute = false,
  approval = null,
  adapters = {},
  store = null,
  taskForPrompt = null,
  grader = gradeParsedResponse,
  parser = parseProviderText,
  modelResolutions = {},
  clock = () => new Date().toISOString(),
  runnerRevision = null,
  livePreflight = null,
} = {}) {
  const selected = selectCalibrationPrompts({ plan, prompts });
  validateAdaptersForPlan(plan, adapters, { requireExecute: execute });

  if (!execute) {
    const checkpoint = checkpointRecord({
      plan,
      status: "dry-run",
      stopReason: null,
      attemptCount: 0,
      completedRunIds: [],
      updatedAt: clock(),
    });
    return {
      checkpoint,
      report: buildCalibrationReport({
        plan,
        status: "dry-run",
        stopReason: null,
        adapters,
        plannedPrompts: selected,
      }),
    };
  }

  if (approval !== plan.plan_version) {
    throw new Error(`calibration execution requires explicit approval for ${plan.plan_version}`);
  }
  if (plan.status !== "calibration-frozen") {
    throw new Error("calibration execution requires a calibration-frozen plan");
  }
  if (typeof taskForPrompt !== "function") {
    throw new TypeError("taskForPrompt must be a function during execution");
  }
  if (typeof grader !== "function" || typeof parser !== "function") {
    throw new TypeError("grader and parser must be functions");
  }
  if (typeof runnerRevision !== "string" || runnerRevision.trim() === "") {
    throw new Error("runnerRevision is required during execution");
  }
  const preflight = requireValidatedLivePreflight({
    livePreflight,
    plan,
    selected,
    adapters,
    modelResolutions,
    runnerRevision,
  });
  requireRunStore(store);

  let attempts = store.listAttempts(BATCH_ID);
  let runs = store.listRuns(BATCH_ID);
  let checkpoint = store.readCheckpoint(BATCH_ID);
  let skippedCompleted = 0;
  let stopReason = null;

  const retained = validateRetainedLedger({
    plan,
    prompts: selected,
    attempts,
    runs,
    checkpoint,
    expectedRunnerRevision: runnerRevision,
  });
  if (retained.failures.length > 0) {
    throw new Error(`retained ledger is invalid:\n- ${retained.failures.join("\n- ")}`);
  }

  if (retained.in_flight_attempt !== null) {
    if (retained.in_flight_resolved) {
      writeProgressCheckpoint({
        plan,
        store,
        clock,
        stopReason: null,
        runnerRevision,
        inFlightAttempt: null,
      });
      checkpoint = store.readCheckpoint(BATCH_ID);
    } else {
      stopReason = "unresolved-in-flight-intent";
    }
  }
  if (stopReason === null) {
    stopReason = budgetStopReason({ attempts, preflight });
  }
  if (stopReason === null && attempts.length >= ATTEMPT_CAP) {
    stopReason = "attempt-cap";
  }

  for (const prompt of selected) {
    if (stopReason !== null) break;
    if (runs.some((run) => run.run_id === prompt.run_id)) {
      skippedCompleted += 1;
      continue;
    }

    let runAttempts = attempts.filter((attempt) => attempt.run_id === prompt.run_id);
    const recovered = recoverRetainedAttempt({
      plan,
      prompt,
      runAttempts,
      store,
      taskForPrompt,
      grader,
      parser,
      runnerRevision,
    });
    if (recovered.stopReason !== null) {
      stopReason = recovered.stopReason;
      runs = store.listRuns(BATCH_ID);
      break;
    }
    if (recovered.completed) {
      runs = store.listRuns(BATCH_ID);
      writeProgressCheckpoint({
        plan,
        store,
        clock,
        stopReason,
        runnerRevision,
      });
      attempts = store.listAttempts(BATCH_ID);
      stopReason = budgetStopReason({ attempts, preflight });
      continue;
    }

    while (!store.listRuns(BATCH_ID).some((run) => run.run_id === prompt.run_id)) {
      attempts = store.listAttempts(BATCH_ID);
      runAttempts = attempts.filter((attempt) => attempt.run_id === prompt.run_id);
      if (attempts.length >= ATTEMPT_CAP) {
        stopReason = "attempt-cap";
        break;
      }
      stopReason = budgetStopReason({ attempts, preflight });
      if (stopReason !== null) break;

      const attemptNumber = runAttempts.length + 1;
      const startedAt = clock();
      let modelResolution;
      let task;
      try {
        modelResolution = resolutionForPrompt(prompt, modelResolutions);
        task = taskForPrompt(prompt);
        validateTaskIdentity(prompt, task);
      } catch (error) {
        const endedAt = clock();
        const attempt = attemptRecord({
          plan,
          prompt,
          attemptNumber,
          startedAt,
          endedAt,
          status: "implementation-defect",
          providerCall: false,
          error: safeError(error),
          runnerRevision,
        });
        store.appendAttempt(attempt);
        appendImplementationDefect({
          plan,
          prompt,
          store,
          reason: error instanceof Error ? error.message : String(error),
          clock,
          runnerRevision,
        });
        stopReason = "implementation-defect";
        break;
      }

      const intent = inFlightAttemptRecord({
        plan,
        prompt,
        attemptNumber,
        startedAt,
        runnerRevision,
      });
      writeProgressCheckpoint({
        plan,
        store,
        clock,
        stopReason: null,
        runnerRevision,
        inFlightAttempt: intent,
      });

      let rawResponse;
      try {
        rawResponse = await adapters[prompt.target.provider].execute({ prompt, modelResolution });
      } catch (error) {
        const endedAt = clock();
        if (error instanceof ProviderTransportError) {
          store.appendAttempt(attemptRecord({
            plan,
            prompt,
            attemptNumber,
            startedAt,
            endedAt,
            status: "transport-error",
            providerCall: true,
            error: safeError(error),
            runnerRevision,
          }));
          writeProgressCheckpoint({
            plan,
            store,
            clock,
            stopReason: null,
            runnerRevision,
          });
          if (attemptNumber === 1 && store.listAttempts(BATCH_ID).length < ATTEMPT_CAP) {
            continue;
          }
          if (attemptNumber === 1) {
            stopReason = "attempt-cap";
            break;
          }
          appendTerminalFailure({
            plan,
            prompt,
            store,
            transportStatus: "transport-error",
            reason: error.message,
            failureCategory: "transport-error",
            clock,
            runnerRevision,
          });
          break;
        }

        if (error instanceof ProviderResponseError) {
          store.appendAttempt(attemptRecord({
            plan,
            prompt,
            attemptNumber,
            startedAt,
            endedAt,
            status: "provider-error",
            providerCall: true,
            error: safeError(error),
            runnerRevision,
          }));
          writeProgressCheckpoint({
            plan,
            store,
            clock,
            stopReason: null,
            runnerRevision,
          });
          appendTerminalFailure({
            plan,
            prompt,
            store,
            transportStatus: "provider-error",
            reason: error.message,
            failureCategory: error.category ?? "provider-error",
            providerRequestId: error.provider_request_id ?? null,
            stopReason: error.stop_reason ?? null,
            rawResponse: error.response_body ?? null,
            clock,
            runnerRevision,
          });
          if (IMMEDIATE_PROVIDER_STOPS.has(error.stop_reason)
              || IMMEDIATE_PROVIDER_STOPS.has(error.category)) {
            stopReason = error.stop_reason ?? error.category;
          }
          break;
        }

        store.appendAttempt(attemptRecord({
          plan,
          prompt,
          attemptNumber,
          startedAt,
          endedAt,
          status: "implementation-defect",
          providerCall: true,
          error: safeError(error),
          runnerRevision,
        }));
        writeProgressCheckpoint({
          plan,
          store,
          clock,
          stopReason: null,
          runnerRevision,
        });
        appendImplementationDefect({
          plan,
          prompt,
          store,
          reason: error instanceof Error ? error.message : String(error),
          clock,
          runnerRevision,
        });
        stopReason = "implementation-defect";
        break;
      }

      let response;
      try {
        response = snapshotJson(rawResponse, "adapter response");
        validateAdapterResponse(response);
        validateResponseUsage(response);
      } catch (error) {
        const endedAt = clock();
        store.appendAttempt(attemptRecord({
          plan,
          prompt,
          attemptNumber,
          startedAt,
          endedAt,
          status: "implementation-defect",
          providerCall: true,
          error: safeError(error),
          runnerRevision,
        }));
        writeProgressCheckpoint({
          plan,
          store,
          clock,
          stopReason: null,
          runnerRevision,
        });
        appendImplementationDefect({
          plan,
          prompt,
          store,
          reason: error instanceof Error ? error.message : String(error),
          clock,
          runnerRevision,
        });
        stopReason = "implementation-defect";
        break;
      }

      const endedAt = clock();
      const attempt = attemptRecord({
        plan,
        prompt,
        attemptNumber,
        startedAt,
        endedAt,
        status: "response",
        providerCall: true,
        response,
        runnerRevision,
      });
      store.appendAttempt(attempt);
      writeProgressCheckpoint({
        plan,
        store,
        clock,
        stopReason: null,
        runnerRevision,
      });

      const evaluationState = { parsed: null };
      try {
        validateExecutedModel(response, modelResolution);
        finalizeResponse({
          plan,
          prompt,
          attempt,
          response,
          store,
          task,
          grader,
          parser,
          runnerRevision,
          evaluationState,
        });
      } catch (error) {
        appendImplementationDefect({
          plan,
          prompt,
          store,
          reason: error instanceof Error ? error.message : String(error),
          clock,
          runnerRevision,
          response,
          responseAttempt: attempt,
          parsed: evaluationState.parsed,
        });
        stopReason = "implementation-defect";
        break;
      }

      attempts = store.listAttempts(BATCH_ID);
      stopReason = budgetStopReason({ attempts, preflight });
      break;
    }

    runs = store.listRuns(BATCH_ID);
    writeProgressCheckpoint({
      plan,
      store,
      clock,
      stopReason,
      runnerRevision,
    });
  }

  attempts = store.listAttempts(BATCH_ID);
  runs = store.listRuns(BATCH_ID);
  checkpoint = store.readCheckpoint(BATCH_ID);
  const completedRunIds = distinctValidatedRuns({ plan, runs, plannedPrompts: selected })
    .map((run) => run.run_id);
  const status = stopReason !== null
    ? "stopped"
    : completedRunIds.length === selected.length
      ? "complete"
      : "open";
  const finalCheckpoint = checkpointRecord({
    plan,
    status,
    stopReason,
    attemptCount: effectiveAttemptCount(attempts, checkpoint?.in_flight_attempt ?? null),
    completedRunIds,
    inFlightAttempt: checkpoint?.in_flight_attempt ?? null,
    runnerRevision,
    updatedAt: clock(),
  });
  store.writeCheckpoint(BATCH_ID, finalCheckpoint);

  return {
    checkpoint: finalCheckpoint,
    report: buildCalibrationReport({
      plan,
      store,
      status,
      stopReason,
      skippedCompleted,
      adapters,
      plannedPrompts: selected,
    }),
  };
}

export function buildCalibrationReport({
  plan,
  store = null,
  status = "pending",
  stopReason = null,
  skippedCompleted = 0,
  adapters = {},
  plannedPrompts = null,
} = {}) {
  validateCalibrationPlan(plan);
  const attempts = store ? store.listAttempts(BATCH_ID) : [];
  const runs = store ? store.listRuns(BATCH_ID) : [];
  const checkpoint = store ? store.readCheckpoint(BATCH_ID) : null;
  const validatedRuns = distinctValidatedRuns({ plan, runs, plannedPrompts });
  const usage = validatedRuns.reduce((total, run) => {
    total.input_tokens += finiteToken(run.usage?.input_tokens);
    total.output_tokens += finiteToken(run.usage?.output_tokens);
    total.total_tokens += finiteToken(run.usage?.total_tokens);
    return total;
  }, { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  const apiKeyPresence = {};
  [...new Set(plan.targets.map((target) => target.provider))].sort().forEach((provider) => {
    apiKeyPresence[provider] = adapters[provider]?.api_key_status === "present"
      ? "present"
      : "absent";
  });

  return {
    report_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: BATCH_ID,
    status,
    stop_reason: stopReason,
    request_ceiling: CALIBRATION_REQUESTS,
    attempt_ceiling: ATTEMPT_CAP,
    provider_calls: attempts.filter((attempt) => attempt.provider_call === true).length
      + unresolvedIntentCount(attempts, checkpoint?.in_flight_attempt ?? null),
    counts: {
      planned: plannedPrompts?.length ?? CALIBRATION_REQUESTS,
      attempts: effectiveAttemptCount(attempts, checkpoint?.in_flight_attempt ?? null),
      completed: validatedRuns.length,
      skipped_completed: skippedCompleted,
      remaining: Math.max(0, CALIBRATION_REQUESTS - validatedRuns.length),
      exceptional_runs: validatedRuns.filter((run) => isExceptionalRun(run)).length,
      implementation_defects: validatedRuns
        .filter((run) => run.implementation_defect === true).length,
    },
    usage,
    targets: plan.targets.map((target) => ({
      target_id: target.id,
      provider: target.provider,
    })),
    api_key_presence: apiKeyPresence,
    runner_revisions: [...new Set(
      [...attempts, ...validatedRuns]
        .map((record) => record.runner_revision)
        .filter((value) => typeof value === "string" && value !== ""),
    )].sort(),
  };
}

export function buildRunnerRevision({
  rootDir = REPOSITORY_ROOT,
  files = CALIBRATION_RUNNER_REVISION_FILES,
} = {}) {
  if (typeof rootDir !== "string" || rootDir.trim() === "") {
    throw new TypeError("rootDir must be a non-empty string");
  }
  if (!Array.isArray(files) || files.length === 0
      || files.some((file) => typeof file !== "string" || file.trim() === "")) {
    throw new TypeError("files must be a non-empty string array");
  }
  const hash = crypto.createHash("sha256");
  [...files].sort().forEach((file) => {
    hash.update(file);
    hash.update("\0");
    hash.update(fs.readFileSync(path.resolve(rootDir, file)));
    hash.update("\0");
  });
  return `sha256:${hash.digest("hex")}`;
}

function validateCalibrationPlan(plan) {
  if (!plan || typeof plan !== "object") throw new TypeError("plan must be an object");
  if (plan.benchmark_id !== "docai-http-openapi-comparison-v3") {
    throw new Error("runner requires the v3 benchmark identity");
  }
  if (plan.plan_version !== "3.0.0-calibration.1") {
    throw new Error("runner requires plan version 3.0.0-calibration.1");
  }
  if (plan.calibration?.planned_requests !== CALIBRATION_REQUESTS) {
    throw new Error(`runner requires a ${CALIBRATION_REQUESTS}-request calibration`);
  }
  if (plan.calibration?.maximum_attempts_per_work_step !== ATTEMPT_CAP) {
    throw new Error(`runner requires the ${ATTEMPT_CAP}-attempt hard cap`);
  }
  if (!Array.isArray(plan.targets) || plan.targets.length !== 3) {
    throw new Error("runner requires exactly three calibration targets");
  }
}

function validateAdaptersForPlan(plan, adapters, { requireExecute }) {
  for (const target of plan.targets) {
    const adapter = adapters[target.provider];
    if (!adapter || adapter.provider !== target.provider) {
      throw new Error(`missing ${target.provider} adapter`);
    }
    if (!['present', 'absent'].includes(adapter.api_key_status)) {
      throw new Error(`${target.provider} adapter must expose API-key presence only`);
    }
    if (requireExecute && typeof adapter.execute !== "function") {
      throw new Error(`${target.provider} adapter execute function is required`);
    }
  }
}

function requireValidatedLivePreflight({
  livePreflight,
  plan,
  selected,
  adapters,
  modelResolutions,
  runnerRevision,
}) {
  const metadata = VALIDATED_PREFLIGHTS.get(livePreflight);
  if (!metadata) throw new Error("execution requires a validated Live preflight");
  const identities = selected.map(promptIdentity);
  if (livePreflight.benchmark_id !== plan.benchmark_id
      || livePreflight.plan_version !== plan.plan_version
      || metadata.runner_revision !== runnerRevision
      || !isDeepStrictEqual(metadata.prompt_identities, identities)) {
    throw new Error("validated Live preflight does not match this calibration execution");
  }
  for (const target of plan.targets) {
    if (adapters[target.provider]?.api_key_status !== "present") {
      throw new Error(`${target.provider} API key is required for Live calibration`);
    }
  }
  const normalizedModels = normalizeModelResolutions(plan, modelResolutions);
  if (!isDeepStrictEqual(metadata.model_resolutions, normalizedModels)) {
    throw new Error("validated Live preflight model resolutions changed before execution");
  }
  return metadata;
}

function normalizeModelResolutions(plan, modelResolutions) {
  const entries = Array.isArray(modelResolutions)
    ? modelResolutions.map((resolution) => [resolution?.target_id, resolution])
    : Object.entries(modelResolutions ?? {});
  const normalized = Object.create(null);
  for (const [key, resolution] of entries) {
    if (typeof key !== "string" || key === "" || Object.hasOwn(normalized, key)) {
      throw new Error("model resolutions must contain unique target IDs");
    }
    normalized[key] = resolution;
  }

  const expectedIds = plan.targets.map((target) => target.id).sort();
  if (!isDeepStrictEqual(Object.keys(normalized).sort(), expectedIds)) {
    const missing = expectedIds.find((targetId) => !Object.hasOwn(normalized, targetId));
    if (missing) throw new Error(`missing model resolution for target ${missing}`);
    throw new Error("model resolutions contain an unknown calibration target");
  }

  for (const target of plan.targets) {
    const resolution = normalized[target.id];
    if (!resolution || typeof resolution !== "object" || Array.isArray(resolution)
        || resolution.target_id !== target.id || resolution.provider !== target.provider) {
      throw new Error(`invalid model resolution for target ${target.id}`);
    }
    for (const field of ["requested_model", "resolved_model"]) {
      if (typeof resolution[field] !== "string" || resolution[field].trim() === "") {
        throw new Error(`model resolution ${target.id} requires ${field}`);
      }
    }
    if (plan.status === "calibration-frozen"
        && (typeof target.model_id !== "string" || target.model_id.trim() === "")) {
      throw new Error(`frozen plan target ${target.id} requires model_id`);
    }
    if (typeof target.model_id === "string"
        && resolution.requested_model !== target.model_id) {
      throw new Error(`model resolution ${target.id} requested_model must match frozen plan model_id`);
    }
    if (typeof target.model_id === "string"
        && resolution.resolved_model !== target.model_id) {
      throw new Error(`model resolution ${target.id} resolved_model must match frozen plan model_id`);
    }
    const pricing = resolution.pricing_usd_per_million_tokens;
    if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)
        || !isNonnegativeFiniteNumber(pricing.input)
        || !isNonnegativeFiniteNumber(pricing.output)) {
      throw new Error(`model resolution ${target.id} requires numeric input/output pricing`);
    }
    validateModelRequestSettings(target, resolution.request_settings);
  }
  return snapshotJson(normalized, "model resolutions");
}

function validateModelRequestSettings(target, settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error(`model resolution ${target.id} requires request settings`);
  }
  if (settings.json_output_mode !== "prompt-only"
      || settings.sampling_parameters !== "omitted"
      || settings.max_output_tokens !== 8192
      || settings.tools !== false) {
    throw new Error(`model resolution ${target.id} does not match frozen request settings`);
  }
  if (target.provider === "openai" && settings.reasoning_effort !== "medium") {
    throw new Error(`model resolution ${target.id} requires medium reasoning effort`);
  }
  if (target.provider === "anthropic" && settings.thinking !== "adaptive") {
    throw new Error(`model resolution ${target.id} requires adaptive thinking`);
  }
  if (target.provider === "google"
      && (settings.thinking_level !== "medium" || settings.grounding !== false)) {
    throw new Error(`model resolution ${target.id} requires medium thinking and disabled grounding`);
  }
}

function validateCostEstimate(plan, costEstimate) {
  if (!costEstimate || typeof costEstimate !== "object" || Array.isArray(costEstimate)
      || costEstimate.benchmark_id !== plan.benchmark_id
      || costEstimate.plan_version !== plan.plan_version) {
    throw new Error("cost estimate does not match the approved plan");
  }
  const calibration = costEstimate.calibration;
  if (!calibration || typeof calibration !== "object" || Array.isArray(calibration)
      || calibration.requests !== CALIBRATION_REQUESTS) {
    throw new Error(`cost estimate must cover exactly ${CALIBRATION_REQUESTS} calibration requests`);
  }
  if (!Number.isInteger(calibration.total_tokens_ceiling)
      || calibration.total_tokens_ceiling <= 0) {
    throw new Error("token ceiling must be a positive integer");
  }
  if (!Number.isFinite(calibration.cost_ceiling_usd)
      || calibration.cost_ceiling_usd <= 0) {
    throw new Error("cost ceiling must be a positive finite number");
  }
}

function promptIdentity(prompt) {
  return {
    run_id: prompt.run_id,
    calibration_ordinal: prompt.calibration_ordinal,
    batch_id: prompt.batch_id,
    repetition: prompt.repetition,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
  };
}

function requireRunStore(store) {
  for (const method of [
    "listAttempts",
    "listRuns",
    "appendAttempt",
    "appendRun",
    "readCheckpoint",
    "writeCheckpoint",
  ]) {
    if (typeof store?.[method] !== "function") throw new TypeError(`store.${method} is required`);
  }
}

export function validateRetainedLedger({
  plan,
  prompts,
  attempts = [],
  runs = [],
  checkpoint = null,
  expectedRunnerRevision = null,
} = {}) {
  const selected = selectCalibrationPrompts({ plan, prompts });
  const failures = [];
  if (!Array.isArray(attempts)) failures.push("retained attempts ledger must be an array");
  if (!Array.isArray(runs)) failures.push("retained runs ledger must be an array");
  if (!Array.isArray(attempts) || !Array.isArray(runs)) {
    return {
      failures,
      in_flight_attempt: null,
      in_flight_resolved: false,
      distinct_run_ids: [],
    };
  }
  if (expectedRunnerRevision !== null
      && (typeof expectedRunnerRevision !== "string" || expectedRunnerRevision.trim() === "")) {
    throw new TypeError("expectedRunnerRevision must be a non-empty string or null");
  }

  const expectedById = new Map(selected.map((prompt) => [prompt.run_id, prompt]));
  const attemptsByRun = new Map();
  const revisions = new Set();

  attempts.forEach((attempt, index) => {
    const label = `attempt ${index + 1}`;
    if (!isPlainJsonObject(attempt)) {
      failures.push(`${label} must be a plain object`);
      return;
    }
    const prompt = expectedById.get(attempt.run_id);
    if (!prompt) {
      failures.push(`${label} has unknown canonical run identity ${String(attempt.run_id)}`);
    } else {
      validateCanonicalIdentity({ plan, prompt, record: attempt, label, failures });
    }
    if (attempt.record_version !== "1") failures.push(`${label} record_version must be 1`);
    if (!ATTEMPT_STATUSES.has(attempt.status)) {
      failures.push(`${label} has invalid status ${String(attempt.status)}`);
    }
    if (!Number.isInteger(attempt.attempt_number) || attempt.attempt_number < 1) {
      failures.push(`${label} attempt_number must be a positive integer`);
    }
    const startedAt = Date.parse(attempt.started_at);
    const endedAt = Date.parse(attempt.ended_at);
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
      failures.push(`${label} requires ordered timestamps`);
    }
    if (typeof attempt.provider_call !== "boolean") {
      failures.push(`${label} provider_call must be boolean`);
    }
    if (["response", "transport-error", "provider-error"].includes(attempt.status)
        && attempt.provider_call !== true) {
      failures.push(`${label} status ${attempt.status} requires provider_call true`);
    }
    if (attempt.status === "response") {
      if (!isPlainJsonObject(attempt.response)) {
        failures.push(`${label} response status requires a response object`);
      } else {
        try {
          validateAdapterResponse(attempt.response);
          validateResponseUsage(attempt.response);
        } catch (error) {
          failures.push(`${label} has invalid retained response: ${error.message}`);
        }
      }
      if (attempt.error !== null) failures.push(`${label} response status requires error null`);
    } else {
      if (!isPlainJsonObject(attempt.error)) {
        failures.push(`${label} status ${String(attempt.status)} requires an error object`);
      }
      if (attempt.response !== null) {
        failures.push(`${label} status ${String(attempt.status)} requires response null`);
      }
    }
    validateRunnerRevision({
      revision: attempt.runner_revision,
      expectedRunnerRevision,
      label,
      failures,
      revisions,
    });
    if (!attemptsByRun.has(attempt.run_id)) attemptsByRun.set(attempt.run_id, []);
    attemptsByRun.get(attempt.run_id).push(attempt);
  });

  attemptsByRun.forEach((runAttempts, runId) => {
    const ordered = [...runAttempts].sort(compareAttemptNumbers);
    if (ordered.length > 2) failures.push(`${runId} exceeds one transport retry`);
    ordered.forEach((attempt, index) => {
      if (attempt.attempt_number !== index + 1) {
        failures.push(`${runId} attempt numbers must be contiguous from 1`);
      }
    });
    if (ordered.length > 1 && ordered[0].status !== "transport-error") {
      failures.push(`${runId} retried after a usable provider response`);
    }
  });

  const runsById = new Map();
  runs.forEach((run, index) => {
    const label = `run ${String(run?.run_id ?? index + 1)}`;
    if (!isPlainJsonObject(run)) {
      failures.push(`${label} must be a plain object`);
      return;
    }
    try {
      validateEvaluationRecord(run);
    } catch (error) {
      failures.push(`${label} is invalid: ${error.message}`);
    }
    const prompt = expectedById.get(run.run_id);
    if (!prompt) {
      failures.push(`${label} has unknown canonical run identity`);
    } else {
      validateCanonicalIdentity({ plan, prompt, record: run, label, failures });
    }
    if (runsById.has(run.run_id)) failures.push(`duplicate retained run ${run.run_id}`);
    else runsById.set(run.run_id, run);
    validateRunnerRevision({
      revision: run.runner_revision,
      expectedRunnerRevision,
      label,
      failures,
      revisions,
    });

    const runAttempts = [...(attemptsByRun.get(run.run_id) ?? [])].sort(compareAttemptNumbers);
    if (runAttempts.length === 0) {
      failures.push(`${label} has no retained attempt`);
      return;
    }
    if (run.attempt_count !== runAttempts.length) {
      failures.push(`${label} attempt_count does not match retained attempts`);
    }
    validateRunAttemptRelation({ run, attempts: runAttempts, label, failures });
  });

  const checkpointResult = validateRetainedCheckpoint({
    plan,
    checkpoint,
    attempts,
    attemptsByRun,
    runsById,
    expectedById,
    expectedRunnerRevision,
    revisions,
    failures,
  });
  if (revisions.size > 1) failures.push("retained ledger must use one runner revision");
  const countedAttempts = effectiveAttemptCount(attempts, checkpointResult.inFlightAttempt);
  if (countedAttempts > ATTEMPT_CAP) {
    failures.push(`retained ledger exceeds the ${ATTEMPT_CAP}-attempt hard cap`);
  }

  return {
    failures,
    in_flight_attempt: checkpointResult.inFlightAttempt,
    in_flight_resolved: checkpointResult.inFlightResolved,
    distinct_run_ids: [...runsById.keys()],
  };
}

function validateCanonicalIdentity({ plan, prompt, record, label, failures }) {
  const expected = {
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: BATCH_ID,
    run_id: prompt.run_id,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (record[field] !== value) {
      failures.push(`${label} ${field} does not match canonical ${field}`);
    }
  }
}

function validateRunnerRevision({
  revision,
  expectedRunnerRevision,
  label,
  failures,
  revisions,
}) {
  if (typeof revision !== "string" || revision.trim() === "") {
    failures.push(`${label} runner revision is required`);
    return;
  }
  revisions.add(revision);
  if (expectedRunnerRevision !== null && revision !== expectedRunnerRevision) {
    failures.push(`${label} runner revision does not match the expected runner revision`);
  }
}

function validateRunAttemptRelation({ run, attempts, label, failures }) {
  const latest = attempts.at(-1);
  if (latest.status === "response") {
    const expectedTransport = latest.response?.completion?.complete === true
      ? "completed"
      : "incomplete";
    if (run.transport_status !== expectedTransport) {
      failures.push(`${label} transport_status does not match its response attempt`);
    }
    return;
  }
  if (latest.status === "provider-error") {
    if (run.transport_status !== "provider-error" || run.implementation_defect !== false) {
      failures.push(`${label} does not match its terminal provider-error attempt`);
    }
    return;
  }
  if (latest.status === "transport-error") {
    if (attempts.length !== 2 || run.transport_status !== "transport-error"
        || run.implementation_defect !== false) {
      failures.push(`${label} does not match its terminal transport retry sequence`);
    }
    return;
  }
  if (latest.status === "implementation-defect"
      && (run.implementation_defect !== true || run.transport_status !== "blocked")) {
    failures.push(`${label} does not match its implementation-defect attempt`);
  }
}

function validateRetainedCheckpoint({
  plan,
  checkpoint,
  attempts,
  attemptsByRun,
  runsById,
  expectedById,
  expectedRunnerRevision,
  revisions,
  failures,
}) {
  if (checkpoint === null) {
    if (attempts.length > 0 || runsById.size > 0) {
      failures.push("retained logs exist without a calibration checkpoint");
    }
    return { inFlightAttempt: null, inFlightResolved: false };
  }
  if (!isPlainJsonObject(checkpoint)) {
    failures.push("retained checkpoint must be a plain object");
    return { inFlightAttempt: null, inFlightResolved: false };
  }
  if (checkpoint.checkpoint_version !== "1") {
    failures.push("retained checkpoint checkpoint_version must be 1");
  }
  for (const [field, value] of Object.entries({
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: BATCH_ID,
  })) {
    if (checkpoint[field] !== value) failures.push(`retained checkpoint ${field} mismatch`);
  }
  if (!["open", "stopped", "complete"].includes(checkpoint.status)) {
    failures.push(`retained checkpoint has invalid status ${String(checkpoint.status)}`);
  }
  if (!Array.isArray(checkpoint.completed_run_ids)
      || checkpoint.completed_run_ids.some((runId) => typeof runId !== "string")) {
    failures.push("retained checkpoint completed_run_ids must be a string array");
  } else {
    if (new Set(checkpoint.completed_run_ids).size !== checkpoint.completed_run_ids.length) {
      failures.push("retained checkpoint completed_run_ids must be unique");
    }
    if (!sameStringMembers(checkpoint.completed_run_ids, [...runsById.keys()])) {
      failures.push("retained checkpoint completed_run_ids do not match retained runs");
    }
  }
  if (!Number.isFinite(Date.parse(checkpoint.updated_at))) {
    failures.push("retained checkpoint updated_at must be an ISO-compatible timestamp");
  }
  validateRunnerRevision({
    revision: checkpoint.runner_revision,
    expectedRunnerRevision,
    label: "retained checkpoint",
    failures,
    revisions,
  });

  const inFlightAttempt = checkpoint.in_flight_attempt ?? null;
  const intentResult = validateInFlightAttempt({
    plan,
    intent: inFlightAttempt,
    attemptsByRun,
    runsById,
    expectedById,
    expectedRunnerRevision,
    revisions,
    failures,
  });
  const expectedAttemptCount = attempts.length + (intentResult.resolved ? 0 : inFlightAttempt === null ? 0 : 1);
  if (checkpoint.attempt_count !== expectedAttemptCount) {
    failures.push("retained checkpoint attempt_count does not match terminal and in-flight attempts");
  }
  if (checkpoint.status === "complete") {
    if (runsById.size !== CALIBRATION_REQUESTS) {
      failures.push(`complete checkpoint requires all ${CALIBRATION_REQUESTS} run records`);
    }
    if (inFlightAttempt !== null) failures.push("complete checkpoint cannot retain an in-flight attempt");
    if (checkpoint.stop_reason !== null) failures.push("complete checkpoint cannot have a stop reason");
  }
  if (checkpoint.status === "open" && checkpoint.stop_reason !== null) {
    failures.push("open checkpoint cannot have a stop reason");
  }
  if (checkpoint.status === "stopped"
      && (typeof checkpoint.stop_reason !== "string" || checkpoint.stop_reason === "")) {
    failures.push("stopped checkpoint requires a stop reason");
  }
  return {
    inFlightAttempt,
    inFlightResolved: intentResult.resolved,
  };
}

function validateInFlightAttempt({
  plan,
  intent,
  attemptsByRun,
  runsById,
  expectedById,
  expectedRunnerRevision,
  revisions,
  failures,
}) {
  if (intent === null) return { resolved: false };
  if (!isPlainJsonObject(intent)) {
    failures.push("retained in-flight attempt must be a plain object");
    return { resolved: false };
  }
  const prompt = expectedById.get(intent.run_id);
  if (!prompt) failures.push(`retained in-flight attempt has unknown identity ${String(intent.run_id)}`);
  else validateCanonicalIdentity({
    plan,
    prompt,
    record: intent,
    label: "retained in-flight attempt",
    failures,
  });
  if (intent.intent_version !== "1") {
    failures.push("retained in-flight attempt intent_version must be 1");
  }
  if (!Number.isInteger(intent.attempt_number) || intent.attempt_number < 1
      || intent.attempt_number > 2) {
    failures.push("retained in-flight attempt attempt_number must be 1 or 2");
  }
  if (!Number.isFinite(Date.parse(intent.started_at))) {
    failures.push("retained in-flight attempt started_at must be an ISO-compatible timestamp");
  }
  validateRunnerRevision({
    revision: intent.runner_revision,
    expectedRunnerRevision,
    label: "retained in-flight attempt",
    failures,
    revisions,
  });

  const runAttempts = [...(attemptsByRun.get(intent.run_id) ?? [])].sort(compareAttemptNumbers);
  const terminal = runAttempts.find((attempt) => attempt.attempt_number === intent.attempt_number);
  if (terminal) {
    if (terminal.started_at !== intent.started_at) {
      failures.push("retained in-flight attempt does not match its terminal attempt timestamp");
    }
    return { resolved: true };
  }
  if (runsById.has(intent.run_id)) {
    failures.push("retained in-flight attempt belongs to an already completed run");
  }
  if (intent.attempt_number !== runAttempts.length + 1) {
    failures.push("retained in-flight attempt does not follow its terminal attempt sequence");
  }
  if (intent.attempt_number === 2 && runAttempts[0]?.status !== "transport-error") {
    failures.push("retained in-flight retry does not follow a transport error");
  }
  return { resolved: false };
}

function compareAttemptNumbers(left, right) {
  return left.attempt_number - right.attempt_number;
}

function isPlainJsonObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameStringMembers(left, right) {
  return isDeepStrictEqual([...left].sort(), [...right].sort());
}

function recoverRetainedAttempt({
  plan,
  prompt,
  runAttempts,
  store,
  taskForPrompt,
  grader,
  parser,
  runnerRevision,
}) {
  if (runAttempts.length === 0) return { completed: false, stopReason: null };
  const ordered = [...runAttempts].sort((left, right) => left.attempt_number - right.attempt_number);
  if (ordered.length > 2 || ordered.some((attempt, index) => attempt.attempt_number !== index + 1)) {
    throw new Error(`retained attempts for ${prompt.run_id} violate retry sequencing`);
  }
  if (ordered.length === 2 && ordered[0].status !== "transport-error") {
    throw new Error(`retained attempts for ${prompt.run_id} retry a usable response`);
  }
  const latest = ordered.at(-1);
  if (latest.status === "response") {
    const evaluationState = { parsed: null };
    try {
      const task = taskForPrompt(prompt);
      validateTaskIdentity(prompt, task);
      finalizeResponse({
        plan,
        prompt,
        attempt: latest,
        response: latest.response,
        store,
        task,
        grader,
        parser,
        runnerRevision,
        evaluationState,
      });
      return { completed: true, stopReason: null };
    } catch (error) {
      appendImplementationDefect({
        plan,
        prompt,
        store,
        reason: error instanceof Error ? error.message : String(error),
        clock: () => latest.ended_at,
        runnerRevision,
        response: latest.response,
        responseAttempt: latest,
        parsed: evaluationState.parsed,
      });
      return { completed: true, stopReason: "implementation-defect" };
    }
  }
  if (latest.status === "provider-error") {
    appendTerminalFailure({
      plan,
      prompt,
      store,
      transportStatus: "provider-error",
      reason: latest.error?.message ?? "retained provider error",
      failureCategory: latest.error?.category ?? "provider-error",
      providerRequestId: latest.error?.provider_request_id ?? null,
      stopReason: latest.error?.stop_reason ?? null,
      rawResponse: latest.error?.response_body ?? null,
      clock: () => latest.ended_at,
      runnerRevision,
    });
    const immediate = IMMEDIATE_PROVIDER_STOPS.has(latest.error?.stop_reason)
      || IMMEDIATE_PROVIDER_STOPS.has(latest.error?.category);
    return {
      completed: true,
      stopReason: immediate ? latest.error.stop_reason ?? latest.error.category : null,
    };
  }
  if (latest.status === "implementation-defect") {
    appendImplementationDefect({
      plan,
      prompt,
      store,
      reason: latest.error?.message ?? "retained implementation defect",
      clock: () => latest.ended_at,
      runnerRevision,
    });
    return { completed: true, stopReason: "implementation-defect" };
  }
  if (latest.status === "transport-error" && ordered.length === 2) {
    appendTerminalFailure({
      plan,
      prompt,
      store,
      transportStatus: "transport-error",
      reason: latest.error?.message ?? "transport failed before a usable response",
      failureCategory: "transport-error",
      clock: () => latest.ended_at,
      runnerRevision,
    });
    return { completed: true, stopReason: null };
  }
  return { completed: false, stopReason: null };
}

function finalizeResponse({
  plan,
  prompt,
  attempt,
  response,
  store,
  task,
  grader,
  parser,
  runnerRevision,
  evaluationState = null,
}) {
  validateAdapterResponse(response);
  const incomplete = response.completion.complete !== true;
  const parsed = parser(response.content_text, { incomplete });
  if (evaluationState !== null) evaluationState.parsed = parsed;
  const grade = grader({ parsed, task, condition: prompt.condition });
  const record = validateEvaluationRecord({
    ...recordIdentity(plan, prompt),
    attempt_count: attempt.attempt_number,
    transport_status: incomplete ? "incomplete" : "completed",
    format_status: parsed.format_status,
    contract_status: grade.contract_status,
    accuracy_status: grade.accuracy_status,
    uncertainty_status: grade.uncertainty_status,
    failure_categories: grade.failure_categories,
    reasons: grade.reasons,
    manual_review_required: grade.manual_review_required,
    implementation_defect: false,
    content_text: response.content_text,
    content_json: parsed.content_json,
    raw_response: response.raw_response ?? null,
    parse_error: parsed.parse_error,
    usage: response.usage ?? null,
    resolved_model: response.resolved_model ?? null,
    provider_request_id: response.provider_request_id ?? null,
    stop_reason: response.completion.stop_reason ?? null,
    started_at: attempt.started_at,
    ended_at: attempt.ended_at,
    runner_revision: runnerRevision,
  });
  store.appendRun(record);
}

function validateAdapterResponse(response) {
  if (!response || typeof response !== "object") {
    throw new Error("adapter response must be an object");
  }
  if (typeof response.content_text !== "string") {
    throw new Error("adapter response content_text must be a string");
  }
  if (!response.completion || typeof response.completion.complete !== "boolean") {
    throw new Error("adapter response completion.complete must be a boolean");
  }
}

function validateResponseUsage(response) {
  if (!isPlainJsonObject(response.usage)) {
    throw new Error("adapter response usage must be an object for budget enforcement");
  }
  for (const field of ["input_tokens", "output_tokens", "total_tokens"]) {
    if (!Number.isFinite(response.usage[field]) || response.usage[field] < 0) {
      throw new Error(`adapter response usage.${field} must be a nonnegative finite number`);
    }
  }
  if (response.usage.total_tokens < response.usage.input_tokens + response.usage.output_tokens) {
    throw new Error("adapter response usage.total_tokens cannot be less than input plus output tokens");
  }
}

function validateExecutedModel(response, modelResolution) {
  if (response.resolved_model !== modelResolution.resolved_model) {
    throw new Error(
      `provider resolved model ${String(response.resolved_model)} does not match frozen model ${modelResolution.resolved_model}`,
    );
  }
}

function appendTerminalFailure({
  plan,
  prompt,
  store,
  transportStatus,
  reason,
  failureCategory,
  providerRequestId = null,
  stopReason = null,
  rawResponse = null,
  clock,
  runnerRevision,
}) {
  const attempts = store.listAttempts(BATCH_ID).filter((attempt) => attempt.run_id === prompt.run_id);
  const startedAt = attempts[0]?.started_at ?? clock();
  const endedAt = attempts.at(-1)?.ended_at ?? clock();
  store.appendRun(validateEvaluationRecord({
    ...recordIdentity(plan, prompt),
    attempt_count: attempts.length,
    transport_status: transportStatus,
    format_status: "empty",
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    failure_categories: [failureCategory],
    reasons: [reason],
    manual_review_required: false,
    implementation_defect: false,
    content_text: null,
    content_json: null,
    raw_response: rawResponse,
    parse_error: null,
    usage: null,
    resolved_model: null,
    provider_request_id: providerRequestId,
    stop_reason: stopReason,
    started_at: startedAt,
    ended_at: endedAt,
    runner_revision: runnerRevision,
  }));
}

function appendImplementationDefect({
  plan,
  prompt,
  store,
  reason,
  clock,
  runnerRevision,
  response = null,
  responseAttempt = null,
  parsed = null,
}) {
  const attempts = store.listAttempts(BATCH_ID).filter((attempt) => attempt.run_id === prompt.run_id);
  const startedAt = attempts[0]?.started_at ?? clock();
  const endedAt = attempts.at(-1)?.ended_at ?? clock();
  const transportStatus = responseAttempt === null
    ? "blocked"
    : response?.completion?.complete === false
      ? "incomplete"
      : "completed";
  store.appendRun(validateEvaluationRecord({
    ...recordIdentity(plan, prompt),
    attempt_count: Math.max(1, attempts.length),
    transport_status: transportStatus,
    format_status: parsed?.format_status ?? (transportStatus === "incomplete" ? "incomplete" : "empty"),
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    failure_categories: ["implementation-defect"],
    reasons: [reason],
    manual_review_required: false,
    implementation_defect: true,
    content_text: response?.content_text ?? null,
    content_json: parsed?.content_json ?? null,
    raw_response: response?.raw_response ?? null,
    parse_error: parsed?.parse_error ?? null,
    usage: response?.usage ?? null,
    resolved_model: response?.resolved_model ?? null,
    provider_request_id: response?.provider_request_id ?? null,
    stop_reason: response?.completion?.stop_reason ?? "implementation-defect",
    started_at: startedAt,
    ended_at: endedAt,
    runner_revision: runnerRevision,
  }));
}

function attemptRecord({
  plan,
  prompt,
  attemptNumber,
  startedAt,
  endedAt,
  status,
  providerCall,
  response = null,
  error = null,
  runnerRevision,
}) {
  return snapshotJson({
    record_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: BATCH_ID,
    run_id: prompt.run_id,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
    attempt_number: attemptNumber,
    started_at: startedAt,
    ended_at: endedAt,
    status,
    provider_call: providerCall,
    response,
    error,
    runner_revision: runnerRevision,
  }, "attempt record");
}

function inFlightAttemptRecord({
  plan,
  prompt,
  attemptNumber,
  startedAt,
  runnerRevision,
}) {
  return snapshotJson({
    intent_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: BATCH_ID,
    run_id: prompt.run_id,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
    attempt_number: attemptNumber,
    started_at: startedAt,
    runner_revision: runnerRevision,
  }, "in-flight attempt");
}

function recordIdentity(plan, prompt) {
  return {
    record_version: "3",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    run_id: prompt.run_id,
    batch_id: BATCH_ID,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
  };
}

function resolutionForPrompt(prompt, modelResolutions) {
  const resolution = Array.isArray(modelResolutions)
    ? modelResolutions.find((candidate) => candidate.target_id === prompt.target.id)
    : modelResolutions?.[prompt.target.id];
  if (!resolution || resolution.target_id !== prompt.target.id
      || resolution.provider !== prompt.target.provider
      || typeof resolution.requested_model !== "string"
      || resolution.requested_model === "") {
    throw new Error(`missing model resolution for target ${prompt.target.id}`);
  }
  return snapshotJson(resolution, "model resolution");
}

function validateTaskIdentity(prompt, task) {
  if (!task || task.id !== prompt.task_id) {
    throw new Error(`task lookup mismatch for ${prompt.run_id}`);
  }
}

function checkpointRecord({
  plan,
  status,
  stopReason,
  attemptCount,
  completedRunIds,
  inFlightAttempt = null,
  runnerRevision = null,
  updatedAt,
}) {
  return {
    checkpoint_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: BATCH_ID,
    status,
    stop_reason: stopReason,
    attempt_count: attemptCount,
    completed_run_ids: [...completedRunIds],
    in_flight_attempt: inFlightAttempt === null
      ? null
      : snapshotJson(inFlightAttempt, "checkpoint in-flight attempt"),
    runner_revision: runnerRevision,
    updated_at: updatedAt,
  };
}

function writeProgressCheckpoint({
  plan,
  store,
  clock,
  stopReason,
  runnerRevision,
  inFlightAttempt = null,
}) {
  const attempts = store.listAttempts(BATCH_ID);
  const runs = store.listRuns(BATCH_ID);
  store.writeCheckpoint(BATCH_ID, checkpointRecord({
    plan,
    status: stopReason === null ? "open" : "stopped",
    stopReason,
    attemptCount: effectiveAttemptCount(attempts, inFlightAttempt),
    completedRunIds: [...new Set(runs.map((run) => run.run_id))],
    inFlightAttempt,
    runnerRevision,
    updatedAt: clock(),
  }));
}

function safeError(error) {
  const safe = {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  };
  for (const field of [
    "category",
    "retryable",
    "usable_response",
    "http_status",
    "stop_reason",
    "provider_request_id",
    "response_body",
  ]) {
    if (error && Object.hasOwn(error, field)) safe[field] = error[field];
  }
  return snapshotJson(safe, "error record");
}

function distinctValidatedRuns({ plan, runs, plannedPrompts = null }) {
  const canonicalPrompts = plannedPrompts ?? buildCalibrationSchedule(plan).map((row) => ({
    ...row,
    target: { id: row.target_id, provider: row.provider },
  }));
  const expectedById = new Map(canonicalPrompts.map((prompt) => [prompt.run_id, prompt]));
  const distinct = new Map();
  for (const run of runs) {
    validateEvaluationRecord(run);
    const prompt = expectedById.get(run.run_id);
    if (!prompt) throw new Error(`report run has unknown canonical identity ${run.run_id}`);
    const failures = [];
    validateCanonicalIdentity({ plan, prompt, record: run, label: `report run ${run.run_id}`, failures });
    if (failures.length > 0) throw new Error(failures.join("; "));
    if (distinct.has(run.run_id) && !isDeepStrictEqual(distinct.get(run.run_id), run)) {
      throw new Error(`report has conflicting duplicate run ${run.run_id}`);
    }
    if (!distinct.has(run.run_id)) distinct.set(run.run_id, run);
  }
  return [...distinct.values()];
}

function budgetStopReason({ attempts, preflight }) {
  let totalTokens = 0;
  let totalCostUsd = 0;
  for (const attempt of attempts) {
    if (attempt.status !== "response") continue;
    validateResponseUsage(attempt.response);
    const usage = attempt.response.usage;
    const resolution = preflight.model_resolutions[attempt.target_id];
    if (!resolution) throw new Error(`budget accounting lacks model resolution for ${attempt.target_id}`);
    const pricing = resolution.pricing_usd_per_million_tokens;
    totalTokens += usage.total_tokens;
    totalCostUsd += (
      usage.input_tokens * pricing.input + usage.output_tokens * pricing.output
    ) / 1_000_000;
  }
  if (totalTokens > preflight.token_ceiling) return "token-ceiling";
  if (totalCostUsd > preflight.cost_ceiling_usd) return "cost-ceiling";
  return null;
}

function effectiveAttemptCount(attempts, inFlightAttempt) {
  return attempts.length + unresolvedIntentCount(attempts, inFlightAttempt);
}

function unresolvedIntentCount(attempts, inFlightAttempt) {
  if (!inFlightAttempt || typeof inFlightAttempt !== "object") return 0;
  return attempts.some((attempt) => (
    attempt.run_id === inFlightAttempt.run_id
      && attempt.attempt_number === inFlightAttempt.attempt_number
  )) ? 0 : 1;
}

function isNonnegativeFiniteNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function finiteToken(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function appendJsonLine(file, value) {
  const snapshot = snapshotJson(value, "JSONL record");
  secureDirectory(path.dirname(file));
  if (fs.existsSync(file)) secureRegularFile(file);
  fs.appendFileSync(file, `${JSON.stringify(snapshot)}\n`, {
    encoding: "utf8",
    flag: "a",
    mode: 0o600,
  });
  secureRegularFile(file);
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  secureRegularFile(file);
  const text = fs.readFileSync(file, "utf8");
  if (text === "") return [];
  if (!text.endsWith("\n")) throw new Error(`JSONL file must end with a newline: ${file}`);
  return text.trimEnd().split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`invalid JSONL at ${file}:${index + 1}`);
    }
  });
}

function requireBatchId(batchId) {
  if (batchId !== BATCH_ID) throw new Error(`batch id must be ${BATCH_ID}`);
}

function snapshotJson(value, label) {
  return snapshotJsonValue(value, label, new WeakSet());
}

function snapshotJsonValue(value, label, ancestors) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${label} must contain only finite numbers`);
    return value;
  }
  if (typeof value !== "object") throw new TypeError(`${label} must be a JSON value`);
  if (ancestors.has(value)) throw new TypeError(`${label} must not contain cycles`);
  ancestors.add(value);

  let result;
  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value);
    const expected = [...Array(value.length).keys()].map(String).concat("length");
    if (!isDeepStrictEqual(keys, expected)) throw new TypeError(`${label} must contain dense JSON arrays`);
    result = value.map((item) => snapshotJsonValue(item, label, ancestors));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${label} must contain only plain objects`);
    }
    result = prototype === null ? Object.create(null) : {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new TypeError(`${label} must not contain symbol keys`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError(`${label} must contain enumerable data properties only`);
      }
      Object.defineProperty(result, key, {
        value: snapshotJsonValue(descriptor.value, label, ancestors),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  ancestors.delete(value);
  return result;
}

function initializePrivateDirectory(directory) {
  const absolute = path.resolve(directory);
  let nearestExisting = absolute;
  while (!fs.existsSync(nearestExisting)) {
    const parent = path.dirname(nearestExisting);
    if (parent === nearestExisting) break;
    nearestExisting = parent;
  }
  if (fs.existsSync(nearestExisting) && fs.lstatSync(nearestExisting).isSymbolicLink()) {
    throw new Error(`private path must not traverse a symlink: ${nearestExisting}`);
  }
  secureDirectory(absolute);
  return fs.realpathSync.native(absolute);
}

function secureDirectory(directory) {
  if (fs.existsSync(directory)) {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink()) throw new Error(`private path must not be a symlink: ${directory}`);
    if (!stat.isDirectory()) throw new Error(`private path must be a directory: ${directory}`);
  } else {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  fs.chmodSync(directory, 0o700);
}

function secureRegularFile(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`private file must not be a symlink: ${file}`);
  if (!stat.isFile()) throw new Error(`private path must be a regular file: ${file}`);
  fs.chmodSync(file, 0o600);
}
