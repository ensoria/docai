import assert from "node:assert/strict";
import test from "node:test";
import { readTaskPacket, validateOutputContract, validateBenchmarkTaskPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/contract.mjs";
import { readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/paths.mjs";
import { readEvidenceLedger } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/check-evidence-ledger.mjs";
import { parseProviderText } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/parser.mjs";
import * as grader from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/grader.mjs";
import { evaluateTaskSemantics } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/semantic-predicates.mjs";
const packet = readTaskPacket(), tasks = packet.tasks, ledger = readEvidenceLedger();
const grade = (answer, task, condition = "docai-selected") => grader.gradeParsedResponse({ parsed: parseProviderText(JSON.stringify(answer)), task, condition });
const visit = (v, fn) => { if (!v || typeof v !== "object") return; fn(v); for (const child of Object.values(v)) visit(child, fn); };
for (const task of tasks) test(`audit baseline: ${task.id}`, () => {
  const r = grade(task.private.expected_outcome, task);
  assert.equal(r.contract_status, "valid"); assert.equal(r.accuracy_status, "pass");
  assert.equal(r.uncertainty_status, "none"); assert.equal(r.manual_review_required, false);
});
for (const [name, index, mutate, expected] of [
  ["boundary representation", 1, (a) => { a.request.boundary.value.value = null; }, "pass"],
  ["alternate upload key", 1, (a) => visit(a, (v) => { if (v.kind === "generated") v.scope = "s0"; }), "pass"],
  ["lowercase authorization", 0, (a) => { a.request.headers.items[0].name = "authorization"; }, "pass"],
  ["structured payment headers and body", 4, () => {}, "pass"],
  ["structured ambiguous-order trigger", 4, () => {}, "pass"],
  ["reverse recovery preserve", 4, (a) => a.failure_recovery.items[0].preserve.items.reverse(), "pass"],
  ["alternate workflow payment key", 4, (a) => visit(a, (v) => { if (v.kind === "generated" && v.scope === "payment") v.scope = "s0"; }), "pass"],
  ["unsafe webhook replay", 5, (a) => { a.webhook.reconciliation.items[0].repeat_side_effect.value = true; }, "fail"],
  ["answer metadata", 0, (a) => { a.schema_version = "4"; }, "invalid"],
  ["payment path suffix", 4, (a) => { a.steps.items[1].request.path.value += "/wrong"; }, "fail"],
  ["negated cart state", 4, (a) => { a.steps.items[0].states_after_success.items[0].state.value = "not cart.validated"; }, "invalid"],
  ["contradictory duplicate ordinal", 4, (a) => { const s = structuredClone(a.steps.items[1]); s.request.method.value = "GET"; a.steps.items.push(s); }, "fail"],
]) test(`audit mutation: ${name}`, () => {
  const task = tasks[index], answer = structuredClone(task.private.expected_outcome); mutate(answer);
  const r = grade(answer, task);
  assert.equal(expected === "invalid" ? r.contract_status : r.accuracy_status, expected, JSON.stringify(r));
});
for (const row of ledger.rows.filter((r) => r.measured)) test(`negative control: ${row.predicate_id}`, () => {
  const task = tasks.find((t) => t.id === row.task_id), answer = structuredClone(task.private.expected_outcome);
  const s = row.output_path.slice(1).split("/").map((v) => v.replaceAll("~1", "/").replaceAll("~0", "~"));
  s.slice(0, -1).reduce((v, k) => v[k], answer)[s.at(-1)] = structuredClone(row.negative_control.replacement);
  assert.equal(validateOutputContract(answer, task.public.output_contract).valid, true);
  const r = grade(answer, task); assert.equal(r.contract_status, "valid"); assert.equal(r.accuracy_status, "fail", JSON.stringify(r));
  assert.ok(r.failure_categories.includes(task.private.assertions[row.negative_control.assertion_index].failure_category));
  const semantics = evaluateTaskSemantics({ answer, task, condition: "docai-selected", ledger });
  assert.ok(semantics.failures.some((f) => f.predicate_id === row.predicate_id && f.category === task.private.assertions[row.negative_control.assertion_index].failure_category), row.predicate_id);
});
test("semantic interface returns source-mapped failures separately from evidence", async () => {
  const { evaluateTaskSemantics } = await import("../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/semantic-predicates.mjs");
  const task = tasks[0], answer = structuredClone(task.private.expected_outcome); answer.request.path.value += "/wrong";
  const r = evaluateTaskSemantics({ answer, task, condition: "docai-selected", ledger });
  assert.deepEqual(Object.keys(r).sort(), ["evidence_discipline", "failures", "passed"]); assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.predicate_id === ledger.rows.find((row) => row.task_id === task.id && row.output_path === "/request/path").predicate_id));
});
test("rejects local reference breaks and cross-operation key reuse", () => {
  for (const mutate of [
    (a) => { a.failure_recovery.items[0].preserve.items.find((v) => v.target.kind === "generated").target.scope = "unrelated"; },
    (a) => visit(a, (v) => { if (v.kind === "generated" && v.scope === "order") v.scope = "payment"; }),
  ]) { const a = structuredClone(tasks[4].private.expected_outcome); mutate(a); assert.equal(grade(a, tasks[4]).accuracy_status, "fail"); }
});
test("external alpha-renaming preserves roles and repeated identities", () => {
  const a = structuredClone(tasks[4].private.expected_outcome);
  const names = new Map();
  visit(a, (v) => { if (v.kind === "external-input") { if (!names.has(v.name)) names.set(v.name, `e${names.size}`); v.name = names.get(v.name); } });
  assert.equal(grade(a, tasks[4]).accuracy_status, "pass");
  a.steps.items[1].request.body.value.card_token.value.name = names.get("access_token");
  assert.equal(grade(a, tasks[4]).accuracy_status, "fail");
});
test("exact matcher never substring-matches or sorts JSON body arrays", () => {
  assert.equal(grader.evaluateAssertion({ x: "expected/wrong" }, { path: "/x", operator: "contains", value: "expected" }).pass, false);
  assert.equal(grader.evaluateAssertion({ x: [[2, 1]] }, { path: "/x", operator: "set_equals", value: [[1, 2]] }).pass, false);
});
test("preserves parser, contract and implementation failure boundaries", () => {
  assert.equal(grader.gradeParsedResponse({ parsed: parseProviderText('{"request":'), task: tasks[0], condition: "docai-selected" }).accuracy_status, "not-evaluated");
  const r = grade({ request: {} }, tasks[0]); assert.equal(r.contract_status, "invalid"); assert.equal(r.accuracy_status, "not-evaluated");
  const task = structuredClone(tasks[0]); task.private.assertions[0].operator = "approximately";
  assert.throws(() => grade(task.private.expected_outcome, task), /unsupported assertion operator/);
});
test("explicit evaluator ambiguity remains inconclusive", () => {
  const p = structuredClone(packet), task = p.tasks[0];
  task.private.assertions = [{ path: "/request/method", operator: "evaluator-ambiguity.v1", failure_category: "review-request-method", fact_id: "users:create-method" }];
  validateBenchmarkTaskPacket(p, readPlan());
  const r = grade(task.private.expected_outcome, task); assert.equal(r.accuracy_status, "inconclusive"); assert.equal(r.manual_review_required, true);
});
test("additional unique workflow step cannot bypass documented ordering", () => {
  const task = tasks[4], a = structuredClone(task.private.expected_outcome), extra = structuredClone(a.steps.items[1]);
  extra.order = 4; extra.keep.items = []; extra.request.path.value = "/v1/payments/recapture";
  a.steps.items.push(extra);
  assert.equal(grade(a, task).contract_status, "valid");
  assert.equal(grade(a, task).accuracy_status, "fail");
});
test("conflicting added recovery cannot hide behind the expected recovery", () => {
  const a = structuredClone(tasks[4].private.expected_outcome), unsafe = structuredClone(a.failure_recovery.items[0]);
  unsafe.repeat_side_effect.value = true; a.failure_recovery.items.push(unsafe);
  assert.equal(grade(a, tasks[4]).accuracy_status, "fail");
});

