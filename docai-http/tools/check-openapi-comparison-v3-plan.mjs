#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BENCHMARK_DIR,
  buildCalibrationSchedule,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";
import { calibrationScheduleJsonl } from "./build-openapi-comparison-v3-calibration-schedule.mjs";
import {
  REQUIRED_ARTIFACT_CLASSES,
  validateFrozenBenchmarkOutputs,
} from "./freeze-openapi-comparison-v3.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLAN_DOC = path.join(BENCHMARK_DIR, "PLAN.md");
const README_FILE = path.join(BENCHMARK_DIR, "README.md");
const PRIVATE_README_FILE = path.join(BENCHMARK_DIR, "private", "README.md");
const CLOSURE_FILE = path.resolve(BENCHMARK_DIR, "..", "V2-DIAGNOSTIC-CLOSURE.md");
const CALIBRATION_SCHEDULE_FILE = path.join(BENCHMARK_DIR, "calibration-schedule.jsonl");
const FUTURE_PRIMARY_DESIGN_KEYS = new Set([
  "api_count",
  "tasks_per_api",
  "target_count",
  "repetitions",
  "condition_count",
  "planned_requests",
  "batch_count",
  "requests_per_batch",
]);
const FROZEN_MODEL_IDS = new Map([
  ["openai-frontier", "gpt-5.6-sol"],
  ["anthropic-balanced", "claude-sonnet-5"],
  ["google-stable-agentic", "gemini-3.7-flash"],
]);

