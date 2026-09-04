import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParityReport,
  buildTaskContext,
  readCalibrationTaskPacket,
} from "../openapi-comparison-v3-context.mjs";
import { readV3Plan } from "../openapi-comparison-v3-utils.mjs";

const plan = readV3Plan();
const api = { id: plan.calibration.api_id };
const packet = readCalibrationTaskPacket(plan);

test("builds only public context data for every condition", () => {
  const task = taskById("upload-document-request");
  const contexts = plan.conditions.map((condition) => buildTaskContext(api, task, condition));

  contexts.forEach((context) => {
    assert.equal(context.api_id, api.id);
    assert.equal(context.task_id, task.id);
    assert.equal(context.content.endsWith("\n"), true);
    assert.equal(context.source_files.length > 0, true);
    assert.equal(Object.hasOwn(context, "fact_ids"), false);
    assert.equal(Object.hasOwn(context, "missing_fact_ids"), false);
  });
  assert.match(contexts.find(({ condition }) => condition === "openapi-raw").content, /^openapi:/);
  assert.ok(JSON.parse(contexts.find(({ condition }) => condition === "openapi-sliced").content));
  assert.match(contexts.find(({ condition }) => condition === "openapi-enriched").content, /<!-- behavior:/);
  assert.match(contexts.find(({ condition }) => condition === "docai-selected").content, /<!-- docai:INDEX\.md -->/);
});

test("parity report proves complete contexts and inventory-matched raw/sliced gaps", () => {
  const report = buildParityReport();

  assert.equal(report.status, "pass");
  assert.equal(report.summary.apis, 1);
  assert.equal(report.summary.tasks, packet.tasks.length);
  assert.equal(report.summary.parity_failures, 0);
  report.tasks.forEach((entry) => {
    const task = taskById(entry.task_id);
    assert.deepEqual(entry.required_fact_ids, [...task.private.fact_inventory.required].sort());
    assert.deepEqual(entry.enriched_fact_ids, entry.required_fact_ids);
    assert.deepEqual(entry.docai_fact_ids, entry.required_fact_ids);
    assert.deepEqual(entry.enriched_missing, []);
    assert.deepEqual(entry.docai_missing, []);
    assert.deepEqual(entry.raw_missing, [...task.private.fact_inventory.raw_missing].sort());
    assert.deepEqual(entry.sliced_missing, [...task.private.fact_inventory.sliced_missing].sort());
  });
});

test("parity report fails when observed v2 context fact metadata drifts from the inventory", () => {
  const report = buildParityReport({
    transformBuiltContext(context, { condition, task }) {
      if (condition !== "openapi-enriched" || task.id !== "upload-document-request") return context;
      return {
        ...context,
        fact_ids: context.fact_ids.filter((factId) => factId !== "documents:upload-method"),
      };
    },
  });
  const entry = report.tasks.find((task) => task.task_id === "upload-document-request");

  assert.equal(report.status, "fail");
  assert.equal(report.summary.parity_failures, 1);
  assert.equal(entry.status, "fail");
  assert.deepEqual(entry.enriched_missing, ["documents:upload-method"]);
});

test("rejects a context request with an unplanned API, condition, or altered task identity", () => {
  const task = taskById("complete-checkout-workflow");

  assert.throws(() => buildTaskContext({ id: "other-api" }, task, "openapi-raw"), /api_id/);
  assert.throws(() => buildTaskContext(api, task, "other-condition"), /condition/);
  assert.throws(() => buildTaskContext(api, { ...task, profile: "full" }, "openapi-raw"), /canonical task/);
});

function taskById(taskId) {
  const task = packet.tasks.find((candidate) => candidate.id === taskId);
  assert.ok(task, `expected task ${taskId}`);
  return task;
}