test("all declared sets can reorder without changing wire JSON arrays", () => {
  for (const task of tasks) {
    const a = structuredClone(task.private.expected_outcome);
    visit(a, (v) => { if (Array.isArray(v.items) && v !== a.steps) v.items.reverse(); });
    assert.equal(grade(a, task).accuracy_status, "pass", task.id);
  }
});
test("set uniqueness and header values are exact, including comma-combinability", () => {
  assert.equal(grader.evaluateAssertion({ x: ["a", "a"] }, { path: "/x", operator: "set_equals", value: ["a", "a"] }).pass, false);
  for (const headers of [{ Authorization: "Basic x", authorization: "Bearer x" }, { authorization: "Bearer x", Authorization: "Basic x" }, { Authorization: "Basic x" }]) {
    assert.equal(grader.evaluateAssertion({ headers }, { path: "/headers", operator: "header_contains", value: { Authorization: "Bearer x" } }).pass, false);
  }
  const a = structuredClone(tasks[5].private.expected_outcome);
  a.webhook.headers.items[0].comma_combinable.value = true;
  assert.equal(grade(a, tasks[5]).accuracy_status, "fail");
});
test("known but wrong state and all wire identifiers fail semantically", () => {
  const a = structuredClone(tasks[4].private.expected_outcome);
  a.steps.items[0].states_after_success.items[0].state.value = "not_confirmed";
  assert.equal(grade(a, tasks[4]).contract_status, "valid");
  assert.equal(grade(a, tasks[4]).accuracy_status, "fail");
  const b = structuredClone(tasks[2].private.expected_outcome);
  b.response.body.fields.items[0].name = "PAYMENT_ID";
  assert.equal(grade(b, tasks[2]).accuracy_status, "fail");
});
test("extra unsafe recovery with a distinct trigger also fails", () => {
  const a = structuredClone(tasks[4].private.expected_outcome), unsafe = structuredClone(a.failure_recovery.items[0]);
  unsafe.trigger.value.category = "conflict"; unsafe.repeat_side_effect.value = true;
  a.failure_recovery.items.push(unsafe);
  assert.equal(grade(a, tasks[4]).contract_status, "valid");
  assert.equal(grade(a, tasks[4]).accuracy_status, "fail");
});
test("independent wrong workflow and recovery categories survive gap reports", () => {
  const task = tasks[4], a = structuredClone(task.private.expected_outcome);
  a.steps.items[1].request.method.value = "GET";
  a.failure_recovery.items[0].action.value.key_strategy = "new";
  a.steps.items[2].request.path = { status: "unknown", value: null };
  a.uncertainties = ["/steps/items/2/request/path"];
  const r = grade(a, task, "docai-selected");
  assert.equal(r.accuracy_status, "fail"); assert.equal(r.manual_review_required, false);
  assert.equal(r.uncertainty_status, "missed-fact");
  assert.ok(r.failure_categories.includes("checkout-ordered-steps"));
  assert.ok(r.failure_categories.includes("checkout-order-recovery"));
});
test("accepted MIME type sets reorder but metadata JSON arrays remain ordered", () => {
  const task = tasks[1], a = structuredClone(task.private.expected_outcome);
  a.request.validation.items.find((v) => v.constraint === "accepted-content-types" && v.target === "document").value.value.reverse();
  assert.equal(grade(a, task).accuracy_status, "pass");
  const b = { body: { status: "known", value: { tags: ["second", "first"] } } };
  assert.equal(grader.evaluateAssertion(b, { path: "/body", operator: "equals", value: { status: "known", value: { tags: ["first", "second"] } } }).pass, false);
});
test("all four conditions share source-mapped semantic expectations", () => {
  for (const task of tasks) {
    for (const condition of ["openapi-raw", "openapi-sliced", "openapi-enriched", "docai-selected"]) {
      assert.equal(grade(task.private.expected_outcome, task, condition).accuracy_status, "pass");
    }
    assert.deepEqual(grade(task.private.expected_outcome, task, "openapi-enriched"), grade(task.private.expected_outcome, task, "docai-selected"));
  }
});
test("general operators preserve exact scalars, absence and structural containment", () => {
  const content = { method: "POST", parts: { status: "complete", items: [{ name: "metadata", value: { status: "known", value: { title: "Q2", tags: ["a", "b"] } } }] } };
  for (const assertion of [
    { path: "/method", operator: "equals", value: "POST" },
    { path: "/role", operator: "absent" },
    { path: "/parts", operator: "contains", value: { items: [{ name: "metadata", value: { status: "known", value: { title: "Q2" } } }] } },
  ]) assert.deepEqual(grader.evaluateAssertion(content, assertion), { pass: true, reason: "" });
});
test("a JSON property called items is not implicitly an unordered collection", () => {
  assert.equal(grader.evaluateAssertion({ body: { items: ["b", "a"] } }, { path: "/body", operator: "equals", value: { items: ["a", "b"] } }).pass, false);
});
test("alpha-renaming does not change per-predicate evidence discipline", async () => {
  const { evaluateTaskSemantics } = await import("../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/semantic-predicates.mjs");
  for (const task of tasks) {
    const a = structuredClone(task.private.expected_outcome), names = new Map();
    visit(a, (v) => {
      if (!["generated", "external-input"].includes(v.kind)) return;
      const key = v.kind === "generated" ? "scope" : "name", id = `${v.kind}:${v[key]}`;
      if (!names.has(id)) names.set(id, `v${names.size}`); v[key] = names.get(id);
    });
    const evaluate = (answer) => evaluateTaskSemantics({ answer, task, condition: "openapi-raw", ledger });
    assert.deepEqual(evaluate(a), evaluate(task.private.expected_outcome), task.id);
  }
});

