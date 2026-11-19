import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PACKAGE_DIR = path.resolve(RUNTIME_DIR, "..");
export const PLAN_FILE = path.join(PACKAGE_DIR, "plan.json");
export const PRIVATE_DIR = path.join(PACKAGE_DIR, "private");

export function readPlan() {
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
  const rotation = digest[0] % plan.conditions.length;
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
          api_id: plan.calibration.api_id,
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
