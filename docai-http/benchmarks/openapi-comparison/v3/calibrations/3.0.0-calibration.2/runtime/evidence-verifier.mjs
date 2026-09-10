import { isDeepStrictEqual } from "node:util";

import { readTaskPacket } from "./contract.mjs";
import { gradeParsedResponse } from "./grader.mjs";
import { validatePlan } from "./check-plan.mjs";
import { parseProviderText } from "./parser.mjs";
import { buildCalibrationPrompts } from "./prompt.mjs";
import { validateEvaluationRecord } from "./record.mjs";
import { assertPlainJson, clonePlainJson } from "./strict-json.mjs";

const VERIFIED_EVIDENCE = new WeakSet();
const RECONCILIATIONS = new WeakSet();
let CANONICAL_INPUTS = null;
const ATTEMPT_CAP = 100;
const ATTEMPT_STATUSES = new Set(["response", "transport-error", "provider-error", "implementation-defect"]);
const ATTEMPT_KEYS = [
  "record_version", "benchmark_id", "plan_version", "batch_id", "run_id", "api_id", "task_id",
  "target_id", "provider", "condition", "repetition", "attempt_number", "started_at", "ended_at",
  "status", "provider_call", "response", "error", "runner_revision",
];
const CHECKPOINT_KEYS = [
  "checkpoint_version", "benchmark_id", "plan_version", "batch_id", "status", "stop_reason",
  "attempt_count", "completed_run_ids", "in_flight_attempt", "runner_revision", "updated_at",
];
const INTENT_KEYS = [
  "intent_version", "benchmark_id", "plan_version", "batch_id", "run_id", "api_id", "task_id",
  "target_id", "provider", "condition", "repetition", "attempt_number", "started_at", "runner_revision",
];
const PROVIDER_ERROR_KEYS = [
  "name", "message", "http_status", "category", "stop_reason", "provider_request_id",
  "response_body", "retryable", "usable_response",
];
const TRANSPORT_ERROR_KEYS = ["name", "message", "category", "retryable", "usable_response"];
const IMPLEMENTATION_ERROR_KEYS = ["name", "message"];
const PROVIDER_ERROR_CATEGORIES = new Set([
  "authentication_error", "billing_error", "rate_limit", "model_unavailable", "provider_error",
  "provider_response_format",
]);

export function deriveCanonicalRun(input) {
  assertPlainJson(input, "canonical run input");
  requireExactKeys(input, "canonical run input", ["plan", "prompt", "task", "attempts", "runnerRevision"]);
  const { plan, prompt, task, attempts, runnerRevision } = input;
  validatePlan(plan);
  requireRunnerRevision(runnerRevision, "runnerRevision");
  const resolvedTask = canonicalTask(plan, task);
  validateCanonicalPrompt(plan, prompt);
  if (prompt.task_id !== resolvedTask.id) throw new Error("canonical prompt task_id must match task");
  validateCanonicalAttemptSequence(plan, prompt, attempts, runnerRevision);

  const terminal = attempts.at(-1);
  const startedAt = attempts[0].started_at;
  const identity = recordIdentity(plan, prompt, attempts.length, runnerRevision);
  if (terminal.status === "response") return deriveResponseRun(identity, prompt, resolvedTask, terminal, startedAt);
  if (terminal.status === "provider-error") return deriveProviderErrorRun(identity, terminal, startedAt);
  if (terminal.status === "transport-error") return deriveTransportErrorRun(identity, terminal, startedAt);
  return deriveImplementationDefectRun(identity, terminal, {}, startedAt);
}

