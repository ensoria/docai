import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fixture, predecessor } from "./calibration3-stop-helpers.mjs";

async function partial(f) {
  const store = new f.runner.MemoryRunStore();
  await f.runner.runApprovedCalibration(f.execution(async ({ prompt }) => f.response(prompt, { input_tokens: 1000000, output_tokens: 2, total_tokens: 1000002 }), store));
  const ledger = f.ledger(store);
  const verified = f.verifier.verifyCalibrationEvidence(ledger);
  assert.deepEqual(verified.failures, []);
  return { store, ledger, evidence: verified.evidence };
}

test("report accepts only genuine evidence and bounded invocation metadata", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const { evidence, ledger } = await partial(f);
  const report = f.runner.buildCalibrationReport({ evidence });
  assert.equal(report.status, "stopped");
  assert.equal(report.counts.completed, 1);
  assert.equal(report.usage.input_tokens, 1000000);
  assert.equal(report.provider_calls, 1);
  for (const input of [{ evidence: {} }, { evidence: { ...evidence } }, { evidence: structuredClone(evidence) }, { evidence: [] }, { plan: f.plan, store: { listRuns: () => ledger.runs }, status: "complete" }, { evidence, runs: ledger.runs }, { evidence, status: "complete" }, { evidence, stopReason: null }, ...[-1, 2, 0.5, "1"].map((skippedCompleted) => ({ evidence, skippedCompleted }))]) {
    assert.throws(() => f.runner.buildCalibrationReport(input));
  }
  assert.equal(f.runner.buildCalibrationReport({ evidence, skippedCompleted: 1 }).counts.skipped_completed, 1);
  for (const mutate of [(l) => { l.attempts[0].response.content_text = "{}"; }, (l) => { l.runs[0].accuracy_status = "wrong"; }]) {
    const copy = structuredClone(ledger); mutate(copy);
    assert.equal(f.verifier.verifyCalibrationEvidence(copy).evidence, null);
  }
});

test("verified attempts and report are independent of all source store mutations", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const { evidence, store } = await partial(f);
  assert.ok(Object.isFrozen(evidence.attempts));
  const before = f.runner.buildCalibrationReport({ evidence });
  store.attempts.length = 0; store.runs.length = 0; store.checkpoints.clear();
  store.listAttempts = store.listRuns = store.readCheckpoint = () => { throw new Error("must not reread"); };
  assert.deepEqual(f.runner.buildCalibrationReport({ evidence }), before);
  fs.appendFileSync(path.join(f.packageDir, "runtime/runner.mjs"), "\n// changed revision\n");
  assert.throws(() => f.runner.buildCalibrationReport({ evidence }), /revision/);
});

test("partial retry and unresolved intent retain usage uncertainty without claiming responses", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const { ledger } = await partial(f);
  const checkpoint = predecessor(ledger);
  const verified = f.verifier.verifyCalibrationEvidence({ ...ledger, attempts: [], runs: [], checkpoint });
  assert.deepEqual(verified.failures, []);
  const report = f.runner.buildCalibrationReport({ evidence: verified.evidence });
  assert.equal(report.counts.attempts, 1);
  assert.equal(report.provider_calls, 1);
  assert.equal(report.confirmed_provider_responses, 0);
  assert.equal(report.unresolved_in_flight_attempts, 1);
  assert.equal(report.usage.unknown_attempts, 1);
  assert.equal(report.usage.complete, false);
  const retry = structuredClone(ledger);
  const attempt = retry.attempts[0];
  attempt.status = "transport-error"; attempt.response = null;
  attempt.error = { name: "ProviderTransportError", message: "offline", category: "transport_error", retryable: true, usable_response: false };
  retry.runs = []; retry.checkpoint = { ...checkpoint, in_flight_attempt: null };
  const v = f.verifier.verifyCalibrationEvidence(retry);
  assert.deepEqual(v.failures, []);
  assert.equal(f.runner.buildCalibrationReport({ evidence: v.evidence }).usage.unknown_attempts, 1);
});

test("planning reports are closed and always zero-result", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const report = f.runner.buildCalibrationPlanningReport({ plan: f.plan, apiKeyPresence: { openai: "present", anthropic: "absent", google: "absent" } });
  assert.equal(report.status, "dry-run"); assert.equal(report.provider_calls, 0);
  assert.equal(report.counts.completed, 0); assert.equal(report.counts.attempts, 0);
  assert.equal(report.usage.total_tokens, 0);
  for (const extra of [{ runs: [] }, { store: {} }, { status: "complete" }, { evidence: {} }]) assert.throws(() => f.runner.buildCalibrationPlanningReport({ plan: f.plan, ...extra }));
  assert.throws(() => f.runner.buildCalibrationPlanningReport({ plan: { ...f.plan, plan_version: "3.0.0-calibration.2" } }));
  assert.throws(() => f.runner.buildCalibrationPlanningReport({ plan: f.plan, apiKeyPresence: { openai: "secret-value" } }));
});
