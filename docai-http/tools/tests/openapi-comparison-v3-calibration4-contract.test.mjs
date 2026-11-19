import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readTaskPacket, taskContracts, validateOutputContract, readContractPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/contract.mjs";

const packet = readTaskPacket();
const upload = () => structuredClone(packet.tasks[1].private.expected_outcome);
const valid = (value) => validateOutputContract(value, "request-construction.calibration4").valid;

test("all six typed positive outcomes validate across exactly five families", () => {
  assert.equal(Object.keys(taskContracts().output_contracts).length, 5);
  for (const task of packet.tasks) {
    assert.match(task.public.output_contract, /\.calibration4$/);
    assert.equal(validateOutputContract(task.private.expected_outcome, task.public.output_contract).valid, true);
    assert.equal(typeof task.public.inputs, "object");
  }
});

test("migration retains scored recovery identifiers and workflow retained outputs", () => {
  const errors = packet.tasks[3].private.assertions.map((a) => a.path);
  for (let i = 0; i < 4; i += 1) {
    assert.equal(errors.includes(`/errors/items/${i}/status`), true);
    assert.equal(errors.includes(`/errors/items/${i}/code`), true);
  }
  const workflow = packet.tasks[4].private.assertions.map((a) => a.path);
  for (let i = 0; i < 3; i += 1) assert.equal(workflow.includes(`/steps/items/${i}/keep`), true);
});

test("unspecified retry ceilings are not fabricated as known-null policies", () => {
  const retry = packet.tasks[1].private.expected_outcome.retry.items[0];
  assert.equal(Object.hasOwn(retry.action.value, "max_attempts"), false);
  assert.deepEqual(packet.tasks[3].private.expected_outcome.errors.items[3].recovery.action.value.max_attempts, { status: "known", value: 1 });
  const answer = upload();
  answer.retry.items[0].action.value.max_attempts = { status: "unknown", value: null };
  assert.equal(valid(answer), true);
  answer.retry.items[0].action.value.max_attempts = { status: "known", value: null };
  assert.equal(valid(answer), false);
});

test("distinguishes known-null from unknown and rejects malformed value records", () => {
  const answer = upload();
  answer.request.body = { status: "known", value: null };
  assert.equal(valid(answer), true);
  answer.request.path = { status: "known", value: null };
  assert.equal(valid(answer), false);
  answer.request.path = { status: "unknown", value: null };
  assert.equal(valid(answer), true);
  answer.request.path.value = "/invented";
  assert.equal(valid(answer), false);
  answer.request.path = { status: "known", value: 7 };
  assert.equal(valid(answer), false);
});

test("partial and unknown inventories never require hidden member names", () => {
  for (const status of ["partial", "unknown"]) {
    const answer = upload();
    answer.request.headers = { status, items: [] };
    assert.equal(valid(answer), true);
  }
  const answer = upload();
  answer.request.headers.status = "partial";
  assert.equal(valid(answer), true);
  answer.request.headers.status = "unknown";
  assert.equal(valid(answer), false);
  answer.request.headers.items = [null];
  assert.equal(valid(answer), false, "overlapping one_of branches must not accept an item");
});

test("every family accepts unnamed incomplete membership without relaxing closure", () => {
  const paths = ["request.headers", "request.headers", "response.body.fields", "errors", "steps", "webhook.headers"];
  packet.tasks.forEach((task, index) => {
    for (const status of ["partial", "unknown"]) {
      const answer = structuredClone(task.private.expected_outcome);
      const fields = paths[index].split(".");
      const parent = fields.slice(0, -1).reduce((v, key) => v[key], answer);
      parent[fields.at(-1)] = { status, items: [] };
      answer.uncertainties = [`/${fields.join("/")}`];
      assert.equal(validateOutputContract(answer, task.public.output_contract).valid, true);
      answer.schema_version = "1";
      assert.equal(validateOutputContract(answer, task.public.output_contract).valid, false);
    }
  });
});

test("closed nested shapes reject extra fields and malformed references", () => {
  const answer = upload();
  answer.request.boundary.extra = true;
  assert.equal(valid(answer), false);
  delete answer.request.boundary.extra;
  answer.request.parts.items[0].value = { status: "known", value: { kind: "step-output", step: "2", field: "id" } };
  assert.equal(valid(answer), false);
  answer.request.parts.items[0].value = { status: "known", value: { kind: "task-input", name: "document", extra: true } };
  assert.equal(valid(answer), false);
});