export function verifyCalibrationEvidence(input) {
  let retained;
  try {
    assertPlainJson(input, "evidence input");
    requireExactKeys(input, "evidence input", [
      "plan", "prompts", "tasks", "attempts", "runs", "checkpoint", "expectedRunnerRevision",
    ]);
    retained = clonePlainJson(input, "evidence input");
  } catch (error) {
    return failed([`evidence input is invalid: ${message(error)}`]);
  }

  const failures = [];
  const { plan, prompts, tasks, attempts, runs, checkpoint, expectedRunnerRevision } = retained;
  try {
    validatePlan(plan);
    requireRunnerRevision(expectedRunnerRevision, "expectedRunnerRevision");
  } catch (error) {
    return failed([`evidence identity is invalid: ${message(error)}`]);
  }

  for (const [name, ledger] of Object.entries({ prompts, tasks, attempts, runs })) {
    if (!Array.isArray(ledger)) failures.push(`${name} must be an array`);
  }
  if (failures.length > 0) return failed(failures);

  const canonicalPrompts = buildCanonicalPrompts(plan, prompts, failures);
  const canonicalTasks = buildCanonicalTasks(plan, tasks, failures);
  const attemptsByRun = validateAttempts({ plan, prompts: canonicalPrompts, attempts, expectedRunnerRevision, failures });
  const retainedRuns = validateRuns({ plan, prompts: canonicalPrompts, runs, expectedRunnerRevision, failures });
  const unresolvedIntent = validateCheckpoint({
    plan, checkpoint, attempts, attemptsByRun, retainedRuns, expectedRunnerRevision, failures,
  });
  if (attempts.length + (unresolvedIntent ? 1 : 0) > ATTEMPT_CAP) {
    failures.push(`retained ledger exceeds the ${ATTEMPT_CAP}-attempt hard cap`);
  }

  const derivedRuns = [];
  for (const [runId, retainedRun] of retainedRuns) {
    const prompt = canonicalPrompts.get(runId);
    const runAttempts = attemptsByRun.get(runId) ?? [];
    if (!prompt || runAttempts.length === 0) {
      failures.push(`run ${runId} has no retained terminal attempt`);
      continue;
    }
    const terminal = runAttempts.at(-1);
    if (!isTerminalAttempt(terminal, runAttempts.length)) {
      failures.push(`run ${runId} is missing a terminal attempt`);
      continue;
    }
    const task = canonicalTasks.get(prompt.task_id);
    if (!task) {
      failures.push(`run ${runId} has no canonical task`);
      continue;
    }
    try {
      const derived = deriveCanonicalRun({
        plan,
        prompt,
        task,
        attempts: runAttempts,
        runnerRevision: expectedRunnerRevision,
      });
      derivedRuns.push(derived);
      if (!isDeepStrictEqual(retainedRun, derived)) failures.push(`run ${runId} derived run mismatch`);
    } catch (error) {
      failures.push(`run ${runId} cannot derive canonical record: ${message(error)}`);
    }
  }

  for (const [runId, runAttempts] of attemptsByRun) {
    const terminal = runAttempts.at(-1);
    if (isTerminalAttempt(terminal, runAttempts.length) && !retainedRuns.has(runId)) {
      failures.push(`terminal attempt for ${runId} is missing its retained run`);
    }
  }
  if (failures.length > 0) return failed(failures);

  const evidence = deepFreeze(clonePlainJson({
    evidence_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    runner_revision: expectedRunnerRevision,
    runs: derivedRuns.sort((left, right) => left.run_id.localeCompare(right.run_id)),
    checkpoint,
  }, "verified evidence"));
  VERIFIED_EVIDENCE.add(evidence);
  return { failures: [], evidence };
}

export function reconcileCalibrationEvidence(input) {
  let retained;
  try {
    assertPlainJson(input, "reconciliation input");
    requireExactKeys(input, "reconciliation input", ["plan", "prompts", "tasks", "attempts", "runs", "checkpoint", "expectedRunnerRevision"]);
    retained = clonePlainJson(input, "reconciliation input");
  } catch (error) { return { failures: [`reconciliation input is invalid: ${message(error)}`], evidence: null, reconciliation: null }; }
  const ordinary = verifyCalibrationEvidence(retained);
  if (ordinary.evidence !== null) return { failures: [], evidence: ordinary.evidence, reconciliation: null };
  if (!Array.isArray(retained.attempts) || !Array.isArray(retained.runs) || retained.checkpoint === null) return { failures: ordinary.failures, evidence: null, reconciliation: null };
  const runsById = new Map(retained.runs.map((run) => [run?.run_id, run]));
  const promptsById = new Map(retained.prompts.map((prompt) => [prompt?.run_id, prompt]));
  const tasksById = new Map(retained.tasks.map((task) => [task?.id, task]));
  const attemptsByRun = new Map();
  for (const attempt of retained.attempts) {
    if (!attempt || typeof attempt !== "object" || typeof attempt.run_id !== "string") return { failures: ordinary.failures, evidence: null, reconciliation: null };
    if (!attemptsByRun.has(attempt.run_id)) attemptsByRun.set(attempt.run_id, []);
    attemptsByRun.get(attempt.run_id).push(attempt);
  }
  const missingTerminalRuns = [];
  try {
    for (const [runId, attempts] of attemptsByRun) {
      attempts.sort((left, right) => left.attempt_number - right.attempt_number);
      const terminal = attempts.at(-1);
      if (!isTerminalAttempt(terminal, attempts.length) || runsById.has(runId)) continue;
      const prompt = promptsById.get(runId);
      const task = tasksById.get(prompt?.task_id);
      if (!prompt || !task) throw new Error(`missing canonical input for ${runId}`);
      missingTerminalRuns.push(deriveCanonicalRun({ plan: retained.plan, prompt, task, attempts, runnerRevision: retained.expectedRunnerRevision }));
    }
  } catch { return { failures: ordinary.failures, evidence: null, reconciliation: null }; }
  let crashWindow;
  try { crashWindow = canonicalCrashWindow(retained, attemptsByRun, missingTerminalRuns); }
  catch { return { failures: ordinary.failures, evidence: null, reconciliation: null }; }
  if (crashWindow === null) {
    return { failures: ordinary.failures, evidence: null, reconciliation: null };
  }
  const candidate = verifyCalibrationEvidence({ ...retained, runs: crashWindow.runs, checkpoint: crashWindow.checkpoint });
  if (candidate.evidence === null) return { failures: ordinary.failures, evidence: null, reconciliation: null };
  const reconciliation = deepFreeze({ runs_to_append: missingTerminalRuns, checkpoint: crashWindow.checkpoint });
  RECONCILIATIONS.add(reconciliation);
  return { failures: [], evidence: null, reconciliation };
}

