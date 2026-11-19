import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";

const packageDir = path.resolve(import.meta.dirname, "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4");
const load = (name) => import(pathToFileURL(path.join(packageDir, "runtime", `${name}.mjs`)).href);

test("plan CLI reports the successor phase identity", () => {
  const result = spawnSync(process.execPath, [path.join(packageDir, "runtime/check-plan.mjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(fs.readFileSync(path.join(packageDir, "plan.json"), "utf8"));
  assert.ok(result.stdout.includes(`Calibration.4 plan check passed: ${plan.status}`));
});

test("draft plan rejects predecessor identities and cannot validate as frozen", async () => {
  const { readPlan } = await load("paths");
  const { validatePlan } = await load("check-plan");
  const plan = readPlan();
  plan.status = "calibration-draft"; delete plan.freeze;
  plan.targets.forEach(target => { target.model_id = null; });
  assert.doesNotThrow(() => validatePlan(plan));
  for (const version of ["3.0.0-calibration.1", "3.0.0-calibration.2", "3.0.0-calibration.3"]) {
    assert.throws(() => validatePlan({ ...plan, plan_version: version }), /unexpected plan_version/);
  }
  assert.throws(() => validatePlan(plan, { requireFrozen: true }), /status must be calibration-frozen/);
});

test("prepared model and cost interfaces reject inherited authorization packets", async () => {
  const policy = await load("estimate-cost");
  const { readPlan } = await load("paths");
  const plan = readPlan();
  const models = JSON.parse(fs.readFileSync(path.join(packageDir, "model-resolutions.json"), "utf8"));
  assert.doesNotThrow(() => policy.validateModelResolutions(plan, models));
  models.plan_version = "3.0.0-calibration.3";
  assert.throws(() => policy.validateModelResolutions(plan, models));
  const cost = JSON.parse(fs.readFileSync(path.join(packageDir, "cost-estimate.json"), "utf8"));
  cost.plan_version = "3.0.0-calibration.3";
  assert.throws(() => policy.validateCostEstimate(plan, cost, models, {}));
});

test("actual execute CLI with fake credentials and .4 approval fails before injected fetch", () => {
  const plan = JSON.parse(fs.readFileSync(path.join(packageDir, "plan.json"), "utf8"));
  if (plan.status === "calibration-frozen") return; // Published guards are exercised in the sealed CLI fixture.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "calibration4-draft-preflight-"));
  try {
    const calls = path.join(root, "fetch-calls");
    const preload = path.join(root, "deny-fetch.mjs");
    fs.writeFileSync(preload, `import fs from "node:fs"; globalThis.fetch = async () => { fs.appendFileSync(${JSON.stringify(calls)}, "called\\n"); throw new Error("unexpected fetch"); };`);
    const env = {
      PATH: process.env.PATH, HOME: root, NODE_OPTIONS: "",
      OPENAI_API_KEY: "fake-openai", ANTHROPIC_API_KEY: "fake-ant", GOOGLE_API_KEY: "fake-google", GEMINI_API_KEY: "fake-google",
      DOCAI_LIVE_LLM_APPROVED_CALIBRATION: "3.0.0-calibration.4",
    };
    for (const [name, args] of [["run-calibration", ["--execute"]], ["freeze", ["--check", "--private-required"]], ["freeze", ["--write", "--private-required"]], ["check-plan", ["--frozen"]]]) {
      const result = spawnSync(process.execPath, ["--import", preload, path.join(packageDir, "runtime", `${name}.mjs`), ...args], { env, encoding: "utf8", timeout: 30000 });
      assert.equal(result.error, undefined);
      assert.notEqual(result.status, 0, name);
      assert.match(result.stderr, /draft freeze is disabled|status must be calibration-frozen/, name);
      for (const secret of [env.OPENAI_API_KEY, env.ANTHROPIC_API_KEY, env.GOOGLE_API_KEY]) assert.ok(!(result.stdout + result.stderr).includes(secret));
      assert.equal(fs.existsSync(calls), false, `${name}: zero injected fetch calls`);
      assert.equal(fs.existsSync(path.join(packageDir, "freeze-manifest.json")), false);
      for (const store of ["runs", "checkpoints", "adjudication"]) assert.equal(fs.existsSync(path.join(packageDir, "private", store)), false);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
