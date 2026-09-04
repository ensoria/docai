import { isDeepStrictEqual } from "node:util";

import { validateOutputContract } from "./openapi-comparison-v3-contract.mjs";

const GRADABLE_FORMAT_STATUSES = new Set(["raw-json", "fenced-json"]);
const MISSING_FACTS_BY_CONDITION = {
  "openapi-raw": "raw_missing",
  "openapi-sliced": "sliced_missing",
  "openapi-enriched": null,
  "docai-selected": null,
};
const EVALUATOR_AMBIGUITY_OPERATOR = "evaluator-ambiguity.v1";
const SUPPORTED_ASSERTION_OPERATORS = new Set([
  "equals",
  "contains",
  "header_contains",
  "absent",
  EVALUATOR_AMBIGUITY_OPERATOR,
  "set_equals",
]);

export function gradeParsedResponse({ parsed, task, condition }) {
  const contentJson = parsedContentJson(parsed);
  if (contentJson === null) return notEvaluatedResult(parsed);

  const contractId = task?.public?.output_contract;
  if (typeof contractId !== "string") {
    throw new Error("Grader task requires public output_contract");
  }
  const contractResult = validateOutputContract(contentJson, contractId);
  if (!contractResult.valid) {
    return {
      contract_status: "invalid",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
      reasons: contractResult.errors,
      failure_categories: ["output-contract"],
      manual_review_required: false,
    };
  }

  const assertions = task?.private?.assertions;
  if (!Array.isArray(assertions)) {
    throw new Error("Grader task requires private assertions");
  }

  const reasons = [];
  const failureCategories = [];
  let hasSubstantiveFailure = false;
  let hasEvaluatorAmbiguity = false;
  for (const assertion of assertions) {
    const result = evaluateAssertion(contentJson, assertion);
    if (result.pass) continue;

    reasons.push(`${assertion.path} ${result.reason}`);
    addUnique(failureCategories, assertion.failure_category);
    if (result.evaluator_ambiguity) {
      hasEvaluatorAmbiguity = true;
    } else {
      hasSubstantiveFailure = true;
    }
  }

  const accuracyStatus = hasSubstantiveFailure
    ? "fail"
    : hasEvaluatorAmbiguity
      ? "inconclusive"
      : "pass";
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
  if (!SUPPORTED_ASSERTION_OPERATORS.has(assertion.operator)) {
    throw new Error(`Grader received unsupported assertion operator ${assertion.operator}`);
  }
  if (assertion.operator === EVALUATOR_AMBIGUITY_OPERATOR) {
    return {
      pass: false,
      reason: "requires evaluator ambiguity review",
      evaluator_ambiguity: true,
    };
  }
  const resolved = resolvePointer(contentJson, assertion.path);
  if (assertion.operator === "absent") {
    return resolved.found
      ? { pass: false, reason: "must be absent" }
      : { pass: true, reason: "" };
  }
  if (!resolved.found) return { pass: false, reason: "is missing" };

  if (assertion.operator === "equals") {
    return isDeepStrictEqual(resolved.value, assertion.value)
      ? { pass: true, reason: "" }
      : { pass: false, reason: `must equal ${format(assertion.value)}` };
  }
  if (assertion.operator === "contains") {
    return containsValue(resolved.value, assertion.value)
      ? { pass: true, reason: "" }
      : { pass: false, reason: `must contain ${format(assertion.value)}` };
  }
  if (assertion.operator === "header_contains") {
    return headerContains(resolved.value, assertion.value)
      ? { pass: true, reason: "" }
      : { pass: false, reason: `must satisfy header contract ${format(assertion.value)}` };
  }
  if (assertion.operator === "set_equals") {
    return setEquals(resolved.value, assertion.value)
      ? { pass: true, reason: "" }
      : { pass: false, reason: `must contain exactly the set ${format(assertion.value)}` };
  }

  return { pass: false, reason: `uses unsupported operator ${assertion.operator}` };
}

function parsedContentJson(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Grader requires a parser result object");
  }
  if (!GRADABLE_FORMAT_STATUSES.has(parsed.format_status)) return null;
  if (!isPlainObject(parsed.content_json)) {
    throw new Error(`Grader received ${parsed.format_status} without a JSON object`);
  }
  return parsed.content_json;
}

