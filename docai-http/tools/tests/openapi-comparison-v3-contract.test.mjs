import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildRequiredOutputText,
  readContractPacket,
  taskContracts,
  validateBenchmarkTaskPacket,
  validateOutputContract,
} from "../openapi-comparison-v3-contract.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..");
const benchmarkDir = path.join(repoRoot, "docai-http", "benchmarks", "openapi-comparison");
const fixtureDir = path.join(testDir, "fixtures", "openapi-comparison-v3", "contracts");
const positive = readJson(path.join(fixtureDir, "positive.json"));
const negative = readJson(path.join(fixtureDir, "negative.json"));
const plan = readJson(path.join(benchmarkDir, "v3", "plan.json"));
const taskFile = path.join(benchmarkDir, "v3", "continuity", "tasks.json");

test("accepts positive fixtures for all six output contracts", () => {
  const contractIds = Object.keys(taskContracts().output_contracts);

  assert.deepEqual(Object.keys(positive).sort(), contractIds.sort());
  for (const [contractId, value] of Object.entries(positive)) {
    assert.deepEqual(validateOutputContract(value, contractId), {
      valid: true,
      errors: [],
    });
  }
});

test("accepts a fractional positive webhook acknowledgement deadline", () => {
  const value = freshPositive("webhook-handling.v3");
  value.webhook.acknowledgement.deadline_seconds = 0.5;

  assert.deepEqual(validateOutputContract(value, "webhook-handling.v3"), {
    valid: true,
    errors: [],
  });
});

test("accepts null directly at every nullable contract field", () => {
  const request = freshPositive("request-construction.v3");
  request.request.content_type = null;
  request.retry.key_header = null;
  assert.equal(validateOutputContract(request, "request-construction.v3").valid, true);

  const workflow = freshPositive("workflow-completion.v3");
  workflow.webhook_reconciliation[0].continue_operation = null;
  assert.equal(validateOutputContract(workflow, "workflow-completion.v3").valid, true);

  const webhook = freshPositive("webhook-handling.v3");
  webhook.webhook.delivery.deduplicate_by = null;
  webhook.webhook.reconciliation[0].continue_operation = null;
  assert.equal(validateOutputContract(webhook, "webhook-handling.v3").valid, true);

  const retrieval = freshPositive("retrieval-selection.v3");
  retrieval.pagination.deduplicate_by = null;
  assert.equal(validateOutputContract(retrieval, "retrieval-selection.v3").valid, true);
});

test("rejects targeted invalid fixtures with stable JSON-Pointer messages", async (t) => {
  for (const fixture of negative) {
    await t.test(fixture.name, () => {
      const result = validateOutputContract(fixture.value, fixture.contract_id);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some((error) => error.includes(fixture.error)), result.errors.join("\n"));
    });
  }
});

test("retains every applicable closed-root validation error", () => {
  const result = validateOutputContract({ unexpected: true }, "workflow-completion.v3");

  assert.deepEqual(result.errors, [
    "/steps: is required",
    "/failure_recovery: is required",
    "/webhook_reconciliation: is required",
    "/uncertainties: is required",
    "/unexpected: is not allowed",
  ]);
});

test("any-json rejects values that JSON cannot represent faithfully", async (t) => {
  const cases = [
    ["undefined", undefined],
    ["function", () => {}],
    ["symbol", Symbol("invalid")],
    ["bigint", 1n],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["class instance", new (class InvalidJson {})()],
  ];

  for (const [name, invalid] of cases) {
    await t.test(name, () => {
      const value = freshPositive("request-construction.v3");
      value.request.body.invalid = invalid;

      const result = validateOutputContract(value, "request-construction.v3");

      assert.equal(result.valid, false);
      assert.ok(result.errors.some((error) => error.startsWith("/request/body/invalid:")));
    });
  }
});

test("any-json rejects cyclic values and sparse arrays", () => {
  const cyclic = freshPositive("request-construction.v3");
  cyclic.request.body.self = cyclic.request.body;
  const cyclicResult = validateOutputContract(cyclic, "request-construction.v3");
  assert.ok(cyclicResult.errors.includes("/request/body/self: must be a finite JSON value"));

  const sparse = freshPositive("request-construction.v3");
  sparse.request.body.items = new Array(2);
  sparse.request.body.items[1] = "present";
  const sparseResult = validateOutputContract(sparse, "request-construction.v3");
  assert.ok(sparseResult.errors.includes("/request/body/items: must be a finite JSON value"));
});

