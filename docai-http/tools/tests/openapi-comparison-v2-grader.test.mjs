import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  evaluateAssertion,
  gradeBenchmarkResponse,
} from "../openapi-comparison-v2-grader.mjs";
import {
  BENCHMARK_DIR,
} from "../openapi-comparison-v2-utils.mjs";

test("grades equals, nested contains, absent, and set_equals assertions", () => {
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

  const assertions = [
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
  ];

  assertions.forEach((assertion) => {
    assert.deepEqual(evaluateAssertion(content, assertion), { pass: true, reason: "" });
  });
});

test("matches HTTP header contracts without requiring literal placeholder text", () => {
  const content = {
    request: {
      headers: {
        authorization: "Bearer actual-access-token",
        "content-type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": "f4d77264-7df8-4f61-b50a-e92830f3478d",
      },
    },
  };
  const assertion = {
    path: "/request/headers",
    operator: "header_contains",
    value: {
      Authorization: "Bearer <access_token>",
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": "<operation-unique-key>",
    },
    failure_category: "request-headers",
  };

  assert.deepEqual(evaluateAssertion(content, assertion), { pass: true, reason: "" });
});

test("reports every failed assertion category", () => {
  const task = taskFor("response-handling.v1", [
    {
      path: "/response/status",
      operator: "equals",
      value: 201,
      failure_category: "status",
    },
    {
      path: "/response/follow_up",
      operator: "contains",
      value: ["payment_id"],
      failure_category: "follow-up",
    },
  ]);
  const content = {
    response: {
      status: 200,
      headers: {},
      body: {},
      follow_up: [],
    },
    uncertainties: [],
  };

  const grade = gradeBenchmarkResponse(content, task);

  assert.equal(grade.status, "fail");
  assert.equal(grade.pass, false);
  assert.equal(grade.automatic_rerun_allowed, false);
  assert.equal(grade.manual_review_required, false);
  assert.deepEqual(grade.failure_categories, ["status", "follow-up"]);
  assert.equal(grade.reasons.length, 2);
});

test("classifies non-object provider output as malformed", () => {
  const task = taskFor("request-construction.v1", []);

  assert.deepEqual(gradeBenchmarkResponse("not an object", task), {
    status: "malformed",
    pass: false,
    reasons: ["response must be a JSON object"],
    failure_categories: ["output-format"],
    automatic_rerun_allowed: false,
    manual_review_required: false,
  });
});

test("classifies an object that violates its output contract as malformed", () => {
  const task = taskFor("request-construction.v1", []);
  const grade = gradeBenchmarkResponse({ request: {}, uncertainties: [] }, task);

  assert.equal(grade.status, "malformed");
  assert.equal(grade.pass, false);
  assert.equal(grade.automatic_rerun_allowed, false);
  assert.equal(grade.manual_review_required, false);
  assert.deepEqual(grade.failure_categories, ["output-format"]);
  assert.match(grade.reasons[0], /output contract/);
});

test("classifies failed assertions with explicit uncertainty as inconclusive", () => {
  const task = taskFor("response-handling.v1", [
    {
      path: "/response/status",
      operator: "equals",
      value: 201,
      failure_category: "status",
    },
  ]);
  const content = {
    response: {
      status: 0,
      headers: {},
      body: {},
      follow_up: [],
    },
    uncertainties: ["The supplied documentation does not state the success status."],
  };

  const grade = gradeBenchmarkResponse(content, task);

  assert.equal(grade.status, "inconclusive");
  assert.equal(grade.pass, false);
  assert.equal(grade.automatic_rerun_allowed, false);
  assert.equal(grade.manual_review_required, true);
  assert.deepEqual(grade.failure_categories, ["status"]);
});