test("fix1 I1 rejects a distinct extra unsafe error recovery", () => {
  const task = tasks[3], a = structuredClone(task.private.expected_outcome);
  a.errors.items.reverse();
  assert.equal(grade(a, task).accuracy_status, "pass");
  const extra = structuredClone(task.private.expected_outcome.errors.items[0]);
  extra.status.value = 500; extra.code.value = "server_error";
  extra.recovery.trigger.value = { category: "ambiguous-outcome", status: 500, code: "server_error" };
  extra.recovery.action.value = { kind: "retry", key_strategy: "new", request_equivalence: "changed" };
  extra.recovery.repeat_side_effect.value = true;
  a.errors.items.push(extra);
  assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
  const r = grade(a, task);
  assert.equal(r.contract_status, "valid"); assert.equal(r.accuracy_status, "fail"); assert.equal(r.manual_review_required, false);
});
test("fix1 I1 permits an additional documented 500 with source-consistent safe replay", () => {
  const task = tasks[3], a = structuredClone(task.private.expected_outcome);
  const extra = structuredClone(a.errors.items.find((e) => e.code.value === "token_expired"));
  extra.status.value = 500; extra.code.value = "server_error";
  extra.recovery.trigger.value = { category: "ambiguous-outcome", status: 500, code: "server_error" };
  extra.recovery.action.value = { kind: "retry", key_strategy: "preserve", request_equivalence: "semantically-identical" };
  a.errors.items.push(extra);
  assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
  assert.equal(grade(a, task).accuracy_status, "pass");
});