test("any-json rejects arrays with hidden non-JSON properties", () => {
  const value = freshPositive("request-construction.v3");
  value.request.body.items = [];
  Object.defineProperty(value.request.body.items, "hidden", {
    value: "not serialized",
    enumerable: false,
  });

  const result = validateOutputContract(value, "request-construction.v3");

  assert.ok(result.errors.includes("/request/body/items: must be a finite JSON value"));
});

test("rejects malformed schemas while loading a contract packet", () => {
  assert.throws(
    () => readContractPacket(path.join(fixtureDir, "malformed-schema.json")),
    /pattern must use the full-match wrapper \^\(\?:\.\.\.\)\$/,
  );
  assert.throws(
    () => readContractPacket(path.join(fixtureDir, "malformed-partial-anchor-schema.json")),
    /pattern must use the full-match wrapper \^\(\?:\.\.\.\)\$/,
  );
});

test("rejects malformed schema keyword combinations", () => {
  assert.throws(
    () => readContractPacket(path.join(fixtureDir, "malformed-keyword-schema.json")),
    /minimum requires a finite numeric schema/,
  );
  assert.throws(
    () => readContractPacket(path.join(fixtureDir, "malformed-object-keyword-schema.json")),
    /object keywords require type object/,
  );
});

test("uses the required full-match wrapper for every uncertainty pointer pattern", () => {
  const expected = "^(?:/(?:[^~/]|~[01])*(?:/(?:[^~/]|~[01])*)*)$";

  for (const contract of Object.values(taskContracts().output_contracts)) {
    assert.equal(contract.schema.properties.uncertainties.items.properties.path.pattern, expected);
  }
});

test("returns cloned contract data instead of shared mutable state", () => {
  const first = taskContracts();
  first.task_classes.request_construction = "mutated.v3";
  first.output_contracts["request-construction.v3"].schema.required.length = 0;

  const second = taskContracts();
  assert.equal(second.task_classes.request_construction, "request-construction.v3");
  assert.deepEqual(second.output_contracts["request-construction.v3"].schema.required, [
    "request",
    "retry",
    "uncertainties",
  ]);
});

test("accepts the migrated six-task continuity packet and calibration subset", () => {
  const packet = readContractPacket(taskFile);

  assert.equal(validateBenchmarkTaskPacket(packet, plan), packet);
  assert.deepEqual(packet.tasks.map(({ id, class: taskClass }) => [id, taskClass]), [
    ["create-user-request", "request_construction"],
    ["upload-document-request", "request_construction"],
    ["payment-created-response", "response_handling"],
    ["create-user-errors", "error_recovery"],
    ["complete-checkout-workflow", "workflow_completion"],
    ["payment-completed-webhook", "webhook_handling"],
  ]);
  assert.ok(plan.calibration.task_ids.every((taskId) => packet.tasks.some((task) => task.id === taskId)));
});

test("preserves v2 task identities, classes, profiles, prompts, and retrieval selections", () => {
  const v2 = readJson(path.join(benchmarkDir, "v2", "continuity", "tasks.json"));
  const v3 = readContractPacket(taskFile);

  assert.equal(v3.tasks.length, v2.tasks.length);
  for (let index = 0; index < v2.tasks.length; index += 1) {
    const before = v2.tasks[index];
    const after = v3.tasks[index];
    assert.deepEqual(
      {
        id: after.id,
        class: after.class,
        profile: after.profile,
        user_task: after.public.user_task,
        retrieval: after.public.retrieval,
      },
      {
        id: before.id,
        class: before.class,
        profile: before.profile,
        user_task: before.public.user_task,
        retrieval: before.public.retrieval,
      },
    );
  }
});

test("preserves every v2 fact inventory member with only intentional v3 additions", () => {
  const v2 = readJson(path.join(benchmarkDir, "v2", "continuity", "tasks.json"));
  const v3 = readContractPacket(taskFile);
  const additions = {
    "create-user-request": ["users:create-method"],
    "upload-document-request": ["documents:upload-method", "documents:json-response"],
  };

  for (let index = 0; index < v2.tasks.length; index += 1) {
    const before = v2.tasks[index];
    const after = v3.tasks[index];
    assert.deepEqual(
      after.private.fact_inventory.required,
      [...before.private.fact_inventory.required, ...(additions[after.id] ?? [])],
      after.id,
    );
    assert.deepEqual(after.private.fact_inventory.raw_missing, before.private.fact_inventory.raw_missing);
    assert.deepEqual(after.private.fact_inventory.sliced_missing, before.private.fact_inventory.sliced_missing);
  }
});

