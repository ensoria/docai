import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fixture, predecessor, revision, watchWrites } from "./calibration3-stop-helpers.mjs";

let f;
before(async () => { f = await fixture(); });
after(() => f?.cleanup());
const fatalReasons = ["implementation-defect", "authentication_error", "billing_error", "model_unavailable"];

function fatalLedger(reason) {
  const prompt = f.prompts[0];
  const attempt = {
    record_version: "1", benchmark_id: f.plan.benchmark_id, plan_version: f.plan.plan_version, batch_id: "calibration", run_id: prompt.run_id, api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider, condition: prompt.condition, repetition: 1, attempt_number: 1, started_at: "2026-11-09T00:00:00.000Z", ended_at: "2026-11-09T00:00:01.000Z", status: reason === "implementation-defect" ? reason : "provider-error", provider_call: true, response: null,
    error: reason === "implementation-defect" ? { name: "Error", message: "synthetic defect" } : { name: "ProviderResponseError", message: "synthetic rejection", http_status: 403, category: reason, stop_reason: null, provider_request_id: null, response_body: null, retryable: false, usable_response: true }, runner_revision: revision,
  };
  const run = f.verifier.deriveCanonicalRun({ plan: f.plan, prompt, task: f.tasks.find((task) => task.id === prompt.task_id), attempts: [attempt], runnerRevision: revision });
  return { plan: f.plan, prompts: f.prompts, tasks: f.tasks, attempts: [attempt], runs: [run], checkpoint: { checkpoint_version: "1", benchmark_id: f.plan.benchmark_id, plan_version: f.plan.plan_version, batch_id: "calibration", status: "stopped", stop_reason: reason, attempt_count: 1, completed_run_ids: [run.run_id], in_flight_attempt: null, runner_revision: revision, updated_at: attempt.ended_at }, expectedRunnerRevision: revision };
}

for (const reason of fatalReasons) {
  test(`verifier binds ${reason} to the stopped terminal prefix`, () => {
    const valid = fatalLedger(reason);
    assert.deepEqual(f.verifier.verifyCalibrationEvidence(valid).failures, []);
    for (const drift of [{ status: "open", stop_reason: null }, { status: "complete", stop_reason: null }, { status: "stopped", stop_reason: null }, { status: "stopped", stop_reason: "token-ceiling" }]) {
      const result = f.verifier.verifyCalibrationEvidence({ ...valid, checkpoint: { ...valid.checkpoint, ...drift } });
      assert.equal(result.evidence, null, JSON.stringify(drift));
      assert.match(result.failures.join("\n"), /fatal|stop reason|stop_reason/);
    }
    const later = structuredClone(valid.attempts[0]);
    const prompt = f.prompts[1];
    Object.assign(later, { run_id: prompt.run_id, condition: prompt.condition, status: "response", response: f.response(prompt), error: null });
    const run = f.verifier.deriveCanonicalRun({ plan: f.plan, prompt, task: f.tasks.find((task) => task.id === prompt.task_id), attempts: [later], runnerRevision: revision });
    valid.attempts.push(later); valid.runs.push(run); valid.checkpoint.attempt_count += 1; valid.checkpoint.completed_run_ids.push(run.run_id);
    const result = f.verifier.verifyCalibrationEvidence(valid);
    assert.equal(result.evidence, null);
    assert.match(result.failures.join("\n"), /after fatal/);
  });

  for (const missingRun of [true, false]) {
    test(`reconciliation preserves ${reason}, missing run=${missingRun}`, () => {
      const ledger = fatalLedger(reason);
      ledger.checkpoint = predecessor(ledger);
      if (missingRun) ledger.runs.pop();
      const result = f.verifier.reconcileCalibrationEvidence(ledger);
      assert.deepEqual(result.failures, []);
      assert.equal(result.reconciliation.checkpoint.status, "stopped");
      assert.equal(result.reconciliation.checkpoint.stop_reason, reason);
      const recovered = { ...ledger, runs: [...ledger.runs, ...result.reconciliation.runs_to_append], checkpoint: result.reconciliation.checkpoint };
      assert.deepEqual(f.verifier.verifyCalibrationEvidence(recovered).failures, []);
    });
  }
}

