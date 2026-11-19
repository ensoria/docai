import { validateOutputContract } from "./contract.mjs";
import { readEvidenceLedger } from "./check-evidence-ledger.mjs";
import { evaluateTaskSemantics } from "./semantic-predicates.mjs";
import { assertPlainJson } from "./strict-json.mjs";

export { evaluateAssertion } from "./semantic-predicates.mjs";

export function gradeParsedResponse(input) {
  assertPlainJson(input, "grader input");
  requireExactKeys(input, "grader input", ["parsed", "task", "condition"]);
  const { parsed, task, condition } = input;
  requireExactKeys(parsed, "grader parser result", ["format_status", "content_json", "content_text", "parse_error"]);
  if (!["raw-json", "fenced-json"].includes(parsed.format_status)) return {
    contract_status: "not-evaluated", accuracy_status: "not-evaluated", uncertainty_status: "not-evaluated",
    reasons: typeof parsed.parse_error?.message === "string" ? [parsed.parse_error.message] : [],
    failure_categories: ["output-format"], manual_review_required: false,
  };
  if (!isPlainObject(parsed.content_json)) throw new Error(`Grader received ${parsed.format_status} without a JSON object`);
  if (typeof task.public.output_contract !== "string") throw new Error("Grader task requires public output_contract");
  const contract = validateOutputContract(parsed.content_json, task.public.output_contract);
  if (!contract.valid) return {
    contract_status: "invalid", accuracy_status: "not-evaluated", uncertainty_status: "not-evaluated",
    reasons: contract.errors, failure_categories: ["output-contract"], manual_review_required: false,
  };
  if (!Array.isArray(task.private.assertions)) throw new Error("Grader task requires private assertions");
  const ledger = readEvidenceLedger();
  const result = evaluateTaskSemantics({ answer: parsed.content_json, task, condition, ledger });
  const ambiguityIds = new Set(task.private.assertions.flatMap((a, index) => {
    if (a.operator !== "evaluator-ambiguity.v1") return [];
    const row = ledger.rows.find((r) => r.measured && r.task_id === task.id && r.fact_id === a.fact_id && r.output_path === a.path && r.negative_control.assertion_index === index);
    return [row?.predicate_id ?? `${task.id}:assertion:${index}`];
  }));
  const substantive = result.failures.some((f) => !ambiguityIds.has(f.predicate_id));
  const accuracy = result.passed ? "pass" : substantive ? "fail" : "inconclusive";
  return {
    contract_status: "valid", accuracy_status: accuracy, uncertainty_status: result.evidence_discipline.status,
    reasons: result.failures.map((f) => `${f.path} ${f.message}`),
    failure_categories: [...new Set(result.failures.map((f) => f.category))],
    manual_review_required: accuracy === "inconclusive",
  };
}

function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function requireExactKeys(value, name, keys) {
  if (!isPlainObject(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error(`${name} must have exactly ${keys.join(", ")}`);
}
