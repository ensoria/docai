import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const packageDir = path.resolve(import.meta.dirname, "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4");
const load = (name) => import(pathToFileURL(path.join(packageDir, "runtime", `${name}.mjs`)).href);

test("isolated .4 phase identity separates prepared inputs from freeze authorization", async () => {
  assert.ok(fs.existsSync(packageDir), "isolated calibration.4 draft does not exist");
  const { PACKAGE_DIR, PRIVATE_DIR, PLAN_FILE, readPlan } = await load("paths");
  const { validatePlan } = await load("check-plan");
  const plan = readPlan();
  assert.equal(PACKAGE_DIR, packageDir);
  assert.equal(PRIVATE_DIR, path.join(packageDir, "private"));
  assert.equal(PLAN_FILE, path.join(packageDir, "plan.json"));
  assert.equal(plan.benchmark_id, "docai-http-openapi-comparison-v3");
  assert.equal(plan.plan_version, "3.0.0-calibration.4");
  assert.ok(["calibration-draft", "calibration-frozen"].includes(plan.status));
  assert.doesNotThrow(() => validatePlan(plan));
  if (plan.status === "calibration-frozen") {
    const { validateFrozenPackage } = await load("freeze");
    assert.equal(fs.existsSync(path.join(packageDir, "freeze-manifest.json")), true);
    assert.doesNotThrow(() => validateFrozenPackage());
    return;
  }
  assert.deepEqual(plan.targets.map((target) => target.model_id), [null, null, null]);
  assert.equal(Object.hasOwn(plan, "freeze"), false);
  assert.doesNotThrow(() => validatePlan(plan));
  for (const entry of ["freeze-manifest.json", "private/runs", "private/checkpoints", "private/adjudication"]) {
    assert.equal(fs.existsSync(path.join(packageDir, entry)), false, entry);
  }
  const prepared = fs.existsSync(path.join(packageDir, "model-resolutions.json"));
  for (const entry of ["cost-estimate.json", "private/prompts/calibration.jsonl", "private/contexts/calibration-metrics.json"]) {
    assert.equal(fs.existsSync(path.join(packageDir, entry)), prepared, entry);
  }
  if (prepared) {
    const { validateModelResolutions, validateCostEstimate } = await load("estimate-cost");
    const packet = name => JSON.parse(fs.readFileSync(path.join(packageDir, name), "utf8"));
    const models = packet("model-resolutions.json");
    assert.doesNotThrow(() => validateModelResolutions(plan, models));
    assert.doesNotThrow(() => validateCostEstimate(plan, packet("cost-estimate.json"), models, packet("private/contexts/calibration-metrics.json")));
  }
});

test(".4 schedule contains exactly the designated 24 unique identities", async () => {
  const { readPlan, buildCalibrationSchedule } = await load("paths");
  const plan = readPlan();
  assert.deepEqual(plan.calibration.task_ids, ["upload-document-request", "complete-checkout-workflow"]);
  assert.deepEqual(plan.targets.map(({ id, provider }) => [id, provider]), [
    ["openai-frontier", "openai"], ["anthropic-balanced", "anthropic"], ["google-stable-agentic", "google"],
  ]);
  assert.deepEqual(plan.conditions, ["openapi-raw", "openapi-sliced", "openapi-enriched", "docai-selected"]);
  assert.deepEqual(plan.calibration.repetitions, [1]);
  assert.equal(plan.calibration.planned_requests, 24);
  assert.deepEqual(plan.calibration.gate, { minimum_automated_decisions: 23, maximum_exceptional_runs: 1 });
  const rows = buildCalibrationSchedule(plan);
  assert.equal(rows.length, 24);
  assert.equal(new Set(rows.map((row) => row.run_id)).size, 24);
  for (const task of plan.calibration.task_ids) for (const target of plan.targets) {
    const pair = rows.filter((row) => row.task_id === task && row.target_id === target.id);
    assert.deepEqual(pair.map((row) => row.condition).sort(), [...plan.conditions].sort());
    for (const row of pair) {
      assert.equal(row.run_id, [plan.benchmark_id, "3.0.0-calibration.4", "calibration", target.id, task, row.condition].join("__"));
      assert.equal(row.repetition, 1);
      assert.equal(row.provider, target.provider);
      assert.equal(row.api_id, "complete-commerce");
    }
  }
  assert.deepEqual(rows.map((row) => row.calibration_ordinal), Array.from({ length: 24 }, (_, i) => i + 1));
  const persisted = fs.readFileSync(path.join(packageDir, "calibration-schedule.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(persisted, rows);
  assert.deepEqual(buildCalibrationSchedule(readPlan()), rows);
});

test("public runtime has no predecessor runtime or private namespace references", () => {
  const runtime = path.join(packageDir, "runtime");
  for (const file of fs.readdirSync(runtime)) {
    assert.equal(fs.lstatSync(path.join(runtime, file)).isSymbolicLink(), false, file);
    const source = fs.readFileSync(path.join(runtime, file), "utf8");
    assert.doesNotMatch(source, /calibration\.[123]|calibration[123]|(?:\.\.\/)+tools\//i, file);
    for (const match of source.matchAll(/(?:from\s+|import\s*\()(["'])([^"']+)\1/g)) {
      const specifier = match[2];
      assert.ok(specifier.startsWith("node:") || (specifier.startsWith("./") && fs.existsSync(path.resolve(runtime, specifier))), `${file}: ${specifier}`);
    }
  }
});

test("draft authority blocks frozen verification and publication, not pure preparation", async () => {
  const { readPlan } = await load("paths");
  if (readPlan().status === "calibration-frozen") return;
  const freeze = await load("freeze");
  for (const name of ["validateFrozenPackage", "publishFreezePair"]) {
    assert.throws(() => freeze[name]({ runtimeIdentity: {} }), /draft freeze is disabled/);
  }
  assert.throws(() => freeze.buildCalibrationFreeze({ runtimeIdentity: {} }), /explicit frozenAt/);
});
