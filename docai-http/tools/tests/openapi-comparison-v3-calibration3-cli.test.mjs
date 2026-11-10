import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cliFixture } from "./calibration3-cli-helpers.mjs";

test("actual execute CLI retains all 24 canonical runs and passes genuine verification and gate", async (t) => {
  const f = await cliFixture(); t.after(f.cleanup);
  const result = f.spawn();
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(f.store.listRuns().length, 24, "exit zero must not mask an entrypoint no-op");
  assert.equal(f.store.listAttempts().length, 24);
  assert.equal(f.calls(), 24);
  const ledger = { ...f.ledger(f.store), plan: JSON.parse(fs.readFileSync(path.join(f.packageDir, "plan.json"))), expectedRunnerRevision: f.runner.buildRunnerRevision() };
  const verified = f.verifier.verifyCalibrationEvidence(ledger);
  assert.deepEqual(verified.failures, []);
  const gate = await f.load("gate");
  assert.equal(gate.evaluateCalibrationGate(verified.evidence).passed, true);
  const check = f.spawn("check-runs", []);
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(check.stdout).calibration.runs, 24);
  const again = f.spawn();
  assert.equal(again.status, 0, again.stderr);
  assert.equal(f.calls(), 24);
  assert.equal(f.store.listRuns().length, 24);
  assert.match(again.stdout, /"skipped_completed": 24/);
});

test("actual CLI blocks approval, credentials, freeze and unresolved intent before transport", async (t) => {
  const f = await cliFixture(); t.after(f.cleanup);
  for (const [name, overrides, expected] of [["approval", { DOCAI_LIVE_LLM_APPROVED_CALIBRATION: "wrong" }, /requires DOCAI/], ["credentials", { OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", GOOGLE_API_KEY: "", GEMINI_API_KEY: "" }, /key.*required|key.*present/i]]) {
    await t.test(name, () => {
      const result = f.spawn("run-calibration", ["--execute"], overrides);
      assert.notEqual(result.status, 0); assert.match(result.stderr, expected);
      assert.equal(f.calls(), 0); assert.equal(f.store.listRuns().length, 0);
    });
  }
  const manifestPath = path.join(f.packageDir, "freeze-manifest.json");
  const manifest = fs.readFileSync(manifestPath);
  fs.writeFileSync(manifestPath, "{}\n");
  const bad = f.spawn(); assert.notEqual(bad.status, 0); assert.equal(f.calls(), 0);
  fs.writeFileSync(manifestPath, manifest);
  const prompt = f.prompts[0];
  const revision = f.runner.buildRunnerRevision();
  const identity = { benchmark_id: f.plan.benchmark_id, plan_version: f.plan.plan_version, batch_id: "calibration", run_id: prompt.run_id, api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider, condition: prompt.condition, repetition: prompt.repetition, runner_revision: revision };
  const now = "2026-11-09T00:00:00.000Z";
  f.store.initialize();
  f.store.writeCheckpoint("calibration", { checkpoint_version: "1", benchmark_id: f.plan.benchmark_id, plan_version: f.plan.plan_version, batch_id: "calibration", status: "open", stop_reason: null, attempt_count: 1, completed_run_ids: [], in_flight_attempt: { intent_version: "1", ...identity, attempt_number: 1, started_at: now }, runner_revision: revision, updated_at: now });
  const before = f.store.readCheckpoint();
  const blocked = f.spawn();
  assert.notEqual(blocked.status, 0); assert.match(blocked.stderr, /unresolved-in-flight-intent/);
  assert.equal(f.calls(), 0); assert.deepEqual(f.store.readCheckpoint(), before);
});
