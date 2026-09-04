import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateAssertion,
  gradeParsedResponse,
} from "../openapi-comparison-v3-grader.mjs";
import {
  readContractPacket,
  validateBenchmarkTaskPacket,
} from "../openapi-comparison-v3-contract.mjs";
import { parseProviderText } from "../openapi-comparison-v3-parser.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..");
const benchmarkDir = path.join(repoRoot, "docai-http", "benchmarks", "openapi-comparison", "v3");
const fixtureDir = path.join(testDir, "fixtures", "openapi-comparison-v3", "grader");
const cases = readJson(path.join(fixtureDir, "uncertainty-cases.json"));
const plan = readJson(path.join(benchmarkDir, "plan.json"));
const tasks = new Map(
  readContractPacket(path.join(benchmarkDir, "continuity", "tasks.json"))
    .tasks
    .map((task) => [task.id, task]),
);

test("evaluates the v3 general assertion operators", () => {
  const content = {
    request: {
      method: "POST",
      body: {},
      parts: [
        { name: "file", filename: "statement.pdf" },
        { name: "metadata", value: { title: "Q2", tags: [] } },
      ],
      headers: {
        authorization: "Bearer actual-access-token",
        "content-type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": "f4d77264-7df8-4f61-b50a-e92830f3478d",
      },
      scopes: ["read", "write"],
    },
  };
  const assertions = [
    { path: "/request/method", operator: "equals", value: "POST" },
    {
      path: "/request/parts",
      operator: "contains",
      value: [{ name: "metadata", value: { title: "Q2" } }],
    },
    { path: "/request/body/role", operator: "absent" },
    { path: "/request/scopes", operator: "set_equals", value: ["write", "read"] },
    {
      path: "/request/headers",
      operator: "header_contains",
      value: {
        Authorization: "Bearer <access_token>",
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": "<operation-unique-key>",
      },
    },
  ];

  for (const assertion of assertions) {
    assert.deepEqual(evaluateAssertion(content, assertion), { pass: true, reason: "" });
  }
});

test("does not evaluate invalid or unparseable parser output", () => {
  const grade = gradeParsedResponse({
    parsed: parseProviderText('{"request":'),
    task: task("create-user-request"),
    condition: "docai-selected",
  });

  assert.deepEqual(grade, {
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    reasons: ["Provider response must be one JSON object or one json fence."],
    failure_categories: ["output-format"],
    manual_review_required: false,
  });
});

test("does not evaluate accuracy when parsed JSON violates the output contract", () => {
  const grade = gradeParsedResponse({
    parsed: parseProviderText('{"request":{}}'),
    task: task("create-user-request"),
    condition: "docai-selected",
  });

  assert.equal(grade.contract_status, "invalid");
  assert.equal(grade.accuracy_status, "not-evaluated");
  assert.equal(grade.uncertainty_status, "not-evaluated");
  assert.equal(grade.manual_review_required, false);
  assert.deepEqual(grade.failure_categories, ["output-contract"]);
  assert.ok(grade.reasons.includes("/retry: is required"));
  assert.ok(grade.reasons.includes("/uncertainties: is required"));
});

test("keeps wrong workflow assertions as failures when the response reports gaps", () => {
  const fixture = cases.wrong_workflow_with_gap;
  const content = expectedContent(fixture.task_id);
  content.steps[1].method = "GET";
  content.failure_recovery[0].action = "do-not-retry";
  content.uncertainties = fixture.uncertainties;

  const grade = gradeParsedResponse({
    parsed: parsedContent(content),
    task: task(fixture.task_id),
    condition: fixture.condition,
  });

  assert.equal(grade.contract_status, "valid");
  assert.equal(grade.accuracy_status, "fail");
  assert.equal(grade.uncertainty_status, fixture.expected_status);
  assert.equal(grade.manual_review_required, false);
  assert.deepEqual(grade.failure_categories, ["workflow-steps", "workflow-recovery"]);
  assert.equal(grade.reasons.length, 2);
});