function canonicalCrashWindow(retained, attemptsByRun, missingTerminalRuns) {
  if (missingTerminalRuns.length > 1) return null;
  const runIds = retained.runs.map((run) => run?.run_id);
  if (!runIds.every((value) => typeof value === "string") || new Set(runIds).size !== runIds.length) return null;
  const canonicalRunIds = canonicalInputs(retained.plan).prompts.map((prompt) => prompt.run_id);
  let affectedRunId;
  let predecessorRunIds;
  if (missingTerminalRuns.length === 1) {
    affectedRunId = missingTerminalRuns[0].run_id;
    const index = canonicalRunIds.indexOf(affectedRunId);
    if (index < 0) return null;
    predecessorRunIds = canonicalRunIds.slice(0, index);
    if (!isDeepStrictEqual(runIds, predecessorRunIds)) return null;
  } else {
    if (runIds.length === 0) return null;
    const index = runIds.length - 1;
    affectedRunId = runIds[index];
    predecessorRunIds = canonicalRunIds.slice(0, index);
    if (!isDeepStrictEqual(runIds, [...predecessorRunIds, affectedRunId])) return null;
  }
  const terminal = attemptsByRun.get(affectedRunId)?.at(-1);
  if (!terminal || !isTerminalAttempt(terminal, attemptsByRun.get(affectedRunId).length)) return null;
  const predecessor = canonicalPredecessorCheckpoint(retained, predecessorRunIds, terminal);
  if (!isDeepStrictEqual(retained.checkpoint, predecessor)) return null;
  const runs = [...retained.runs, ...missingTerminalRuns];
  return {
    runs,
    checkpoint: {
      ...predecessor,
      completed_run_ids: runs.map((run) => run.run_id),
      in_flight_attempt: null,
      updated_at: terminal.ended_at,
    },
  };
}

function canonicalPredecessorCheckpoint(retained, completedRunIds, terminal) {
  return {
    checkpoint_version: "1",
    benchmark_id: retained.plan.benchmark_id,
    plan_version: retained.plan.plan_version,
    batch_id: "calibration",
    status: "open",
    stop_reason: null,
    attempt_count: retained.attempts.length,
    completed_run_ids: completedRunIds,
    in_flight_attempt: canonicalIntentFromAttempt(terminal),
    runner_revision: retained.expectedRunnerRevision,
    updated_at: terminal.started_at,
  };
}

function canonicalIntentFromAttempt(terminal) {
  return {
    intent_version: "1",
    benchmark_id: terminal.benchmark_id,
    plan_version: terminal.plan_version,
    batch_id: terminal.batch_id,
    run_id: terminal.run_id,
    api_id: terminal.api_id,
    task_id: terminal.task_id,
    target_id: terminal.target_id,
    provider: terminal.provider,
    condition: terminal.condition,
    repetition: terminal.repetition,
    attempt_number: terminal.attempt_number,
    started_at: terminal.started_at,
    runner_revision: terminal.runner_revision,
  };
}