test("maps method and response-format assertions to semantically exact facts", () => {
  const tasks = Object.fromEntries(readContractPacket(taskFile).tasks.map((task) => [task.id, task]));

  assert.equal(
    findAssertion(tasks["create-user-request"], "/request/method").fact_id,
    "users:create-method",
  );
  assert.equal(
    findAssertion(tasks["upload-document-request"], "/request/method").fact_id,
    "documents:upload-method",
  );
  assert.equal(
    findAssertion(
      tasks["upload-document-request"],
      "/request/headers",
      (assertion) => assertion.value?.Accept === "application/json",
    ).fact_id,
    "documents:json-response",
  );
});

test("validates every migrated expected outcome and assertion fact association", () => {
  const packet = validateBenchmarkTaskPacket(readContractPacket(taskFile), plan);

  for (const task of packet.tasks) {
    assert.equal(
      validateOutputContract(task.private.expected_outcome, task.public.output_contract).valid,
      true,
      task.id,
    );
    const required = new Set(task.private.fact_inventory.required);
    for (const assertion of task.private.assertions) {
      assert.equal(typeof assertion.fact_id, "string");
      assert.ok(required.has(assertion.fact_id), `${task.id}: ${assertion.fact_id}`);
      assert.notEqual(assertion.path.endsWith("/caller_action"), true);
    }
  }
});

test("migrates all six expected outcomes to canonical v3 fields", () => {
  const tasks = Object.fromEntries(readContractPacket(taskFile).tasks.map((task) => [task.id, task]));

  for (const id of ["create-user-request", "upload-document-request"]) {
    assert.deepEqual(tasks[id].private.expected_outcome.retry, {
      ambiguous_outcome: "same-request-and-key",
      key_header: "Idempotency-Key",
    });
  }
  assert.deepEqual(tasks["payment-created-response"].private.expected_outcome.response.retained_fields, [
    "payment_id",
  ]);
  assert.deepEqual(tasks["payment-created-response"].private.expected_outcome.response.relations, [
    { target: "POST /orders", field: "payment_id", action: "pass-as-input" },
    { target: "payment.completed", field: "payment_id", action: "match" },
  ]);
  assert.deepEqual(
    tasks["complete-checkout-workflow"].private.expected_outcome.steps.map((step) => step.states_after_success),
    [
      ["cart.validated"],
      ["payment.pending", "order.not_confirmed"],
      ["payment.settled", "order.confirmed"],
    ],
  );
  assert.deepEqual(tasks["payment-completed-webhook"].private.expected_outcome.webhook.delivery, {
    at_least_once: true,
    ordered: false,
    deduplicate_by: "event_id",
  });
  assert.deepEqual(tasks["payment-completed-webhook"].private.expected_outcome.webhook.acknowledgement, {
    status_class: "2xx",
    deadline_seconds: 5,
  });
  assert.deepEqual(tasks["payment-completed-webhook"].private.expected_outcome.webhook.payload.metadata, {
    handling: "opaque",
    allowed_actions: ["store", "forward"],
    interpret: false,
  });
  const metadataAssertion = findAssertion(
    tasks["payment-completed-webhook"],
    "/webhook/payload/metadata",
  );
  assert.equal(metadataAssertion.operator, "equals");
  assert.deepEqual(metadataAssertion.value, {
    handling: "opaque",
    allowed_actions: ["store", "forward"],
    interpret: false,
  });
});

test("rejects unknown keys at every task-packet layer", async (t) => {
  const cases = [
    ["packet", (packet) => { packet.unexpected = true; }, /task packet has unknown key unexpected/],
    ["task", (packet) => { packet.tasks[0].unexpected = true; }, /task create-user-request has unknown key unexpected/],
    ["public", (packet) => { packet.tasks[0].public.unexpected = true; }, /task create-user-request public has unknown key unexpected/],
    ["retrieval", (packet) => { packet.tasks[0].public.retrieval.unexpected = true; }, /task create-user-request public\.retrieval has unknown key unexpected/],
    ["private", (packet) => { packet.tasks[0].private.unexpected = true; }, /task create-user-request private has unknown key unexpected/],
    ["fact inventory", (packet) => { packet.tasks[0].private.fact_inventory.unexpected = []; }, /task create-user-request fact_inventory has unknown key unexpected/],
    ["assertion", (packet) => { packet.tasks[0].private.assertions[0].unexpected = true; }, /task create-user-request assertion 0 has unknown key unexpected/],
  ];

  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => {
      const packet = freshTaskPacket();
      mutate(packet);
      assert.throws(() => validateBenchmarkTaskPacket(packet, plan), expected);
    });
  }
});

