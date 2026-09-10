import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, types } from "node:util";
import { fileURLToPath } from "node:url";

import { readTaskPacket } from "./contract.mjs";
import { deriveCanonicalRun, reconcileCalibrationEvidence, requireReconciliation, verifyCalibrationEvidence } from "./evidence-verifier.mjs";
import { buildCalibrationSchedule, PRIVATE_DIR, readPlan } from "./paths.mjs";
import { buildCalibrationPrompts, validatePromptRecord } from "./prompt.mjs";
import { isExceptionalRun } from "./record.mjs";
import { assertPlainJson, clonePlainJson } from "./strict-json.mjs";
import { ProviderResponseError, ProviderTransportError } from "./provider-errors.mjs";

const BATCH_ID = "calibration";
const REQUEST_COUNT = 24;
const ATTEMPT_CAP = 100;
const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(PACKAGE_DIR, "..", "..", "..", "..", "..", "..");
const APPROVED_PRIVATE_ROOT = path.resolve(PRIVATE_DIR);
const IMMEDIATE_PROVIDER_STOPS = new Set(["authentication_error", "billing_error", "model_unavailable"]);
const LIVE_PREFLIGHTS = new WeakMap();

export const CALIBRATION_RUNNER_REVISION_FILES = [
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/provider-errors.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/provider-adapter-utils.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/openai-adapter.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/anthropic-adapter.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/google-adapter.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/runner.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/evidence-verifier.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/parser.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/grader.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/prompt.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/record.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/contract.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/context.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/strict-json.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-plan.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/build-prompts.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-runs.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/run-calibration.mjs",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/plan.json",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/contracts.json",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/calibration-schedule.jsonl",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/continuity/tasks.json",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/private/prompts/calibration.jsonl",
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/private/contexts/calibration-metrics.json",
];

export class MemoryRunStore {
  constructor() { this.attempts = []; this.runs = []; this.checkpoints = new Map(); }
  listAttempts(batchId = BATCH_ID) { requireBatchId(batchId); return clonePlainJson(this.attempts, "memory attempts"); }
  listRuns(batchId = BATCH_ID) { requireBatchId(batchId); return clonePlainJson(this.runs, "memory runs"); }
  appendAttempt(record) { this.attempts.push(clonePlainJson(record, "attempt record")); }
  appendRun(record) { this.runs.push(clonePlainJson(record, "run record")); }
  readCheckpoint(batchId = BATCH_ID) { requireBatchId(batchId); return this.checkpoints.has(batchId) ? clonePlainJson(this.checkpoints.get(batchId), "checkpoint") : null; }
  writeCheckpoint(batchId, checkpoint) { requireBatchId(batchId); this.checkpoints.set(batchId, clonePlainJson(checkpoint, "checkpoint")); }
}

export class FileRunStore {
  constructor(input) {
    requirePlainOptions(input, "file store options", ["runsDir", "checkpointsDir"]);
    const { runsDir, checkpointsDir } = input;
    requirePath(runsDir, "runsDir"); requirePath(checkpointsDir, "checkpointsDir");
    const resolvedRunsDir = path.resolve(runsDir);
    const resolvedCheckpointsDir = path.resolve(checkpointsDir);
    assertApprovedPrivateStorePath(resolvedRunsDir);
    assertApprovedPrivateStorePath(resolvedCheckpointsDir);
    Object.defineProperties(this, {
      runsDir: { value: resolvedRunsDir, enumerable: true, writable: false, configurable: false },
      checkpointsDir: { value: resolvedCheckpointsDir, enumerable: true, writable: false, configurable: false },
    });
    inspectPrivateDirectory(this.runsDir);
    inspectPrivateDirectory(this.checkpointsDir);
  }
  initialize() {
    initializePrivateDirectory(this.runsDir);
    initializePrivateDirectory(path.join(this.runsDir, BATCH_ID));
    initializePrivateDirectory(this.checkpointsDir);
  }
  listAttempts(batchId = BATCH_ID) { return readJsonLines(this.readLogFile(batchId, "attempts.jsonl")); }
  listRuns(batchId = BATCH_ID) { return readJsonLines(this.readLogFile(batchId, "runs.jsonl")); }
  appendAttempt(record) { assertPlainJson(record, "attempt record"); appendJsonLine(this.writeLogFile(record.batch_id, "attempts.jsonl"), record); }
  appendRun(record) { assertPlainJson(record, "run record"); appendJsonLine(this.writeLogFile(record.batch_id, "runs.jsonl"), record); }
  readCheckpoint(batchId = BATCH_ID) {
    const state = inspectPrivateFile(this.checkpointsDir, [`${batchId}.json`]);
    if (state === null) return null;
    try { return JSON.parse(readPrivateUtf8File(state)); } catch { throw new Error(`invalid checkpoint JSON: ${state.file}`); }
  }
  writeCheckpoint(batchId, checkpoint) {
    requireBatchId(batchId);
    const value = clonePlainJson(checkpoint, "checkpoint");
    writeAtomicCheckpoint(preparePrivateFileForWrite(this.checkpointsDir, [`${batchId}.json`]), value);
  }
  readLogFile(batchId, name) { requireBatchId(batchId); return inspectPrivateFile(this.runsDir, [batchId, name]); }
  writeLogFile(batchId, name) { requireBatchId(batchId); return preparePrivateFileForWrite(this.runsDir, [batchId, name]); }
}

