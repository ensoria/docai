import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const BENCHMARK_DIR = path.resolve(SCRIPT_DIR, "..", "benchmarks", "openapi-comparison", "v3");
export const PLAN_FILE = path.join(BENCHMARK_DIR, "plan.json");

export function readV3Plan() {
  return JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
}

export function orderedConditions(plan, taskId, targetId) {
  const digest = crypto.createHash("sha256")
    .update([
      plan.benchmark_id,
      plan.plan_version,
      "calibration",
      taskId,
      targetId,
    ].join("\0"))
    .digest();
  const rotation = digest[0] % 4;
  const rotated = [
    ...plan.conditions.slice(rotation),
    ...plan.conditions.slice(0, rotation),
  ];

  return digest[1] % 2 === 1
    ? [rotated[0], ...rotated.slice(1).reverse()]
    : rotated;
}

export function buildCalibrationSchedule(plan) {
  const schedule = [];
  let calibrationOrdinal = 1;

  plan.calibration.task_ids.forEach((taskId) => {
    plan.targets.forEach((target) => {
      orderedConditions(plan, taskId, target.id).forEach((condition) => {
        schedule.push({
          run_id: [
            plan.benchmark_id,
            plan.plan_version,
            "calibration",
            target.id,
            taskId,
            condition,
          ].join("__"),
          calibration_ordinal: calibrationOrdinal,
          batch_id: "calibration",
          repetition: 1,
          api_id: "complete-commerce",
          task_id: taskId,
          target_id: target.id,
          provider: target.provider,
          condition,
        });
        calibrationOrdinal += 1;
      });
    });
  });

  return schedule;
}

export function buildPrimarySchedulePreview(plan) {
  const design = plan.future_primary_design;
  const preview = [];

  for (let apiNumber = 1; apiNumber <= design.api_count; apiNumber += 1) {
    const apiId = `preview-api-${apiNumber}`;
    for (let taskNumber = 1; taskNumber <= design.tasks_per_api; taskNumber += 1) {
      const taskId = `preview-task-${taskNumber}`;
      plan.targets.forEach((target) => {
        for (let repetition = 1; repetition <= design.repetitions; repetition += 1) {
          plan.conditions.forEach((condition) => {
            preview.push({
              run_id: ["preview", apiId, taskId, target.id, repetition, condition].join("__"),
              api_id: apiId,
              task_id: taskId,
              target_id: target.id,
              provider: target.provider,
              repetition,
              condition,
            });
          });
        }
      });
    }
  }

  return preview;
}

export function scheduleSummary(schedule) {
  const counts = {
    total_rows: schedule.length,
    unique_run_ids: new Set(schedule.map((row) => row.run_id)).size,
    by_task: {},
    by_target: {},
    by_provider: {},
    by_condition: {},
  };
  const dimensions = [
    ["task_id", "by_task"],
    ["target_id", "by_target"],
    ["provider", "by_provider"],
    ["condition", "by_condition"],
  ];

  schedule.forEach((row) => {
    dimensions.forEach(([field, summaryField]) => {
      counts[summaryField][row[field]] = (counts[summaryField][row[field]] ?? 0) + 1;
    });
  });

  return counts;
}