test("rejects class instances at every object layer in task packets", async (t) => {
  const cases = [
    ["packet", (packet) => asClassInstance(packet), /task packet must be a plain finite JSON object/],
    ["task", (packet) => { packet.tasks[0] = asClassInstance(packet.tasks[0]); return packet; }, /task create-user-request must be a plain finite JSON object/],
    ["public", (packet) => { packet.tasks[0].public = asClassInstance(packet.tasks[0].public); return packet; }, /task create-user-request public must be a plain finite JSON object/],
    ["retrieval", (packet) => { packet.tasks[0].public.retrieval = asClassInstance(packet.tasks[0].public.retrieval); return packet; }, /task create-user-request public\.retrieval must be a plain finite JSON object/],
    ["private", (packet) => { packet.tasks[0].private = asClassInstance(packet.tasks[0].private); return packet; }, /task create-user-request private must be a plain finite JSON object/],
    ["expected outcome", (packet) => { packet.tasks[0].private.expected_outcome = asClassInstance(packet.tasks[0].private.expected_outcome); return packet; }, /task create-user-request private\.expected_outcome must be a plain finite JSON object/],
    ["assertion", (packet) => { packet.tasks[0].private.assertions[0] = asClassInstance(packet.tasks[0].private.assertions[0]); return packet; }, /task create-user-request assertion 0 must be a plain finite JSON object/],
    ["fact inventory", (packet) => { packet.tasks[0].private.fact_inventory = asClassInstance(packet.tasks[0].private.fact_inventory); return packet; }, /task create-user-request fact_inventory must be a plain finite JSON object/],
  ];

  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => {
      const packet = mutate(freshTaskPacket());
      assert.throws(() => validateBenchmarkTaskPacket(packet, plan), expected);
    });
  }
});

test("rejects hidden, symbol, accessor, and cyclic task-packet data", async (t) => {
  const cases = [
    ["hidden public property", (packet) => {
      Object.defineProperty(packet.tasks[0].public, "hidden", { value: true });
    }, /task create-user-request public must be a plain finite JSON object/],
    ["symbol task property", (packet) => {
      packet.tasks[0][Symbol("hidden")] = true;
    }, /task create-user-request must be a plain finite JSON object/],
    ["retrieval accessor", (packet) => {
      Object.defineProperty(packet.tasks[0].public.retrieval, "computed", {
        enumerable: true,
        get: () => "value",
      });
    }, /task create-user-request public\.retrieval must be a plain finite JSON object/],
    ["public cycle", (packet) => {
      packet.tasks[0].public.loop = packet.tasks[0].public;
    }, /task create-user-request public must be a finite JSON value/],
  ];

  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => {
      const packet = freshTaskPacket();
      mutate(packet);
      assert.throws(() => validateBenchmarkTaskPacket(packet, plan), expected);
    });
  }
});

test("enforces assertion operator value domains", async (t) => {
  const cases = [
    ["absent with value", "absent", "unexpected", /absent operator must not have value/],
    ["evaluator ambiguity with value", "evaluator-ambiguity.v1", "unexpected", /evaluator-ambiguity\.v1 operator must not have value/],
    ["equals undefined", "equals", undefined, /equals value must be a finite JSON value/],
    ["equals NaN", "equals", Number.NaN, /equals value must be a finite JSON value/],
    ["contains function", "contains", () => {}, /contains value must be a finite JSON value/],
    ["contains cycle", "contains", cyclicObject(), /contains value must be a finite JSON value/],
    ["header empty", "header_contains", {}, /header_contains value must be a non-empty plain object with string values/],
    ["header non-string", "header_contains", { Accept: 1 }, /header_contains value must be a non-empty plain object with string values/],
    ["header class", "header_contains", asClassInstance({ Accept: "application/json" }), /header_contains value must be a non-empty plain object with string values/],
    ["set scalar", "set_equals", "value", /set_equals value must be a dense finite JSON array/],
    ["set sparse", "set_equals", sparseArray(), /set_equals value must be a dense finite JSON array/],
    ["set non-finite", "set_equals", [Number.POSITIVE_INFINITY], /set_equals value must be a dense finite JSON array/],
  ];

  for (const [name, operator, value, expected] of cases) {
    await t.test(name, () => {
      const packet = freshTaskPacket();
      const assertion = packet.tasks[0].private.assertions[0];
      assertion.operator = operator;
      assertion.value = value;
      assert.throws(() => validateBenchmarkTaskPacket(packet, plan), expected);
    });
  }
});

test("accepts the versioned evaluator ambiguity operator without a value", () => {
  const packet = freshTaskPacket();
  const assertion = packet.tasks[0].private.assertions[0];
  assertion.operator = "evaluator-ambiguity.v1";
  delete assertion.value;

  assert.strictEqual(validateBenchmarkTaskPacket(packet, plan), packet);
});

