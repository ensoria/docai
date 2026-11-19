import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fixture } from "./calibration4-stop-helpers.mjs";

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

test("file store confines checkpoint identities and preserves unsafe files without repair", async t => {
  const f = await fixture(); t.after(f.cleanup);
  const runsDir = path.join(f.packageDir, "private/runs", "synthetic");
  const checkpointsDir = path.join(f.packageDir, "private/checkpoints", "synthetic");
  const store = new f.runner.FileRunStore({ runsDir, checkpointsDir });
  assert.deepEqual(store.listAttempts(), []);
  assert.equal(fs.existsSync(runsDir), false);
  assert.throws(() => store.readCheckpoint("../outside"), /batch id/);
  assert.throws(() => new f.runner.FileRunStore({ runsDir: f.root, checkpointsDir }), /approved private root/);
  store.initialize();
  assert.equal(fs.statSync(runsDir).mode & 0o777, 0o700);
  const source = path.join(f.root, "outside.json");
  fs.writeFileSync(source, "{}\n", { mode: 0o600 });
  const file = path.join(checkpointsDir, "calibration.json");
  fs.symlinkSync(source, file);
  assert.throws(() => store.readCheckpoint(), /symlink/);
  assert.equal(fs.readFileSync(source, "utf8"), "{}\n");
  fs.unlinkSync(file); fs.writeFileSync(file, "{}\n", { mode: 0o644 });
  assert.throws(() => store.readCheckpoint(), /permissions/);
  assert.equal(fs.statSync(file).mode & 0o777, 0o644);
  fs.chmodSync(file, 0o600);
  const log = path.join(runsDir, "calibration/attempts.jsonl");
  fs.writeFileSync(log, "{}", { mode: 0o600 });
  assert.throws(() => store.listAttempts(), /newline/);
  fs.writeFileSync(log, "{}\n"); fs.chmodSync(log, 0o644);
  assert.throws(() => store.listAttempts(), /permissions/);
  assert.equal(fs.statSync(log).mode & 0o777, 0o644);
});

test("runner revision binds native pricing and semantic reconstruction dependencies", async t => {
  const f = await fixture(); t.after(f.cleanup);
  const before = f.runner.buildRunnerRevision();
  for (const name of ["provider-usage", "billing", "semantic-predicates", "answer-values", "check-evidence-ledger"]) {
    const file = path.join(f.packageDir, "runtime", name + ".mjs"), bytes = fs.readFileSync(file);
    try {
      fs.appendFileSync(file, "\n// disposable dependency drift\n");
      assert.notEqual(f.runner.buildRunnerRevision(), before, name);
    } finally { fs.writeFileSync(file, bytes); }
  }
});

test("runner rejects store accessors and Proxy prototypes before invoking traps", async t => {
  const f = await fixture(); t.after(f.cleanup);
  let calls = 0;
  const options = f.execution(async ({ prompt }) => { calls++; return f.response(prompt); });
  for (const method of ["listAttempts", "listRuns", "appendAttempt", "appendRun", "readCheckpoint", "writeCheckpoint"]) {
    let getters = 0;
    const store = new f.runner.MemoryRunStore();
    Object.defineProperty(store, method, { get() { getters++; throw new Error("getter invoked"); } });
    await assert.rejects(f.runner.runApprovedCalibration({ ...options, store }));
    assert.equal(getters, 0, method);
  }
  let traps = 0;
  const store = Object.create(new Proxy({}, { get() { traps++; }, getOwnPropertyDescriptor() { traps++; }, getPrototypeOf() { traps++; } }));
  await assert.rejects(f.runner.runApprovedCalibration({ ...options, store }));
  assert.equal(traps, 0); assert.equal(calls, 0);
});

test("runner completion report includes every charge without rereading after final write", async (t) => {
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
    return f.response(prompt);
  }, store));
  assert.equal(result.report.status, "complete");
  assert.equal(result.report.counts.completed, 24);
  assert.equal(result.report.counts.attempts, 24);
  assert.equal(result.report.provider_calls, 24);
  assert.equal(result.report.confirmed_provider_responses, 24);
  assert.equal(result.report.usage.total_tokens, 72);
  assert.equal(result.report.usage.unknown_attempts, 0);
  assert.equal(result.report.usage.complete, true);
});
