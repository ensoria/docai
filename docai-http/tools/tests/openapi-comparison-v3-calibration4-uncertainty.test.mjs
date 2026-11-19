import assert from "node:assert/strict";
import test from "node:test";
import { readTaskPacket, validateOutputContract } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/contract.mjs";
import { gradeParsedResponse } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/grader.mjs";
import { evaluateTaskSemantics } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/semantic-predicates.mjs";
import { readEvidenceLedger } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/check-evidence-ledger.mjs";
const tasks = readTaskPacket().tasks;
const grade = (answer, task, condition = "openapi-raw") => gradeParsedResponse({ parsed: { format_status: "raw-json", content_json: answer, content_text: JSON.stringify(answer), parse_error: null }, task, condition });
const gap = (a, path) => a.uncertainties.push(path);

test("unknown required path is valid, automatic fail, and separately reported gap", () => {
  const task = tasks[0], a = structuredClone(task.private.expected_outcome);
  a.request.path = { status: "unknown", value: null }; gap(a, "/request/path");
  assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
  const result = grade(a, task);
  assert.equal(result.contract_status, "valid"); assert.equal(result.accuracy_status, "fail");
  assert.equal(result.uncertainty_status, "unsupported-guess"); assert.equal(result.manual_review_required, false);
  const semantics = evaluateTaskSemantics({ answer: a, task, condition: "openapi-raw", ledger: readEvidenceLedger() });
  assert.equal(semantics.evidence_discipline.diagnostics.find((d) => d.path === "/request/path").status, "reported-gap");
});
test("available fact abstention is missed-fact, not a successful uncertainty", () => {
  const task = tasks[0], a = structuredClone(task.private.expected_outcome);
  a.request.method = { status: "unknown", value: null }; gap(a, "/request/method");
  assert.equal(grade(a, task).uncertainty_status, "missed-fact");
  assert.equal(grade(a, task).accuracy_status, "fail");
});
test("partial membership preserves known headers without naming undocumented members", () => {
  const task = tasks[0], a = structuredClone(task.private.expected_outcome);
  a.request.path = { status: "unknown", value: null }; gap(a, "/request/path");
  a.request.headers = { status: "partial", items: a.request.headers.items.filter((h) => h.name === "Content-Type") };
  gap(a, "/request/headers");
  a.retry = { status: "unknown", items: [] }; gap(a, "/retry");
  const result = grade(a, task);
  assert.equal(result.uncertainty_status, "reported-gap");
  assert.equal(result.accuracy_status, "fail");
  a.request.headers.items = [];
  assert.equal(grade(a, task).uncertainty_status, "missed-fact");
});
test("known claims with fake gaps cannot suppress unsupported claims", () => {
  const task = tasks[0], a = structuredClone(task.private.expected_outcome);
  gap(a, "/request/path");
  const result = grade(a, task);
  assert.equal(result.accuracy_status, "fail");
  assert.equal(result.uncertainty_status, "unsupported-guess");
});
test("external runtime token, receiver and file values are not documentation gaps", () => {
  for (const i of [0, 1, 5]) {
    const task = tasks[i], a = structuredClone(task.private.expected_outcome);
    const result = grade(a, task, "docai-selected");
    assert.equal(result.accuracy_status, "pass", task.id);
    assert.equal(result.uncertainty_status, "none", task.id);
  }
});
test("partial state knowledge grades independent available member separately", () => {
  const task = tasks[4], a = structuredClone(task.private.expected_outcome);
  const states = a.steps.items[1].states_after_success;
  states.status = "partial"; states.items = states.items.filter((s) => s.subject === "payment");
  gap(a, "/steps/items/1/states_after_success");
  assert.notEqual(grade(a, task).uncertainty_status, "missed-fact");
  states.items = [];
  assert.equal(grade(a, task).uncertainty_status, "missed-fact");
});
test("unknown membership cannot pass even when all asserted members are present", () => {
  const task = tasks[0], a = structuredClone(task.private.expected_outcome);
  a.request.headers.status = "partial"; gap(a, "/request/headers");
  assert.equal(grade(a, task, "docai-selected").accuracy_status, "fail");
});
test("uncertainty paths match complete pointer segments and actual member positions", () => {
  const task = tasks[0], a = structuredClone(task.private.expected_outcome);
  a.request.headers.items.reverse();
  const index = a.request.headers.items.findIndex((h) => h.name === "Authorization");
  a.request.headers.items[index].scheme = { status: "unknown", value: null };
  gap(a, `/request/headers/items/${index}/scheme`);
  assert.equal(grade(a, task, "docai-selected").uncertainty_status, "missed-fact");
  a.uncertainties = ["/request/header"];
  const r = grade(a, task, "docai-selected");
  assert.ok(r.failure_categories.includes("uncertainty-correspondence"));
});
test("unreported unknown is not evidence of a correctly reported documentation gap", () => {
  const task = structuredClone(tasks[0]), a = structuredClone(task.private.expected_outcome);
  task.private.assertions = task.private.assertions.filter((v) => v.path === "/request/path");
  a.request.path = { status: "unknown", value: null };
  const r = grade(a, task);
  assert.equal(r.accuracy_status, "fail"); assert.equal(r.uncertainty_status, "none");
});
test("omitted missing header abstains; wrong and correct supplied claims are unsupported", () => {
  const task = structuredClone(tasks[0]);
  task.private.assertions = task.private.assertions.filter((v) => v.fact_id === "common:bearer-auth");
  for (const [mode, accuracy, uncertainty] of [["omit", "fail", "none"], ["wrong", "fail", "unsupported-guess"], ["correct", "pass", "unsupported-guess"]]) {
    const a = structuredClone(task.private.expected_outcome);
    if (mode === "omit") a.request.headers.items.shift();
    if (mode === "wrong") a.request.headers.items[0].scheme.value = "Basic";
    const r = grade(a, task); assert.equal(r.accuracy_status, accuracy, mode); assert.equal(r.uncertainty_status, uncertainty, mode);
  }
});
test("member gap diagnoses only its own source fact, even after reordering", () => {
  const task = tasks[2], a = structuredClone(task.private.expected_outcome);
  a.response.relations.items.reverse();
  const index = a.response.relations.items.findIndex((v) => v.target.value === "POST /orders");
  a.response.relations.items[index].action = { status: "unknown", value: null };
  gap(a, `/response/relations/items/${index}/action`);
  const r = evaluateTaskSemantics({ answer: a, task, condition: "openapi-raw", ledger: readEvidenceLedger() });
  assert.equal(r.evidence_discipline.diagnostics.find((d) => d.fact_id === "payments:order-link").status, "reported-gap");
  assert.equal(r.evidence_discipline.diagnostics.find((d) => d.fact_id === "payments:webhook-link").status, "none");
});
for (const [condition, status] of [["openapi-raw", "reported-gap"], ["docai-selected", "missed-fact"]]) test(`fix1 I3 identifies reordered relation with unknown field: ${condition}`, () => {
  const task = tasks[2], a = structuredClone(task.private.expected_outcome);
  a.response.relations.items.reverse();
  const index = a.response.relations.items.findIndex((v) => v.target.value === "POST /orders");
  a.response.relations.items[index].field = { status: "unknown", value: null };
  gap(a, `/response/relations/items/${index}/field`);
  assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
  const r = evaluateTaskSemantics({ answer: a, task, condition, ledger: readEvidenceLedger() });
  assert.equal(r.passed, false);
  assert.equal(r.evidence_discipline.diagnostics.find((d) => d.predicate_id === "payment-created-response#4").status, status);
  assert.equal(r.evidence_discipline.diagnostics.find((d) => d.fact_id === "payments:webhook-link").status, "none");
});
test("fix1 I3 does not guess ambiguous relation identity from a shared join field", () => {
  const task = tasks[2], a = structuredClone(task.private.expected_outcome);
  for (const [i, member] of a.response.relations.items.entries()) {
    member.target = { status: "unknown", value: null }; gap(a, `/response/relations/items/${i}/target`);
  }
  assert.equal(validateOutputContract(a, task.public.output_contract).valid, true);
  const r = evaluateTaskSemantics({ answer: a, task, condition: "openapi-raw", ledger: readEvidenceLedger() });
  assert.equal(r.passed, false);
  assert.equal(r.evidence_discipline.diagnostics.some((d) => d.status === "reported-gap"), false);
});