test("header assertions reject hidden, symbol, and accessor properties", async (t) => {
  const cases = [
    ["hidden", () => {
      const value = { Accept: "application/json" };
      Object.defineProperty(value, "hidden", { value: "secret" });
      return value;
    }],
    ["symbol", () => {
      const value = { Accept: "application/json" };
      value[Symbol("hidden")] = "secret";
      return value;
    }],
    ["accessor", () => {
      const value = {};
      Object.defineProperty(value, "Accept", {
        enumerable: true,
        get: () => "application/json",
      });
      return value;
    }],
  ];

  for (const [name, buildValue] of cases) {
    await t.test(name, () => {
      const packet = freshTaskPacket();
      const assertion = packet.tasks[0].private.assertions[0];
      assertion.operator = "header_contains";
      assertion.value = buildValue();
      assert.throws(
        () => validateBenchmarkTaskPacket(packet, plan),
        /header_contains value must be a non-empty plain object with string values/,
      );
    });
  }
});

test("rejects forbidden private keys nested anywhere in public task data", () => {
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

  for (const key of forbiddenKeys) {
    const packet = freshTaskPacket();
    packet.tasks[0].public.nested = [{ deeper: { [key]: "leak" } }];
    assert.throws(
      () => validateBenchmarkTaskPacket(packet, plan),
      new RegExp(`public.*task data must not contain ${key}`),
    );
  }
});

test("rejects malformed task packet identities and private grading data", async (t) => {
  const cases = [
    ["missing fact_id", (packet) => delete packet.tasks[0].private.assertions[0].fact_id, /requires fact_id/],
    ["unknown fact_id", (packet) => { packet.tasks[0].private.assertions[0].fact_id = "unknown:fact"; }, /fact_id unknown:fact is not required/],
    ["duplicate task id", (packet) => { packet.tasks[1].id = packet.tasks[0].id; }, /task ids must be unique/],
    ["wrong contract id", (packet) => { packet.tasks[0].public.output_contract = "response-handling.v3"; }, /output_contract must be request-construction.v3/],
    ["missing calibration task", (packet) => { packet.tasks = packet.tasks.filter((task) => task.id !== "upload-document-request"); }, /missing calibration task upload-document-request/],
    ["unsupported operator", (packet) => { packet.tasks[0].private.assertions[0].operator = "approximately"; }, /unsupported assertion operator approximately/],
    ["invalid expected outcome", (packet) => { delete packet.tasks[0].private.expected_outcome.uncertainties; }, /expected_outcome.*\/uncertainties: is required/],
    ["expected answer leakage", (packet) => { packet.tasks[0].public.expected_outcome = { method: "POST" }; }, /public task data must not contain expected_outcome/],
  ];

  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => {
      const packet = freshTaskPacket();
      mutate(packet);
      assert.throws(() => validateBenchmarkTaskPacket(packet, plan), expected);
    });
  }
});

test("renders provider-neutral public schemas without selected expected answers", () => {
  const first = buildRequiredOutputText("workflow-completion.v3", {
    provider: "openai",
    condition: "openapi-raw",
  });
  const second = buildRequiredOutputText("workflow-completion.v3", {
    provider: "google",
    condition: "docai-selected",
  });

  assert.equal(first, second);
  assert.match(first, /^Return exactly one raw JSON object with no Markdown fence or surrounding prose\./);
  assert.match(first, /"additional_properties": false/);
  assert.match(first, /same-request-and-key/);
  assert.doesNotMatch(first, /cart_01K0COMPLETE|taro@example\.com|payment\.completed|payment\.settled/);

  const allContracts = JSON.stringify(taskContracts());
  assert.doesNotMatch(allContracts, /cart_01K0COMPLETE|taro@example\.com|payment\.completed|payment\.settled/);
});

function freshPositive(contractId) {
  return structuredClone(positive[contractId]);
}

function freshTaskPacket() {
  return readJson(taskFile);
}

function findAssertion(task, assertionPath, predicate = () => true) {
  const assertion = task.private.assertions.find((candidate) => (
    candidate.path === assertionPath && predicate(candidate)
  ));
  assert.ok(assertion, `${task.id} requires assertion ${assertionPath}`);
  return assertion;
}

function asClassInstance(value) {
  return Object.assign(new (class PacketLayer {})(), value);
}

function sparseArray() {
  const value = new Array(2);
  value[1] = "present";
  return value;
}

function cyclicObject() {
  const value = {};
  value.self = value;
  return value;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