function notEvaluatedResult(parsed) {
  const parseError = parsed?.parse_error;
  return {
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    reasons: typeof parseError?.message === "string" ? [parseError.message] : [],
    failure_categories: ["output-format"],
    manual_review_required: false,
  };
}

function classifyUncertainty(contentJson, task, condition) {
  const missingFacts = missingFactIds(task, condition);
  const gapFacts = new Set();
  let hasMissedFact = false;
  const expectedOutcome = task?.private?.expected_outcome;
  if (!isPlainObject(expectedOutcome)) {
    throw new Error("Grader task requires private expected_outcome");
  }

  for (const uncertainty of contentJson.uncertainties) {
    for (const assertion of task.private.assertions) {
      if (!uncertaintyMatchesAssertion(uncertainty.path, assertion, expectedOutcome)) continue;
      gapFacts.add(assertion.fact_id);
      if (!missingFacts.has(assertion.fact_id)) hasMissedFact = true;
    }
  }

  let hasUnsupportedGuess = false;
  for (const assertion of task.private.assertions) {
    if (missingFacts.has(assertion.fact_id)
        && !gapFacts.has(assertion.fact_id)
        && providerClaimsAssertion(contentJson, assertion)) {
      hasUnsupportedGuess = true;
    }
  }

  if (hasMissedFact) return "missed-fact";
  if (hasUnsupportedGuess) return "unsupported-guess";
  if (gapFacts.size > 0) return "reported-gap";
  return "none";
}

function missingFactIds(task, condition) {
  if (!Object.hasOwn(MISSING_FACTS_BY_CONDITION, condition)) {
    throw new Error(`Grader received unsupported condition ${String(condition)}`);
  }
  const inventory = task?.private?.fact_inventory;
  if (!inventory || !Array.isArray(inventory.required)) {
    throw new Error("Grader task requires private fact_inventory");
  }
  const missingKey = MISSING_FACTS_BY_CONDITION[condition];
  if (missingKey === null) return new Set();
  if (!Array.isArray(inventory[missingKey])) {
    throw new Error(`Grader task requires fact_inventory.${missingKey}`);
  }
  return new Set(inventory[missingKey]);
}

function pointersOverlap(left, right) {
  return left === right || isPointerAncestor(left, right) || isPointerAncestor(right, left);
}

function uncertaintyMatchesAssertion(pointer, assertion, expectedOutcome) {
  if (!pointersOverlap(pointer, assertion.path)) return false;
  if (pointer === assertion.path) return true;

  const expectedAtAssertionPath = resolvePointer(expectedOutcome, assertion.path);
  if (expectedAtAssertionPath.found
      && Array.isArray(expectedAtAssertionPath.value)
      && isPointerAncestor(assertion.path, pointer)) {
    return aggregateChildMatchesAssertion(
      pointer,
      assertion,
      expectedAtAssertionPath.value,
    );
  }
  if (assertion.operator !== "header_contains" || !isPointerAncestor(assertion.path, pointer)) {
    return true;
  }

  const headerName = decodePointerSegment(pointer.slice(assertion.path.length + 1).split("/")[0]);
  return Object.keys(assertion.value).some((expectedName) => (
    expectedName.toLowerCase() === headerName.toLowerCase()
  ));
}

function aggregateChildMatchesAssertion(pointer, assertion, canonicalElements) {
  const relativeSegments = pointer.slice(assertion.path.length + 1).split("/");
  const canonicalElement = resolvePointer(canonicalElements, `/${relativeSegments[0]}`);
  if (!canonicalElement.found || !Array.isArray(assertion.value)) return false;

  const relativeChildPointer = relativeSegments.length === 1
    ? ""
    : `/${relativeSegments.slice(1).join("/")}`;
  return assertion.value.some((expectedElement) => (
    containsValue(canonicalElement.value, expectedElement)
      && (relativeChildPointer === "" || resolvePointer(expectedElement, relativeChildPointer).found)
  ));
}

