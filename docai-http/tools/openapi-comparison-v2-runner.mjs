#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { gradeBenchmarkResponse } from "./openapi-comparison-v2-grader.mjs";
import {
  PRIMARY_PROMPTS_FILE,
  readPromptRecords,
} from "./openapi-comparison-v2-prompt.mjs";
import {
  BENCHMARK_DIR,
  readV2Plan,
} from "./openapi-comparison-v2-utils.mjs";
import {
  buildParityReport,
  readApiTaskPacket,
} from "./openapi-comparison-v2-context.mjs";
import {
  validateFrozenArtifacts,
  validateFrozenBenchmarkOutputs,
} from "./freeze-openapi-comparison-v2.mjs";
import {
  ProviderResponseError,
  ProviderTransportError,
} from "./openapi-comparison-v2-provider-errors.mjs";
import { createOpenAIAdapter } from "./openapi-comparison-v2-openai-adapter.mjs";
import { createAnthropicAdapter } from "./openapi-comparison-v2-anthropic-adapter.mjs";
import { createGoogleAdapter } from "./openapi-comparison-v2-google-adapter.mjs";

export {
  ProviderResponseError,
  ProviderTransportError,
};

const PRIVATE_RUNS_DIR = path.join(BENCHMARK_DIR, "private", "runs");
const REPOSITORY_ROOT = path.resolve(BENCHMARK_DIR, "..", "..", "..", "..");
const MANIFEST_FILE = path.join(BENCHMARK_DIR, "freeze-manifest.json");
const MODEL_RESOLUTIONS_FILE = path.join(BENCHMARK_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(BENCHMARK_DIR, "cost-estimate.json");
const RUNNER_REVISION_FILES = [
  "openapi-comparison-v2-runner.mjs",
  "openapi-comparison-v2-provider-errors.mjs",
  "openapi-comparison-v2-provider-adapter-utils.mjs",
  "openapi-comparison-v2-openai-adapter.mjs",
  "openapi-comparison-v2-anthropic-adapter.mjs",
  "openapi-comparison-v2-google-adapter.mjs",
  "check-openapi-comparison-v2-runs.mjs",
];
const TERMINAL_STATUSES = new Set(["pass", "fail", "blocked", "malformed", "inconclusive"]);
const IMMEDIATE_STOP_REASONS = new Set([
  "billing_error",
  "model_unavailable",
  "authentication_error",
]);

export function selectBatchPrompts({ plan, prompts, batchId }) {
  if (typeof batchId !== "string" || batchId.trim() === "" || batchId.includes(",")) {
    throw new Error("exactly one batch id is required");
  }
  if (plan?.status !== "frozen") throw new Error("runner requires a frozen plan");
  const batch = plan.execution?.batches?.find((candidate) => candidate.id === batchId);
  if (!batch) throw new Error(`unknown batch ${batchId}`);

  const selected = prompts
    .filter((prompt) => prompt.batch_id === batchId)
    .sort((left, right) => left.batch_ordinal - right.batch_ordinal);
  if (selected.length !== batch.planned_requests) {
    throw new Error(
      `batch ${batchId} requires ${batch.planned_requests} prompts; found ${selected.length}`,
    );
  }
  if (new Set(selected.map((prompt) => prompt.run_id)).size !== selected.length) {
    throw new Error(`batch ${batchId} prompt run IDs must be unique`);
  }
  selected.forEach((prompt) => {
    if (prompt.benchmark_id !== plan.benchmark_id || prompt.plan_version !== plan.plan_version) {
      throw new Error(`prompt ${prompt.run_id} does not match the frozen plan`);
    }
  });
  return selected;
}

export async function runApprovedBatch({
  plan,
  prompts,
  batchId,
  approvedBatchId,
  adapters,
  store,
  taskForPrompt,
  grader = gradeBenchmarkResponse,
  modelResolutions = null,
  priceByTarget = {},
  batchCostCeiling = null,
  clock = () => new Date().toISOString(),
  runnerRevision = null,
}) {
  if (approvedBatchId !== batchId) {
    throw new Error(`batch ${batchId} requires matching explicit approval`);
  }
  const selected = selectBatchPrompts({ plan, prompts, batchId });
  const batch = plan.execution.batches.find((candidate) => candidate.id === batchId);
  const maximumAttempts = plan.execution.maximum_attempts_per_work_step;
  const maximumTransportRetries = plan.retry_policy.maximum_transport_retries_per_run;
  const existingAttempts = store.listAttempts(batchId);
  const existingRuns = store.listRuns(batchId);
  assertValidExistingRecords(selected, existingAttempts, existingRuns);

  let attemptCount = existingAttempts.length;
  let skippedCompleted = 0;
  let stopReason = null;
  let rateLimits = existingAttempts.filter((attempt) => attempt.category === "rate_limit").length;
  let exceptionalOutputs = existingRuns.filter((run) => (
    run.status === "malformed" || run.status === "inconclusive"
  )).length;

  for (const prompt of selected) {
    if (hasTerminalRun(store, batchId, prompt.run_id)) {
      skippedCompleted += 1;
      continue;
    }
    if (attemptCount >= maximumAttempts) {
      stopReason = "attempt_cap";
      break;
    }

    const nonRetryable = latestNonRetryableAttempt(store, batchId, prompt.run_id);
    if (nonRetryable?.status === "runner_error") {
      stopReason = "fixture_or_grader_defect";
      break;
    }
    if (nonRetryable?.status === "provider_error") {
      appendBlockedRun({
        plan,
        prompt,
        batchId,
        store,
        clock,
        category: nonRetryable.category,
        reason: nonRetryable.error?.message ?? "retained provider error",
        runnerRevision,
      });
      if (nonRetryable.category === "rate_limit" && rateLimits >= 2) {
        stopReason = "repeated_rate_limit";
      } else if (IMMEDIATE_STOP_REASONS.has(nonRetryable.category)) {
        stopReason = nonRetryable.category;
      }
      if (stopReason) break;
      continue;
    }

    const recovered = latestUsableAttempt(store, batchId, prompt.run_id);
    if (recovered) {
      const recovery = finalizeProviderResponse({
        prompt,
        response: recovered.response,
        store,
        batchId,
        taskForPrompt,
        grader,
        clock,
        runnerRevision,
      });
      if (recovery.stopReason) {
        stopReason = recovery.stopReason;
        break;
      }
      if (["malformed", "inconclusive"].includes(recovery.run.status)) exceptionalOutputs += 1;
      if (exceedsExceptionalOutputLimit(exceptionalOutputs, batch.planned_requests, plan)) {
        stopReason = "malformed_plus_inconclusive_limit";
        break;
      }
      continue;
    }

    let transportRetries = store.listAttempts(batchId)
      .filter((attempt) => attempt.run_id === prompt.run_id && attempt.status === "transport_error")
      .length;

    while (!hasTerminalRun(store, batchId, prompt.run_id)) {
      if (attemptCount >= maximumAttempts) {
        stopReason = "attempt_cap";
        break;
      }
      const priorAttempts = store.listAttempts(batchId)
        .filter((attempt) => attempt.run_id === prompt.run_id);
      const attemptNumber = priorAttempts.length + 1;
      const startedAt = clock();
      const adapter = adapters[prompt.target.provider];
      if (!adapter || typeof adapter.execute !== "function") {
        stopReason = "fixture_or_grader_defect";
        break;
      }

      try {
        taskForPrompt(prompt);
        const response = await adapter.execute({
          prompt,
          modelResolution: resolutionForPrompt(prompt, modelResolutions),
        });
        const completedAt = clock();
        store.appendAttempt({
          record_version: "1",
          benchmark_id: plan.benchmark_id,
          plan_version: plan.plan_version,
          batch_id: batchId,
          run_id: prompt.run_id,
          attempt_number: attemptNumber,
          target_id: prompt.target.id,
          provider: prompt.target.provider,
          requested_model: prompt.target.planned_model,
          resolved_model: response.resolved_model ?? prompt.target.planned_model,
          started_at: startedAt,
          completed_at: completedAt,
          status: "response",
          category: null,
          provider_request_id: response.provider_request_id ?? null,
          response,
          runner_revision: runnerRevision,
        });
        attemptCount += 1;

        const finalized = finalizeProviderResponse({
          prompt,
          response,
          store,
          batchId,
          taskForPrompt,
          grader,
          clock,
          runnerRevision,
        });
        if (finalized.stopReason) {
          stopReason = finalized.stopReason;
          break;
        }
        if (["malformed", "inconclusive"].includes(finalized.run.status)) {
          exceptionalOutputs += 1;
        }
        if (exceedsExceptionalOutputLimit(exceptionalOutputs, batch.planned_requests, plan)) {
          stopReason = "malformed_plus_inconclusive_limit";
          break;
        }
        if (batchCostCeiling !== null) {
          const currentCost = buildBatchReport({
            plan,
            batchId,
            store,
            skippedCompleted,
            priceByTarget,
          }).cost_usd;
          const multiplier = 1 + plan.stop_rules.projected_spend_over_estimate_percent / 100;
          if (currentCost > batchCostCeiling * multiplier) {
            stopReason = "projected_spend_limit";
            break;
          }
        }
      } catch (error) {
        const completedAt = clock();
        if (error instanceof ProviderTransportError) {
          store.appendAttempt({
            record_version: "1",
            benchmark_id: plan.benchmark_id,
            plan_version: plan.plan_version,
            batch_id: batchId,
            run_id: prompt.run_id,
            attempt_number: attemptNumber,
            target_id: prompt.target.id,
            provider: prompt.target.provider,
            requested_model: prompt.target.planned_model,
            resolved_model: null,
            started_at: startedAt,
            completed_at: completedAt,
            status: "transport_error",
            category: "transport_error",
            error: safeError(error),
            runner_revision: runnerRevision,
          });
          attemptCount += 1;
          transportRetries += 1;
          if (transportRetries <= maximumTransportRetries && attemptCount < maximumAttempts) {
            continue;
          }
          appendBlockedRun({
            plan,
            prompt,
            batchId,
            store,
            clock,
            category: "transport_error",
            reason: error.message,
            runnerRevision,
          });
          break;
        }

        if (error instanceof ProviderResponseError) {
          store.appendAttempt({
            record_version: "1",
            benchmark_id: plan.benchmark_id,
            plan_version: plan.plan_version,
            batch_id: batchId,
            run_id: prompt.run_id,
            attempt_number: attemptNumber,
            target_id: prompt.target.id,
            provider: prompt.target.provider,
            requested_model: prompt.target.planned_model,
            resolved_model: null,
            started_at: startedAt,
            completed_at: completedAt,
            status: "provider_error",
            category: error.category,
            http_status: error.http_status,
            provider_request_id: error.provider_request_id,
            error: safeError(error),
            response_body: error.response_body,
            runner_revision: runnerRevision,
          });
          attemptCount += 1;
          appendBlockedRun({
            plan,
            prompt,
            batchId,
            store,
            clock,
            category: error.category,
            reason: error.message,
            runnerRevision,
          });
          if (error.category === "rate_limit") {
            rateLimits += 1;
            if (rateLimits >= 2) stopReason = "repeated_rate_limit";
          } else if (IMMEDIATE_STOP_REASONS.has(error.stop_reason)) {
            stopReason = error.stop_reason;
          }
          break;
        }

        store.appendAttempt({
          record_version: "1",
          benchmark_id: plan.benchmark_id,
          plan_version: plan.plan_version,
          batch_id: batchId,
          run_id: prompt.run_id,
          attempt_number: attemptNumber,
          target_id: prompt.target.id,
          provider: prompt.target.provider,
          requested_model: prompt.target.planned_model,
          resolved_model: null,
          started_at: startedAt,
          completed_at: completedAt,
          status: "runner_error",
          category: "fixture_or_grader_defect",
          error: safeError(error),
          runner_revision: runnerRevision,
        });
        attemptCount += 1;
        stopReason = "fixture_or_grader_defect";
        break;
      }
    }
    writeProgressCheckpoint({ plan, batchId, store, clock, stopReason });
    if (stopReason) break;
  }

  const runs = store.listRuns(batchId);
  const status = stopReason
    ? "stopped"
    : runs.length === selected.length
      ? "complete"
      : "open";
  const checkpoint = {
    checkpoint_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: batchId,
    status,
    stop_reason: stopReason,
    attempt_count: store.listAttempts(batchId).length,
    completed_run_ids: runs.map((run) => run.run_id),
    updated_at: clock(),
  };
  store.writeCheckpoint(batchId, checkpoint);

  const report = buildBatchReport({
    plan,
    batchId,
    store,
    skippedCompleted,
    priceByTarget,
  });
  if (typeof store.writeReport === "function") store.writeReport(batchId, report);
  return { checkpoint, report };
}

export function buildBatchReport({
  plan,
  batchId,
  store,
  skippedCompleted = 0,
  priceByTarget = {},
}) {
  const attempts = store.listAttempts(batchId);
  const runs = store.listRuns(batchId);
  const usage = attempts
    .filter((attempt) => attempt.status === "response")
    .reduce((total, attempt) => addUsage(total, attempt.response?.usage), emptyUsage());
  const cost = attempts
    .filter((attempt) => attempt.status === "response")
    .reduce((total, attempt) => {
      const price = priceByTarget[attempt.target_id];
      if (!price) return total;
      const input = attempt.response?.usage?.input_tokens ?? 0;
      const output = attempt.response?.usage?.output_tokens ?? 0;
      return total + ((input * price.input) + (output * price.output)) / 1_000_000;
    }, 0);
  const batchIndex = plan.execution.batches.findIndex((batch) => batch.id === batchId);
  const counts = {
    attempted: attempts.length,
    provider_responses: attempts.filter((attempt) => attempt.status === "response").length,
    transport_errors: attempts.filter((attempt) => attempt.status === "transport_error").length,
    provider_errors: attempts.filter((attempt) => attempt.status === "provider_error").length,
    retried_attempts: attempts.filter((attempt) => attempt.attempt_number > 1).length,
    completed: runs.length,
  };
  for (const status of TERMINAL_STATUSES) {
    counts[status] = runs.filter((run) => run.status === status).length;
  }
  return {
    report_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: batchId,
    counts,
    skipped_completed: skippedCompleted,
    usage,
    cost_usd: roundUsd(cost),
    resolved_models: [...new Set(
      attempts.map((attempt) => attempt.resolved_model).filter(Boolean),
    )].sort(),
    runner_revisions: [...new Set(
      [...attempts, ...runs].map((record) => record.runner_revision).filter(Boolean),
    )].sort(),
    started_at: minimumTimestamp(attempts.map((attempt) => attempt.started_at)),
    ended_at: maximumTimestamp(attempts.map((attempt) => attempt.completed_at)),
    status: store.readCheckpoint(batchId)?.status ?? "pending",
    stop_reason: store.readCheckpoint(batchId)?.stop_reason ?? null,
    remaining_batches: plan.execution.batches.slice(batchIndex + 1).map((batch) => batch.id),
  };
}

export class MemoryRunStore {
  constructor() {
    this.attempts = [];
    this.runs = [];
    this.checkpoints = new Map();
    this.reports = new Map();
  }

  listAttempts(batchId) {
    return this.attempts
      .filter((attempt) => attempt.batch_id === batchId)
      .map((attempt) => structuredClone(attempt));
  }

  listRuns(batchId) {
    return this.runs
      .filter((run) => run.batch_id === batchId)
      .map((run) => structuredClone(run));
  }

  appendAttempt(record) {
    this.attempts.push(structuredClone(record));
  }

  appendRun(record) {
    this.runs.push(structuredClone(record));
  }

  readCheckpoint(batchId) {
    return this.checkpoints.has(batchId) ? structuredClone(this.checkpoints.get(batchId)) : null;
  }

  writeCheckpoint(batchId, checkpoint) {
    this.checkpoints.set(batchId, structuredClone(checkpoint));
  }

  writeReport(batchId, report) {
    this.reports.set(batchId, structuredClone(report));
  }

  readReport(batchId) {
    return this.reports.has(batchId) ? structuredClone(this.reports.get(batchId)) : null;
  }
}

export class FileRunStore {
  constructor(rootDirectory) {
    this.rootDirectory = rootDirectory;
  }

  listAttempts(batchId) {
    return readJsonLines(this.file(batchId, "attempts.jsonl"));
  }

  listRuns(batchId) {
    return readJsonLines(this.file(batchId, "runs.jsonl"));
  }

  appendAttempt(record) {
    appendJsonLine(this.file(record.batch_id, "attempts.jsonl"), record);
  }

  appendRun(record) {
    appendJsonLine(this.file(record.batch_id, "runs.jsonl"), record);
  }

  readCheckpoint(batchId) {
    const file = this.file(batchId, "checkpoint.json");
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  }

  writeCheckpoint(batchId, checkpoint) {
    atomicWriteJson(this.file(batchId, "checkpoint.json"), checkpoint);
  }

  writeReport(batchId, report) {
    atomicWriteJson(this.file(batchId, "report.json"), report);
  }

  readReport(batchId) {
    const file = this.file(batchId, "report.json");
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  }

  file(batchId, name) {
    if (!/^[a-z0-9-]+$/.test(batchId)) throw new Error(`invalid batch id ${batchId}`);
    return path.join(this.rootDirectory, batchId, name);
  }
}

function finalizeProviderResponse({
  prompt,
  response,
  store,
  batchId,
  taskForPrompt,
  grader,
  clock,
  runnerRevision,
}) {
  try {
    const grade = grader(response.content_json, taskForPrompt(prompt));
    const run = {
      run_record_version: "1",
      benchmark_id: prompt.benchmark_id,
      plan_version: prompt.plan_version,
      batch_id: batchId,
      run_id: prompt.run_id,
      api_id: prompt.api_id,
      task_id: prompt.task_id,
      target_id: prompt.target.id,
      provider: prompt.target.provider,
      requested_model: prompt.target.planned_model,
      resolved_model: response.resolved_model ?? prompt.target.planned_model,
      status: grade.status,
      reasons: [...(grade.reasons ?? [])],
      failure_categories: [...(grade.failure_categories ?? [])],
      manual_review_required: grade.manual_review_required === true,
      provider_request_id: response.provider_request_id ?? null,
      usage: response.usage ?? emptyUsage(),
      completed_at: clock(),
      runner_revision: runnerRevision,
    };
    store.appendRun(run);
    return { run, stopReason: null };
  } catch (error) {
    appendBlockedRun({
      plan: {
        benchmark_id: prompt.benchmark_id,
        plan_version: prompt.plan_version,
      },
      prompt,
      batchId,
      store,
      clock,
      category: "fixture_or_grader_defect",
      reason: error.message,
      runnerRevision,
    });
    return {
      run: store.listRuns(batchId).find((candidate) => candidate.run_id === prompt.run_id),
      stopReason: "fixture_or_grader_defect",
    };
  }
}

function appendBlockedRun({
  plan,
  prompt,
  batchId,
  store,
  clock,
  category,
  reason,
  runnerRevision,
}) {
  if (hasTerminalRun(store, batchId, prompt.run_id)) return;
  store.appendRun({
    run_record_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: batchId,
    run_id: prompt.run_id,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    requested_model: prompt.target.planned_model,
    resolved_model: null,
    status: "blocked",
    reasons: [reason],
    failure_categories: [category],
    manual_review_required: false,
    provider_request_id: null,
    usage: emptyUsage(),
    completed_at: clock(),
    runner_revision: runnerRevision,
  });
}

function resolutionForPrompt(prompt, modelResolutions) {
  return modelResolutions?.targets?.find((target) => target.target_id === prompt.target.id) ?? {
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    requested_model: prompt.target.planned_model,
    resolved_model: prompt.target.planned_model,
    request_settings: {
      json_output_mode: "prompt-only",
      max_output_tokens: 4096,
      sampling_parameters: "omitted",
    },
  };
}

function assertValidExistingRecords(selected, attempts, runs) {
  const runIds = new Set(selected.map((prompt) => prompt.run_id));
  attempts.forEach((attempt) => {
    if (!runIds.has(attempt.run_id)) throw new Error(`attempt has unknown run_id ${attempt.run_id}`);
  });
  const seenRuns = new Set();
  runs.forEach((run) => {
    if (!runIds.has(run.run_id)) throw new Error(`run record has unknown run_id ${run.run_id}`);
    if (!TERMINAL_STATUSES.has(run.status)) throw new Error(`run ${run.run_id} has invalid status`);
    if (seenRuns.has(run.run_id)) throw new Error(`duplicate run record ${run.run_id}`);
    seenRuns.add(run.run_id);
  });
}

function latestUsableAttempt(store, batchId, runId) {
  return store.listAttempts(batchId)
    .filter((attempt) => attempt.run_id === runId && attempt.status === "response")
    .at(-1) ?? null;
}

function latestNonRetryableAttempt(store, batchId, runId) {
  return store.listAttempts(batchId)
    .filter((attempt) => (
      attempt.run_id === runId
      && (attempt.status === "provider_error" || attempt.status === "runner_error")
    ))
    .at(-1) ?? null;
}

function hasTerminalRun(store, batchId, runId) {
  return store.listRuns(batchId).some((run) => (
    run.run_id === runId && TERMINAL_STATUSES.has(run.status)
  ));
}

function exceedsExceptionalOutputLimit(count, plannedRequests, plan) {
  const allowed = Math.floor(
    plannedRequests * plan.stop_rules.maximum_malformed_plus_inconclusive_percent / 100,
  );
  return count > allowed;
}

function writeProgressCheckpoint({ plan, batchId, store, clock, stopReason }) {
  const runs = store.listRuns(batchId);
  store.writeCheckpoint(batchId, {
    checkpoint_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: batchId,
    status: stopReason ? "stopped" : "open",
    stop_reason: stopReason,
    attempt_count: store.listAttempts(batchId).length,
    completed_run_ids: runs.map((run) => run.run_id),
    updated_at: clock(),
  });
}

function addUsage(total, usage = {}) {
  return {
    input_tokens: total.input_tokens + (usage.input_tokens ?? 0),
    output_tokens: total.output_tokens + (usage.output_tokens ?? 0),
    total_tokens: total.total_tokens + (
      usage.total_tokens ?? ((usage.input_tokens ?? 0) + (usage.output_tokens ?? 0))
    ),
  };
}

function emptyUsage() {
  return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
}

function roundUsd(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function minimumTimestamp(values) {
  return values.filter(Boolean).sort()[0] ?? null;
}

function maximumTimestamp(values) {
  return values.filter(Boolean).sort().at(-1) ?? null;
}

function safeError(error) {
  return {
    name: error?.name ?? "Error",
    message: String(error?.message ?? error).slice(0, 1000),
  };
}

function appendJsonLine(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "a" });
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8").trim();
  if (text === "") return [];
  return text.split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`invalid JSONL at ${file}:${index + 1}: ${error.message}`);
    }
  });
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function buildTaskLookup(plan) {
  const tasks = new Map();
  plan.apis.forEach((api) => {
    const packet = readApiTaskPacket(api, plan);
    packet.tasks.forEach((task) => tasks.set(`${api.id}\0${task.id}`, task));
  });
  return (prompt) => {
    const task = tasks.get(`${prompt.api_id}\0${prompt.task_id}`);
    if (!task) throw new Error(`task not found for ${prompt.api_id}/${prompt.task_id}`);
    return task;
  };
}

