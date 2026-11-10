import { isDeepStrictEqual } from "node:util";

import { validateOutputContract } from "./contract.mjs";
import { assertPlainJson } from "./strict-json.mjs";

const GRADABLE_FORMAT_STATUSES = new Set(["raw-json", "fenced-json"]);
const MISSING_FACTS_BY_CONDITION = {
  "openapi-raw": "raw_missing",
  "openapi-sliced": "sliced_missing",
  "openapi-enriched": null,
  "docai-selected": null,
};
const EVALUATOR_AMBIGUITY_OPERATOR = "evaluator-ambiguity.v1";
const SUPPORTED_ASSERTION_OPERATORS = new Set([
  "equals", "contains", "header_contains", "absent", EVALUATOR_AMBIGUITY_OPERATOR, "set_equals",
]);

export function gradeParsedResponse(input) {
  assertPlainJson(input, "grader input");
  requireExactKeys(input, "grader input", ["parsed", "task", "condition"]);
  const { parsed, task, condition } = input;
  const contentJson = parsedContentJson(parsed);
  if (contentJson === null) return notEvaluatedResult(parsed);
  if (typeof task.public.output_contract !== "string") throw new Error("Grader task requires public output_contract");
  const contractResult = validateOutputContract(contentJson, task.public.output_contract);
  if (!contractResult.valid) return {
    contract_status: "invalid", accuracy_status: "not-evaluated", uncertainty_status: "not-evaluated",
    reasons: contractResult.errors, failure_categories: ["output-contract"], manual_review_required: false,
  };
  if (!Array.isArray(task.private.assertions)) throw new Error("Grader task requires private assertions");
  const reasons = [];
  const failureCategories = [];
  let substantive = false;
  let ambiguous = false;
  for (const assertion of task.private.assertions) {
    const result = evaluateAssertion(contentJson, assertion);
    if (result.pass) continue;
    reasons.push(`${assertion.path} ${result.reason}`);
    addUnique(failureCategories, assertion.failure_category);
    if (result.evaluator_ambiguity) ambiguous = true;
    else substantive = true;
  }
  const accuracyStatus = substantive ? "fail" : ambiguous ? "inconclusive" : "pass";
  return {
    contract_status: "valid",
    accuracy_status: accuracyStatus,
    uncertainty_status: classifyUncertainty(contentJson, task, condition),
    reasons,
    failure_categories: failureCategories,
    manual_review_required: accuracyStatus === "inconclusive",
  };
}

export function evaluateAssertion(contentJson, assertion) {
  assertPlainJson(contentJson, "grader content JSON");
  assertPlainJson(assertion, "grader assertion");
  if (!SUPPORTED_ASSERTION_OPERATORS.has(assertion.operator)) {
    throw new Error(`Grader received unsupported assertion operator ${assertion.operator}`);
  }
  if (assertion.operator === EVALUATOR_AMBIGUITY_OPERATOR) {
    return { pass: false, reason: "requires evaluator ambiguity review", evaluator_ambiguity: true };
  }
  const resolved = resolvePointer(contentJson, assertion.path);
  if (assertion.operator === "absent") return resolved.found
    ? { pass: false, reason: "must be absent" } : { pass: true, reason: "" };
  if (!resolved.found) return { pass: false, reason: "is missing" };
  if (assertion.operator === "equals") return isDeepStrictEqual(resolved.value, assertion.value)
    ? { pass: true, reason: "" } : { pass: false, reason: `must equal ${format(assertion.value)}` };
  if (assertion.operator === "contains") return containsValue(resolved.value, assertion.value)
    ? { pass: true, reason: "" } : { pass: false, reason: `must contain ${format(assertion.value)}` };
  if (assertion.operator === "header_contains") return headerContains(resolved.value, assertion.value)
    ? { pass: true, reason: "" } : { pass: false, reason: `must satisfy header contract ${format(assertion.value)}` };
  if (assertion.operator === "set_equals") return setEquals(resolved.value, assertion.value)
    ? { pass: true, reason: "" } : { pass: false, reason: `must contain exactly the set ${format(assertion.value)}` };
  return { pass: false, reason: `uses unsupported operator ${assertion.operator}` };
}