test("validates the output structure for every task class", () => {
  const cases = [
    [
      "request-construction.v1",
      {
        request: {
          method: "POST",
          path: "/items",
          headers: {},
          query: {},
          content_type: "application/json",
          body: {},
          parts: [],
        },
        client_behavior: [],
        uncertainties: [],
      },
    ],
    [
      "response-handling.v1",
      {
        response: {
          status: 200,
          headers: {},
          body: {},
          follow_up: [],
        },
        uncertainties: [],
      },
    ],
    [
      "error-recovery.v1",
      {
        errors: [
          {
            status: 409,
            code: "conflict",
            retry_policy: "never",
            caller_action: "Correct the request.",
            preserve: [],
          },
        ],
        uncertainties: [],
      },
    ],
    [
      "workflow-completion.v1",
      {
        steps: [
          {
            order: 1,
            method: "POST",
            path: "/items",
            input: {},
            keep: [],
            state_after_success: "item.created",
          },
        ],
        failure_recovery: [],
        webhook_reconciliation: [],
        uncertainties: [],
      },
    ],
    [
      "webhook-handling.v1",
      {
        webhook: {
          event: "item.created",
          method: "POST",
          path: "/callbacks",
          verification: [],
          headers: {},
          payload: {},
          acknowledgement: {},
          reconciliation: [],
        },
        uncertainties: [],
      },
    ],
    [
      "retrieval-selection.v1",
      {
        request: {
          method: "GET",
          path: "/items",
          query: {},
          headers: {},
        },
        pagination: {
          items_path: "items",
          next_cursor_path: "next_cursor",
          cursor_parameter: "cursor",
          stop_condition: "Stop on null.",
          deduplicate_by: null,
        },
        uncertainties: [],
      },
    ],
  ];

  cases.forEach(([contract, content]) => {
    const grade = gradeBenchmarkResponse(
      content,
      taskFor(contract, [
        {
          path: "/uncertainties",
          operator: "set_equals",
          value: [],
          failure_category: "uncertainties",
        },
      ]),
    );
    assert.equal(grade.status, "pass", `${contract}: ${grade.reasons.join("; ")}`);
    assert.equal(grade.automatic_rerun_allowed, false);
  });
});

test("all available positive and targeted negative fixtures grade deterministically", () => {
  const fixtureDirs = [
    path.join(BENCHMARK_DIR, "continuity"),
    path.join(BENCHMARK_DIR, "private", "holdouts", "field-service"),
    path.join(BENCHMARK_DIR, "private", "holdouts", "media-processing"),
  ].filter((directory) => fs.existsSync(path.join(directory, "tasks.json")));
  let positiveCount = 0;
  let negativeCount = 0;

  fixtureDirs.forEach((directory) => {
    const packet = readJson(path.join(directory, "tasks.json"));
    const tasks = new Map(packet.tasks.map((task) => [task.id, task]));
    const positives = readJson(path.join(directory, "positive-results.json"));
    const negatives = readJson(path.join(directory, "negative-results.json"));

    positives.results.forEach((result) => {
      const task = tasks.get(result.task_id);
      const content = result.use_expected_outcome
        ? task.private.expected_outcome
        : result.content_json;
      const grade = gradeBenchmarkResponse(content, task);
      assert.equal(grade.status, "pass", `${result.task_id}: ${grade.reasons.join("; ")}`);
      positiveCount += 1;
    });

    negatives.results.forEach((result) => {
      const grade = gradeBenchmarkResponse(result.content_json, tasks.get(result.task_id));
      assert.equal(grade.status, "fail", result.task_id);
      assert.ok(
        grade.failure_categories.includes(result.expected_failure_category),
        `${result.task_id}: expected ${result.expected_failure_category}; got ${grade.failure_categories.join(", ")}`,
      );
      negativeCount += 1;
    });
  });

  assert.equal(positiveCount, fixtureDirs.length * 6);
  assert.equal(negativeCount, fixtureDirs.length * 6);
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function taskFor(outputContract, assertions) {
  return {
    public: {
      output_contract: outputContract,
    },
    private: {
      assertions,
    },
  };
}