export function validateV3Plan(candidate, {
  closureDocumentExists = true,
  requireFrozen = false,
} = {}) {
  const failures = [];
  const fail = (area, message) => failures.push(`${area}: ${message}`);
  const assert = (condition, area, message) => {
    if (!condition) fail(area, message);
  };

  assert(closureDocumentExists, "closure", "V2-DIAGNOSTIC-CLOSURE.md is required");
  assert(candidate?.benchmark_id === "docai-http-openapi-comparison-v3", "identity", "unexpected benchmark_id");
  assert(candidate?.plan_version === "3.0.0-calibration.1", "identity", "unexpected plan_version");
  assert(
    ["calibration-draft", "calibration-frozen"].includes(candidate?.status),
    "identity",
    "status must be calibration-draft or calibration-frozen",
  );
  if (requireFrozen) {
    assert(candidate?.status === "calibration-frozen", "freeze", "status must be calibration-frozen");
  }
  assertSameMembers(candidate?.conditions ?? [], [
    "openapi-raw",
    "openapi-sliced",
    "openapi-enriched",
    "docai-selected",
  ], "conditions", fail);

  const targets = candidate?.targets ?? [];
  assert(targets.length === 3, "targets", "exactly three targets are required");
  assertSameMembers(
    targets.map((target) => `${target.id}/${target.provider}`),
    [
      "openai-frontier/openai",
      "anthropic-balanced/anthropic",
      "google-stable-agentic/google",
    ],
    "targets",
    fail,
  );
  targets.forEach((target) => {
    const expectedModel = FROZEN_MODEL_IDS.get(target.id);
    if (candidate?.status === "calibration-frozen") {
      assert(
        target.model_id === expectedModel,
        `target:${target.id ?? "<unknown>"}`,
        `model_id must be ${expectedModel}`,
      );
    } else {
      assert(target.model_id === null, `target:${target.id ?? "<unknown>"}`, "model_id must remain null until catalog verification");
    }
  });

  const calibration = candidate?.calibration ?? {};
  assert(calibration.api_id === "complete-commerce", "calibration", "api_id must be complete-commerce");
  assertSameMembers(
    calibration.task_ids ?? [],
    ["upload-document-request", "complete-checkout-workflow"],
    "calibration tasks",
    fail,
  );
  assertSameMembers(calibration.repetitions ?? [], [1], "calibration repetitions", fail);
  assert(calibration.planned_requests === 24, "calibration", "planned_requests must be 24");
  assert(calibration.maximum_attempts_per_work_step === 100, "calibration", "maximum_attempts_per_work_step must be 100");
  assert(calibration.gate?.minimum_automated_decisions === 23, "calibration gate", "minimum_automated_decisions must be 23");
  assert(calibration.gate?.maximum_exceptional_runs === 1, "calibration gate", "maximum_exceptional_runs must be 1");

  const calculatedCalibrationRequests = (calibration.task_ids?.length ?? 0)
    * targets.length
    * (calibration.repetitions?.length ?? 0)
    * (candidate?.conditions?.length ?? 0);
  assert(calculatedCalibrationRequests === 24, "calibration", `matrix calculates ${calculatedCalibrationRequests} requests instead of 24`);

  const primary = candidate?.future_primary_design ?? {};
  Object.keys(primary).forEach((key) => {
    assert(FUTURE_PRIMARY_DESIGN_KEYS.has(key), "future primary", `unknown key ${key}`);
  });
  assert(primary.api_count === 3, "future primary", "api_count must be 3");
  assert(primary.tasks_per_api === 6, "future primary", "tasks_per_api must be 6");
  assert(primary.target_count === 3, "future primary", "target_count must be 3");
  assert(primary.repetitions === 3, "future primary", "repetitions must be 3");
  assert(primary.condition_count === 4, "future primary", "condition_count must be 4");
  assert(primary.planned_requests === 648, "future primary", "planned_requests must be 648");
  assert(primary.batch_count === 9, "future primary", "batch_count must be 9");
  assert(primary.requests_per_batch === 72, "future primary", "requests_per_batch must be 72");
  assert(
    primary.api_count * primary.tasks_per_api * primary.target_count * primary.repetitions * primary.condition_count === 648,
    "future primary",
    "matrix must calculate 648 requests",
  );
  assert(primary.batch_count * primary.requests_per_batch === 648, "future primary", "batches must calculate 648 requests");

  if (candidate?.status === "calibration-frozen") {
    assert(candidate.freeze?.manifest === "freeze-manifest.json", "freeze", "manifest must be freeze-manifest.json");
    assert(
      typeof candidate.freeze?.frozen_at === "string"
        && !Number.isNaN(Date.parse(candidate.freeze.frozen_at)),
      "freeze",
      "frozen_at must be an ISO-compatible timestamp",
    );
    assert(
      /^[a-f0-9]{64}$/.test(candidate.freeze?.artifact_set_sha256 ?? ""),
      "freeze",
      "artifact_set_sha256 must be a SHA-256 digest",
    );
    assert(
      JSON.stringify(candidate.freeze?.required_artifact_classes) === JSON.stringify(REQUIRED_ARTIFACT_CLASSES),
      "freeze",
      "required artifact classes must match the complete v3 calibration boundary",
    );
  }

  if (failures.length > 0) {
    throw new Error(`OpenAPI comparison v3 plan check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }
}

export function validateCalibrationSchedule(plan, schedule) {
  const failures = [];
  const fail = (area, message) => failures.push(`${area}: ${message}`);
  const assert = (condition, area, message) => {
    if (!condition) fail(area, message);
  };
  const expectedSchedule = buildCalibrationSchedule(plan);

  assert(Array.isArray(schedule), "calibration schedule", "must be an array of rows");
  if (!Array.isArray(schedule)) {
    throw new Error(`OpenAPI comparison v3 calibration schedule check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }

  assert(
    schedule.length === expectedSchedule.length,
    "calibration schedule",
    `must contain exactly ${expectedSchedule.length} rows; found ${schedule.length}`,
  );

  const runIds = new Set();
  schedule.forEach((row, index) => {
    const rowLabel = `row ${index + 1}`;
    assert(row && typeof row === "object", rowLabel, "must be an object");
    if (!row || typeof row !== "object") return;

    assert(!String(row.run_id).startsWith("preview"), rowLabel, "preview run_id values are not calibration identities");
    assert(!runIds.has(row.run_id), rowLabel, `duplicate run_id ${row.run_id}`);
    runIds.add(row.run_id);

    const expected = expectedSchedule[index];
    if (!expected) return;
    assert(
      row.calibration_ordinal === expected.calibration_ordinal,
      rowLabel,
      `calibration_ordinal must be ${expected.calibration_ordinal}`,
    );
    Object.entries(expected).forEach(([field, value]) => {
      assert(row[field] === value, rowLabel, `${field} must be ${JSON.stringify(value)}`);
    });
    assert(
      JSON.stringify(Object.keys(row)) === JSON.stringify(Object.keys(expected)),
      rowLabel,
      "must contain only canonical calibration fields in canonical order",
    );
  });

  plan.calibration.task_ids.forEach((taskId) => {
    plan.targets.forEach((target) => {
      const conditions = schedule
        .filter((row) => row?.task_id === taskId && row?.target_id === target.id)
        .map((row) => row.condition);
      assert(
        conditions.length === plan.conditions.length
          && new Set(conditions).size === plan.conditions.length
          && plan.conditions.every((condition) => conditions.includes(condition)),
        "calibration schedule",
        `${taskId}/${target.id} must contain all four conditions exactly once`,
      );
    });
  });

  if (failures.length > 0) {
    throw new Error(`OpenAPI comparison v3 calibration schedule check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }
}

function assertSameMembers(actual, expected, area, fail) {
  const actualValues = [...actual].sort();
  const expectedValues = [...expected].sort();
  if (JSON.stringify(actualValues) !== JSON.stringify(expectedValues)) {
    fail(area, `expected ${expectedValues.join(", ")}; found ${actualValues.join(", ")}`);
  }
}

function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => !["--frozen", "--private-required"].includes(argument))) {
    console.error("Usage: check-openapi-comparison-v3-plan.mjs [--frozen] [--private-required]");
    process.exitCode = 2;
    return;
  }
  const requireFrozen = arguments_.includes("--frozen") || arguments_.includes("--private-required");
  const privateRequired = arguments_.includes("--private-required");
  let plan;
  try {
    plan = readV3Plan();
  } catch (error) {
    console.error(`OpenAPI comparison v3 plan check failed:\n- plan: cannot read plan.json: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    validateV3Plan(plan, {
      closureDocumentExists: fs.existsSync(CLOSURE_FILE),
      requireFrozen,
    });
    [PLAN_DOC, README_FILE, PRIVATE_README_FILE].forEach((file) => {
      if (!fs.existsSync(file)) throw new Error(`${path.basename(file)} is required`);
    });
    const actualScheduleText = fs.readFileSync(CALIBRATION_SCHEDULE_FILE, "utf8");
    const lines = actualScheduleText.split("\n");
    if (lines.at(-1) === "") lines.pop();
    const schedule = lines.map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`calibration-schedule.jsonl line ${index + 1} is not valid JSON: ${error.message}`);
      }
    });
    validateCalibrationSchedule(plan, schedule);
    const expectedScheduleText = calibrationScheduleJsonl(plan);
    if (actualScheduleText !== expectedScheduleText) {
      throw new Error("calibration-schedule.jsonl must exactly match freshly generated canonical JSONL");
    }
    if (plan.status === "calibration-frozen") {
      validateFrozenBenchmarkOutputs({
        plan,
        benchmarkDir: BENCHMARK_DIR,
        privateRequired,
      });
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const qualifier = requireFrozen ? "frozen calibration" : plan.status;
  console.log(`OpenAPI comparison v3 ${qualifier} plan check passed for ${path.relative(process.cwd(), BENCHMARK_DIR)}`);
  console.log("Live execution remains locked pending a separate explicit approval.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