function parsedContentJson(parsed) {
  assertPlainJson(parsed, "grader parser result");
  requireExactKeys(parsed, "grader parser result", ["format_status", "content_json", "content_text", "parse_error"]);
  if (!GRADABLE_FORMAT_STATUSES.has(parsed.format_status)) return null;
  if (!isPlainObject(parsed.content_json)) throw new Error(`Grader received ${parsed.format_status} without a JSON object`);
  return parsed.content_json;
}

function notEvaluatedResult(parsed) {
  return {
    contract_status: "not-evaluated", accuracy_status: "not-evaluated", uncertainty_status: "not-evaluated",
    reasons: typeof parsed.parse_error?.message === "string" ? [parsed.parse_error.message] : [],
    failure_categories: ["output-format"], manual_review_required: false,
  };
}

function classifyUncertainty(contentJson, task, condition) {
  const missingFacts = missingFactIds(task, condition);
  const gapFacts = new Set();
  let missedFact = false;
  if (!isPlainObject(task.private.expected_outcome)) throw new Error("Grader task requires private expected_outcome");
  for (const uncertainty of contentJson.uncertainties) {
    for (const assertion of task.private.assertions) {
      if (!uncertaintyMatchesAssertion(uncertainty.path, assertion, task.private.expected_outcome)) continue;
      gapFacts.add(assertion.fact_id);
      if (!missingFacts.has(assertion.fact_id)) missedFact = true;
    }
  }
  let unsupportedGuess = false;
  for (const assertion of task.private.assertions) {
    if (missingFacts.has(assertion.fact_id) && !gapFacts.has(assertion.fact_id)
        && providerClaimsAssertion(contentJson, assertion)) unsupportedGuess = true;
  }
  if (missedFact) return "missed-fact";
  if (unsupportedGuess) return "unsupported-guess";
  if (gapFacts.size > 0) return "reported-gap";
  return "none";
}

function missingFactIds(task, condition) {
  if (!Object.hasOwn(MISSING_FACTS_BY_CONDITION, condition)) throw new Error(`Grader received unsupported condition ${String(condition)}`);
  if (!Array.isArray(task.private.fact_inventory.required)) throw new Error("Grader task requires private fact_inventory");
  const missingKey = MISSING_FACTS_BY_CONDITION[condition];
  if (missingKey === null) return new Set();
  if (!Array.isArray(task.private.fact_inventory[missingKey])) throw new Error(`Grader task requires fact_inventory.${missingKey}`);
  return new Set(task.private.fact_inventory[missingKey]);
}

function uncertaintyMatchesAssertion(pointer, assertion, expectedOutcome) {
  if (!pointersOverlap(pointer, assertion.path)) return false;
  if (pointer === assertion.path) return true;
  const expected = resolvePointer(expectedOutcome, assertion.path);
  if (expected.found && Array.isArray(expected.value) && isPointerAncestor(assertion.path, pointer)) {
    const relative = pointer.slice(assertion.path.length + 1).split("/");
    const actual = resolvePointer(expected.value, `/${relative[0]}`);
    if (!actual.found || !Array.isArray(assertion.value)) return false;
    const child = relative.length === 1 ? "" : `/${relative.slice(1).join("/")}`;
    return assertion.value.some((candidate) => containsValue(actual.value, candidate)
      && (child === "" || resolvePointer(candidate, child).found));
  }
  if (assertion.operator !== "header_contains" || !isPointerAncestor(assertion.path, pointer)) return true;
  const headerName = decodePointerSegment(pointer.slice(assertion.path.length + 1).split("/")[0]);
  return Object.keys(assertion.value).some((name) => name.toLowerCase() === headerName.toLowerCase());
}

