import { buildRunnerRevision } from "./runner.mjs";
import { requireVerifiedEvidence } from "./evidence-verifier.mjs";
import { buildCalibrationSchedule, readPlan } from "./paths.mjs";
import { isExceptionalRun, validateEvaluationRecord } from "./record.mjs";

const CALIBRATION_REQUESTS = 24;
const AUTOMATED_STATUSES = new Set(["pass", "fail"]);
const TERMINAL_ERROR_STATUSES = new Set(["provider-error", "transport-error"]);
const PARSEABLE_FORMAT_STATUSES = new Set(["raw-json", "fenced-json"]);
const TOKEN_LIMIT_STOP_REASONS = new Set(["max_output_tokens", "max_tokens", "MAX_TOKENS", "length"]);

export function evaluateCalibrationGate(verifiedEvidence) {
  const evidence = requireVerifiedEvidence(verifiedEvidence);
  const plan = readPlan();
  const expectedRevision = buildRunnerRevision();
  const failures = [];
  const schedule = buildCalibrationSchedule(plan);

  addFailure(failures, evidence.benchmark_id !== plan.benchmark_id, "evidence benchmark identity does not match the approved calibration plan");
  addFailure(failures, evidence.plan_version !== plan.plan_version, "evidence plan version does not match the approved calibration plan");
  addFailure(failures, evidence.runner_revision !== expectedRevision, "evidence runner revision does not match the approved calibration runner revision");

  const runsById = new Map();
  for (const [index, run] of evidence.runs.entries()) {
    try {
      validateEvaluationRecord(run);
    } catch (error) {
      failures.push(`run ${index + 1}: invalid evaluation record: ${error.message}`);
      continue;
    }
    if (runsById.has(run.run_id)) failures.push(`run identities: duplicate record for ${run.run_id}`);
    else runsById.set(run.run_id, run);
  }

  const scheduleById = new Map(schedule.map((row) => [row.run_id, row]));
  for (const run of runsById.values()) validateRunIdentity(run, scheduleById, plan, failures);
  const recordedRuns = [...runsById.values()];
  const automatedDecisions = recordedRuns.filter((run) => AUTOMATED_STATUSES.has(run.accuracy_status));
  const exceptionalRuns = recordedRuns.filter(isExceptionalRun);
  const semanticPasses = automatedDecisions.filter((run) => run.accuracy_status === "pass").length;
  const exactScheduledIdentities = scheduleById.size === CALIBRATION_REQUESTS
    && runsById.size === CALIBRATION_REQUESTS
    && failures.every((failure) => !failure.startsWith("run identities:"));
  const completeConditionPairs = hasCompleteConditionPairs(plan, schedule, runsById);
  const noTerminalErrors = recordedRuns.every((run) => !TERMINAL_ERROR_STATUSES.has(run.transport_status));
  const noIncompleteResponses = recordedRuns.every((run) => run.transport_status !== "incomplete");
  const noImplementationDefects = recordedRuns.every((run) => run.implementation_defect === false);
  const noTokenLimitCompletions = recordedRuns.every((run) => !isTokenLimitCompletion(run));
  const noUnexplainedPipelineStates = recordedRuns.every(hasExplainedPipelineState);
  const automatedCoverage = automatedDecisions.length >= plan.calibration.gate.minimum_automated_decisions;
  const exceptionalRunLimit = exceptionalRuns.length <= plan.calibration.gate.maximum_exceptional_runs;

  addFailure(failures, !exactScheduledIdentities, "run identities: records must contain exactly the 24 canonical scheduled identities");
  addFailure(failures, !completeConditionPairs, "condition pairs: every task/target pair must contain all four conditions");
  addFailure(failures, !noTerminalErrors, "transport: terminal provider or transport errors are not reliable");
  addFailure(failures, !noIncompleteResponses, "transport: incomplete responses are not reliable");
  addFailure(failures, !noImplementationDefects, "implementation: implementation defects are not reliable");
  addFailure(failures, !noTokenLimitCompletions, "completion: token-limit completions are not reliable");
  addFailure(failures, !noUnexplainedPipelineStates, "pipeline: completed parseable responses must have a contract result");
  addFailure(failures, !automatedCoverage, `coverage: requires at least ${plan.calibration.gate.minimum_automated_decisions} automated decisions; found ${automatedDecisions.length}`);
  addFailure(failures, !exceptionalRunLimit, `exceptional runs: permits at most ${plan.calibration.gate.maximum_exceptional_runs}; found ${exceptionalRuns.length}`);

  return {
    calibration_gate_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    passed: failures.length === 0,
    thresholds: { automated_decisions_required: plan.calibration.gate.minimum_automated_decisions, exceptional_runs_maximum: plan.calibration.gate.maximum_exceptional_runs },
    counts: {
      scheduled_runs: schedule.length,
      recorded_runs: runsById.size,
      automated_decisions: automatedDecisions.length,
      exceptional_runs: exceptionalRuns.length,
      semantic_passes: semanticPasses,
      semantic_fails: automatedDecisions.length - semanticPasses,
      semantic_pass_rate: automatedDecisions.length === 0 ? null : semanticPasses / automatedDecisions.length,
    },
    checks: {
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

function validateRunIdentity(run, scheduleById, plan, failures) {
  const expected = scheduleById.get(run.run_id);
  if (!expected) {
    failures.push(`run identities: unknown scheduled run ${run.run_id}`);
    return;
  }
  const identity = {
    benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: expected.batch_id,
    api_id: expected.api_id, task_id: expected.task_id, target_id: expected.target_id,
    provider: expected.provider, condition: expected.condition, repetition: expected.repetition,
  };
  for (const [field, value] of Object.entries(identity)) {
    if (run[field] !== value) failures.push(`run identities: ${run.run_id} ${field} does not match the canonical ${field}`);
  }
}

function hasCompleteConditionPairs(plan, schedule, runsById) {
  if (runsById.size !== CALIBRATION_REQUESTS) return false;
  return plan.calibration.task_ids.every((taskId) => plan.targets.every((target) => {
    const expected = schedule.filter((row) => row.task_id === taskId && row.target_id === target.id);
    const actual = expected.filter((row) => runsById.has(row.run_id));
    return actual.length === plan.conditions.length && new Set(actual.map((row) => row.condition)).size === plan.conditions.length;
  }));
}

function isTokenLimitCompletion(run) { return run.transport_status === "completed" && TOKEN_LIMIT_STOP_REASONS.has(run.stop_reason); }
function hasExplainedPipelineState(run) { return !(run.transport_status === "completed" && PARSEABLE_FORMAT_STATUSES.has(run.format_status) && run.contract_status === "not-evaluated"); }
function addFailure(failures, condition, message) { if (condition && !failures.includes(message)) failures.push(message); }
