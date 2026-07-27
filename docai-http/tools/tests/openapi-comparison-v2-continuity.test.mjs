import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  readContractPacket,
  validateBenchmarkTaskPacket,
} from "../openapi-comparison-v2-contract.mjs";
import {
  BENCHMARK_DIR,
  readV2Plan,
} from "../openapi-comparison-v2-utils.mjs";

const plan = readV2Plan();
const continuityDir = path.join(BENCHMARK_DIR, "continuity");
const packetFile = path.join(continuityDir, "tasks.json");
const positiveFile = path.join(continuityDir, "positive-results.json");
const negativeFile = path.join(continuityDir, "negative-results.json");
const conformanceDir = path.resolve(
  BENCHMARK_DIR,
  "..",
  "..",
  "..",
  "fixtures",
  "conformance",
  "v1.0.0",
  "valid",
);

test("continuity packet validates against the frozen task identities", () => {
  const packet = readContractPacket(packetFile);

  assert.doesNotThrow(() => validateBenchmarkTaskPacket(packet, plan));
  assert.equal(packet.api_id, "complete-commerce");
  assert.deepEqual(
    [...packet.tasks.map((task) => task.id)].sort(),
    [...plan.apis.find((api) => api.id === packet.api_id).tasks].sort(),
  );
});

test("continuity DocAI retrieval files exist in Stable 1.0.0", () => {
  const packet = readContractPacket(packetFile);

  packet.tasks.forEach((task) => {
    task.public.retrieval.docai_files.forEach((file) => {
      assert.equal(
        fs.existsSync(path.join(conformanceDir, task.profile, file)),
        true,
        `${task.id} missing ${task.profile}/${file}`,
      );
    });
  });
});

test("continuity examples cover every task once", () => {
  const packet = readContractPacket(packetFile);
  const expectedIds = packet.tasks.map((task) => task.id).sort();
  const positives = JSON.parse(fs.readFileSync(positiveFile, "utf8"));
  const negatives = JSON.parse(fs.readFileSync(negativeFile, "utf8"));

  assert.deepEqual(positives.results.map((result) => result.task_id).sort(), expectedIds);
  assert.deepEqual(negatives.results.map((result) => result.task_id).sort(), expectedIds);
  positives.results.forEach((result) => assert.equal(typeof result.content_json, "object"));
  negatives.results.forEach((result) => {
    assert.equal(typeof result.content_json, "object");
    assert.match(result.expected_failure_category, /^[a-z0-9-]+$/);
  });
});
