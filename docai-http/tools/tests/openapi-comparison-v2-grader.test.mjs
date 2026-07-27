import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { gradeBenchmarkResponse } from "../openapi-comparison-v2-grader.mjs";
import {
  BENCHMARK_DIR,
} from "../openapi-comparison-v2-utils.mjs";

test("grades equals, nested contains, absent, and set_equals assertions", () => {
  const task = {
    private: {
      assertions: [
        {
          path: "/request/method",
          operator: "equals",
          value: "POST",
          failure_category: "method",
        },
        {
          path: "/request/parts",
          operator: "contains",
          value: [{ name: "metadata", value: { title: "Q2" } }],
          failure_category: "parts",
        },
        {
          path: "/request/body/role",
          operator: "absent",
          failure_category: "default",
        },
        {
          path: "/request/scopes",
          operator: "set_equals",
          value: ["write", "read"],
          failure_category: "scopes",
        },
      ],
    },
  };
  const content = {
    request: {
      method: "POST",
      body: {},
      parts: [
        { name: "file", filename: "a.pdf" },
        { name: "metadata", content_type: "application/json", value: { title: "Q2", tags: [] } },
      ],
      scopes: ["read", "write"],
    },
  };

  assert.deepEqual(gradeBenchmarkResponse(content, task), {
    status: "pass",
    pass: true,
    reasons: [],
    failure_categories: [],
  });
});

test("reports every failed assertion category", () => {
  const task = {
    private: {
      assertions: [
        {
          path: "/status",
          operator: "equals",
          value: 201,
          failure_category: "status",
        },
        {
          path: "/follow_up",
          operator: "contains",
          value: ["payment_id"],
          failure_category: "follow-up",
        },
      ],
    },
  };

  const grade = gradeBenchmarkResponse({ status: 200, follow_up: [] }, task);

  assert.equal(grade.status, "fail");
  assert.equal(grade.pass, false);
  assert.deepEqual(grade.failure_categories, ["status", "follow-up"]);
  assert.equal(grade.reasons.length, 2);
});

test("classifies non-object provider output as malformed", () => {
  assert.deepEqual(gradeBenchmarkResponse("not an object", { private: { assertions: [] } }), {
    status: "malformed",
    pass: false,
    reasons: ["response must be a JSON object"],
    failure_categories: ["output-format"],
  });
});

test("continuity positive examples pass and targeted negatives fail", () => {
  const continuityDir = path.join(BENCHMARK_DIR, "continuity");
  const packet = readJson(path.join(continuityDir, "tasks.json"));
  const tasks = new Map(packet.tasks.map((task) => [task.id, task]));
  const positives = readJson(path.join(continuityDir, "positive-results.json"));
  const negatives = readJson(path.join(continuityDir, "negative-results.json"));

  positives.results.forEach((result) => {
    const grade = gradeBenchmarkResponse(result.content_json, tasks.get(result.task_id));
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
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