test("verifier rejects a fatal stop reason without fatal evidence", () => {
  const ledger = fatalLedger("implementation-defect");
  ledger.attempts = []; ledger.runs = []; ledger.checkpoint.attempt_count = 0; ledger.checkpoint.completed_run_ids = [];
  assert.equal(f.verifier.verifyCalibrationEvidence(ledger).evidence, null);
});

test("fatal-stop validation still returns failures for malformed attempts", () => {
  for (const malformed of [null, false, "invalid", {}]) {
    const ledger = fatalLedger("implementation-defect");
    ledger.attempts[0] = malformed;
    let result;
    assert.doesNotThrow(() => { result = f.verifier.verifyCalibrationEvidence(ledger); });
    assert.equal(result.evidence, null);
    assert.notEqual(result.failures.length, 0);
  }
});

for (const reason of [...fatalReasons, "token-ceiling", "cost-ceiling", "attempt-cap", "operator-stop"]) {
  test(`persisted ${reason} returns unchanged with zero calls or writes`, async () => {
    const store = new f.runner.MemoryRunStore();
    const ledger = fatalLedger(fatalReasons.includes(reason) ? reason : "implementation-defect");
    if (!fatalReasons.includes(reason)) { ledger.attempts = []; ledger.runs = []; Object.assign(ledger.checkpoint, { stop_reason: reason, attempt_count: 0, completed_run_ids: [] }); }
    ledger.attempts.forEach((attempt) => store.appendAttempt(attempt)); ledger.runs.forEach((run) => store.appendRun(run)); store.writeCheckpoint("calibration", ledger.checkpoint);
    const before = f.ledger(store); const writes = watchWrites(store); let calls = 0;
    const options = f.execution(async ({ prompt }) => { calls += 1; return f.response(prompt); }, store);
    const result = await f.runner.runApprovedCalibration(options);
    assert.equal(calls, 0); assert.equal(writes(), 0);
    assert.deepEqual(f.ledger(store), before);
    assert.deepEqual(result.checkpoint, before.checkpoint);
    assert.equal(result.report.status, "stopped"); assert.equal(result.report.stop_reason, reason);
  });
}

test("first implementation defect stops one call; same preflight re-entry does nothing", async () => {
  let calls = 0;
  const options = f.execution(async ({ prompt }) => { calls += 1; if (calls === 1) throw new Error("injected implementation defect"); return f.response(prompt); });
  const first = await f.runner.runApprovedCalibration(options);
  assert.equal(first.checkpoint.stop_reason, "implementation-defect"); assert.equal(calls, 1);
  const retained = f.ledger(options.store); const writes = watchWrites(options.store);
  const second = await f.runner.runApprovedCalibration(options);
  assert.equal(calls, 1); assert.equal(writes(), 0); assert.deepEqual(f.ledger(options.store), retained);
  assert.deepEqual(second.checkpoint, first.checkpoint); assert.deepEqual(second.report, first.report);
});

test("completed resume is idempotent including checkpoint timestamp and writes", async () => {
  let calls = 0;
  const options = f.execution(async ({ prompt }) => { calls += 1; return f.response(prompt); });
  const first = await f.runner.runApprovedCalibration(options);
  assert.equal(first.checkpoint.status, "complete"); assert.equal(calls, 24);
  const writes = watchWrites(options.store);
  options.clock = () => { throw new Error("terminal re-entry must not need a clock tick"); };
  const second = await f.runner.runApprovedCalibration(options);
  assert.deepEqual(second.checkpoint, first.checkpoint); assert.equal(calls, 24); assert.equal(writes(), 0);
});

for (const reason of ["authentication_error", "billing_error", "model_unavailable", "token-ceiling", "cost-ceiling"]) {
  test(`injected ${reason} stops once and stays terminal`, async () => {
    let calls = 0;
    const options = f.execution(async ({ prompt }) => {
      calls += 1;
      if (fatalReasons.includes(reason)) throw new f.errors.ProviderResponseError("synthetic rejection", { category: reason });
      const costTokens = Math.ceil(f.cost.calibration.cost_ceiling_usd * 1000000 / f.cost.calibration.targets[0].pricing_usd_per_million_tokens.output) + 1;
      assert.ok(costTokens < f.cost.calibration.total_tokens_ceiling);
      return f.response(prompt, reason === "token-ceiling"
        ? { input_tokens: f.cost.calibration.total_tokens_ceiling, output_tokens: 0, total_tokens: f.cost.calibration.total_tokens_ceiling }
        : { input_tokens: 0, output_tokens: costTokens, total_tokens: costTokens });
    });
    const first = await f.runner.runApprovedCalibration(options);
    assert.equal(first.checkpoint.stop_reason, reason); assert.equal(calls, 1);
    const writes = watchWrites(options.store);
    const second = await f.runner.runApprovedCalibration(options);
    assert.deepEqual(second.checkpoint, first.checkpoint); assert.equal(calls, 1); assert.equal(writes(), 0);
  });
}

