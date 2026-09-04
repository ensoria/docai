import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCalibrationGate } from "../openapi-comparison-v3-calibration-gate.mjs";
import { checkCalibrationGate } from "../check-openapi-comparison-v3-calibration.mjs";
import { CALIBRATION_RUNNER_REVISION_FILES } from "../openapi-comparison-v3-runner.mjs";
import { buildCalibrationSchedule, readV3Plan } from "../openapi-comparison-v3-utils.mjs";

const PLAN = readV3Plan();
const SCHEDULE = buildCalibrationSchedule(PLAN);

test("passes 24 raw, valid, automatically decided calibration records", () => {
  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs: passingRuns() });

  assert.equal(result.passed, true);
  assert.equal(result.counts.automated_decisions, 24);
  assert.equal(result.counts.exceptional_runs, 0);
  assert.equal(result.counts.semantic_pass_rate, 1);
});

test("passes with one fenced record", () => {
  const runs = passingRuns();
  runs[0].format_status = "fenced-json";

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, true);
  assert.equal(result.counts.exceptional_runs, 1);
});

test("passes with one contract-invalid record", () => {
  const runs = passingRuns();
  Object.assign(runs[0], notEvaluated({ contract_status: "invalid" }));

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, true);
  assert.equal(result.counts.automated_decisions, 23);
  assert.equal(result.counts.exceptional_runs, 1);
});

test("passes with one inconclusive record", () => {
  const runs = passingRuns();
  Object.assign(runs[0], {
    accuracy_status: "inconclusive",
    manual_review_required: true,
  });

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, true);
  assert.equal(result.counts.automated_decisions, 23);
  assert.equal(result.counts.exceptional_runs, 1);
});

test("fails with two distinct exceptional records", () => {
  const runs = passingRuns();
  runs[0].format_status = "fenced-json";
  Object.assign(runs[1], notEvaluated({ contract_status: "invalid" }));

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.equal(result.counts.exceptional_runs, 2);
  assert.equal(result.checks.exceptional_runs, false);
});

test("fails with only 22 automated decisions", () => {
  const runs = passingRuns();
  [0, 1].forEach((index) => Object.assign(runs[index], notEvaluated({ contract_status: "invalid" })));

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.equal(result.counts.automated_decisions, 22);
  assert.equal(result.checks.automated_coverage, false);
});

test("counts multiple exceptional dimensions on one run once", () => {
  const runs = passingRuns();
  Object.assign(runs[0], {
    format_status: "fenced-json",
    accuracy_status: "inconclusive",
    manual_review_required: true,
  });

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, true);
  assert.equal(result.counts.exceptional_runs, 1);
});

test("fails when a scheduled condition pair is incomplete", () => {
  const runs = passingRuns();
  runs[0] = { ...runs[0], run_id: runs[1].run_id };

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.equal(result.checks.exact_scheduled_identities, false);
  assert.equal(result.checks.complete_condition_pairs, false);
});

test("fails a terminal provider error", () => {
  const runs = passingRuns();
  Object.assign(runs[0], terminal({ transport_status: "provider-error" }));

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.equal(result.checks.no_terminal_errors, false);
});

test("fails a terminal transport error", () => {
  const runs = passingRuns();
  Object.assign(runs[0], terminal({ transport_status: "transport-error" }));

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.equal(result.checks.no_terminal_errors, false);
});

test("fails an incomplete response", () => {
  const runs = passingRuns();
  Object.assign(runs[0], terminal({ transport_status: "incomplete", format_status: "incomplete" }));

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.equal(result.checks.no_incomplete_responses, false);
});

test("fails an implementation defect", () => {
  const runs = passingRuns();
  Object.assign(runs[0], terminal({ implementation_defect: true }));

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.equal(result.checks.no_implementation_defects, false);
});

test("fails every closed token-limit completion reason including length", () => {
  for (const stopReason of ["max_output_tokens", "max_tokens", "MAX_TOKENS", "length"]) {
    const runs = passingRuns();
    runs[0].stop_reason = stopReason;

    const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

    assert.equal(result.passed, false, stopReason);
    assert.equal(result.checks.no_token_limit_completions, false, stopReason);
  }
});

test("does not infer token limits from completion reasons outside the closed set", () => {
  const runs = passingRuns();
  runs[0].stop_reason = "maximum tokens guessed from prose";

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, true);
  assert.equal(result.checks.no_token_limit_completions, true);
});

test("rejects a forged same-sized plan and its caller-generated schedule", () => {
  const plan = structuredClone(PLAN);
  plan.benchmark_id = "forged-benchmark";
  plan.plan_version = "forged-calibration.1";
  plan.calibration.api_id = "forged-api";
  plan.calibration.task_ids = ["forged-task-a", "forged-task-b"];
  plan.targets = [
    { id: "forged-target-a", provider: "forged-provider-a", model_id: null },
    { id: "forged-target-b", provider: "forged-provider-b", model_id: null },
    { id: "forged-target-c", provider: "forged-provider-c", model_id: null },
  ];
  plan.conditions = ["forged-a", "forged-b", "forged-c", "forged-d"];
  const schedule = buildCalibrationSchedule(plan);
  const runs = runsFor(plan, schedule);

  const result = evaluateCalibrationGate({ plan, schedule, runs });

  assert.equal(result.passed, false);
  assert.match(result.failures.join("\n"), /approved calibration plan/);
});