export function readApprovedPrivateUtf8File(input) {
  requirePlainOptions(input, "private read input", ["root", "segments"]);
  const { root, segments } = input;
  requirePath(root, "root");
  assertPlainJson(segments, "private read segments");
  if (!Array.isArray(segments) || segments.length === 0 || segments.some((segment) => typeof segment !== "string" || !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(segment))) {
    throw new TypeError("private read segments must be non-empty safe path segments");
  }
  const state = inspectPrivateFile(path.resolve(root), segments);
  if (state === null) throw new Error(`private file is absent: ${path.join(path.resolve(root), ...segments)}`);
  return readPrivateUtf8File(state);
}

export function selectCalibrationPrompts(input) {
  requirePlainOptions(input, "prompt selection input", ["plan", "prompts"]);
  const { plan, prompts } = input;
  assertPlainJson(plan, "plan"); assertPlainJson(prompts, "prompts");
  const expected = buildCalibrationSchedule(plan);
  if (prompts.length !== REQUEST_COUNT) throw new Error(`calibration requires exactly ${REQUEST_COUNT} prompts`);
  const selected = prompts.map((prompt) => validatePromptRecord(prompt)).sort((a, b) => a.calibration_ordinal - b.calibration_ordinal);
  if (new Set(selected.map((prompt) => prompt.run_id)).size !== REQUEST_COUNT) throw new Error("calibration prompts must have unique run identities");
  selected.forEach((prompt, index) => {
    const identity = { run_id: prompt.run_id, calibration_ordinal: prompt.calibration_ordinal, batch_id: prompt.batch_id, repetition: prompt.repetition, api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider, condition: prompt.condition };
    if (!isDeepStrictEqual(identity, expected[index])) throw new Error(`calibration prompt ${prompt.run_id} does not match canonical ordinal ${index + 1}`);
  });
  return selected;
}

export function validateLivePreflight(input) {
  requirePlainOptions(input, "Live preflight input", ["plan", "prompts", "adapters", "modelResolutions", "costEstimate", "freezeManifest", "validateFreezeArtifacts", "runnerRevision"]);
  const { plan, prompts, adapters, modelResolutions, costEstimate, freezeManifest, validateFreezeArtifacts, runnerRevision } = input;
  const selected = selectCalibrationPrompts({ plan, prompts });
  validateFrozenPlan(plan);
  const boundAdapters = validateAdapters(plan, adapters, true); requireRevision(runnerRevision);
  assertPlainJson(modelResolutions, "model resolutions"); assertPlainJson(costEstimate, "cost estimate"); assertPlainJson(freezeManifest, "freeze manifest");
  if (typeof validateFreezeArtifacts !== "function" || types.isProxy(validateFreezeArtifacts)) throw new TypeError("validateFreezeArtifacts must be a non-Proxy function");
  if (freezeManifest.benchmark_id !== plan.benchmark_id || freezeManifest.plan_version !== plan.plan_version || freezeManifest.status !== "frozen") throw new Error("freeze manifest does not match frozen calibration.2 plan");
  if (costEstimate.benchmark_id !== plan.benchmark_id || costEstimate.plan_version !== plan.plan_version || costEstimate.calibration?.requests !== REQUEST_COUNT || !Number.isFinite(costEstimate.calibration?.total_tokens_ceiling) || costEstimate.calibration.total_tokens_ceiling < 0 || !Number.isFinite(costEstimate.calibration?.cost_ceiling_usd) || costEstimate.calibration.cost_ceiling_usd < 0) throw new Error("cost estimate requires nonnegative numeric token and cost ceilings for the frozen 24-request calibration");
  validateModelResolutions(plan, modelResolutions);
  if (validateFreezeArtifacts({ plan, prompts: selected, modelResolutions, costEstimate, freezeManifest, runnerRevision }) !== true) throw new Error("freeze artifact validation failed");
  const capability = Object.freeze({ preflight_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, runner_revision: runnerRevision });
  LIVE_PREFLIGHTS.set(capability, Object.freeze({
    plan: clonePlainJson(plan, "frozen preflight plan"),
    prompts: clonePlainJson(selected, "frozen preflight prompts"),
    models: clonePlainJson(modelResolutions, "frozen preflight models"),
    adapters: boundAdapters,
    tokenCeiling: costEstimate.calibration.total_tokens_ceiling,
    costCeiling: costEstimate.calibration.cost_ceiling_usd,
    runnerRevision,
  }));
  return capability;
}
export const validateLiveCalibrationPreflight = validateLivePreflight;