test("classifies reported gaps, missed facts, unsupported guesses, and no uncertainty", () => {
  for (const fixture of [
    cases.reported_gap,
    cases.missed_fact,
    cases.unsupported_guess,
    cases.no_uncertainty,
  ]) {
    const content = expectedContent(fixture.task_id);
    content.uncertainties = fixture.uncertainties;

    const grade = gradeParsedResponse({
      parsed: parsedContent(content),
      task: task(fixture.task_id),
      condition: fixture.condition,
    });

    assert.equal(grade.contract_status, "valid", fixture.expected_status);
    assert.equal(grade.accuracy_status, "pass", fixture.expected_status);
    assert.equal(grade.uncertainty_status, fixture.expected_status, fixture.expected_status);
    assert.deepEqual(grade.failure_categories, [], fixture.expected_status);
    assert.equal(grade.manual_review_required, false, fixture.expected_status);
  }
});

test("retains every failed category while classifying an available fact gap", () => {
  const content = expectedContent("create-user-request");
  content.request.method = "GET";
  content.retry.ambiguous_outcome = "do-not-retry";
  content.uncertainties = [{ path: "/request/body", reason: "documentation-gap" }];

  const grade = gradeParsedResponse({
    parsed: parsedContent(content),
    task: task("create-user-request"),
    condition: "docai-selected",
  });

  assert.equal(grade.accuracy_status, "fail");
  assert.equal(grade.uncertainty_status, "missed-fact");
  assert.deepEqual(grade.failure_categories, ["request-method", "request-retry"]);
  assert.equal(grade.reasons.length, 2);
});

test("matches uncertainty pointers on complete JSON Pointer segments and associated facts", () => {
  const assertion = {
    path: "/request/headers",
    operator: "header_contains",
    value: { Authorization: "Bearer <access_token>" },
    failure_category: "request-headers",
    fact_id: "common:bearer-auth",
  };
  const scopedTask = {
    ...task("create-user-request"),
    private: {
      ...task("create-user-request").private,
      assertions: [assertion],
      fact_inventory: {
        required: [assertion.fact_id],
        raw_missing: [assertion.fact_id],
        sliced_missing: [assertion.fact_id],
      },
    },
  };
  const content = expectedContent("create-user-request");
  content.uncertainties = [{
    path: "/request/headers/Authorization",
    reason: "documentation-gap",
  }];

  const matched = gradeParsedResponse({
    parsed: parsedContent(content),
    task: scopedTask,
    condition: "openapi-raw",
  });
  assert.equal(matched.uncertainty_status, "reported-gap");

  content.uncertainties[0].path = "/request/header";
  const unmatched = gradeParsedResponse({
    parsed: parsedContent(content),
    task: scopedTask,
    condition: "openapi-raw",
  });
  assert.equal(unmatched.uncertainty_status, "unsupported-guess");
});

test("associates aggregate child uncertainty pointers with only their canonical fact", () => {
  const responseContent = expectedContent("payment-created-response");
  responseContent.uncertainties = [{
    path: "/response/relations/0/field",
    reason: "documentation-gap",
  }];
  const responseGrade = gradeParsedResponse({
    parsed: parsedContent(responseContent),
    task: task("payment-created-response"),
    condition: "openapi-raw",
  });
  assert.equal(responseGrade.uncertainty_status, "reported-gap");

  const workflowSteps = task("complete-checkout-workflow").private.assertions.filter((assertion) => (
    ["workflow-steps", "workflow-payment-idempotency"].includes(assertion.failure_category)
  ));
  const workflowTask = scopedTask("complete-checkout-workflow", workflowSteps, [
    "checkout:ordered-steps",
    "checkout:payment-idempotency",
  ], ["checkout:payment-idempotency"]);
  const workflowContent = expectedContent("complete-checkout-workflow");
  workflowContent.uncertainties = [{
    path: "/steps/1/input/Idempotency-Key",
    reason: "documentation-gap",
  }];
  const workflowGrade = gradeParsedResponse({
    parsed: parsedContent(workflowContent),
    task: workflowTask,
    condition: "openapi-raw",
  });
  assert.equal(workflowGrade.uncertainty_status, "reported-gap");
});