export function requireReconciliation(value) {
  assertPlainJson(value, "reconciliation");
  if (!RECONCILIATIONS.has(value)) throw new TypeError("value is not verified calibration reconciliation");
  return value;
}

export function requireVerifiedEvidence(value) {
  assertPlainJson(value, "verified evidence");
  if (!VERIFIED_EVIDENCE.has(value)) throw new TypeError("value is not verified calibration evidence");
  return value;
}

function deriveResponseRun(identity, prompt, task, attempt, firstStartedAt) {
  const response = attempt.response;
  const incomplete = response.completion.complete !== true;
  let parsed = null;
  try {
    parsed = parseProviderText(response.content_text, { incomplete });
    const grade = gradeParsedResponse({ parsed, task, condition: prompt.condition });
    return finalize({
      ...identity,
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
      raw_response: response.raw_response,
      parse_error: parsed.parse_error,
      usage: response.usage,
      resolved_model: response.resolved_model,
      provider_request_id: response.provider_request_id,
      stop_reason: response.completion.stop_reason,
      started_at: attempt.started_at,
      ended_at: attempt.ended_at,
    });
  } catch (error) {
    return deriveImplementationDefectRun(identity, attempt, {
      response,
      parsed,
      reason: message(error),
    }, firstStartedAt);
  }
}

function deriveProviderErrorRun(identity, attempt, startedAt) {
  const error = attempt.error;
  return finalize({
    ...identity,
    transport_status: "provider-error",
    format_status: "empty",
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    failure_categories: [error.category ?? "provider-error"],
    reasons: [error.message ?? "retained provider error"],
    manual_review_required: false,
    implementation_defect: false,
    content_text: null,
    content_json: null,
    raw_response: error.response_body ?? null,
    parse_error: null,
    usage: null,
    resolved_model: null,
    provider_request_id: error.provider_request_id ?? null,
    stop_reason: error.stop_reason ?? null,
    started_at: startedAt,
    ended_at: attempt.ended_at,
  });
}

function deriveTransportErrorRun(identity, attempt, startedAt) {
  const error = attempt.error;
  return finalize({
    ...identity,
    transport_status: "transport-error",
    format_status: "empty",
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    failure_categories: ["transport-error"],
    reasons: [error.message ?? "transport failed before a usable response"],
    manual_review_required: false,
    implementation_defect: false,
    content_text: null,
    content_json: null,
    raw_response: null,
    parse_error: null,
    usage: null,
    resolved_model: null,
    provider_request_id: null,
    stop_reason: null,
    started_at: startedAt,
    ended_at: attempt.ended_at,
  });
}

function deriveImplementationDefectRun(identity, attempt, details = {}, startedAt = attempt.started_at) {
  const response = details.response ?? null;
  const parsed = details.parsed ?? null;
  const transportStatus = response === null ? "blocked" : response.completion.complete ? "completed" : "incomplete";
  return finalize({
    ...identity,
    transport_status: transportStatus,
    format_status: parsed?.format_status ?? (transportStatus === "incomplete" ? "incomplete" : "empty"),
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    failure_categories: ["implementation-defect"],
    reasons: [details.reason ?? attempt.error.message ?? "retained implementation defect"],
    manual_review_required: false,
    implementation_defect: true,
    content_text: response?.content_text ?? null,
    content_json: parsed?.content_json ?? null,
    raw_response: response?.raw_response ?? null,
    parse_error: parsed?.parse_error ?? null,
    usage: response?.usage ?? null,
    resolved_model: response?.resolved_model ?? null,
    provider_request_id: response?.provider_request_id ?? null,
    stop_reason: response?.completion.stop_reason ?? "implementation-defect",
    started_at: startedAt,
    ended_at: attempt.ended_at,
  });
}

function finalize(record) {
  validateEvaluationRecord(record);
  return clonePlainJson(record, "canonical run");
}

