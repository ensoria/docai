import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BENCHMARK_DIR,
  buildCalibrationSchedule,
  buildPrimarySchedulePreview,
  orderedConditions,
  readV3Plan,
  scheduleSummary,
} from "../openapi-comparison-v3-utils.mjs";
import { validateCalibrationSchedule } from "../check-openapi-comparison-v3-plan.mjs";

const plan = readV3Plan();

test("builds the complete deterministic 24-row calibration matrix", () => {
  const schedule = buildCalibrationSchedule(plan);

  assert.equal(schedule.length, 24);
  assert.equal(new Set(schedule.map((row) => row.run_id)).size, 24);
  assert.deepEqual(schedule.map((row) => row.calibration_ordinal), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.deepEqual(new Set(schedule.map((row) => row.task_id)), new Set(plan.calibration.task_ids));
  assert.deepEqual(new Set(schedule.map((row) => row.target_id)), new Set(plan.targets.map((target) => target.id)));
  assert.deepEqual(new Set(schedule.map((row) => row.provider)), new Set(plan.targets.map((target) => target.provider)));
  assert.deepEqual(new Set(schedule.map((row) => row.condition)), new Set(plan.conditions));
  schedule.forEach((row) => {
    assert.equal(row.batch_id, "calibration");
    assert.equal(row.repetition, 1);
    assert.equal(row.api_id, "complete-commerce");
    assert.equal("model_id" in row, false);
  });
  assert.deepEqual(buildCalibrationSchedule(plan), schedule);
});

test("uses the SHA-256 rotation order for every calibration task and target pair", () => {
  const expectedConditions = {
    "upload-document-request/openai-frontier": ["openapi-enriched", "openapi-sliced", "openapi-raw", "docai-selected"],
    "upload-document-request/anthropic-balanced": ["openapi-sliced", "openapi-raw", "docai-selected", "openapi-enriched"],
    "upload-document-request/google-stable-agentic": ["docai-selected", "openapi-raw", "openapi-sliced", "openapi-enriched"],
    "complete-checkout-workflow/openai-frontier": ["openapi-raw", "docai-selected", "openapi-enriched", "openapi-sliced"],
    "complete-checkout-workflow/anthropic-balanced": ["docai-selected", "openapi-raw", "openapi-sliced", "openapi-enriched"],
    "complete-checkout-workflow/google-stable-agentic": ["openapi-sliced", "openapi-raw", "docai-selected", "openapi-enriched"],
  };

  Object.entries(expectedConditions).forEach(([pair, expected]) => {
    const [taskId, targetId] = pair.split("/");
    assert.deepEqual(orderedConditions(plan, taskId, targetId), expected);
  });
});

test("gives every calibration task and target pair all four conditions exactly once", () => {
  const schedule = buildCalibrationSchedule(plan);

  plan.calibration.task_ids.forEach((taskId) => {
    plan.targets.forEach(({ id: targetId }) => {
      const conditions = schedule
        .filter((row) => row.task_id === taskId && row.target_id === targetId)
        .map((row) => row.condition);
      assert.deepEqual(new Set(conditions), new Set(plan.conditions));
      assert.equal(conditions.length, 4);
    });
  });
});

test("summarizes deterministic calibration counts", () => {
  assert.deepEqual(scheduleSummary(buildCalibrationSchedule(plan)), {
    total_rows: 24,
    unique_run_ids: 24,
    by_task: {
      "upload-document-request": 12,
      "complete-checkout-workflow": 12,
    },
    by_target: {
      "openai-frontier": 8,
      "anthropic-balanced": 8,
      "google-stable-agentic": 8,
    },
    by_provider: {
      openai: 8,
      anthropic: 8,
      google: 8,
    },
    by_condition: {
      "openapi-raw": 6,
      "openapi-sliced": 6,
      "openapi-enriched": 6,
      "docai-selected": 6,
    },
  });
});

test("rejects duplicate calibration run identities", () => {
  const schedule = buildCalibrationSchedule(plan);
  schedule[1].run_id = schedule[0].run_id;

  assert.throws(() => validateCalibrationSchedule(plan, schedule), /duplicate run_id/);
});

test("rejects a missing calibration row", () => {
  const schedule = buildCalibrationSchedule(plan);
  schedule.pop();

  assert.throws(() => validateCalibrationSchedule(plan, schedule), /must contain exactly 24 rows/);
});

test("rejects a changed calibration ordinal", () => {
  const schedule = buildCalibrationSchedule(plan);
  schedule[4].calibration_ordinal = 99;

  assert.throws(() => validateCalibrationSchedule(plan, schedule), /calibration_ordinal/);
});

test("rejects a calibration row with a changed run identity", () => {
  const schedule = buildCalibrationSchedule(plan);
  schedule[4].run_id = "wrong-run-id";

  assert.throws(() => validateCalibrationSchedule(plan, schedule), /run_id/);
});

test("rejects an incomplete condition pair", () => {
  const schedule = buildCalibrationSchedule(plan);
  schedule.splice(0, 1);

  assert.throws(() => validateCalibrationSchedule(plan, schedule), /four conditions/);
});

test("builds a 648-row primary preview only in memory", () => {
  const primaryScheduleFile = path.join(BENCHMARK_DIR, "primary-schedule.jsonl");
  const before = fs.existsSync(primaryScheduleFile);
  const preview = buildPrimarySchedulePreview(plan);

  assert.equal(preview.length, 648);
  assert.equal(new Set(preview.map((row) => row.run_id)).size, 648);
  assert.equal(preview.every((row) => row.run_id.startsWith("preview__")), true);
  assert.equal(fs.existsSync(primaryScheduleFile), before);
  assert.throws(() => validateCalibrationSchedule(plan, preview), /preview/);
});

