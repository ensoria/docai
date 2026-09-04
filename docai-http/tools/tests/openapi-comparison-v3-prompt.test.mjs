import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  buildCalibrationPromptRecords,
  buildPromptMetricsPacket,
  buildPromptRecord,
  promptMessages,
  renderedPromptText,
  validatePromptRecord,
} from "../openapi-comparison-v3-prompt.mjs";
import { calibrationPromptJsonl } from "../build-openapi-comparison-v3-prompts.mjs";
import {
  buildTaskContext,
  readCalibrationTaskPacket,
} from "../openapi-comparison-v3-context.mjs";
import {
  buildCalibrationSchedule,
  readV3Plan,
} from "../openapi-comparison-v3-utils.mjs";

const plan = readV3Plan();
const api = { id: plan.calibration.api_id };
const packet = readCalibrationTaskPacket(plan);

test("paired calibration conditions share provider-neutral instructions and task contract", () => {
  const task = taskById("upload-document-request");
  const runs = buildCalibrationSchedule(plan)
    .filter((run) => run.task_id === task.id && run.target_id === "openai-frontier");
  const records = runs.map((run) => buildPromptRecord({ run, api, task }));

  assert.equal(records.length, 4);
  assert.equal(new Set(records.map((record) => record.prompt.system)).size, 1);
  assert.equal(new Set(records.map((record) => record.prompt.task)).size, 1);
  assert.equal(new Set(records.map((record) => record.prompt.required_output)).size, 1);
  assert.equal(new Set(records.map((record) => record.prompt.documentation)).size, 4);

  records.forEach((record) => {
    const messages = promptMessages(record);
    assert.deepEqual(messages.map((message) => message.role), ["system", "user"]);
    assert.match(messages[0].content, /Use only the supplied documentation/);
    assert.doesNotMatch(messages[0].content, /OpenAI|Anthropic|Google|provider/i);
    assert.match(messages[1].content, /# Documentation/);
    assert.match(messages[1].content, /# Task/);
    assert.match(messages[1].content, /# Required Output/);
  });
});

test("exports exactly 24 identity-validated prompt records with stable rendered hashes", () => {
  const first = buildCalibrationPromptRecords(plan);
  const second = buildCalibrationPromptRecords(plan);

  assert.equal(first.length, 24);
  assert.equal(new Set(first.map((record) => record.run_id)).size, 24);
  assert.deepEqual(second, first);
  assert.equal(
    new Set(first.map((record) => record.prompt_sha256)).size,
    8,
    "each task/condition text is shared only across the three provider targets",
  );
  first.forEach((record) => {
    assert.doesNotThrow(() => validatePromptRecord(record));
    assert.equal(record.prompt_sha256, sha256(renderedPromptText(record)));
  });
});

test("never serializes expected outcomes, assertions, or fact inventories into prompts", () => {
  const record = buildCalibrationPromptRecords(plan).find((candidate) => (
    candidate.task_id === "complete-checkout-workflow"
      && candidate.condition === "docai-selected"
  ));
  const serialized = JSON.stringify(record);

  assert.doesNotMatch(
    serialized,
    /"(?:assertions|evidence|expected_outcome|fact_ids|fact_inventory|failure_category|grader|grader_evidence|missing_fact_ids|private|raw_missing|sliced_missing)"\s*:/,
  );
  assert.doesNotMatch(serialized, /"checkout:order-recovery"/);
});

test("rejects private keys recursively at every nesting depth", () => {
  const record = buildCalibrationPromptRecords(plan)[0];
  const forbiddenKeys = [
    "assertions",
    "evidence",
    "expected_outcome",
    "fact_ids",
    "fact_inventory",
    "failure_category",
    "grader",
    "grader_evidence",
    "missing_fact_ids",
    "private",
    "raw_missing",
    "sliced_missing",
  ];

  forbiddenKeys.forEach((key) => {
    const nested = structuredClone(record);
    nested.context.source_files = [{ one: [{ two: { [key]: "must not escape" } }] }];
    assert.throws(() => validatePromptRecord(nested), new RegExp(`private key ${key}`));
  });
});

test("rejects a record whose supplied context or run identity differs from the calibration plan", () => {
  const task = taskById("upload-document-request");
  const run = buildCalibrationSchedule(plan).find((candidate) => candidate.task_id === task.id);
  const context = buildTaskContext(api, task, run.condition);

  assert.throws(
    () => buildPromptRecord({ run: { ...run, provider: "other" }, api, task, context }),
    /run identity/,
  );
  assert.throws(
    () => buildPromptRecord({ run, api, task, context: { ...context, task_id: "other-task" } }),
    /context identity/,
  );
});

test("rejects canonical run and task inputs when they belong to different calibration tasks", () => {
  const uploadRun = buildCalibrationSchedule(plan).find((run) => (
    run.task_id === "upload-document-request"
  ));
  const checkoutTask = taskById("complete-checkout-workflow");

  assert.throws(
    () => buildPromptRecord({ run: uploadRun, api, task: checkoutTask }),
    /run task_id must match the canonical task/,
  );
});

test("revalidates every prompt record field against its canonical plan, run, task, context, and contract", async (t) => {
  const record = buildCalibrationPromptRecords(plan)[0];
  const cases = [
    ["run id", (candidate) => { candidate.run_id = `${candidate.run_id}-tampered`; }],
    ["condition", (candidate) => { candidate.condition = "docai-selected"; }],
    ["target provider", (candidate) => { candidate.target.provider = "other"; }],
    ["context source", (candidate) => { candidate.context.source_files[0] = "other.md"; }],
    ["task text", (candidate) => { candidate.prompt.task = "other task"; }],
    ["required output", (candidate) => { candidate.prompt.required_output = "other contract"; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const candidate = structuredClone(record);
      mutate(candidate);
      assert.throws(() => validatePromptRecord(candidate), /canonical calibration/);
    });
  }
});

test("metrics require the exact unique 24-record canonical calibration matrix", () => {
  const records = buildCalibrationPromptRecords(plan);
  const duplicate = records.map((record) => structuredClone(record));
  duplicate[1] = structuredClone(duplicate[0]);
  const mixedPlan = records.map((record) => structuredClone(record));
  mixedPlan[1].benchmark_id = "other-benchmark";

  assert.throws(() => buildPromptMetricsPacket(duplicate), /unique canonical run identities/);
  assert.throws(() => buildPromptMetricsPacket(mixedPlan), /canonical calibration/);
});

test("rejects non-JSON descriptors and values before recursive leakage checks or serialization", async (t) => {
  const records = buildCalibrationPromptRecords(plan);
  const cases = [
    ["hidden toJSON", (candidate) => {
      Object.defineProperty(candidate, "toJSON", {
        value: () => ({ private: { expected_outcome: "leak" } }),
      });
    }],
    ["accessor", (candidate) => {
      Object.defineProperty(candidate.prompt, "documentation", {
        enumerable: true,
        get: () => "computed",
      });
    }],
    ["symbol", (candidate) => { candidate[Symbol("hidden")] = true; }],
    ["class", (candidate) => { candidate.context = new (class Context {})(); }],
    ["cycle", (candidate) => { candidate.prompt.loop = candidate.prompt; }],
    ["sparse array", (candidate) => {
      candidate.context.source_files = [];
      candidate.context.source_files[1] = "source.md";
    }],
    ["nonfinite number", (candidate) => { candidate.calibration_ordinal = Number.NaN; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const candidate = structuredClone(records[0]);
      mutate(candidate);
      assert.throws(() => validatePromptRecord(candidate), /finite JSON|cycle/);
    });
  }

  const serializationProbe = records.map((record) => structuredClone(record));
  Object.defineProperty(serializationProbe[0], "toJSON", {
    value: () => ({ private: { expected_outcome: "leak" } }),
  });
  assert.throws(() => calibrationPromptJsonl(serializationProbe), /finite JSON/);
});

test("builds deterministic metrics for every generated private prompt", () => {
  const records = buildCalibrationPromptRecords(plan);
  const first = buildPromptMetricsPacket(records);
  const second = buildPromptMetricsPacket(records);

  assert.deepEqual(second, first);
  assert.equal(first.rows.length, 24);
  assert.equal(Object.hasOwn(first, "recorded_at"), false);
  first.rows.forEach((row) => {
    assert.equal(row.context_utf8_bytes > 0, true);
    assert.equal(row.prompt_utf8_bytes > row.context_utf8_bytes, true);
    assert.match(row.prompt_sha256, /^[a-f0-9]{64}$/);
  });
});

function taskById(taskId) {
  const task = packet.tasks.find((candidate) => candidate.id === taskId);
  assert.ok(task, `expected task ${taskId}`);
  return task;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
