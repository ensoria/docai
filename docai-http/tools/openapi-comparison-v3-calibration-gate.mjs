import { isDeepStrictEqual } from "node:util";

import { validateEvaluationRecord } from "./openapi-comparison-v3-record.mjs";
import { assertFinitePlainJson } from "./openapi-comparison-v3-strict-json.mjs";
import { buildCalibrationSchedule, readV3Plan } from "./openapi-comparison-v3-utils.mjs";

const CALIBRATION_REQUESTS = 24;
const AUTOMATED_STATUSES = new Set(["pass", "fail"]);
const TERMINAL_ERROR_STATUSES = new Set(["provider-error", "transport-error"]);
const PARSEABLE_FORMAT_STATUSES = new Set(["raw-json", "fenced-json"]);
const TOKEN_LIMIT_STOP_REASONS = new Set([
  "max_output_tokens",
  "max_tokens",
  "MAX_TOKENS",
  "length",
]);

export function evaluateCalibrationGate(input = {}) {
  assertFinitePlainJson(input, "calibration gate input");
  requireExactKeys(input, ["plan", "schedule", "runs"], "calibration gate input");
  const { plan, schedule, runs } = input;
  const failures = [];
  const approvedPlan = readV3Plan();
  assertFinitePlainJson(approvedPlan, "checked-in calibration plan");
  const expectedSchedule = validatePlanAndBuildSchedule(plan, approvedPlan, failures);
  const canonicalSchedule = validateSchedule(schedule, expectedSchedule, failures);
  const validatedRuns = validateRuns(runs, failures);
  const scheduleById = new Map((canonicalSchedule ?? []).map((row) => [row.run_id, row]));
  const runsById = validateRunIdentities(validatedRuns, scheduleById, approvedPlan, failures);

  const recordedRuns = [...runsById.values()];
  const automatedDecisions = recordedRuns.filter((run) => AUTOMATED_STATUSES.has(run.accuracy_status));
  const exceptionalRuns = recordedRuns.filter(isExceptional);
  const semanticPasses = automatedDecisions.filter((run) => run.accuracy_status === "pass").length;
  const noTerminalErrors = recordedRuns.every((run) => !TERMINAL_ERROR_STATUSES.has(run.transport_status));
  const noIncompleteResponses = recordedRuns.every((run) => run.transport_status !== "incomplete");
  const noImplementationDefects = recordedRuns.every((run) => run.implementation_defect === false);
  const noTokenLimitCompletions = recordedRuns.every((run) => !isTokenLimitCompletion(run));
  const noUnexplainedPipelineStates = recordedRuns.every(hasExplainedPipelineState);
  const completeConditionPairs = hasCompleteConditionPairs(approvedPlan, canonicalSchedule, runsById);
  const exactScheduledIdentities = scheduleById.size === CALIBRATION_REQUESTS
    && runsById.size === CALIBRATION_REQUESTS
    && failures.every((failure) => !failure.startsWith("run identities:"));
  const minimumAutomatedDecisions = approvedPlan.calibration.gate.minimum_automated_decisions;
  const maximumExceptionalRuns = approvedPlan.calibration.gate.maximum_exceptional_runs;
  const automatedCoverage = automatedDecisions.length >= minimumAutomatedDecisions;
  const exceptionalRunLimit = exceptionalRuns.length <= maximumExceptionalRuns;

  addFailure(failures, !exactScheduledIdentities, "run identities: records must contain exactly the 24 canonical scheduled identities");
  addFailure(failures, !completeConditionPairs, "condition pairs: every task/target pair must contain all four conditions");
  addFailure(failures, !noTerminalErrors, "transport: terminal provider or transport errors are not reliable");
  addFailure(failures, !noIncompleteResponses, "transport: incomplete responses are not reliable");
  addFailure(failures, !noImplementationDefects, "implementation: implementation defects are not reliable");
  addFailure(failures, !noTokenLimitCompletions, "completion: token-limit completions are not reliable");
  addFailure(failures, !noUnexplainedPipelineStates, "pipeline: completed parseable responses must have a contract result");
  addFailure(
    failures,
    !automatedCoverage,
    `coverage: requires at least ${minimumAutomatedDecisions} automated decisions; found ${automatedDecisions.length}`,
  );
  addFailure(
    failures,
    !exceptionalRunLimit,
    `exceptional runs: permits at most ${maximumExceptionalRuns}; found ${exceptionalRuns.length}`,
  );

  return {
    calibration_gate_version: "1",
    benchmark_id: approvedPlan.benchmark_id,
    plan_version: approvedPlan.plan_version,
    passed: failures.length === 0,
    thresholds: {
      automated_decisions_required: minimumAutomatedDecisions,
      exceptional_runs_maximum: maximumExceptionalRuns,
    },
    counts: {
      scheduled_runs: canonicalSchedule?.length ?? 0,
      recorded_runs: runsById.size,
      automated_decisions: automatedDecisions.length,
      exceptional_runs: exceptionalRuns.length,
      semantic_passes: semanticPasses,
      semantic_fails: automatedDecisions.length - semanticPasses,
      semantic_pass_rate: automatedDecisions.length === 0
        ? null
        : semanticPasses / automatedDecisions.length,
    },
    checks: {
      canonical_schedule: canonicalSchedule !== null,
      exact_scheduled_identities: exactScheduledIdentities,
      complete_condition_pairs: completeConditionPairs,
      no_terminal_errors: noTerminalErrors,
      no_incomplete_responses: noIncompleteResponses,
      no_implementation_defects: noImplementationDefects,
      no_token_limit_completions: noTokenLimitCompletions,
      no_unexplained_pipeline_states: noUnexplainedPipelineStates,
      automated_coverage: automatedCoverage,
      exceptional_runs: exceptionalRunLimit,
      semantic_pass_rate_diagnostic_only: true,
    },
    failures,
  };
}

