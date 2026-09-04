import { isDeepStrictEqual } from "node:util";
import path from "node:path";

import { buildTaskContext as buildV2TaskContext } from "./openapi-comparison-v2-context.mjs";
import {
  readContractPacket,
  validateBenchmarkTaskPacket,
} from "./openapi-comparison-v3-contract.mjs";
import {
  BENCHMARK_DIR,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

const TASK_PACKET_FILE = path.join(BENCHMARK_DIR, "continuity", "tasks.json");

export function readCalibrationTaskPacket(plan = readV3Plan()) {
  const packet = readContractPacket(TASK_PACKET_FILE);
  return validateBenchmarkTaskPacket(packet, plan);
}

export function buildTaskContext(api, task, condition) {
  const plan = readV3Plan();
  const resolvedTask = canonicalTask(plan, api, task);
  if (!plan.conditions.includes(condition)) {
    throw new Error(`context condition must be one of ${plan.conditions.join(", ")}`);
  }

  return observeBuiltContext(plan, resolvedTask, condition).public_context;
}

export function buildParityReport({ transformBuiltContext = (context) => context } = {}) {
  if (typeof transformBuiltContext !== "function") {
    throw new Error("parity transformBuiltContext must be a function");
  }
  const plan = readV3Plan();
  const api = { id: plan.calibration.api_id };
  const packet = readCalibrationTaskPacket(plan);
  const tasks = packet.tasks.map((task) => parityTask(api, task, transformBuiltContext));
  const parityFailures = tasks.filter((task) => task.status !== "pass").length;

  return {
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    status: parityFailures === 0 ? "pass" : "fail",
    summary: {
      apis: 1,
      tasks: tasks.length,
      parity_failures: parityFailures,
    },
    tasks,
  };
}

function parityTask(api, task, transformBuiltContext) {
  const plan = readV3Plan();
  const contexts = Object.fromEntries(plan.conditions.map((condition) => [
    condition,
    observeBuiltContext(plan, task, condition, transformBuiltContext),
  ]));

  const inventory = task.private.fact_inventory;
  const required = sortedUnique(inventory.required);
  const rawMissing = contexts["openapi-raw"].missing_fact_ids;
  const slicedMissing = contexts["openapi-sliced"].missing_fact_ids;
  const enrichedFacts = contexts["openapi-enriched"].fact_ids;
  const docaiFacts = contexts["docai-selected"].fact_ids;
  const expectedRawMissing = sortedUnique(inventory.raw_missing);
  const expectedSlicedMissing = sortedUnique(inventory.sliced_missing);
  const parity = sameValues(required, enrichedFacts)
    && sameValues(required, docaiFacts)
    && sameValues(expectedRawMissing, rawMissing)
    && sameValues(expectedSlicedMissing, slicedMissing)
    && sameValues(difference(required, expectedRawMissing), contexts["openapi-raw"].fact_ids)
    && sameValues(difference(required, expectedSlicedMissing), contexts["openapi-sliced"].fact_ids)
    && contexts["openapi-enriched"].missing_fact_ids.length === 0
    && contexts["docai-selected"].missing_fact_ids.length === 0;

  return {
    api_id: api.id,
    task_id: task.id,
    status: parity ? "pass" : "fail",
    required_fact_ids: required,
    enriched_fact_ids: enrichedFacts,
    docai_fact_ids: docaiFacts,
    enriched_missing: difference(required, enrichedFacts),
    docai_missing: difference(required, docaiFacts),
    raw_missing: rawMissing,
    sliced_missing: slicedMissing,
  };
}

function observeBuiltContext(plan, task, condition, transformBuiltContext = (context) => context) {
  const built = transformBuiltContext(
    buildV2TaskContext({ id: plan.calibration.api_id }, task, condition),
    { api_id: plan.calibration.api_id, task, condition },
  );
  if (!built || typeof built !== "object" || Array.isArray(built)
      || !Array.isArray(built.fact_ids) || !Array.isArray(built.missing_fact_ids)) {
    throw new Error("v2 context builder must return fact_ids and missing_fact_ids arrays");
  }
  const factIds = sortedUnique(built.fact_ids);
  const missingFactIds = sortedUnique(built.missing_fact_ids);
  if (factIds.some((factId) => typeof factId !== "string")
      || missingFactIds.some((factId) => typeof factId !== "string")) {
    throw new Error("v2 context builder fact metadata must contain strings");
  }
  return {
    fact_ids: factIds,
    missing_fact_ids: missingFactIds,
    public_context: {
      api_id: plan.calibration.api_id,
      task_id: task.id,
      condition,
      media_type: built.media_type,
      source_files: [...built.source_files],
      content: built.content,
    },
  };
}

function canonicalTask(plan, api, task) {
  if (!api || api.id !== plan.calibration.api_id) {
    throw new Error(`context api_id must be ${plan.calibration.api_id}`);
  }
  const packet = readCalibrationTaskPacket(plan);
  const expected = packet.tasks.find((candidate) => candidate.id === task?.id);
  if (!expected || !isDeepStrictEqual(task, expected)) {
    throw new Error(`context requires a canonical task for ${plan.calibration.api_id}`);
  }
  return expected;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