function validateCanonicalAttemptSequence(plan, prompt, attempts, runnerRevision) {
  if (!Array.isArray(attempts) || attempts.length < 1 || attempts.length > 2) {
    throw new Error("canonical attempts must contain one or two attempts");
  }
  attempts.forEach((attempt, index) => {
    const label = `canonical attempt ${index + 1}`;
    requireExactKeys(attempt, label, ATTEMPT_KEYS);
    validateIdentity(plan, prompt, attempt, label);
    validateAttempt(attempt, runnerRevision);
    if (attempt.attempt_number !== index + 1) {
      throw new Error("canonical attempt numbers must be contiguous from 1");
    }
    if (index > 0 && Date.parse(attempt.started_at) < Date.parse(attempts[index - 1].ended_at)) {
      throw new Error("canonical attempt timestamps must be ordered across retries");
    }
    if (index < attempts.length - 1 && attempt.status !== "transport-error") {
      throw new Error("canonical retry must follow a transport-error attempt");
    }
  });
  if (!isTerminalAttempt(attempts.at(-1), attempts.length)) {
    throw new Error("canonical attempts do not contain a terminal attempt");
  }
}

function validateAttempts({ plan, prompts, attempts, expectedRunnerRevision, failures }) {
  const byRun = new Map();
  const seen = new Set();
  attempts.forEach((attempt, index) => {
    const label = `attempt ${index + 1}`;
    try {
      requireExactKeys(attempt, label, ATTEMPT_KEYS);
      const prompt = prompts.get(attempt.run_id);
      if (!prompt) throw new Error("has unknown canonical run identity");
      validateIdentity(plan, prompt, attempt, label);
      validateAttempt(attempt, expectedRunnerRevision);
      const key = `${attempt.run_id}\0${attempt.attempt_number}`;
      if (seen.has(key)) throw new Error("duplicates a retained attempt number");
      seen.add(key);
      if (!byRun.has(attempt.run_id)) byRun.set(attempt.run_id, []);
      byRun.get(attempt.run_id).push(attempt);
    } catch (error) {
      failures.push(`${label} is invalid: ${message(error)}`);
    }
  });
  for (const [runId, runAttempts] of byRun) {
    runAttempts.sort((left, right) => left.attempt_number - right.attempt_number);
    if (runAttempts.length > 2) failures.push(`${runId} exceeds one transport retry`);
    runAttempts.forEach((attempt, index) => {
      if (attempt.attempt_number !== index + 1) failures.push(`${runId} attempt numbers must be contiguous from 1`);
      if (index > 0 && runAttempts[index - 1].status !== "transport-error") failures.push(`${runId} retried after a usable provider response`);
      if (index < runAttempts.length - 1 && attempt.status !== "transport-error") failures.push(`${runId} retains a nonterminal attempt before its latest attempt`);
    });
  }
  return byRun;
}

function validateRuns({ plan, prompts, runs, expectedRunnerRevision, failures }) {
  const retained = new Map();
  runs.forEach((run, index) => {
    const label = `run ${index + 1}`;
    try {
      validateEvaluationRecord(run);
      const prompt = prompts.get(run.run_id);
      if (!prompt) throw new Error("has unknown canonical run identity");
      validateIdentity(plan, prompt, run, label);
      requireRunnerRevision(run.runner_revision, `${label} runner_revision`);
      if (run.runner_revision !== expectedRunnerRevision) throw new Error("runner_revision does not match expectedRunnerRevision");
      if (retained.has(run.run_id)) throw new Error("duplicates a retained run identity");
      retained.set(run.run_id, run);
    } catch (error) {
      failures.push(`${label} is invalid: ${message(error)}`);
    }
  });
  return retained;
}