export async function runApprovedCalibration(input) {
  requirePlainExecutionInput(input);
  const { plan, prompts, execute, approval, adapters, store, tasks, modelResolutions, clock, runnerRevision, livePreflight } = input;
  const selected = selectCalibrationPrompts({ plan, prompts });
  validateAdapterContainer(adapters);
  if (execute !== true) return { checkpoint: dryRunCheckpoint(plan, runnerRevision ?? "dry-run", clock), report: buildCalibrationReport({ plan, adapters, plannedPrompts: selected, status: "dry-run" }) };
  if (approval !== "3.0.0-calibration.2") throw new Error("calibration execution requires explicit approval for 3.0.0-calibration.2");
  requireRunStore(store); requireRevision(runnerRevision);
  if (typeof clock !== "function" || types.isProxy(clock)) throw new TypeError("clock must be a non-Proxy function");
  const evidencePlan = plan.status === "calibration-frozen" ? readPlan() : plan;
  const taskMap = taskMapFor(evidencePlan, tasks);
  let state = retainedState({ plan: evidencePlan, prompts: selected, taskMap, store, runnerRevision });
  const preflight = requireLivePreflight(livePreflight, plan, selected, modelResolutions, runnerRevision);
  if (state.reconciliation !== null) {
    initializeRunStore(store);
    state = applyRetainedReconciliation({ plan: evidencePlan, prompts: selected, taskMap, store, runnerRevision, reconciliation: state.reconciliation });
  }
  if (state.checkpoint?.in_flight_attempt != null) throw new Error("unresolved-in-flight-intent");
  let skippedCompleted = 0; let stopReason = null;
  for (let promptIndex = 0; promptIndex < selected.length; promptIndex += 1) {
    const prompt = selected[promptIndex];
    if (state.runs.some((run) => run.run_id === prompt.run_id)) { skippedCompleted += 1; continue; }
    if (state.attempts.length >= ATTEMPT_CAP) { stopReason = "attempt-cap"; break; }
    const retainedBudgetStop = budgetStopReason(state.attempts, preflight);
    if (retainedBudgetStop !== null) { stopReason = retainedBudgetStop; break; }
    const runAttempts = state.attempts.filter((attempt) => attempt.run_id === prompt.run_id);
    if (!(runAttempts.length === 0 || (runAttempts.length === 1 && runAttempts[0].status === "transport-error"))) throw new Error(`retained nonterminal attempt for ${prompt.run_id} cannot be resent`);
    const number = runAttempts.length + 1; const startedAt = timestamp(clock);
    initializeRunStore(store);
    writeCheckpoint(plan, store, state.attempts, state.runs, runnerRevision, clock, null, intentRecord(plan, prompt, number, startedAt, runnerRevision), startedAt);
    let terminal;
    try {
      const adapterResponse = await preflight.adapters[prompt.target.provider].execute({ prompt, modelResolution: modelResolutions[prompt.target.id] });
      terminal = responseAttempt(plan, prompt, number, startedAt, timestamp(clock), adapterResponse, runnerRevision);
    }
    catch (error) { terminal = error instanceof ProviderTransportError ? errorAttempt(plan, prompt, number, startedAt, timestamp(clock), "transport-error", true, error, runnerRevision) : error instanceof ProviderResponseError ? errorAttempt(plan, prompt, number, startedAt, timestamp(clock), "provider-error", true, error, runnerRevision) : errorAttempt(plan, prompt, number, startedAt, timestamp(clock), "implementation-defect", true, error, runnerRevision); }
    let budgetStop = null;
    if (terminal.status === "response") {
      const resolution = preflight.models[prompt.target.id];
      if (terminal.response.resolved_model !== resolution.resolved_model) terminal = errorAttempt(plan, prompt, number, startedAt, terminal.ended_at, "implementation-defect", true, new Error("provider resolved model does not match frozen model"), runnerRevision);
      else budgetStop = budgetStopReason([...state.attempts, terminal], preflight);
    }
    store.appendAttempt(terminal); state.attempts = store.listAttempts(BATCH_ID);
    if (terminal.status === "transport-error" && number === 1) { writeCheckpoint(plan, store, state.attempts, state.runs, runnerRevision, clock); state = retainedState({ plan: evidencePlan, prompts: selected, taskMap, store, runnerRevision }); promptIndex -= 1; continue; }
    const canonical = deriveCanonicalRun({ plan: evidencePlan, prompt, task: taskMap.get(prompt.task_id), attempts: state.attempts.filter((attempt) => attempt.run_id === prompt.run_id), runnerRevision });
    store.appendRun(canonical); state.runs = store.listRuns(BATCH_ID);
    const terminalStop = canonical.implementation_defect ? "implementation-defect" : budgetStop ?? (terminal.status === "provider-error" && IMMEDIATE_PROVIDER_STOPS.has(terminal.error.category) ? terminal.error.category : null);
    const nextCheckpoint = checkpointRecord(plan, terminalStop ? "stopped" : "open", terminalStop, state.attempts.length, state.runs.map((run) => run.run_id), null, runnerRevision, terminal.ended_at);
    const postAppendVerification = verifyCalibrationEvidence({ plan: evidencePlan, prompts: selected, tasks: [...taskMap.values()], attempts: state.attempts, runs: state.runs, checkpoint: nextCheckpoint, expectedRunnerRevision: runnerRevision });
    if (postAppendVerification.failures.length > 0) throw new Error(`post-append evidence verification failed:\n- ${postAppendVerification.failures.join("\n- ")}`);
    store.writeCheckpoint(BATCH_ID, nextCheckpoint);
    state = retainedState({ plan: evidencePlan, prompts: selected, taskMap, store, runnerRevision });
    state = retainedState({ plan: evidencePlan, prompts: selected, taskMap, store, runnerRevision });
    if (terminalStop) { stopReason = terminalStop; break; }
  }
  const completed = state.runs.map((run) => run.run_id); const status = stopReason ? "stopped" : completed.length === REQUEST_COUNT ? "complete" : "open";
  const final = checkpointRecord(plan, status, stopReason, state.attempts.length, completed, null, runnerRevision, timestamp(clock));
  const finalVerification = verifyCalibrationEvidence({ plan: evidencePlan, prompts: selected, tasks: [...taskMap.values()], attempts: state.attempts, runs: state.runs, checkpoint: final, expectedRunnerRevision: runnerRevision });
  if (finalVerification.failures.length > 0) throw new Error(`final checkpoint verification failed:\n- ${finalVerification.failures.join("\n- ")}`);
  initializeRunStore(store);
  store.writeCheckpoint(BATCH_ID, final);
  return { checkpoint: final, report: buildCalibrationReport({ plan, store, adapters: preflight.adapters, plannedPrompts: selected, status, stopReason, skippedCompleted }) };
}

