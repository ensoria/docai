import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildPrimaryPromptRecords,
  buildPromptMetric,
  buildPromptMetricsPacket,
  buildPromptRecord,
  promptMessages,
  textMetrics,
  validatePromptRecord,
} from "../openapi-comparison-v2-prompt.mjs";
import {
  buildPrimarySchedule,
  readV2Plan,
} from "../openapi-comparison-v2-utils.mjs";
import {
  readApiTaskPacket,
  resolveApiArtifacts,
} from "../openapi-comparison-v2-context.mjs";

const plan = readV2Plan();
const continuityApi = plan.apis.find((api) => api.id === "complete-commerce");
const continuityPacket = readApiTaskPacket(continuityApi);
const createUserTask = continuityPacket.tasks.find((task) => task.id === "create-user-request");
const privateRequired = process.env.DOCAI_BENCHMARK_PRIVATE_REQUIRED === "1";

test("four paired condition prompts differ only in documentation", () => {
  const baseRun = buildPrimarySchedule(plan).find((run) => (
    run.api_id === continuityApi.id
      && run.task_id === createUserTask.id
      && run.target_id === "openai-frontier"
  ));
  const records = plan.conditions.map((condition) => buildPromptRecord({
    run: {
      ...baseRun,
      run_id: `${baseRun.run_id}__test-${condition}`,
      condition,
    },
    api: continuityApi,
    task: createUserTask,
  }));

  assert.equal(new Set(records.map((record) => record.prompt.system)).size, 1);
  assert.equal(new Set(records.map((record) => record.prompt.task)).size, 1);
  assert.equal(new Set(records.map((record) => record.prompt.required_output)).size, 1);
  assert.equal(new Set(records.map((record) => record.prompt.documentation)).size, 4);
  records.forEach((record) => assert.doesNotThrow(() => validatePromptRecord(record)));
});

test("provider-neutral messages contain only public task data and documentation", () => {
  const run = buildPrimarySchedule(plan).find((candidate) => (
    candidate.api_id === continuityApi.id
      && candidate.task_id === createUserTask.id
      && candidate.condition === "docai-selected"
  ));
  const record = buildPromptRecord({ run, api: continuityApi, task: createUserTask });
  const messages = promptMessages(record);
  const serialized = JSON.stringify(record);

  assert.deepEqual(messages.map((message) => message.role), ["system", "user"]);
  assert.match(messages[0].content, /Use only the supplied documentation/);
  assert.match(messages[1].content, /# Documentation/);
  assert.match(messages[1].content, /# Task/);
  assert.match(messages[1].content, /# Required Output/);
  assert.doesNotMatch(serialized, /"(expected_outcome|assertions|fact_inventory|failure_category)":/);
  assert.doesNotMatch(serialized, /"(fact_ids|missing_fact_ids)":/);
});

test("primary prompt export covers all 648 unique scheduled runs", {
  skip: skipUnlessAllApisAvailable(),
}, () => {
  const records = buildPrimaryPromptRecords(plan, { privateRequired });

  assert.equal(records.length, 648);
  assert.equal(new Set(records.map((record) => record.run_id)).size, 648);
  plan.conditions.forEach((condition) => {
    assert.equal(records.filter((record) => record.condition === condition).length, 162);
  });
  records.forEach((record) => assert.doesNotThrow(() => validatePromptRecord(record)));

  const metrics = buildPromptMetricsPacket(records);
  assert.equal(metrics.rows.length, 648);
  assert.equal(metrics.rows.every((row) => row.context_utf8_bytes > 0), true);
  assert.equal(metrics.rows.every((row) => row.prompt_utf8_bytes > row.context_utf8_bytes), true);
  assert.equal(Object.hasOwn(metrics, "recorded_at"), false);
});

test("text metrics count UTF-8 bytes, Unicode characters, and chars divided by four", () => {
  assert.deepEqual(textMetrics("Aé🙂"), {
    utf8_bytes: 7,
    characters: 3,
    approx_tokens_chars_div_4: 1,
  });
});

test("prompt metrics cover context and rendered messages with optional tokenizers", () => {
  const run = buildPrimarySchedule(plan).find((candidate) => (
    candidate.api_id === continuityApi.id
      && candidate.task_id === createUserTask.id
      && candidate.condition === "docai-selected"
  ));
  const record = buildPromptRecord({ run, api: continuityApi, task: createUserTask });
  const metric = buildPromptMetric(record, {
    tokenizers: [
      {
        id: "test-tokenizer",
        count: (text) => text.length,
      },
    ],
  });

  assert.equal(metric.run_id, record.run_id);
  assert.ok(metric.context_utf8_bytes > 0);
  assert.ok(metric.prompt_utf8_bytes > metric.context_utf8_bytes);
  assert.equal(metric.tokenizer_counts["test-tokenizer"], metric.prompt_characters);
});

function skipUnlessAllApisAvailable() {
  if (privateRequired) return false;
  return plan.apis.some((api) => !fs.existsSync(resolveApiArtifacts(api).task_packet));
}