function validateCheckpoint({ plan, checkpoint, attempts, attemptsByRun, retainedRuns, expectedRunnerRevision, failures }) {
  try {
    if (checkpoint === null) {
      if (attempts.length > 0 || retainedRuns.size > 0) throw new Error("retained logs exist without a checkpoint");
      return false;
    }
    requireExactKeys(checkpoint, "checkpoint", CHECKPOINT_KEYS);
    if (checkpoint.checkpoint_version !== "1") throw new Error("checkpoint_version must be 1");
    if (checkpoint.benchmark_id !== plan.benchmark_id || checkpoint.plan_version !== plan.plan_version || checkpoint.batch_id !== "calibration") throw new Error("canonical identity mismatch");
    if (!["open", "stopped", "complete"].includes(checkpoint.status)) throw new Error("status is invalid");
    if ((checkpoint.status === "open" || checkpoint.status === "complete") && checkpoint.stop_reason !== null) throw new Error("open or complete checkpoint cannot have a stop reason");
    if (checkpoint.status === "stopped" && (typeof checkpoint.stop_reason !== "string" || checkpoint.stop_reason === "")) throw new Error("stopped checkpoint requires a stop reason");
    if (!Number.isInteger(checkpoint.attempt_count) || checkpoint.attempt_count < 0) throw new Error("attempt_count must be a nonnegative integer");
    if (!Array.isArray(checkpoint.completed_run_ids) || checkpoint.completed_run_ids.some((id) => typeof id !== "string")) throw new Error("completed_run_ids must be a string array");
    if (new Set(checkpoint.completed_run_ids).size !== checkpoint.completed_run_ids.length) throw new Error("completed_run_ids must be unique");
    if (!sameMembers(checkpoint.completed_run_ids, [...retainedRuns.keys()])) throw new Error("completed_run_ids do not match retained runs");
    const unresolvedIntent = validateInFlightIntent({
      plan,
      intent: checkpoint.in_flight_attempt,
      prompts: new Map([...attemptsByRun.keys()].map((runId) => [runId, null])),
      attemptsByRun,
      retainedRuns,
      expectedRunnerRevision,
    });
    requireRunnerRevision(checkpoint.runner_revision, "checkpoint runner_revision");
    if (checkpoint.runner_revision !== expectedRunnerRevision) throw new Error("runner_revision does not match expectedRunnerRevision");
    if (!validTimestamp(checkpoint.updated_at)) throw new Error("updated_at must be an ISO-compatible timestamp");
    if (checkpoint.attempt_count !== attempts.length + (unresolvedIntent ? 1 : 0)) throw new Error("attempt_count does not match retained attempts and in-flight intent");
    if (checkpoint.status === "complete") {
      if (retainedRuns.size !== promptsCount(plan)) throw new Error("complete checkpoint requires all canonical run records");
      if (checkpoint.in_flight_attempt !== null) throw new Error("complete checkpoint cannot retain an in-flight attempt");
      if ([...attemptsByRun.values()].some((entries) => !isTerminalAttempt(entries.at(-1), entries.length))) throw new Error("complete checkpoint contains a nonterminal attempt");
    }
    return unresolvedIntent;
  } catch (error) {
    failures.push(`checkpoint is invalid: ${message(error)}`);
    return false;
  }
}

function validateInFlightIntent({ plan, intent, prompts, attemptsByRun, retainedRuns, expectedRunnerRevision }) {
  if (intent === null) return false;
  requireExactKeys(intent, "in_flight_attempt", INTENT_KEYS);
  if (intent.intent_version !== "1") throw new Error("in_flight_attempt intent_version must be 1");
  const expected = canonicalInputs(plan).prompts.find((prompt) => prompt.run_id === intent.run_id);
  if (!expected) throw new Error("in_flight_attempt has unknown canonical identity");
  validateIdentity(plan, expected, intent, "in_flight_attempt");
  if (!Number.isInteger(intent.attempt_number) || intent.attempt_number < 1 || intent.attempt_number > 2) throw new Error("in_flight_attempt attempt_number must be 1 or 2");
  if (!validTimestamp(intent.started_at)) throw new Error("in_flight_attempt started_at must be an ISO-compatible timestamp");
  requireRunnerRevision(intent.runner_revision, "in_flight_attempt runner_revision");
  if (intent.runner_revision !== expectedRunnerRevision) throw new Error("in_flight_attempt runner_revision does not match expectedRunnerRevision");
  const runAttempts = attemptsByRun.get(intent.run_id) ?? [];
  const matchingAttempt = runAttempts.find((attempt) => attempt.attempt_number === intent.attempt_number);
  if (matchingAttempt) {
    if (matchingAttempt.started_at !== intent.started_at) throw new Error("in_flight_attempt timestamp does not match its terminal attempt");
    return false;
  }
  if (retainedRuns.has(intent.run_id)) throw new Error("in_flight_attempt belongs to a completed run");
  if (intent.attempt_number !== runAttempts.length + 1) throw new Error("in_flight_attempt does not follow the retained attempt sequence");
  if (intent.attempt_number === 2 && runAttempts[0]?.status !== "transport-error") throw new Error("in_flight retry must follow a transport error");
  const precedingAttempt = runAttempts.at(-1);
  if (precedingAttempt && Date.parse(intent.started_at) < Date.parse(precedingAttempt.ended_at)) {
    throw new Error("in_flight_attempt started_at precedes the retained attempt ended_at");
  }
  return true;
}