test("treats omitted missing facts as abstentions but supplied values as unsupported guesses", () => {
  const bearerAssertion = task("create-user-request").private.assertions.find((assertion) => (
    assertion.fact_id === "common:bearer-auth"
  ));
  const bearerTask = scopedTask(
    "create-user-request",
    [bearerAssertion],
    [bearerAssertion.fact_id],
    [bearerAssertion.fact_id],
  );
  const cases = [
    ["omitted", (content) => delete content.request.headers.Authorization, "fail", "none"],
    ["wrong", (content) => { content.request.headers.Authorization = "Basic guessed"; }, "fail", "unsupported-guess"],
    ["correct", (content) => { content.request.headers.Authorization = "Bearer actual-token"; }, "pass", "unsupported-guess"],
  ];

  for (const [name, mutate, accuracyStatus, uncertaintyStatus] of cases) {
    const content = expectedContent("create-user-request");
    mutate(content);
    const grade = gradeParsedResponse({
      parsed: parsedContent(content),
      task: bearerTask,
      condition: "openapi-raw",
    });
    assert.equal(grade.accuracy_status, accuracyStatus, name);
    assert.equal(grade.uncertainty_status, uncertaintyStatus, name);
  }
});

test("rejects case-insensitive duplicate header names independently of JSON key order", () => {
  const assertion = {
    path: "/request/headers",
    operator: "header_contains",
    value: { Authorization: "Bearer <access_token>" },
  };
  const duplicateOrders = [
    { Authorization: "Basic invalid", authorization: "Bearer actual-token" },
    { authorization: "Bearer actual-token", Authorization: "Basic invalid" },
  ];

  for (const headers of duplicateOrders) {
    assert.deepEqual(evaluateAssertion({ request: { headers } }, assertion), {
      pass: false,
      reason: "must satisfy header contract {\"Authorization\":\"Bearer <access_token>\"}",
    });
  }
});

test("rejects comma-combined webhook placeholder values", () => {
  const content = expectedContent("payment-completed-webhook");
  content.webhook.headers["X-Payment-Attempt"] = "combined,values";

  const grade = gradeParsedResponse({
    parsed: parsedContent(content),
    task: task("payment-completed-webhook"),
    condition: "docai-selected",
  });

  assert.equal(grade.accuracy_status, "fail");
  assert.deepEqual(grade.failure_categories, ["webhook-header"]);
});

test("reaches inconclusive through a packet-valid explicit evaluator-ambiguity operator", () => {
  const content = expectedContent("create-user-request");
  const packet = freshTaskPacket();
  const ambiguousTask = packet.tasks.find(({ id }) => id === "create-user-request");
  ambiguousTask.private.assertions = [{
    path: "/request/method",
    operator: "evaluator-ambiguity.v1",
    failure_category: "evaluator-ambiguity",
    fact_id: "users:create-method",
  }];
  validateBenchmarkTaskPacket(packet, plan);

  assert.deepEqual(
    evaluateAssertion(content, ambiguousTask.private.assertions[0]),
    {
      pass: false,
      reason: "requires evaluator ambiguity review",
      evaluator_ambiguity: true,
    },
  );

  const grade = gradeParsedResponse({
    parsed: parsedContent(content),
    task: ambiguousTask,
    condition: "docai-selected",
  });
  assert.deepEqual(grade, {
    contract_status: "valid",
    accuracy_status: "inconclusive",
    uncertainty_status: "none",
    reasons: ["/request/method requires evaluator ambiguity review"],
    failure_categories: ["evaluator-ambiguity"],
    manual_review_required: true,
  });
});

test("throws an implementation error for an unsupported assertion operator", () => {
  const unsupportedTask = scopedTask("create-user-request", [{
    path: "/request/method",
    operator: "approximately",
    value: "POST",
    failure_category: "request-method",
    fact_id: "users:create-method",
  }], ["users:create-method"], []);

  assert.throws(
    () => gradeParsedResponse({
      parsed: parsedContent(expectedContent("create-user-request")),
      task: unsupportedTask,
      condition: "docai-selected",
    }),
    /unsupported assertion operator approximately/,
  );
});

function task(id) {
  const selected = tasks.get(id);
  assert.ok(selected, `missing fixture task ${id}`);
  return selected;
}

function expectedContent(id) {
  return structuredClone(task(id).private.expected_outcome);
}

function scopedTask(id, assertions, requiredFacts, rawMissingFacts) {
  const selected = structuredClone(task(id));
  selected.private.assertions = assertions;
  selected.private.fact_inventory = {
    required: requiredFacts,
    raw_missing: rawMissingFacts,
    sliced_missing: rawMissingFacts,
  };
  return selected;
}

function parsedContent(content) {
  return parseProviderText(JSON.stringify(content));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function freshTaskPacket() {
  return readJson(path.join(benchmarkDir, "continuity", "tasks.json"));
}
