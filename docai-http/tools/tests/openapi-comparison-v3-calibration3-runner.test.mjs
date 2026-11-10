import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./calibration3-stop-helpers.mjs";

test("checker returns the verified report and never exposes invalid checkpoint claims", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const store = new f.runner.MemoryRunStore();
  const execution = f.execution(async () => { throw new Error("synthetic stop"); }, store);
  const result = await f.runner.runApprovedCalibration(execution);
  assert.equal(result.report.usage.complete, false);
  const { checkCalibrationRunState } = await f.load("check-runs");
  const input = { plan: f.plan, prompts: f.prompts, tasks: f.tasks, store, runnerRevision: execution.runnerRevision };
  const checked = checkCalibrationRunState(input);
  assert.deepEqual(checked.failures, []);
  assert.deepEqual(checked.report, f.runner.buildCalibrationReport({ evidence: f.verifier.verifyCalibrationEvidence(f.ledger(store)).evidence }));
  store.checkpoints.get("calibration").status = "complete";
  const invalid = checkCalibrationRunState(input);
  assert.ok(invalid.failures.length > 0);
  assert.equal(invalid.report, null);
  assert.equal(invalid.calibration, null);
});

test("runner completion report includes retry attempts and unknown usage without rereading after final write", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const store = new f.runner.MemoryRunStore();
  let calls = 0;
  const write = store.writeCheckpoint.bind(store);
  store.writeCheckpoint = (batch, checkpoint) => {
    write(batch, checkpoint);
    if (checkpoint.status === "complete") {
      store.listAttempts = store.listRuns = store.readCheckpoint = () => { throw new Error("post-finish reread"); };
    }
  };
  const result = await f.runner.runApprovedCalibration(f.execution(async ({ prompt }) => {
    calls += 1;
    if (calls === 1) throw new f.errors.ProviderTransportError("synthetic retry");
    return f.response(prompt);
  }, store));
  assert.equal(result.report.status, "complete");
  assert.equal(result.report.counts.completed, 24);
  assert.equal(result.report.counts.attempts, 25);
  assert.equal(result.report.provider_calls, 25);
  assert.equal(result.report.confirmed_provider_responses, 24);
  assert.equal(result.report.usage.total_tokens, 72);
  assert.equal(result.report.usage.unknown_attempts, 1);
  assert.equal(result.report.usage.complete, false);
});