function providerClaimsAssertion(contentJson, assertion) {
  const resolved = resolvePointer(contentJson, assertion.path);
  if (!resolved.found) return false;
  if (["absent", "equals", "set_equals"].includes(assertion.operator)) return true;
  if (assertion.operator === "contains") return hasNonEmptyClaim(resolved.value);
  if (assertion.operator === "header_contains") {
    if (!isPlainObject(resolved.value)) return false;
    const actual = new Set(Object.keys(resolved.value).map((name) => name.toLowerCase()));
    return Object.keys(assertion.value).some((name) => actual.has(name.toLowerCase()));
  }
  if (assertion.operator === EVALUATOR_AMBIGUITY_OPERATOR) return false;
  throw new Error(`Grader received unsupported assertion operator ${assertion.operator}`);
}

function resolvePointer(value, pointer) {
  if (pointer === "") return { found: true, value };
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return { found: false, value: undefined };
  let current = value;
  for (const segment of pointer.slice(1).split("/").map(decodePointerSegment)) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, segment)) return { found: false, value: undefined };
    current = current[segment];
  }
  return { found: true, value: current };
}

function containsValue(actual, expected) {
  if (typeof actual === "string" && typeof expected === "string") return actual.includes(expected);
  if (Array.isArray(actual)) return (Array.isArray(expected) ? expected : [expected])
    .every((item) => actual.some((candidate) => containsValue(candidate, item)));
  if (isPlainObject(actual) && isPlainObject(expected)) return Object.entries(expected)
    .every(([key, value]) => Object.hasOwn(actual, key) && containsValue(actual[key], value));
  return isDeepStrictEqual(actual, expected);
}

function headerContains(actual, expected) {
  if (!isPlainObject(actual) || !isPlainObject(expected)) return false;
  const normalized = new Map();
  for (const [name, value] of Object.entries(actual)) {
    const lower = name.toLowerCase();
    if (normalized.has(lower)) return false;
    normalized.set(lower, String(value));
  }
  return Object.entries(expected).every(([name, value]) => {
    const actualValue = normalized.get(name.toLowerCase());
    return actualValue !== undefined && headerValueMatches(name, String(value), actualValue);
  });
}

function headerValueMatches(name, expected, actual) {
  const normalizedName = name.toLowerCase();
  if (normalizedName === "authorization" && /^Bearer <[^>]+>$/.test(expected)) return /^Bearer\s+\S+$/i.test(actual);
  if (normalizedName === "idempotency-key" && expected === "<operation-unique-key>") return actual.length >= 1 && actual.length <= 128 && /^[\x21-\x7e]+$/.test(actual);
  if (expected === "<required string; not comma-combinable>") return actual.length > 0 && !actual.includes(",");
  if (expected.includes("<")) return placeholderPattern(expected).test(actual);
  return actual === expected;
}

function setEquals(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  return isDeepStrictEqual([...new Set(actual.map(canonical))].sort(), [...new Set(expected.map(canonical))].sort());
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function placeholderPattern(template) { return new RegExp(`^${template.split(/(<[^>]+>)/g).filter(Boolean).map((part) => /^<[^>]+>$/.test(part) ? ".+" : escapeRegExp(part)).join("")}$`); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function pointersOverlap(left, right) { return left === right || isPointerAncestor(left, right) || isPointerAncestor(right, left); }
function isPointerAncestor(ancestor, descendant) { return ancestor !== "" && descendant.startsWith(`${ancestor}/`); }
function decodePointerSegment(segment) { return segment.replaceAll("~1", "/").replaceAll("~0", "~"); }
function hasNonEmptyClaim(value) { return Array.isArray(value) ? value.length > 0 : isPlainObject(value) ? Object.keys(value).length > 0 : typeof value === "string" ? value.length > 0 : true; }
function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function format(value) { const formatted = JSON.stringify(value); return formatted.length > 240 ? `${formatted.slice(0, 237)}...` : formatted; }
function addUnique(values, value) { if (!values.includes(value)) values.push(value); }
function requireExactKeys(value, name, keys) { if (!isPlainObject(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error(`${name} must have exactly ${keys.join(", ")}`); }