for (const reason of [...fatalReasons, "nonfatal"]) {
  for (const missingRun of [true, false]) {
    test(`runner recovers ${reason} crash, missing run=${missingRun}`, async () => {
      let calls = 0;
      const options = f.execution(async ({ prompt }) => { calls += 1; return f.response(prompt); });
      const ledger = fatalLedger(reason === "nonfatal" ? "implementation-defect" : reason);
      if (reason === "nonfatal") {
        Object.assign(ledger.attempts[0], { status: "response", response: f.response(f.prompts[0]), error: null });
        ledger.runs[0] = f.verifier.deriveCanonicalRun({ plan: f.plan, prompt: f.prompts[0], task: f.tasks.find((task) => task.id === f.prompts[0].task_id), attempts: ledger.attempts, runnerRevision: revision });
      }
      const checkpoint = predecessor(ledger);
      ledger.attempts.forEach((attempt) => options.store.appendAttempt(attempt));
      if (!missingRun) ledger.runs.forEach((run) => options.store.appendRun(run));
      options.store.writeCheckpoint("calibration", checkpoint);
      const result = await f.runner.runApprovedCalibration(options);
      assert.equal(result.checkpoint.status, reason === "nonfatal" ? "complete" : "stopped");
      assert.equal(result.checkpoint.stop_reason, reason === "nonfatal" ? null : reason);
      assert.equal(calls, reason === "nonfatal" ? 23 : 0);
      assert.deepEqual(f.verifier.verifyCalibrationEvidence(f.ledger(options.store)).failures, []);
      const writes = watchWrites(options.store);
      await f.runner.runApprovedCalibration(options);
      assert.equal(writes(), 0); assert.equal(calls, reason === "nonfatal" ? 23 : 0);
    });
  }
}

test("open pre-response transport retry remains resumable", async () => {
  let calls = 0;
  const options = f.execution(async ({ prompt }) => { calls += 1; return f.response(prompt); });
  const ledger = fatalLedger("implementation-defect");
  Object.assign(ledger.attempts[0], { status: "transport-error", error: { name: "ProviderTransportError", message: "synthetic disconnect", category: "transport_error", retryable: true, usable_response: false } });
  options.store.appendAttempt(ledger.attempts[0]);
  options.store.writeCheckpoint("calibration", { ...ledger.checkpoint, status: "open", stop_reason: null, completed_run_ids: [] });
  options.clock = () => "2026-11-09T00:00:01.000Z";
  const result = await f.runner.runApprovedCalibration(options);
  assert.equal(result.checkpoint.status, "complete"); assert.equal(calls, 24);
  assert.equal(options.store.listAttempts()[1].attempt_number, 2);
  assert.deepEqual(f.verifier.verifyCalibrationEvidence(f.ledger(options.store)).failures, []);
});

test("fatal checkpoint tampering rejects before runner calls or writes", async () => {
  for (const drift of [{ status: "open", stop_reason: null }, { status: "stopped", stop_reason: "billing_error" }]) {
    const store = new f.runner.MemoryRunStore(); const ledger = fatalLedger("implementation-defect");
    ledger.attempts.forEach((attempt) => store.appendAttempt(attempt)); ledger.runs.forEach((run) => store.appendRun(run)); store.writeCheckpoint("calibration", { ...ledger.checkpoint, ...drift });
    let calls = 0; const writes = watchWrites(store); const retained = f.ledger(store);
    await assert.rejects(f.runner.runApprovedCalibration(f.execution(async () => { calls += 1; }, store)), /fatal evidence/);
    assert.equal(calls, 0); assert.equal(writes(), 0); assert.deepEqual(f.ledger(store), retained);
  }
});