function validateAttempt(attempt, runnerRevision) {
  if (attempt.record_version !== "1") throw new Error("record_version must be 1");
  if (!ATTEMPT_STATUSES.has(attempt.status)) throw new Error(`status ${String(attempt.status)} is invalid`);
  if (!Number.isInteger(attempt.attempt_number) || attempt.attempt_number < 1 || attempt.attempt_number > 2) throw new Error("attempt_number must be 1 or 2");
  if (!validTimestamp(attempt.started_at) || !validTimestamp(attempt.ended_at) || Date.parse(attempt.ended_at) < Date.parse(attempt.started_at)) throw new Error("timestamps must be ordered ISO-compatible timestamps");
  if (typeof attempt.provider_call !== "boolean") throw new Error("provider_call must be boolean");
  if (["response", "transport-error", "provider-error"].includes(attempt.status) && attempt.provider_call !== true) throw new Error(`${attempt.status} requires provider_call true`);
  if (attempt.status === "response") {
    if (attempt.error !== null) throw new Error("response requires error null");
    validateResponse(attempt.response);
  } else {
    if (attempt.response !== null) throw new Error(`${attempt.status} requires response null`);
    validateError(attempt.error, attempt.status);
  }
  requireRunnerRevision(attempt.runner_revision, "attempt runner_revision");
  if (attempt.runner_revision !== runnerRevision) throw new Error("runner_revision does not match expectedRunnerRevision");
}

function validateResponse(response) {
  requireExactKeys(response, "attempt response", ["content_text", "completion", "usage", "resolved_model", "provider_request_id", "raw_response"]);
  if (typeof response.content_text !== "string") throw new Error("response content_text must be a string");
  requireExactKeys(response.completion, "response completion", ["complete", "category", "provider_status", "stop_reason"]);
  if (typeof response.completion.complete !== "boolean") throw new Error("response completion.complete must be a boolean");
  const expectedCategory = response.completion.complete ? "completed" : "incomplete";
  if (response.completion.category !== expectedCategory) throw new Error(`response completion.category must be ${expectedCategory}`);
  if (response.completion.provider_status !== null && typeof response.completion.provider_status !== "string") throw new Error("response completion.provider_status must be string or null");
  if (response.completion.stop_reason !== null && typeof response.completion.stop_reason !== "string") throw new Error("response completion.stop_reason must be string or null");
  requireExactKeys(response.usage, "response usage", ["input_tokens", "output_tokens", "total_tokens"]);
  for (const field of ["input_tokens", "output_tokens", "total_tokens"]) if (!Number.isFinite(response.usage[field]) || response.usage[field] < 0) throw new Error(`response usage.${field} must be a nonnegative finite number`);
  if (response.usage.total_tokens < response.usage.input_tokens + response.usage.output_tokens) throw new Error("response usage.total_tokens cannot be less than input plus output tokens");
  for (const field of ["resolved_model", "provider_request_id"]) if (response[field] !== null && typeof response[field] !== "string") throw new Error(`response ${field} must be string or null`);
}

function validateError(error, status) {
  const requiredKeys = status === "provider-error"
    ? PROVIDER_ERROR_KEYS
    : status === "transport-error"
      ? TRANSPORT_ERROR_KEYS
      : IMPLEMENTATION_ERROR_KEYS;
  requireExactKeys(error, `${status} error`, requiredKeys);
  if (typeof error.message !== "string" || error.message === "") throw new Error("error.message must be a non-empty string");
  if (typeof error.name !== "string" || error.name === "") throw new Error("error.name must be a non-empty string");

  if (status === "transport-error") {
    if (error.name !== "ProviderTransportError") throw new Error("transport-error error.name must be ProviderTransportError");
    if (error.category !== "transport_error") throw new Error("transport-error error.category must be transport_error");
    if (error.retryable !== true) throw new Error("transport-error error.retryable must be true");
    if (error.usable_response !== false) throw new Error("transport-error error.usable_response must be false");
    return;
  }

  if (status === "implementation-defect") {
    if (["ProviderTransportError", "ProviderResponseError"].includes(error.name)) {
      throw new Error("implementation-defect error.name must not identify a provider error");
    }
    return;
  }

  if (error.name !== "ProviderResponseError") throw new Error("provider-error error.name must be ProviderResponseError");
  if (!PROVIDER_ERROR_CATEGORIES.has(error.category)) throw new Error("provider-error error.category is invalid");
  if (error.retryable !== false) throw new Error("provider-error error.retryable must be false");
  if (error.usable_response !== true) throw new Error("provider-error error.usable_response must be true");
  if (error.http_status !== null
      && (!Number.isInteger(error.http_status) || error.http_status < 100 || error.http_status > 599)) {
    throw new Error("error.http_status must be an HTTP status integer or null");
  }
  for (const field of ["stop_reason", "provider_request_id"]) {
    if (error[field] !== null && typeof error[field] !== "string") throw new Error(`error.${field} must be string or null`);
  }
}