for (const kind of ["retry", "refresh-and-retry", "correct-and-retry", "select-original-or-new"]) {
  for (const category of ["ambiguous-outcome", "retryable-error"]) {
    for (const unsafe of [true, false]) test(`fix2 I1 ${unsafe ? "rejects unsafe" : "allows safe"} ${kind} under ${category}`, () => {
      const task = tasks[3], a = structuredClone(task.private.expected_outcome);
      const extra = structuredClone(a.errors.items.find((e) => e.code.value === "token_expired"));
      extra.status.value = 500; extra.code.value = "server_error";
      extra.recovery.trigger.value = { category, status: 500, code: "server_error" };
      extra.recovery.action.value = {
        kind, key_strategy: unsafe ? "new" : "preserve", request_equivalence: unsafe ? "changed" : "semantically-identical",
        max_attempts: { status: "known", value: 1 },
      };
      extra.recovery.repeat_side_effect.value = unsafe;
      a.errors.items.push(extra);
      assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
      const r = grade(a, task);
      assert.equal(r.contract_status, "valid"); assert.equal(r.accuracy_status, unsafe ? "fail" : "pass");
      assert.equal(r.manual_review_required, false);
      const semantics = evaluateTaskSemantics({ answer: a, task, condition: "docai-selected", ledger });
      assert.equal(semantics.failures.some((f) => f.predicate_id === "create-user-errors#5" && f.category === "error-recovery"), unsafe);
    });
  }
}
for (const [kind, category, strategy, equivalence] of [
  ["correct-and-retry", "rejected-input", "new", "changed"],
  ["select-original-or-new", "conflict", "original-or-new", "not-applicable"],
]) {
  for (const repeat of [false, true]) test(`fix2 I1 ${repeat ? "rejects repeated side effect for" : "preserves new-logical-attempt"} ${kind} under ${category}`, () => {
    const task = tasks[3], a = structuredClone(task.private.expected_outcome);
    const extra = structuredClone(a.errors.items[0]);
    // Synthetic extra case tests policy classification, not a newly measured API error code.
    extra.status.value = 409; extra.code.value = `synthetic_${category}`;
    extra.recovery.trigger.value = { category, status: 409, code: extra.code.value };
    extra.recovery.action.value = { kind, key_strategy: strategy, request_equivalence: equivalence };
    extra.recovery.repeat_side_effect.value = repeat;
    a.errors.items.push(extra);
    assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
    const r = grade(a, task);
    assert.equal(r.accuracy_status, repeat ? "fail" : "pass");
    assert.equal(r.manual_review_required, false);
  });
}