test("relational, safety and uncertainty errors belong to semantics, not schema", () => {
  const task = packet.tasks[4];
  const answer = structuredClone(task.private.expected_outcome);
  answer.steps.items[1].order = answer.steps.items[0].order;
  answer.steps.items[2].request.body.value.payment_id = { status: "known", value: { kind: "step-output", step: 99, field: "payment_id" } };
  answer.failure_recovery.items[0].repeat_side_effect.value = true;
  answer.steps.items[0].request.headers.status = "partial";
  answer.uncertainties = [];
  assert.equal(validateOutputContract(answer, task.public.output_contract).valid, true);
});

test("partial checkout retains known output IDs while expanded paths and key membership stay unknown", () => {
  const task = packet.tasks[4];
  const answer = structuredClone(task.private.expected_outcome);
  for (const [i, step] of answer.steps.items.entries()) {
    step.request.path = { status: "unknown", value: null };
    step.keep = { status: "partial", items: step.keep.items.filter((item) => item.kind === "step-output") };
    answer.uncertainties.push(`/steps/items/${i}/request/path`, `/steps/items/${i}/keep`);
  }
  assert.equal(validateOutputContract(answer, task.public.output_contract).valid, true);
  assert.deepEqual(answer.steps.items[1].keep.items, [{ kind: "step-output", step: 2, field: "payment_id" }]);
  assert.deepEqual(answer.steps.items[2].keep.items.map((item) => item.field), ["order_id", "cart_id", "payment_id"]);
  for (const a of task.private.assertions.filter((a) => /^\/steps\/items\/[12]\/keep$/.test(a.path))) {
    assert.equal(a.operator, "contains", "each known or policy-dependent member needs its own predicate");
    assert.equal(a.value.items.length, 1);
    assert.equal(Object.hasOwn(a.value, "status"), false, "partial membership must not fail a complete-list assertion");
  }
  const responseTask = packet.tasks[2];
  const response = structuredClone(responseTask.private.expected_outcome);
  response.response.retained_fields = { status: "partial", items: ["payment_id"] };
  response.uncertainties = ["/response/retained_fields"];
  assert.equal(validateOutputContract(response, responseTask.public.output_contract).valid, true);
});

test("one_of requires exactly one matching branch and validates its declaration", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "c4-one-of-"));
  const file = path.join(directory, "contracts.json");
  const data = taskContracts();
  try {
    const id = "request-construction.calibration4";
    data.output_contracts[id].schema = { one_of: [{ type: "string" }, { type: "integer" }] };
    fs.writeFileSync(file, JSON.stringify(data));
    assert.doesNotThrow(() => readContractPacket(file));
    data.output_contracts[id].schema.one_of = [];
    fs.writeFileSync(file, JSON.stringify(data));
    assert.throws(() => readContractPacket(file), /one_of/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("public input identities resolve literal supplied values, not private placeholders", () => {
  assert.equal(packet.tasks[1].public.inputs.filename, "statement.pdf");
  assert.deepEqual(packet.tasks[1].public.inputs.metadata, { title: "Q2 statement", tags: ["finance", "quarterly"] });
  assert.equal(packet.tasks[4].public.inputs.cart_id, "cart_01K0COMPLETE");
  assert.equal(packet.tasks[4].public.inputs.amount, 1200);
  assert.equal(packet.tasks[4].public.inputs.currency, "JPY");
  assert.equal(JSON.stringify(packet.tasks.map((t) => t.private.expected_outcome)).includes("<"), false);
});

test("typed answer helpers keep input resolution and structural identity explicit", async () => {
  const file = new URL("../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/answer-values.mjs", import.meta.url);
  assert.equal(fs.existsSync(file), true);
  const { resolveTaskInput, referenceIdentity, readAnswerPointer } = await import(file);
  assert.deepEqual(resolveTaskInput({ kind: "task-input", name: "metadata" }, packet.tasks[1].public.inputs), { title: "Q2 statement", tags: ["finance", "quarterly"] });
  assert.throws(() => resolveTaskInput({ kind: "task-input", name: "not_supplied" }, packet.tasks[1].public.inputs), /not supplied/);
  assert.notEqual(referenceIdentity({ kind: "generated", rule: "opaque-string", scope: "a" }), referenceIdentity({ kind: "generated", rule: "opaque-string", scope: "b" }));
  assert.equal(referenceIdentity({ kind: "step-output", step: 2, field: "id" }), referenceIdentity({ field: "id", kind: "step-output", step: 2 }));
  assert.throws(() => referenceIdentity({ kind: "step-output", step: "2", field: "id" }), /malformed/);
  assert.throws(() => resolveTaskInput({ kind: "task-input", name: "metadata", extra: true }, packet.tasks[1].public.inputs), /malformed/);
  assert.deepEqual(readAnswerPointer({ "a/b": { "~": null } }, "/a~1b/~0"), { found: true, value: null });
  assert.deepEqual(readAnswerPointer({}, "/missing"), { found: false });
});
