import assert from "node:assert/strict";
import test from "node:test";
import { readTaskPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/contract.mjs";
import * as values from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/answer-values.mjs";
import { validateOutputContract } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/contract.mjs";

const task = readTaskPacket().tasks.find((t) => t.id === "complete-checkout-workflow");
const check = (answer) => {
  assert.equal(typeof values.validateAnswerRelations, "function");
  return values.validateAnswerRelations({ answer, task });
};

test("relations allow current response retention and backward request dependencies", () => {
  assert.deepEqual(check(structuredClone(task.private.expected_outcome)), []);
});
for (const [name, mutate] of [
  ["duplicate ordinals", (a) => { a.steps.items[2].order = 2; }],
  ["reordered steps", (a) => a.steps.items.reverse()],
  ["same-step request dependency", (a) => { a.steps.items[1].request.body.value.cart_id.value.step = 2; }],
  ["forward dependency", (a) => { a.steps.items[1].request.body.value.cart_id.value.step = 3; }],
  ["same-step recovery input", (a) => { a.failure_recovery.items[0].preserve.items[0].target = { kind: "step-output", step: 3, field: "order_id" }; }],
  ["dangling field", (a) => { a.steps.items[1].request.body.value.cart_id.value.field = "unknown_field"; }],
  ["invented retained output", (a) => { a.steps.items[1].keep.items.push({ kind: "step-output", step: 2, field: "invented" }); }],
  ["case-variant duplicate headers", (a) => { const h = structuredClone(a.steps.items[0].request.headers.items[0]); h.name = "authorization"; a.steps.items[0].request.headers.items.push(h); }],
  ["contradictory states", (a) => a.steps.items[1].states_after_success.items.push({ subject: "payment", state: { status: "known", value: "settled" } })],
  ["unknown without correspondence", (a) => { a.steps.items[1].request.path = { status: "unknown", value: null }; }],
  ["uncertainty over known fact", (a) => a.uncertainties.push("/steps/items/1/request/path")],
  ["unknown task input", (a) => { a.steps.items[1].request.body.value.amount.value.name = "private_name"; }],
]) test(`relations reject ${name}`, () => {
  const answer = structuredClone(task.private.expected_outcome);
  mutate(answer);
  const failures = check(answer);
  assert.ok(failures.length > 0);
  for (const f of failures) assert.deepEqual(Object.keys(f).sort(), ["category", "message", "path", "predicate_id"]);
});

test("relations preserve pointer strictness and cloned public inputs", () => {
  assert.throws(() => values.readAnswerPointer({}, "/bad~2"));
  const inputs = { value: { nested: [] } };
  values.resolveTaskInput({ kind: "task-input", name: "value" }, inputs).nested.push(1);
  assert.deepEqual(inputs.value.nested, []);
  assert.throws(() => values.referenceIdentity({ kind: "step-output", step: "1", field: "id" }));
});
for (const [name, index, mutate] of [
  ["JSON media-type disagreement", 0, (r) => { r.content_type.value = "text/plain"; }],
  ["multipart header disagreement", 1, (r) => r.headers.items.push({ name: "content-type", value: { status: "known", value: "application/json" }, scheme: { status: "known", value: null } })],
  ["multipart JSON body", 1, (r) => { r.body.value = { extra: { status: "known", value: "data" } }; }],
  ["library boundary with literal value", 1, (r) => { r.boundary.value.value = "fixed-boundary"; }],
  ["JSON multipart boundary mode", 0, (r) => { r.boundary.mode.value = "library-managed"; }],
]) test(`fix1 I2 rejects ${name}`, () => {
  const selected = readTaskPacket().tasks[index], answer = structuredClone(selected.private.expected_outcome);
  mutate(answer.request);
  assert.equal(validateOutputContract(answer, selected.public.output_contract).valid, true);
  assert.ok(values.validateAnswerRelations({ answer, task: selected }).some((f) => f.category === "request-media-type"));
});
test("fix1 I2 allows consistent JSON and library-managed multipart representations", () => {
  for (const index of [0, 1]) {
    const selected = readTaskPacket().tasks[index], answer = structuredClone(selected.private.expected_outcome);
    if (index === 1) answer.request.headers.items.push({ name: "content-type", value: { status: "known", value: "multipart/form-data" }, scheme: { status: "known", value: null } });
    assert.equal(validateOutputContract(answer, selected.public.output_contract).valid, true);
    assert.deepEqual(values.validateAnswerRelations({ answer, task: selected }), []);
  }
});