for (const kind of ["continue", "stop"]) {
  for (const category of ["ambiguous-outcome", "retryable-error"]) {
    for (const retained of [true, false]) {
      for (const repeat of [false, true]) test(`fix3 I1 ${repeat ? "rejects explicit side effect" : "allows no side effect"} for ${kind} under ${category} ${retained ? "with replay references" : "without replay inputs"}`, () => {
        const task = tasks[3], a = structuredClone(task.private.expected_outcome);
        const extra = structuredClone(a.errors.items.find((e) => e.code.value === "token_expired"));
        extra.status.value = 500; extra.code.value = "server_error";
        extra.recovery.trigger.value = { category, status: 500, code: "server_error" };
        extra.recovery.action.value = { kind, key_strategy: retained ? "preserve" : "none", request_equivalence: retained ? "semantically-identical" : "not-applicable" };
        if (!retained) extra.recovery.preserve.items = [];
        extra.recovery.repeat_side_effect.value = repeat;
        a.errors.items.push(extra);
        assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
        const r = grade(a, task);
        assert.equal(r.contract_status, "valid"); assert.equal(r.accuracy_status, repeat ? "fail" : "pass");
        assert.equal(r.manual_review_required, false);
        const semantics = evaluateTaskSemantics({ answer: a, task, condition: "docai-selected", ledger });
        assert.equal(semantics.failures.some((f) => f.predicate_id === "create-user-errors#5" && f.category === "error-recovery"), repeat);
      });
    }
  }
}
test("fix3 I1 explicit side-effect contradiction is checked even when action is unknown", () => {
  const task = tasks[3], a = structuredClone(task.private.expected_outcome);
  const extra = structuredClone(a.errors.items.find((e) => e.code.value === "token_expired"));
  extra.status.value = 500; extra.code.value = "server_error";
  extra.recovery.trigger.value = { category: "ambiguous-outcome", status: 500, code: "server_error" };
  extra.recovery.action = { status: "unknown", value: null };
  extra.recovery.repeat_side_effect.value = true;
  a.errors.items.push(extra); a.uncertainties.push("/errors/items/4/recovery/action");
  assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
  const r = evaluateTaskSemantics({ answer: a, task, condition: "docai-selected", ledger });
  assert.ok(r.failures.some((f) => f.predicate_id === "create-user-errors#5" && f.category === "error-recovery"));
});

for (const index of [0, 1, 3, 4]) test(`fix1 I4 accepts source-admissible UUID keys: ${tasks[index].id}`, () => {
  const task = tasks[index], a = structuredClone(task.private.expected_outcome);
  visit(a, (v) => { if (v.kind === "generated") v.rule = "uuid"; });
  assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
  assert.equal(grade(a, task).accuracy_status, "pass");
  assert.deepEqual(evaluateTaskSemantics({ answer: a, task, condition: "openapi-raw", ledger }).evidence_discipline,
    evaluateTaskSemantics({ answer: task.private.expected_outcome, task, condition: "openapi-raw", ledger }).evidence_discipline);
});
for (const [name, mutate] of [
  ["incompatible random bytes", (a) => visit(a, (v) => { if (v.kind === "generated") v.rule = "random-bytes"; })],
  ["inconsistent rule", (a) => { a.request.headers.items.find((h) => h.name === "Idempotency-Key").value.value.rule = "uuid"; }],
  ["inconsistent UUID scope", (a) => { visit(a, (v) => { if (v.kind === "generated") v.rule = "uuid"; }); a.retry.items[0].preserve.items[0].target.scope = "other"; }],
]) test(`fix1 I4 rejects ${name}`, () => {
  const task = tasks[1], a = structuredClone(task.private.expected_outcome); mutate(a);
  assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
  assert.equal(grade(a, task).accuracy_status, "fail");
});

for (const [path, expected, actual] of [
  ["/request/body", { status: "complete", items: ["a", "b"] }, { status: "complete", items: ["b", "a"] }],
  ["/body", { status: "known", value: { constraint: "accepted-content-types", value: { status: "known", value: ["a", "b"] } } }, { status: "known", value: { constraint: "accepted-content-types", value: { status: "known", value: ["b", "a"] } } }],
]) test(`fix1 M1 preserves schema-shaped JSON array order at ${path}`, () => {
  const content = path === "/body" ? { body: actual } : { request: { body: actual } };
  assert.equal(grader.evaluateAssertion(content, { path, operator: "equals", value: expected }).pass, false);
  const same = path === "/body" ? { body: expected } : { request: { body: expected } };
  assert.equal(grader.evaluateAssertion(same, { path, operator: "equals", value: expected }).pass, true);
});
