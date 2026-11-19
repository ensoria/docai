import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cliFixture } from "./calibration4-cli-helpers.mjs";
import { fixture } from "./calibration4-stop-helpers.mjs";
import { pinFixtureAuthority } from "./calibration4-freeze-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PACKAGE = "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4";
const PACKAGE_DIR = path.join(ROOT, PACKAGE);
const MODELS = ["gpt-5.6-sol", "claude-sonnet-5", "gemini-3.8-flash"];

test("synthetic fixture synchronizes its disposable plan after a frozen source is copied", async () => {
  const f = await fixture();
  try {
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.packageDir, "plan.json"), "utf8")), f.plan);
    assert.equal(f.plan.status, "calibration-frozen");
    assert.equal(f.prompts.length, 24);
    assert.equal(f.prompts.every((prompt) => prompt.plan_version === f.plan.plan_version), true);
  } finally { f.cleanup(); }
});

async function runtime(name) {
  const file = path.join(PACKAGE_DIR, "runtime", `${name}.mjs`);
  assert.ok(fs.existsSync(file), `missing isolated calibration.4 runtime: ${name}`);
  return import(pathToFileURL(file).href);
}

test("accepts a disposable .4 draft and rejects the predecessor identity", async () => {
  const { readPlan, PACKAGE_DIR: actual, PRIVATE_DIR } = await runtime("paths");
  const { validatePlan } = await runtime("check-plan");
  const plan = readPlan();
  plan.status = "calibration-draft";
  delete plan.freeze;
  plan.targets.forEach((target) => { target.model_id = null; });
  assert.equal(actual, PACKAGE_DIR);
  assert.equal(PRIVATE_DIR, path.join(PACKAGE_DIR, "private"));
  assert.equal(plan.plan_version, "3.0.0-calibration.4");
  assert.equal(plan.status, "calibration-draft");
  assert.deepEqual(plan.targets.map((target) => target.model_id), [null, null, null]);
  assert.equal(Object.hasOwn(plan, "freeze"), false);
  assert.doesNotThrow(() => validatePlan(plan));
  assert.throws(() => validatePlan({ ...plan, plan_version: "3.0.0-calibration.2" }), /unexpected plan_version/);
  assert.throws(() => validatePlan(plan, { requireFrozen: true }), /status must be calibration-frozen/);
});

test("resolved plan validation requires exactly the approved model panel", async () => {
  const { readPlan } = await runtime("paths");
  const { validatePlan, FROZEN_ARTIFACT_CLASSES } = await runtime("check-plan");
  // Synthetic shape/time only: this is not a seal, manifest, or execution approval.
  const plan = readPlan();
  plan.status = "calibration-frozen";
  plan.targets.forEach((target, index) => { target.model_id = MODELS[index]; });
  plan.freeze = {
    manifest: "freeze-manifest.json",
    frozen_at: "2026-11-09T00:00:00Z",
    artifact_set_sha256: "0".repeat(64),
    required_artifact_classes: [...FROZEN_ARTIFACT_CLASSES],
  };
  assert.doesNotThrow(() => validatePlan(plan, { requireFrozen: true }));
  for (const [index, wrong] of [[0, "other-openai"], [1, "other-anthropic"], [2, "gemini-3.7-flash"]]) {
    const changed = structuredClone(plan);
    changed.targets[index].model_id = wrong;
    assert.throws(() => validatePlan(changed), new RegExp(`model_id must be ${MODELS[index]}`));
  }
});

test("regenerates 24 deterministic unique rows in the .4 identity ordering", async () => {
  const { readPlan, buildCalibrationSchedule } = await runtime("paths");
  const plan = readPlan();
  const schedule = buildCalibrationSchedule(plan);
  const expectedPairs = [
    ["docai-selected", "openapi-enriched", "openapi-sliced", "openapi-raw"],
    ["openapi-raw", "openapi-sliced", "openapi-enriched", "docai-selected"],
    ["openapi-enriched", "openapi-sliced", "openapi-raw", "docai-selected"],
    ["docai-selected", "openapi-enriched", "openapi-sliced", "openapi-raw"],
    ["openapi-enriched", "docai-selected", "openapi-raw", "openapi-sliced"],
    ["docai-selected", "openapi-enriched", "openapi-sliced", "openapi-raw"],
  ];
  assert.equal(schedule.length, 24);
  assert.equal(new Set(schedule.map((row) => row.run_id)).size, 24);
  assert.deepEqual(buildCalibrationSchedule(readPlan()), schedule);
  assert.deepEqual(schedule.map((row) => row.calibration_ordinal), Array.from({ length: 24 }, (_, i) => i + 1));
  expectedPairs.forEach((conditions, i) => {
    assert.deepEqual(schedule.slice(i * 4, (i + 1) * 4).map((row) => row.condition), conditions);
  });
  assert.ok(schedule.every((row) => row.run_id.includes("__3.0.0-calibration.4__")));
  const persisted = fs.readFileSync(path.join(PACKAGE_DIR, "calibration-schedule.jsonl"), "utf8")
    .trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(persisted, schedule);
});

test("ignores only package-private outputs while preserving its README", () => {
  const result = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
    cwd: ROOT,
    encoding: "utf8",
    input: [`${PACKAGE}/private/runs.jsonl`, `${PACKAGE}/private/prompts/calibration.jsonl`, `${PACKAGE}/private/README.md`, `${PACKAGE}/plan.json`].join("\n") + "\n",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), [
    `${PACKAGE}/private/runs.jsonl`, `${PACKAGE}/private/prompts/calibration.jsonl`,
  ]);
});

test("draft frozen validation and publication fail closed without the fixed .4 authority", async () => {
  const f = await cliFixture();
  try {
    await pinFixtureAuthority(f.packageDir, null);
    const freeze = await f.load("freeze");
    for (const operation of ["validateFrozenPackage", "publishFreezePair"]) {
      assert.throws(() => freeze[operation]({ runtimeIdentity: {} }), /draft freeze is disabled until phase7B/);
    }
  } finally { f.cleanup(); }
});