export function validateRetainedLedger(input) {
  requirePlainOptions(input, "retained ledger input", ["plan", "prompts", "attempts", "runs", "checkpoint", "expectedRunnerRevision", "tasks"]);
  const { plan, prompts, attempts, runs, checkpoint, expectedRunnerRevision, tasks = canonicalTasks(plan) } = input;
  const result = verifyCalibrationEvidence({ plan, prompts, tasks, attempts, runs, checkpoint, expectedRunnerRevision });
  return { failures: result.failures, evidence: result.evidence, in_flight_attempt: checkpoint?.in_flight_attempt ?? null, distinct_run_ids: result.evidence?.runs.map((run) => run.run_id) ?? [] };
}

export function buildCalibrationReport(input) {
  requirePlainReportInput(input);
  const { plan, store = null, status = "pending", stopReason = null, skippedCompleted = 0, adapters = {}, plannedPrompts = null } = input;
  assertPlainJson(plan, "report plan");
  const selected = plannedPrompts === null ? selectCalibrationPrompts({ plan, prompts: buildCalibrationPrompts({ plan, packet: readTaskPacket(plan) }) }) : plannedPrompts;
  const attempts = store ? store.listAttempts(BATCH_ID) : []; const runs = store ? store.listRuns(BATCH_ID) : []; const checkpoint = store ? store.readCheckpoint(BATCH_ID) : null;
  const usage = runs.reduce((total, run) => { total.input_tokens += token(run.usage?.input_tokens); total.output_tokens += token(run.usage?.output_tokens); total.total_tokens += token(run.usage?.total_tokens); return total; }, { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  const apiKeyPresence = Object.fromEntries([...new Set(plan.targets.map((target) => target.provider))].sort().map((provider) => [provider, adapters[provider]?.api_key_status === "present" ? "present" : "absent"]));
  return { report_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: BATCH_ID, status, stop_reason: stopReason, request_ceiling: REQUEST_COUNT, attempt_ceiling: ATTEMPT_CAP, provider_calls: attempts.filter((attempt) => attempt.provider_call === true).length + (checkpoint?.in_flight_attempt ? 1 : 0), counts: { planned: selected.length, attempts: attempts.length + (checkpoint?.in_flight_attempt ? 1 : 0), completed: runs.length, skipped_completed: skippedCompleted, remaining: Math.max(0, REQUEST_COUNT - runs.length), exceptional_runs: runs.filter(isExceptionalRun).length, implementation_defects: runs.filter((run) => run.implementation_defect).length }, usage, targets: plan.targets.map((target) => ({ target_id: target.id, provider: target.provider })), api_key_presence: apiKeyPresence, runner_revisions: [...new Set([...attempts, ...runs].map((record) => record.runner_revision).filter((value) => typeof value === "string" && value !== ""))].sort() };
}

export function buildRunnerRevision(input = {}) {
  requirePlainOptions(input, "runner revision input", ["rootDir", "files"]);
  const { rootDir = REPOSITORY_ROOT, files = CALIBRATION_RUNNER_REVISION_FILES } = input;
  requirePath(rootDir, "rootDir"); assertPlainJson(files, "revision files");
  if (!Array.isArray(files) || files.length === 0 || files.some((file) => typeof file !== "string" || file === "")) throw new TypeError("files must be a non-empty string array");
  const hash = crypto.createHash("sha256"); [...files].sort().forEach((file) => { hash.update(file); hash.update("\0"); hash.update(fs.readFileSync(path.resolve(rootDir, file))); hash.update("\0"); }); return `sha256:${hash.digest("hex")}`;
}

function retainedState({ plan, prompts, taskMap, store, runnerRevision }) {
  let attempts = store.listAttempts(BATCH_ID); let runs = store.listRuns(BATCH_ID); let checkpoint = store.readCheckpoint(BATCH_ID);
  let result = verifyCalibrationEvidence({ plan, prompts, tasks: [...taskMap.values()], attempts, runs, checkpoint, expectedRunnerRevision: runnerRevision });
  if (result.failures.length > 0) {
    const reconciliation = reconcileCalibrationEvidence({ plan, prompts, tasks: [...taskMap.values()], attempts, runs, checkpoint, expectedRunnerRevision: runnerRevision });
    if (reconciliation.reconciliation === null) throw new Error(`retained ledger is invalid:\n- ${result.failures.join("\n- ")}`);
    return { attempts, runs, checkpoint, evidence: result.evidence, reconciliation: requireReconciliation(reconciliation.reconciliation) };
  }
  return { attempts, runs, checkpoint, evidence: result.evidence, reconciliation: null };
}
function applyRetainedReconciliation({ plan, prompts, taskMap, store, runnerRevision, reconciliation }) {
  reconciliation.runs_to_append.forEach((run) => store.appendRun(run));
  store.writeCheckpoint(BATCH_ID, reconciliation.checkpoint);
  const state = retainedState({ plan, prompts, taskMap, store, runnerRevision });
  if (state.reconciliation !== null) throw new Error("reconciliation did not produce a verified retained ledger");
  return state;
}
function initializeRunStore(store) { if (store instanceof FileRunStore) store.initialize(); }
function taskMapFor(plan, tasks) { assertPlainJson(tasks, "tasks"); const canonical = canonicalTasks(plan); if (!isDeepStrictEqual(tasks, canonical)) throw new Error("tasks must match the canonical calibration task packet"); return new Map(tasks.map((task) => [task.id, task])); }
function canonicalTasks(plan) { return readTaskPacket(plan).tasks.filter((task) => plan.calibration.task_ids.includes(task.id)); }
function validateFrozenPlan(plan) {
  assertPlainJson(plan, "frozen plan");
  const draft = readPlan();
  if (plan.status !== "calibration-frozen" || plan.benchmark_id !== draft.benchmark_id || plan.plan_version !== draft.plan_version || !Array.isArray(plan.targets) || plan.targets.length !== draft.targets.length) throw new Error("Live preflight requires a complete frozen calibration.2 plan");
  plan.targets.forEach((target, index) => {
    const expected = draft.targets[index];
    if (target.id !== expected.id || target.provider !== expected.provider || typeof target.model_id !== "string" || target.model_id === "") throw new Error("Live preflight requires exact frozen target models");
  });
}
function requireLivePreflight(capability, plan, selected, models, revision) {
  if (types.isProxy(capability) || !LIVE_PREFLIGHTS.has(capability)) throw new Error("execution requires a validated Live preflight capability");
  const bound = LIVE_PREFLIGHTS.get(capability);
  if (!isDeepStrictEqual(bound.plan, plan) || !isDeepStrictEqual(bound.prompts, selected) || !isDeepStrictEqual(bound.models, models) || bound.runnerRevision !== revision) throw new Error("validated Live preflight capability does not match execution inputs");
  return bound;
}
function validateAdapterContainer(adapters) {
  if (types.isProxy(adapters) || !adapters || typeof adapters !== "object" || Array.isArray(adapters) || Object.getPrototypeOf(adapters) !== Object.prototype) throw new TypeError("adapters must be a plain non-Proxy object");
  for (const key of Reflect.ownKeys(adapters)) {
    if (typeof key !== "string") throw new TypeError("adapters must not contain symbol keys");
    const descriptor = Object.getOwnPropertyDescriptor(adapters, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError(`adapters.${key} must be own enumerable data`);
  }
}
function validateAdapters(plan, adapters, requireExecute) {
  validateAdapterContainer(adapters);
  const snapshots = {};
  for (const target of plan.targets) {
    if (Object.hasOwn(snapshots, target.provider)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(adapters, target.provider);
    const adapter = descriptor?.value;
    if (types.isProxy(adapter) || !adapter || typeof adapter !== "object" || Array.isArray(adapter) || Object.getPrototypeOf(adapter) !== Object.prototype) throw new Error(`missing valid ${target.provider} adapter`);
    const provider = ownDataValue(adapter, "provider", `${target.provider} adapter`);
    const apiKeyStatus = ownDataValue(adapter, "api_key_status", `${target.provider} adapter`);
    const execute = ownDataValue(adapter, "execute", `${target.provider} adapter`);
    if (provider !== target.provider || apiKeyStatus !== "present") throw new Error(`validated ${target.provider} adapter requires an API key to be present`);
    if (requireExecute && (typeof execute !== "function" || types.isProxy(execute))) throw new Error(`${target.provider} adapter execute function is required`);
    snapshots[target.provider] = Object.freeze({ provider, api_key_status: apiKeyStatus, execute });
  }
  return Object.freeze(snapshots);
}
function ownDataValue(value, key, name) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor)) throw new TypeError(`${name}.${key} must be own data`);
  return descriptor.value;
}
function validateModelResolutions(plan, resolutions) { assertPlainJson(resolutions, "model resolutions"); if (!resolutions || typeof resolutions !== "object" || Array.isArray(resolutions)) throw new TypeError("model resolutions must be a plain object"); for (const target of plan.targets) { const resolution = resolutions[target.id]; const pricing = resolution?.pricing_usd_per_million_tokens; if (!resolution || resolution.target_id !== target.id || resolution.provider !== target.provider || resolution.requested_model !== target.model_id || resolution.resolved_model !== target.model_id || !pricing || !Number.isFinite(pricing.input) || pricing.input < 0 || !Number.isFinite(pricing.output) || pricing.output < 0) throw new Error(`missing exact priced model resolution for target ${target.id}`); } }
function budgetStopReason(attempts, preflight) { let tokens = 0; let cost = 0; for (const attempt of attempts) { if (attempt.status !== "response") continue; const usage = attempt.response.usage; const pricing = preflight.models[attempt.target_id].pricing_usd_per_million_tokens; tokens += usage.total_tokens; cost += (usage.input_tokens * pricing.input + usage.output_tokens * pricing.output) / 1_000_000; } return tokens >= preflight.tokenCeiling ? "token-ceiling" : cost >= preflight.costCeiling ? "cost-ceiling" : null; }
function responseAttempt(plan, prompt, number, startedAt, endedAt, response, revision) { try { assertPlainJson(response, "adapter response"); validateResponse(response); return attemptRecord(plan, prompt, number, startedAt, endedAt, "response", true, response, null, revision); } catch (error) { return errorAttempt(plan, prompt, number, startedAt, endedAt, "implementation-defect", true, error, revision); } }
function errorAttempt(plan, prompt, number, startedAt, endedAt, status, providerCall, error, revision) { return attemptRecord(plan, prompt, number, startedAt, endedAt, status, providerCall, null, safeError(error, status), revision); }
function attemptRecord(plan, prompt, number, startedAt, endedAt, status, providerCall, response, error, revision) { return clonePlainJson({ record_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: BATCH_ID, run_id: prompt.run_id, api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider, condition: prompt.condition, repetition: prompt.repetition, attempt_number: number, started_at: startedAt, ended_at: endedAt, status, provider_call: providerCall, response, error, runner_revision: revision }, "attempt record"); }
function intentRecord(plan, prompt, number, startedAt, revision) { return { intent_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: BATCH_ID, run_id: prompt.run_id, api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider, condition: prompt.condition, repetition: prompt.repetition, attempt_number: number, started_at: startedAt, runner_revision: revision }; }
function safeError(error, status) { const message = error instanceof Error ? error.message : "unexpected non-Error failure"; if (status === "transport-error") return { name: "ProviderTransportError", message, category: "transport_error", retryable: true, usable_response: false }; if (status === "provider-error") return { name: "ProviderResponseError", message, http_status: integerOrNull(error.http_status), category: providerCategory(error.category), stop_reason: stringOrNull(error.stop_reason), provider_request_id: stringOrNull(error.provider_request_id), response_body: jsonOrNull(error.response_body), retryable: false, usable_response: true }; return { name: providerErrorName(error), message }; }
function providerErrorName(error) { const name = error instanceof Error && typeof error.name === "string" ? error.name : "Error"; return ["ProviderTransportError", "ProviderResponseError"].includes(name) ? "Error" : name; }
function providerCategory(value) { return ["authentication_error", "billing_error", "rate_limit", "model_unavailable", "provider_error", "provider_response_format"].includes(value) ? value : "provider_error"; }
function integerOrNull(value) { return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null; } function stringOrNull(value) { return typeof value === "string" ? value : null; } function jsonOrNull(value) { try { return value === undefined ? null : clonePlainJson(value, "provider response body"); } catch { return null; } }
function validateResponse(response) { const keys = ["content_text", "completion", "usage", "resolved_model", "provider_request_id", "raw_response"]; if (Object.keys(response).length !== keys.length || keys.some((key) => !Object.hasOwn(response, key))) throw new Error("adapter response must have the canonical response fields"); if (typeof response.content_text !== "string" || !response.completion || typeof response.completion.complete !== "boolean" || !response.usage || !Number.isFinite(response.usage.input_tokens) || !Number.isFinite(response.usage.output_tokens) || !Number.isFinite(response.usage.total_tokens) || response.usage.total_tokens < response.usage.input_tokens + response.usage.output_tokens) throw new Error("adapter response is invalid for retained evidence"); }
function writeCheckpoint(plan, store, attempts, runs, revision, clock, stopReason = null, inFlightAttempt = null, updatedAt = null) { store.writeCheckpoint(BATCH_ID, checkpointRecord(plan, stopReason ? "stopped" : "open", stopReason, attempts.length + (inFlightAttempt ? 1 : 0), runs.map((run) => run.run_id), inFlightAttempt, revision, updatedAt ?? timestamp(clock))); }
function checkpointRecord(plan, status, stopReason, attemptCount, completed, inFlightAttempt, revision, updatedAt) { return { checkpoint_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: BATCH_ID, status, stop_reason: stopReason, attempt_count: attemptCount, completed_run_ids: [...completed], in_flight_attempt: inFlightAttempt, runner_revision: revision, updated_at: updatedAt }; }
function dryRunCheckpoint(plan, revision, clock) { return checkpointRecord(plan, "dry-run", null, 0, [], null, revision, timestamp(clock ?? (() => new Date().toISOString()))); }
function requirePlainExecutionInput(value) { requirePlainOptions(value, "calibration execution input", ["plan", "prompts", "execute", "approval", "adapters", "store", "tasks", "modelResolutions", "clock", "runnerRevision", "livePreflight"]); for (const field of ["plan", "prompts", "execute", "approval", "tasks", "modelResolutions", "runnerRevision", "livePreflight"]) if (Object.hasOwn(value, field)) assertPlainJson(value[field], `calibration execution input.${field}`); for (const field of ["store", "clock", "adapters"]) if (Object.hasOwn(value, field) && types.isProxy(value[field])) throw new TypeError(`${field} must not be a Proxy`); }
function requirePlainReportInput(value) { if (types.isProxy(value)) throw new TypeError("report input must not be a Proxy"); if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("report input must be a plain object"); }
function requirePlainOptions(value, name, allowed) { if (types.isProxy(value)) throw new TypeError(`${name} must not be a Proxy`); if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(`${name} must be a plain object`); for (const key of Reflect.ownKeys(value)) { if (typeof key !== "string" || !allowed.includes(key)) throw new Error(`${name} has unknown option ${String(key)}`); const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError(`${name}.${key} must be own enumerable data`); } }
function requireRunStore(store) { if (!store || typeof store !== "object" || types.isProxy(store)) throw new TypeError("store must be a non-Proxy object"); for (const method of ["listAttempts", "listRuns", "appendAttempt", "appendRun", "readCheckpoint", "writeCheckpoint"]) if (typeof store[method] !== "function" || types.isProxy(store[method])) throw new TypeError(`store.${method} is required`); }
function requirePath(value, name) { if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`); } function requireRevision(value) { if (typeof value !== "string" || value.trim() === "") throw new TypeError("runnerRevision must be a non-empty string"); } function requireBatchId(value) { if (value !== BATCH_ID) throw new Error(`batch id must be ${BATCH_ID}`); } function timestamp(clock) { const value = clock(); if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("clock must return an ISO-compatible timestamp"); return value; } function token(value) { return Number.isFinite(value) && value >= 0 ? value : 0; }
function appendJsonLine(state, value) {
  const snapshot = clonePlainJson(value, "JSONL record");
  const fd = openPrivateFileForAppend(state);
  try {
    fs.writeSync(fd, `${JSON.stringify(snapshot)}\n`, null, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function readJsonLines(state) {
  if (state === null) return [];
  const text = readPrivateUtf8File(state);
  if (text === "") return [];
  if (!text.endsWith("\n")) throw new Error(`JSONL file must end with a newline: ${state.file}`);
  return text.trimEnd().split("\n").map((line, index) => {
    try {
      const value = JSON.parse(line);
      assertPlainJson(value, `JSONL ${state.file}:${index + 1}`);
      return value;
    } catch (error) {
      throw new Error(`invalid JSONL at ${state.file}:${index + 1}: ${error.message}`);
    }
  });
}
function inspectPrivateDirectory(directory) {
  assertApprovedPrivateStorePath(directory);
  assertNoSymlinkAncestry(directory);
  const stat = lstatOrNull(directory);
  if (stat === null) return null;
  assertPrivateDirectory(directory, stat);
  return { directory, stat };
}
function inspectPrivateFile(root, segments) {
  assertApprovedPrivateStorePath(root);
  assertNoSymlinkAncestry(root);
  let stat = lstatOrNull(root);
  if (stat === null) return null;
  assertPrivateDirectory(root, stat);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    stat = lstatOrNull(current);
    if (stat === null) return null;
    if (index === segments.length - 1) assertPrivateRegularFile(current, stat);
    else assertPrivateDirectory(current, stat);
  }
  return { file: current, stat };
}
function preparePrivateFileForWrite(root, segments) {
  assertApprovedPrivateStorePath(root);
  assertNoSymlinkAncestry(root);
  let stat = lstatOrNull(root);
  if (stat === null) throw new Error(`private directory is not initialized: ${root}`);
  assertPrivateDirectory(root, stat);
  let current = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    current = path.join(current, segments[index]);
    stat = lstatOrNull(current);
    if (stat === null) throw new Error(`private directory is not initialized: ${current}`);
    assertPrivateDirectory(current, stat);
  }
  const file = path.join(current, segments.at(-1));
  assertNoSymlinkAncestry(file);
  stat = lstatOrNull(file);
  if (stat !== null) assertPrivateRegularFile(file, stat);
  return { file, stat };
}
function initializePrivateDirectory(directory) {
  const absolute = path.resolve(directory);
  assertApprovedPrivateStorePath(absolute);
  assertNoSymlinkAncestry(absolute);
  const stat = lstatOrNull(absolute);
  if (stat !== null) {
    assertPrivateDirectory(absolute, stat);
    return;
  }
  fs.mkdirSync(absolute, { recursive: true, mode: 0o700 });
  const created = lstatOrNull(absolute);
  if (created === null) throw new Error(`failed to initialize private directory: ${absolute}`);
  assertPrivateDirectory(absolute, created);
}
function lstatOrNull(file) {
  try { return fs.lstatSync(file); }
  catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function assertNoSymlinkAncestry(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = lstatOrNull(current);
    if (stat === null) return;
    if (stat.isSymbolicLink()) throw new Error(`private path must not traverse a symlink: ${current}`);
  }
}
function assertApprovedPrivateStorePath(directory) {
  const absolute = path.resolve(directory);
  const relative = path.relative(APPROVED_PRIVATE_ROOT, absolute);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`private store path must be below the approved private root: ${absolute}`);
  }
  assertNoWritableAncestry(absolute);
}
function assertNoWritableAncestry(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = lstatOrNull(current);
    if (stat === null) return;
    if (stat.isSymbolicLink()) throw new Error(`private path must not traverse a symlink: ${current}`);
    if ((stat.mode & 0o022) !== 0) throw new Error(`private path has group or other writable ancestry: ${current}`);
  }
}
function assertPrivateDirectory(directory, stat) {
  if (stat.isSymbolicLink()) throw new Error(`private path must not be a symlink: ${directory}`);
  if (!stat.isDirectory()) throw new Error(`private path must be a directory: ${directory}`);
  assertOwnedPrivateMode(directory, stat, 0o700, "directory");
}
function assertPrivateRegularFile(file, stat) {
  if (stat.isSymbolicLink()) throw new Error(`private file must not be a symlink: ${file}`);
  if (!stat.isFile()) throw new Error(`private path must be a regular file: ${file}`);
  assertOwnedPrivateMode(file, stat, 0o600, "file");
}
function assertOwnedPrivateMode(file, stat, expectedMode, kind) {
  const uid = currentUid();
  if (stat.uid !== uid) throw new Error(`private ${kind} must be owned by the current user: ${file}`);
  if ((stat.mode & 0o777) !== expectedMode) throw new Error(`private ${kind} has unsafe permissions: ${file}`);
}
function currentUid() {
  if (typeof process.getuid !== "function") throw new Error("private store requires a current user id");
  return process.getuid();
}
function openPrivateFileForAppend(state) {
  const flags = fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY | noFollowFlag();
  const fd = fs.openSync(state.file, flags, 0o600);
  try {
    assertPrivateDescriptor(state, fd);
    return fd;
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
}
function readPrivateUtf8File(state) {
  const fd = openExistingPrivateFile(state);
  try { return fs.readFileSync(fd, "utf8"); }
  finally { fs.closeSync(fd); }
}
function openExistingPrivateFile(state) {
  const fd = fs.openSync(state.file, fs.constants.O_RDONLY | noFollowFlag());
  try {
    assertPrivateDescriptor(state, fd);
    return fd;
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
}
function assertPrivateDescriptor(state, fd) {
  const descriptorStat = fs.fstatSync(fd);
  assertPrivateRegularFile(state.file, descriptorStat);
  const pathStat = lstatOrNull(state.file);
  if (pathStat === null || pathStat.isSymbolicLink() || !sameFile(pathStat, descriptorStat)) throw new Error(`private file changed while opening: ${state.file}`);
  if (state.stat !== null && !sameFile(state.stat, descriptorStat)) throw new Error(`private file changed before opening: ${state.file}`);
}
function sameFile(left, right) { return left.dev === right.dev && left.ino === right.ino; }
function noFollowFlag() { return Number.isInteger(fs.constants.O_NOFOLLOW) ? fs.constants.O_NOFOLLOW : 0; }
function writeAtomicCheckpoint(state, value) {
  const temporary = path.join(path.dirname(state.file), `.${path.basename(state.file)}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`);
  let temporaryCreated = false;
  let temporaryStat = null;
  try {
    const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollowFlag(), 0o600);
    temporaryCreated = true;
    try {
      temporaryStat = fs.fstatSync(fd);
      assertPrivateRegularFile(temporary, temporaryStat);
      fs.writeSync(fd, `${JSON.stringify(value, null, 2)}\n`, null, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, state.file);
    temporaryCreated = false;
    const final = { file: state.file, stat: temporaryStat };
    const finalFd = openExistingPrivateFile(final);
    try {
      const finalStat = fs.fstatSync(finalFd);
      if (!sameFile(temporaryStat, finalStat)) throw new Error(`checkpoint replacement identity mismatch: ${state.file}`);
    } finally {
      fs.closeSync(finalFd);
    }
    fsyncDirectory(path.dirname(state.file));
  } finally {
    if (temporaryCreated) removeTemporaryFile(temporary);
  }
}
function fsyncDirectory(directory) {
  let fd;
  try {
    fd = fs.openSync(directory, fs.constants.O_RDONLY | noFollowFlag());
    const stat = fs.fstatSync(fd);
    assertPrivateDirectory(directory, stat);
    fs.fsyncSync(fd);
  } catch (error) {
    if (!["EINVAL", "ENOTSUP", "EOPNOTSUPP"].includes(error?.code)) throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function removeTemporaryFile(file) {
  try { fs.unlinkSync(file); }
  catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
