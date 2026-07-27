import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  readContractPacket,
  validateBenchmarkTaskPacket,
} from "../openapi-comparison-v2-contract.mjs";
import { gradeBenchmarkResponse } from "../openapi-comparison-v2-grader.mjs";
import {
  BENCHMARK_DIR,
  readV2Plan,
} from "../openapi-comparison-v2-utils.mjs";

const plan = readV2Plan();
const privateRoot = path.join(BENCHMARK_DIR, "private", "holdouts");
const privateRequired = process.env.DOCAI_BENCHMARK_PRIVATE_REQUIRED === "1";

test("field-service holdout packet and projections are complete", {
  skip: skipUnlessAvailable("field-service"),
}, () => {
  validatePrivateHoldout("field-service", "holdout-field-service");
});

function validatePrivateHoldout(directoryName, apiId) {
  const holdoutDir = path.join(privateRoot, directoryName);
  const packet = readContractPacket(path.join(holdoutDir, "tasks.json"));
  const api = plan.apis.find((candidate) => candidate.id === apiId);

  assert.doesNotThrow(() => validateBenchmarkTaskPacket(packet, plan));
  assert.deepEqual(
    packet.tasks.map((task) => task.id).sort(),
    [...api.tasks].sort(),
  );

  [
    "source/openapi.yaml",
    "source/behavior.yaml",
    "docai/full/INDEX.md",
    "docai/full/CONVENTIONS.md",
    "docai/compact/INDEX.md",
    "docai/compact/CONVENTIONS.md",
    "positive-results.json",
    "negative-results.json",
  ].forEach((file) => {
    assert.equal(fs.existsSync(path.join(holdoutDir, file)), true, `${apiId} missing ${file}`);
  });

  packet.tasks.forEach((task) => {
    task.public.retrieval.docai_files.forEach((file) => {
      const fullFile = path.join(holdoutDir, "docai", "full", file);
      assert.equal(fs.existsSync(fullFile), true, `${task.id} missing full/${file}`);
      if (task.profile === "compact") {
        const compactFile = path.join(holdoutDir, "docai", "compact", file);
        assert.equal(fs.existsSync(compactFile), true, `${task.id} missing compact/${file}`);
      }
    });
  });

  validateExamples(holdoutDir, packet);
}

function validateExamples(holdoutDir, packet) {
  const tasks = new Map(packet.tasks.map((task) => [task.id, task]));
  const positives = readJson(path.join(holdoutDir, "positive-results.json"));
  const negatives = readJson(path.join(holdoutDir, "negative-results.json"));
  const expectedIds = [...tasks.keys()].sort();

  assert.deepEqual(positives.results.map((result) => result.task_id).sort(), expectedIds);
  assert.deepEqual(negatives.results.map((result) => result.task_id).sort(), expectedIds);

  positives.results.forEach((result) => {
    const task = tasks.get(result.task_id);
    const contentJson = result.use_expected_outcome
      ? task.private.expected_outcome
      : result.content_json;
    const grade = gradeBenchmarkResponse(contentJson, task);
    assert.equal(grade.status, "pass", `${result.task_id}: ${grade.reasons.join("; ")}`);
  });
  negatives.results.forEach((result) => {
    const grade = gradeBenchmarkResponse(result.content_json, tasks.get(result.task_id));
    assert.equal(grade.status, "fail", result.task_id);
    assert.ok(
      grade.failure_categories.includes(result.expected_failure_category),
      `${result.task_id}: expected ${result.expected_failure_category}; got ${grade.failure_categories.join(", ")}`,
    );
  });
}

function skipUnlessAvailable(directoryName) {
  if (privateRequired) return false;
  return !fs.existsSync(path.join(privateRoot, directoryName));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