function validatePlanAndBuildSchedule(plan, approvedPlan, failures) {
  if (!isDeepStrictEqual(plan, approvedPlan)) {
    failures.push("plan: must match the exact checked-in approved calibration plan");
  }
  return buildCalibrationSchedule(approvedPlan);
}

function validateSchedule(schedule, expectedSchedule, failures) {
  if (!Array.isArray(schedule)) {
    failures.push("schedule: must be an array");
    return null;
  }
  if (schedule.length !== expectedSchedule.length) {
    failures.push(`schedule: must contain exactly ${expectedSchedule.length} canonical rows`);
    return null;
  }
  for (let index = 0; index < expectedSchedule.length; index += 1) {
    if (!isDeepStrictEqual(schedule[index], expectedSchedule[index])) {
      failures.push(`schedule: row ${index + 1} does not match the canonical calibration schedule`);
      return null;
    }
  }
  return expectedSchedule;
}

function validateRuns(runs, failures) {
  if (!Array.isArray(runs)) {
    failures.push("runs: must be an array");
    return [];
  }
  return runs.filter((run, index) => {
    try {
      validateEvaluationRecord(run);
      return true;
    } catch (error) {
      failures.push(`run ${index + 1}: invalid evaluation record: ${error.message}`);
      return false;
    }
  });
}

function validateRunIdentities(runs, scheduleById, approvedPlan, failures) {
  const runsById = new Map();
  runs.forEach((run) => {
    const expected = scheduleById.get(run.run_id);
    if (!expected) {
      failures.push(`run identities: unknown scheduled run ${run.run_id}`);
      return;
    }
    if (runsById.has(run.run_id)) {
      failures.push(`run identities: duplicate record for ${run.run_id}`);
      return;
    }
    const identity = {
      benchmark_id: approvedPlan.benchmark_id,
      plan_version: approvedPlan.plan_version,
      batch_id: expected.batch_id,
      api_id: expected.api_id,
      task_id: expected.task_id,
      target_id: expected.target_id,
      provider: expected.provider,
      condition: expected.condition,
      repetition: expected.repetition,
    };
    for (const [field, value] of Object.entries(identity)) {
      if (run[field] !== value) {
        failures.push(`run identities: ${run.run_id} ${field} does not match the canonical ${field}`);
      }
    }
    runsById.set(run.run_id, run);
  });
  return runsById;
}

function hasCompleteConditionPairs(plan, schedule, runsById) {
  if (!schedule || runsById.size !== CALIBRATION_REQUESTS) return false;
  return plan.calibration.task_ids.every((taskId) => plan.targets.every((target) => {
    const expected = schedule.filter((row) => row.task_id === taskId && row.target_id === target.id);
    const actual = expected.filter((row) => runsById.has(row.run_id));
    return actual.length === plan.conditions.length
      && new Set(actual.map((row) => row.condition)).size === plan.conditions.length;
  }));
}

function isExceptional(run) {
  return run.format_status !== "raw-json"
    || run.contract_status === "invalid"
    || run.accuracy_status === "inconclusive";
}

function isTokenLimitCompletion(run) {
  return run.transport_status === "completed"
    && TOKEN_LIMIT_STOP_REASONS.has(run.stop_reason);
}

function hasExplainedPipelineState(run) {
  return !(run.transport_status === "completed"
    && PARSEABLE_FORMAT_STATUSES.has(run.format_status)
    && run.contract_status === "not-evaluated");
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!isDeepStrictEqual(actual, wanted)) throw new TypeError(`${label} has unexpected or missing fields`);
}

function addFailure(failures, condition, message) {
  if (condition && !failures.includes(message)) failures.push(message);
}