test("rejects canonical run IDs with the wrong benchmark or plan identity", () => {
  const runs = passingRuns().map((run) => ({
    ...run,
    benchmark_id: "forged-benchmark",
    plan_version: "forged-plan",
  }));

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.match(result.failures.join("\n"), /benchmark_id|plan_version/);
});

test("rejects a completed parseable record with unexplained not-evaluated dimensions", () => {
  const runs = passingRuns();
  Object.assign(runs[0], {
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
  });

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, false);
  assert.equal(result.checks.no_unexplained_pipeline_states, false);
});

test("rejects non-plain plans and hidden, symbol, or accessor schedule and run data", () => {
  const probes = [];

  const forgedPlan = structuredClone(PLAN);
  Object.setPrototypeOf(forgedPlan, { forged: true });
  probes.push(() => evaluateCalibrationGate({ plan: forgedPlan, schedule: SCHEDULE, runs: passingRuns() }));

  const hiddenSchedule = structuredClone(SCHEDULE);
  Object.defineProperty(hiddenSchedule[0], "hidden", { value: true });
  probes.push(() => evaluateCalibrationGate({ plan: PLAN, schedule: hiddenSchedule, runs: passingRuns() }));

  const symbolSchedule = structuredClone(SCHEDULE);
  symbolSchedule[0][Symbol("identity")] = "forged";
  probes.push(() => evaluateCalibrationGate({ plan: PLAN, schedule: symbolSchedule, runs: passingRuns() }));

  const accessorSchedule = structuredClone(SCHEDULE);
  Object.defineProperty(accessorSchedule[0], "run_id", {
    enumerable: true,
    get: () => SCHEDULE[0].run_id,
  });
  probes.push(() => evaluateCalibrationGate({ plan: PLAN, schedule: accessorSchedule, runs: passingRuns() }));

  const accessorRuns = passingRuns();
  Object.defineProperty(accessorRuns[0], "accuracy_status", {
    enumerable: true,
    get: () => "pass",
  });
  probes.push(() => evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs: accessorRuns }));

  probes.forEach((probe) => assert.throws(
    probe,
    /finite plain JSON|enumerable data properties|plain objects|hidden or symbol keys|symbol keys/,
  ));
});

test("reports a low semantic pass rate without failing reliable machinery", () => {
  const runs = passingRuns();
  runs.slice(0, 12).forEach((run) => { run.accuracy_status = "fail"; });

  const result = evaluateCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs });

  assert.equal(result.passed, true);
  assert.equal(result.counts.semantic_pass_rate, 0.5);
  assert.equal(result.checks.semantic_pass_rate_diagnostic_only, true);
});

test("checker returns the gate result without changing its reliability meaning", () => {
  const result = checkCalibrationGate({ plan: PLAN, schedule: SCHEDULE, runs: passingRuns() });

  assert.equal(result.passed, true);
  assert.equal(result.checks.semantic_pass_rate_diagnostic_only, true);
});

test("checker validates its object boundary before reading properties", () => {
  const input = { schedule: SCHEDULE, runs: passingRuns() };
  Object.defineProperty(input, "plan", {
    enumerable: true,
    get: () => PLAN,
  });

  assert.throws(
    () => checkCalibrationGate(input),
    /finite plain JSON|enumerable data properties/,
  );
});

test("includes calibration reliability and adjudication tools in the frozen runner revision", () => {
  [
    "docai-http/tools/openapi-comparison-v3-calibration-gate.mjs",
    "docai-http/tools/check-openapi-comparison-v3-calibration.mjs",
    "docai-http/tools/openapi-comparison-v3-adjudication.mjs",
    "docai-http/tools/check-openapi-comparison-v3-adjudication.mjs",
    "docai-http/tools/openapi-comparison-v3-strict-json.mjs",
  ].forEach((file) => assert.equal(CALIBRATION_RUNNER_REVISION_FILES.includes(file), true, file));
});

function passingRuns() {
  return runsFor(PLAN, SCHEDULE);
}

function runsFor(plan, schedule) {
  return schedule.map((row) => ({
    record_version: "3",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    run_id: row.run_id,
    batch_id: row.batch_id,
    api_id: row.api_id,
    task_id: row.task_id,
    target_id: row.target_id,
    provider: row.provider,
    condition: row.condition,
    repetition: row.repetition,
    attempt_count: 1,
    transport_status: "completed",
    format_status: "raw-json",
    contract_status: "valid",
    accuracy_status: "pass",
    uncertainty_status: "none",
    failure_categories: [],
    reasons: [],
    manual_review_required: false,
    implementation_defect: false,
  }));
}

function notEvaluated({ contract_status }) {
  return {
    contract_status,
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    manual_review_required: false,
  };
}

function terminal({ transport_status = "blocked", format_status = "empty", implementation_defect = false }) {
  return {
    transport_status,
    format_status,
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    manual_review_required: false,
    implementation_defect,
  };
}
