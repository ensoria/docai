import assert from "node:assert/strict";
import test from "node:test";
import { nativeAttempt } from "./calibration4-evidence-helpers.mjs";
import { nativeAccountingForAttempt } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/record.mjs";
import { providerCompletion } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/provider-adapter-utils.mjs";

import { readTaskPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/contract.mjs";
import { verifyCalibrationEvidence } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/evidence-verifier.mjs";
import { buildCalibrationPrompts } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/prompt.mjs";
import { buildCalibrationSchedule, readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/paths.mjs";
import { deriveCanonicalRun } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/evidence-verifier.mjs";
import { buildRunnerRevision } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/runner.mjs";
import { checkCalibrationGate } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/check-gate.mjs";
import { evaluateCalibrationGate } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/gate.mjs";

const PLAN = readPlan();
const TASK_PACKET_TASKS = readTaskPacket(PLAN).tasks;
const TASKS = TASK_PACKET_TASKS.filter((task) => PLAN.calibration.task_ids.includes(task.id));
const PROMPTS = buildCalibrationPrompts({ plan: PLAN, packet: { benchmark_id: PLAN.benchmark_id, api_id: PLAN.calibration.api_id, tasks: TASK_PACKET_TASKS } });
const REVISION = buildRunnerRevision();

test("requires WeakSet-branded verified evidence before gate evaluation", () => {
  const ledger = syntheticLedger();
  const verified = evidenceFor(ledger);

  for (const value of [
    { runs: ledger.runs },
    structuredClone(verified),
    { ...verified },
    { ...verified, runs: fabricatedPassingRuns() },
  ]) {
    assert.throws(() => evaluateCalibrationGate(value), /verified calibration evidence/);
  }
});

test("accepts exactly 24 verified identities and one exceptional automatic record", () => {
  const ledger = syntheticLedger();
  setInvalidContract(ledger, 0);
  const result = evaluateCalibrationGate(evidenceFor(ledger));

  assert.equal(result.passed, true);
  assert.equal(result.counts.recorded_runs, 24);
  assert.equal(result.counts.automated_decisions, 23);
  assert.equal(result.counts.exceptional_runs, 1);
});

test("rejects verified evidence from a different plan or runner revision", () => {
  const wrongRevision = syntheticLedger();
  wrongRevision.expectedRunnerRevision = "sha256:other";
  wrongRevision.attempts.forEach((attempt) => { attempt.runner_revision = wrongRevision.expectedRunnerRevision; });
  wrongRevision.runs = wrongRevision.prompts.map((prompt, index) => deriveCanonicalRun({ plan: wrongRevision.plan, prompt, task: wrongRevision.tasks.find((task) => task.id === prompt.task_id), attempts: [wrongRevision.attempts[index]], runnerRevision: wrongRevision.expectedRunnerRevision }));
  wrongRevision.checkpoint.runner_revision = wrongRevision.expectedRunnerRevision;
  const result = evaluateCalibrationGate(evidenceFor(wrongRevision));
  assert.equal(result.passed, false);
  assert.match(result.failures.join("\n"), /runner revision/);
});

test("fails terminal errors, incomplete records, defects, token limits, and unexplained pipeline states", async (t) => {
  const variants = [
    ["provider error", (ledger) => setTerminalStatus(ledger, 0, "provider-error"), "no_terminal_errors"],
    ["transport error", (ledger) => setTerminalStatus(ledger, 23, "transport-error"), "no_terminal_errors"],
    ["incomplete", (ledger) => { Object.assign(ledger.attempts[0].response.raw_response, { status: "incomplete", incomplete_details: { reason: "length" } }); rederive(ledger, 0); }, "no_incomplete_responses"],
    ["implementation defect", (ledger) => {
      const last = ledger.runs.length - 1;
      setTerminalStatus(ledger, last, "implementation-defect");
      ledger.checkpoint.status = "stopped";
      ledger.checkpoint.stop_reason = "implementation-defect";
    }, "no_implementation_defects"],
    ["token limit", (ledger) => { ledger.attempts[0].response.raw_response.incomplete_details = { reason: "max_output_tokens" }; rederive(ledger, 0); }, "no_incomplete_responses"],
  ];

  for (const [name, mutate, check] of variants) {
    await t.test(name, () => {
      const ledger = syntheticLedger();
      mutate(ledger);
      const result = evaluateCalibrationGate(evidenceFor(ledger));
      assert.equal(result.passed, false);
      assert.equal(result.checks[check], false);
    });
  }
});

test("computes semantic pass rate only after evidence verification and leaves it diagnostic", () => {
  const ledger = syntheticLedger();
  ledger.runs.slice(0, 12).forEach((_, index) => setSemanticFail(ledger, index));
  const result = evaluateCalibrationGate(evidenceFor(ledger));

  assert.equal(result.passed, true);
  assert.equal(result.counts.semantic_pass_rate, 0.5);
  assert.equal(result.checks.semantic_pass_rate_diagnostic_only, true);
});

test("gate checker verifies a raw ledger before evaluating it", () => {
  const ledger = syntheticLedger();
  const result = checkCalibrationGate(ledger);

  assert.equal(result.verification.failures.length, 0);
  assert.equal(result.gate.passed, true);
});

test("Task 3 verification rejects the defensive completed parseable pipeline state", () => {
  const ledger = syntheticLedger();
  ledger.runs[0] = {
    ...ledger.runs[0],
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
  };
  const result = verifyCalibrationEvidence(ledger);
  assert.equal(result.evidence, null);
  assert.match(result.failures.join("\n"), /derived run mismatch/);
});

function evidenceFor(ledger) {
  const result = verifyCalibrationEvidence(ledger);
  assert.deepEqual(result.failures, []);
  return result.evidence;
}

function syntheticLedger() {
  const plan = structuredClone(PLAN);
  const prompts = structuredClone(PROMPTS);
  const tasks = structuredClone(TASKS);
  const attempts = prompts.map((prompt) => responseAttempt(prompt));
  const runs = prompts.map((prompt, index) => deriveCanonicalRun({ plan, prompt, task: tasks.find((task) => task.id === prompt.task_id), attempts: [attempts[index]], runnerRevision: REVISION }));
  return { plan, prompts, tasks, attempts, runs, checkpoint: checkpoint(runs), expectedRunnerRevision: REVISION };
}

function responseAttempt(prompt) {
  return nativeAttempt(prompt, TASKS, PLAN, REVISION);
}

function checkpoint(runs) {
  return { checkpoint_version: "1", benchmark_id: PLAN.benchmark_id, plan_version: PLAN.plan_version, batch_id: "calibration", status: "complete", stop_reason: null, attempt_count: runs.length, completed_run_ids: runs.map((run) => run.run_id), in_flight_attempt: null, runner_revision: REVISION, updated_at: "2026-09-10T00:00:01.000Z" };
}

function setInvalidContract(ledger, index) { ledger.attempts[index].response.content_text = "{}"; rederive(ledger, index); }
function setSemanticFail(ledger, index) {
  const outcome = structuredClone(TASKS.find((task) => task.id === ledger.prompts[index].task_id).private.expected_outcome);
  if (outcome.request) outcome.request.path.value = "/not-the-expected-path";
  else outcome.steps.items[0].request.path.value = "/not-the-expected-path";
  ledger.attempts[index].response.content_text = JSON.stringify(outcome);
  rederive(ledger, index);
  assert.equal(ledger.runs[index].accuracy_status, "fail");
}

function setTerminalStatus(ledger, index, status) {
  const attempt = ledger.attempts[index];
  if (status === "transport-error") {
    attempt.status = "transport-error";
    attempt.response = null;
    attempt.error = { name: "ProviderTransportError", message: "derived test transport error", category: "transport_error", retryable: true, usable_response: false };
    ledger.checkpoint.status = "stopped"; ledger.checkpoint.stop_reason = "accounting-unknown";
    rederive(ledger, index);
    return;
  }
  const raw = attempt.response.raw_response;
  attempt.status = status;
  attempt.response = null;
  attempt.error = status === "implementation-defect"
    ? { name: "Error", message: "derived test implementation defect" }
    : status === "transport-error"
      ? { name: "ProviderTransportError", message: "derived test transport error", category: "transport_error", retryable: true, usable_response: false }
      : { name: "ProviderResponseError", message: "derived test provider error", http_status: 500, category: "provider_error", stop_reason: null, provider_request_id: "test-provider-request", response_body: raw, retryable: false, usable_response: true };
  rederive(ledger, index);
}

function rederive(ledger, index) {
  const attempt = ledger.attempts[index];
  attempt.accounting = nativeAccountingForAttempt(attempt);
  if (attempt.response) attempt.response.completion = providerCompletion(attempt.provider, attempt.response.raw_response);
  if (attempt.status === "provider-error") {
    attempt.error.usage = attempt.accounting.usage;
    attempt.error.completion = { ...providerCompletion(attempt.provider, attempt.error.response_body), complete: false, category: "incomplete" };
  }
  ledger.runs[index] = deriveCanonicalRun({ plan: ledger.plan, prompt: ledger.prompts[index], task: ledger.tasks.find((task) => task.id === ledger.prompts[index].task_id), attempts: ledger.attempts.filter((attempt) => attempt.run_id === ledger.prompts[index].run_id), runnerRevision: ledger.expectedRunnerRevision });
}

function fabricatedPassingRuns() {
  return buildCalibrationSchedule(PLAN).map((row) => ({ run_id: row.run_id, accuracy_status: "pass" }));
}
