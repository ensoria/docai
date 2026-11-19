import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cliFixture } from "./calibration4-cli-helpers.mjs";
import { pinFixtureAuthority } from "./calibration4-freeze-helpers.mjs";

test("actual execute CLI retains all 24 canonical runs and passes genuine verification and gate", async (t) => {
  const f = await cliFixture(); t.after(f.cleanup);
  const result = f.spawn();
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(f.store.listRuns().length, 24, "exit zero must not mask an entrypoint no-op");
  assert.equal(f.store.listAttempts().length, 24);
  assert.equal(f.calls(), 24);
  assert.equal(new Set(f.requests().map(r => r.run_id)).size, 24);
  for (const request of f.requests()) {
    assert.equal(request.body.max_output_tokens ?? request.body.max_tokens ?? request.body.generation_config?.max_output_tokens, 16384);
  }
  const now = Date.now();
  for (const attempt of f.store.listAttempts()) {
    assert.ok(Math.abs(now - Date.parse(attempt.started_at)) < 120000);
    assert.ok(Date.parse(attempt.ended_at) >= Date.parse(attempt.started_at));
    const raw = attempt.response.raw_response;
    if (attempt.provider !== "anthropic") assert.equal(Object.hasOwn(raw, "output_text"), false, "native output must exercise content/steps parsing");
    if (attempt.provider === "openai") {
      assert.equal(raw.text.verbosity, "medium");
      assert.deepEqual(raw.output[0].content[0].logprobs, []);
    }
    if (attempt.provider === "google") {
      assert.ok(raw.steps.some(step => step.type === "thought" && step.signature));
      assert.ok(raw.steps.some(step => step.type === "model_output"));
      assert.equal(attempt.accounting.usage.reasoning_tokens, 1);
      assert.equal(attempt.accounting.usage.final_output_tokens, 1);
      assert.equal(attempt.accounting.usage.output_tokens, 2);
      assert.equal(attempt.accounting.charge.estimated_usd, (0.75 + 2 * 3.75) / 1000000);
    }
    assert.equal(attempt.response.content_text, JSON.stringify(f.tasks.find(task => task.id === attempt.task_id).private.expected_outcome));
  }
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

for (const mode of ["openai-billing", "google-tool"]) test(`fix1 actual CLI ${mode} stays unknown and terminal with native evidence`, async t => {
  const f = await cliFixture(); t.after(f.cleanup);
  const env = { TASK5_FAKE_NATIVE: mode };
  const result = f.spawn("run-calibration", ["--execute"], env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.calls(), mode === "openai-billing" ? 1 : 9);
  assert.equal(f.store.readCheckpoint().stop_reason, "accounting-unknown");
  const last = f.store.listAttempts().at(-1);
  assert.equal(last.accounting.charge.estimated_usd, null);
  if (mode === "openai-billing") assert.equal(last.response.raw_response.output[0].content[0].billing_addon, null);
  else assert.equal(last.response.raw_response.steps.at(-1).type, "function_call");
  const before = f.calls();
  assert.equal(f.spawn("run-calibration", ["--execute"], env).status, 0);
  assert.equal(f.calls(), before);
});

for (const mode of ["reject", "read", "partial"]) test(`actual CLI ${mode} retains terminal evidence and never retries or resends`, async t => {
  const f = await cliFixture(); t.after(f.cleanup);
  const env = { TASK5_FAKE_TRANSPORT: mode };
  const result = f.spawn("run-calibration", ["--execute"], env);
  assert.equal(result.status, 0, result.stderr);
  if (mode === "partial") {
    // Complete accounting permits continuing the schedule, never retrying a response.
    assert.equal(f.calls(), 24);
    assert.ok(f.store.listRuns().every(r => r.transport_status === "incomplete" && r.content_json === null));
  } else {
    assert.equal(f.calls(), 1);
    assert.equal(f.store.readCheckpoint().stop_reason, "accounting-unknown");
    assert.equal(f.store.listAttempts()[0].accounting.charge.estimated_usd, null);
    assert.match(f.store.listAttempts()[0].error.message, /failure/);
  }
  const before = f.calls();
  assert.equal(f.spawn("run-calibration", ["--execute"], env).status, 0);
  assert.equal(f.calls(), before);
});

test("actual CLI null freeze anchor makes zero calls", async t => {
  const f = await cliFixture(); t.after(f.cleanup);
  await pinFixtureAuthority(f.packageDir, null);
  const result = f.spawn();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /disabled|anchor|artifact/i);
  assert.equal(f.calls(), 0); assert.equal(f.store.listAttempts().length, 0);
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