function providerClaimsAssertion(contentJson, assertion) {
  const resolved = resolvePointer(contentJson, assertion.path);
  if (!resolved.found) return false;

  if (assertion.operator === "absent") return true;
  if (assertion.operator === "equals" || assertion.operator === "set_equals") return true;
  if (assertion.operator === "contains") return hasNonEmptyClaim(resolved.value);
  if (assertion.operator === "header_contains") {
    if (!isPlainObject(resolved.value)) return false;
    const actualNames = new Set(Object.keys(resolved.value).map((name) => name.toLowerCase()));
    return Object.keys(assertion.value).some((name) => actualNames.has(name.toLowerCase()));
  }
  if (assertion.operator === EVALUATOR_AMBIGUITY_OPERATOR) return false;
  throw new Error(`Grader received unsupported assertion operator ${assertion.operator}`);
}

function hasNonEmptyClaim(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "string") return value.length > 0;
  return true;
}

function isPointerAncestor(ancestor, descendant) {
  return ancestor !== "" && descendant.startsWith(`${ancestor}/`);
}

function decodePointerSegment(segment) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolvePointer(value, pointer) {
  if (pointer === "") return { found: true, value };
  if (typeof pointer !== "string" || !pointer.startsWith("/")) {
    return { found: false, value: undefined };
  }
  const segments = pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, segment)) {
      return { found: false, value: undefined };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function containsValue(actual, expected) {
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.includes(expected);
  }
  if (Array.isArray(actual)) {
    const expectedItems = Array.isArray(expected) ? expected : [expected];
    return expectedItems.every((expectedItem) => (
      actual.some((actualItem) => containsValue(actualItem, expectedItem))
    ));
  }
  if (isPlainObject(actual) && isPlainObject(expected)) {
    return Object.entries(expected).every(([key, expectedValue]) => (
      Object.hasOwn(actual, key) && containsValue(actual[key], expectedValue)
    ));
  }
  return isDeepStrictEqual(actual, expected);
}

function headerContains(actual, expected) {
  if (!isPlainObject(actual) || !isPlainObject(expected)) return false;
  const normalized = normalizeHeaders(actual);
  if (normalized === null) return false;
  return Object.entries(expected).every(([name, expectedValue]) => {
    const actualValue = normalized.get(name.toLowerCase());
    return actualValue !== undefined
      && headerValueMatches(name, String(expectedValue), actualValue);
  });
}

function normalizeHeaders(headers) {
  const normalized = new Map();
  for (const [name, value] of Object.entries(headers)) {
    const normalizedName = name.toLowerCase();
    if (normalized.has(normalizedName)) return null;
    normalized.set(normalizedName, String(value));
  }
  return normalized;
}

function headerValueMatches(name, expected, actual) {
  const normalizedName = name.toLowerCase();
  if (normalizedName === "authorization" && /^Bearer <[^>]+>$/.test(expected)) {
    return /^Bearer\s+\S+$/i.test(actual);
  }
  if (normalizedName === "idempotency-key" && expected === "<operation-unique-key>") {
    return actual.length >= 1 && actual.length <= 128 && /^[\x21-\x7e]+$/.test(actual);
  }
  if (expected === "<required string; not comma-combinable>") {
    return actual.length > 0 && !actual.includes(",");
  }
  if (expected.includes("<")) return placeholderPattern(expected).test(actual);
  return actual === expected;
}

function placeholderPattern(template) {
  const parts = template.split(/(<[^>]+>)/g).filter(Boolean);
  const source = parts.map((part) => (
    /^<[^>]+>$/.test(part) ? ".+" : escapeRegExp(part)
  )).join("");
  return new RegExp(`^${source}$`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setEquals(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  const actualSet = [...new Set(actual.map(canonical))].sort();
  const expectedSet = [...new Set(expected.map(canonical))].sort();
  return isDeepStrictEqual(actualSet, expectedSet);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function format(value) {
  const formatted = JSON.stringify(value);
  return formatted.length > 240 ? `${formatted.slice(0, 237)}...` : formatted;
}

function addUnique(values, value) {
  if (!values.includes(value)) values.push(value);
}