function createAdapters(modelResolutions) {
  return {
    openai: createOpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY }),
    anthropic: createAnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
    google: createGoogleAdapter({ apiKey: process.env.GOOGLE_API_KEY }),
  };
}

export function buildRunnerRevision({
  toolsDirectory = path.dirname(fileURLToPath(import.meta.url)),
} = {}) {
  const hash = crypto.createHash("sha256");
  RUNNER_REVISION_FILES.forEach((name) => {
    hash.update(`${name}\0`);
    hash.update(fs.readFileSync(path.join(toolsDirectory, name)));
    hash.update("\0");
  });
  return `sha256:${hash.digest("hex")}`;
}

async function runCli() {
  const batchId = optionValue("--batch");
  const approvedBatchId = optionValue("--approved-batch");
  if (!process.argv.includes("--execute") || !batchId || !approvedBatchId) {
    console.error(
      "Usage: openapi-comparison-v2-runner.mjs --execute --batch <id> --approved-batch <same-id>",
    );
    process.exitCode = 2;
    return;
  }
  if (process.env.DOCAI_LIVE_LLM_APPROVED_BATCH !== batchId) {
    throw new Error(
      `Set DOCAI_LIVE_LLM_APPROVED_BATCH=${batchId} only after explicit user approval`,
    );
  }

  const plan = readV2Plan();
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  validateFrozenBenchmarkOutputs({ plan });
  validateFrozenArtifacts({ plan, manifest, rootDir: REPOSITORY_ROOT });
  const parity = buildParityReport({ privateRequired: true });
  if (parity.status !== "pass") {
    throw new Error(
      `context parity failed for ${parity.summary.parity_failures} task(s)`,
    );
  }
  const prompts = readPromptRecords(PRIMARY_PROMPTS_FILE);
  const modelResolutions = JSON.parse(fs.readFileSync(MODEL_RESOLUTIONS_FILE, "utf8"));
  const costEstimate = JSON.parse(fs.readFileSync(COST_ESTIMATE_FILE, "utf8"));
  const batchEstimate = costEstimate.batches.find((batch) => batch.batch_id === batchId);
  if (!batchEstimate) throw new Error(`cost estimate missing batch ${batchId}`);
  const adapters = createAdapters(modelResolutions);
  const priceByTarget = Object.fromEntries(
    modelResolutions.targets.map((target) => [
      target.target_id,
      target.pricing_usd_per_million_tokens,
    ]),
  );
  const store = new FileRunStore(path.join(PRIVATE_RUNS_DIR, plan.plan_version));
  const result = await runApprovedBatch({
    plan,
    prompts,
    batchId,
    approvedBatchId,
    adapters,
    store,
    taskForPrompt: buildTaskLookup(plan),
    modelResolutions,
    priceByTarget,
    batchCostCeiling: batchEstimate.cost_ceiling_usd,
    runnerRevision: process.env.DOCAI_BENCHMARK_RUNNER_REVISION ?? buildRunnerRevision(),
  });
  console.log(JSON.stringify(result.report, null, 2));
  if (result.checkpoint.status !== "complete") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
