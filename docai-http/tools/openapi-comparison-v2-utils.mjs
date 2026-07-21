import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const BENCHMARK_DIR = path.resolve(SCRIPT_DIR, "..", "benchmarks", "openapi-comparison", "v2");
export const PLAN_FILE = path.join(BENCHMARK_DIR, "plan.json");

export function readV2Plan() {
  return JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
}

export function buildPrimarySchedule(plan) {
  const apisById = new Map(plan.apis.map((api) => [api.id, api]));
  const schedule = [];

  plan.execution.batches.forEach((batch, batchIndex) => {
    const api = apisById.get(batch.api);
    if (!api) throw new Error(`Batch ${batch.id} refers to unknown API ${batch.api}`);

    let batchOrdinal = 0;
    api.tasks.forEach((taskId) => {
      plan.targets.forEach((target) => {
        orderedConditions(plan, batch, taskId, target.id).forEach((condition) => {
          batchOrdinal += 1;
          schedule.push({
            run_id: [plan.benchmark_id, plan.plan_version, batch.id, target.id, taskId, condition].join("__"),
            primary_ordinal: schedule.length + 1,
            batch_id: batch.id,
            batch_ordinal: batchOrdinal,
            api_id: api.id,
            repetition: batch.repetition,
            target_id: target.id,
            provider: target.provider,
            planned_model: target.planned_model,
            task_id: taskId,
            condition,
          });
        });
      });
    });
  });

  return schedule;
}

export function orderedConditions(plan, batch, taskId, targetId) {
  const key = [plan.benchmark_id, plan.plan_version, batch.id, taskId, targetId].join("\0");
  const digest = crypto.createHash("sha256").update(key).digest();
  const offset = digest[0] % plan.conditions.length;
  const rotated = [...plan.conditions.slice(offset), ...plan.conditions.slice(0, offset)];
  return digest[1] % 2 === 0 ? rotated : [rotated[0], ...rotated.slice(1).reverse()];
}

export function scheduleSummary(plan, schedule) {
  return plan.execution.batches.map((batch) => {
    const rows = schedule.filter((row) => row.batch_id === batch.id);
    return {
      batch_id: batch.id,
      api_id: batch.api,
      repetition: batch.repetition,
      requests: rows.length,
      first_run_id: rows[0]?.run_id ?? null,
      last_run_id: rows.at(-1)?.run_id ?? null,
    };
  });
}
