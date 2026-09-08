import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PACKAGE_DIR,
  PLAN_FILE,
  PRIVATE_DIR,
  buildCalibrationSchedule,
  readPlan,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";
import { validatePlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-plan.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const EXPECTED_CONDITIONS = [
  "openapi-raw",
  "openapi-sliced",
  "openapi-enriched",
  "docai-selected",
];
const EXPECTED_TARGETS = [
  "openai-frontier/openai",
  "anthropic-balanced/anthropic",
  "google-stable-agentic/google",
];
const EXPECTED_TASK_IDS = [
  "upload-document-request",
  "complete-checkout-workflow",
];
const EXPECTED_PAIR_CONDITIONS = {
  "upload-document-request/openai-frontier": ["openapi-sliced", "openapi-enriched", "docai-selected", "openapi-raw"],
  "upload-document-request/anthropic-balanced": ["docai-selected", "openapi-enriched", "openapi-sliced", "openapi-raw"],
  "upload-document-request/google-stable-agentic": ["openapi-sliced", "openapi-raw", "docai-selected", "openapi-enriched"],
  "complete-checkout-workflow/openai-frontier": ["openapi-enriched", "docai-selected", "openapi-raw", "openapi-sliced"],
  "complete-checkout-workflow/anthropic-balanced": ["openapi-enriched", "openapi-sliced", "openapi-raw", "docai-selected"],
  "complete-checkout-workflow/google-stable-agentic": ["openapi-enriched", "docai-selected", "openapi-raw", "openapi-sliced"],
};

function clonedPlan() {
  return structuredClone(readPlan());
}

function countedProxy(target) {
  let trapCalls = 0;
  const proxy = new Proxy(target, {
    get(target_, property, receiver) {
      trapCalls += 1;
      return Reflect.get(target_, property, receiver);
    },
    getPrototypeOf(target_) {
      trapCalls += 1;
      return Reflect.getPrototypeOf(target_);
    },
    ownKeys(target_) {
      trapCalls += 1;
      return Reflect.ownKeys(target_);
    },
    getOwnPropertyDescriptor(target_, property) {
      trapCalls += 1;
      return Reflect.getOwnPropertyDescriptor(target_, property);
    },
  });

  return { proxy, trapCalls: () => trapCalls };
}

test("defines the calibration.2 package boundary and canonical 24-run identity", () => {
  const plan = readPlan();
  const schedule = buildCalibrationSchedule(plan);

  assert.equal(PACKAGE_DIR, path.join(
    REPOSITORY_ROOT,
    "docai-http",
    "benchmarks",
    "openapi-comparison",
    "v3",
    "calibrations",
    "3.0.0-calibration.2",
  ));
  assert.equal(PLAN_FILE, path.join(PACKAGE_DIR, "plan.json"));
  assert.equal(PRIVATE_DIR, path.join(PACKAGE_DIR, "private"));
  assert.equal(plan.plan_version, "3.0.0-calibration.2");
  assert.deepEqual(plan.conditions, EXPECTED_CONDITIONS);
  assert.deepEqual(plan.targets.map(({ id, provider }) => `${id}/${provider}`), EXPECTED_TARGETS);
  assert.deepEqual(plan.calibration.task_ids, EXPECTED_TASK_IDS);
  assert.deepEqual(plan.calibration.repetitions, [1]);
  assert.equal(schedule.length, 24);
  assert.equal(new Set(schedule.map((row) => row.run_id)).size, 24);
  assert.ok(schedule.every((row) => row.run_id.includes("3.0.0-calibration.2")));

  plan.calibration.task_ids.forEach((taskId) => {
    plan.targets.forEach(({ id: targetId }) => {
      const pairConditions = schedule
        .filter((row) => row.task_id === taskId && row.target_id === targetId)
        .map((row) => row.condition);

      assert.deepEqual(pairConditions, EXPECTED_PAIR_CONDITIONS[`${taskId}/${targetId}`]);
    });
  });
});

test("accepts only the closed calibration.2 draft plan shape", () => {
  assert.doesNotThrow(() => validatePlan(clonedPlan()));

  [
    ["primary_schedule", []],
    ["run_ids", ["primary-run-1"]],
    ["approval_state", "approved"],
  ].forEach(([field, value]) => {
    const plan = clonedPlan();
    plan[field] = value;
    assert.throws(() => validatePlan(plan), new RegExp(`unknown key ${field}`));
  });

  [
    ["schedule_rows", [{ run_id: "primary-run-1" }]],
    ["run_ids", ["primary-run-1"]],
    ["approval_state", "approved"],
  ].forEach(([field, value]) => {
    const plan = clonedPlan();
    plan.future_primary_design[field] = value;
    assert.throws(() => validatePlan(plan), new RegExp(`unknown key ${field}`));
  });

  const accessorPlan = clonedPlan();
  Object.defineProperty(accessorPlan, "status", {
    enumerable: true,
    get() {
      return "calibration-draft";
    },
  });
  assert.throws(() => validatePlan(accessorPlan), /plain JSON/);

  const executablePlan = clonedPlan();
  executablePlan.future_primary_design = Object.create(null);
  assert.throws(() => validatePlan(executablePlan), /plain JSON/);
});

test("rejects Array subclasses before inherited iterators can spoof calibration data", () => {
  let iteratorCalls = 0;
  class SpoofedConditions extends Array {
    *[Symbol.iterator]() {
      iteratorCalls += 1;
      yield* EXPECTED_CONDITIONS;
    }
  }

  const plan = clonedPlan();
  plan.conditions = new SpoofedConditions("invalid-1", "invalid-2", "invalid-3", "invalid-4");

  assert.throws(() => validatePlan(plan), /plain JSON array/);
  assert.equal(iteratorCalls, 0);
});

test("rejects nested array Proxies before invoking their traps", () => {
  const plan = clonedPlan();
  const { proxy, trapCalls } = countedProxy(plan.conditions);
  plan.conditions = proxy;

  assert.throws(() => validatePlan(plan), /Proxy/);
  assert.equal(trapCalls(), 0);
});

test("rejects nested object Proxies before invoking their traps", () => {
  const plan = clonedPlan();
  const { proxy, trapCalls } = countedProxy(plan.calibration);
  plan.calibration = proxy;

  assert.throws(() => validatePlan(plan), /Proxy/);
  assert.equal(trapCalls(), 0);
});

test("rejects reordered calibration dimensions", () => {
  [
    ["conditions", (plan) => plan.conditions.reverse()],
    ["targets", (plan) => plan.targets.reverse()],
    ["calibration tasks", (plan) => plan.calibration.task_ids.reverse()],
    ["calibration repetitions", (plan) => { plan.calibration.repetitions = [2]; }],
  ].forEach(([dimension, mutate]) => {
    const plan = clonedPlan();
    mutate(plan);
    assert.throws(() => validatePlan(plan), new RegExp(`${dimension}.*must match the approved order`));
  });
});

test("does not disturb the frozen calibration.1 package", () => {
  const result = spawnSync(
    process.execPath,
    ["docai-http/tools/freeze-openapi-comparison-v3.mjs", "--check"],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(PACKAGE_DIR, "plan.json")), true);
});