function buildCanonicalPrompts(plan, prompts, failures) {
  const canonical = new Map();
  const { prompts: expected } = canonicalInputs(plan);
  const expectedById = new Map(expected.map((prompt) => [prompt.run_id, prompt]));
  if (prompts.length !== expected.length) failures.push(`prompts must contain exactly ${expected.length} canonical records`);
  prompts.forEach((prompt, index) => {
    try {
      const expectedPrompt = expectedById.get(prompt.run_id);
      if (!expectedPrompt || !isDeepStrictEqual(prompt, expectedPrompt)) throw new Error("does not match the canonical prompt");
      if (canonical.has(prompt.run_id)) throw new Error("duplicates a prompt run identity");
      canonical.set(prompt.run_id, prompt);
    } catch (error) { failures.push(`prompt ${index + 1} is invalid: ${message(error)}`); }
  });
  return canonical;
}

function buildCanonicalTasks(plan, tasks, failures) {
  const { tasks: expected } = canonicalInputs(plan);
  const expectedById = new Map(expected.map((task) => [task.id, task]));
  const canonical = new Map();
  if (tasks.length !== expected.length) failures.push(`tasks must contain exactly ${expected.length} calibration tasks`);
  tasks.forEach((task, index) => {
    const expectedTask = expectedById.get(task?.id);
    if (!expectedTask || !isDeepStrictEqual(task, expectedTask)) failures.push(`task ${index + 1} is not a canonical calibration task`);
    else if (canonical.has(task.id)) failures.push(`task ${task.id} is duplicated`);
    else canonical.set(task.id, task);
  });
  return canonical;
}

function canonicalTask(plan, task) {
  const canonical = canonicalInputs(plan).tasks.find((candidate) => candidate.id === task?.id);
  if (!canonical || !isDeepStrictEqual(task, canonical) || !plan.calibration.task_ids.includes(task.id)) throw new Error("task must be a canonical calibration task");
  return canonical;
}

function validateCanonicalPrompt(plan, prompt) {
  assertPlainJson(prompt, "canonical prompt");
  const expected = canonicalInputs(plan).prompts.find((candidate) => candidate.run_id === prompt.run_id);
  if (!expected || !isDeepStrictEqual(prompt, expected)) throw new Error("prompt must be a canonical calibration prompt");
}

function canonicalInputs(plan) {
  if (CANONICAL_INPUTS === null) {
    const packet = readTaskPacket(plan);
    CANONICAL_INPUTS = {
      prompts: buildCalibrationPrompts({ plan, packet }),
      tasks: packet.tasks.filter((task) => plan.calibration.task_ids.includes(task.id)),
    };
  }
  return CANONICAL_INPUTS;
}

function validateIdentity(plan, prompt, record, label) {
  for (const [field, expected] of Object.entries({
    benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: "calibration", run_id: prompt.run_id,
    api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider,
    condition: prompt.condition, repetition: prompt.repetition,
  })) if (record[field] !== expected) throw new Error(`${label} ${field} does not match canonical identity`);
}

function recordIdentity(plan, prompt, attemptCount, runnerRevision) {
  return {
    record_version: "3", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, run_id: prompt.run_id,
    batch_id: "calibration", api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id,
    provider: prompt.target.provider, condition: prompt.condition, repetition: prompt.repetition,
    attempt_count: attemptCount, runner_revision: runnerRevision,
  };
}

function requireExactKeys(value, name, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(`${name} must be a plain object`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(value, key))) throw new Error(`${name} must have exactly the required keys`);
}
function requireRunnerRevision(value, name) { if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`); }
function validTimestamp(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function isTerminalAttempt(attempt, count) { return attempt.status !== "transport-error" || count === 2; }
function promptsCount(plan) { return plan.calibration.planned_requests; }
function sameMembers(left, right) { return isDeepStrictEqual([...left].sort(), [...right].sort()); }
function failed(failures) { return { failures, evidence: null }; }
function message(error) { return error instanceof Error ? error.message : String(error); }
function deepFreeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
