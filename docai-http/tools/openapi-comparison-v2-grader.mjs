import { isDeepStrictEqual } from "node:util";

import { taskContracts } from "./openapi-comparison-v2-contract.mjs";

const contracts = taskContracts();

export function gradeBenchmarkResponse(contentJson, task) {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) {
    return malformedResult(["response must be a JSON object"]);
  }

  const contractId = task?.public?.output_contract;
  const contract = contracts.output_contracts[contractId];
  if (!contract) {
    throw new Error(`Grader task has unknown output contract ${contractId ?? "<missing>"}`);
  }
  const shapeErrors = validateShape(contentJson, contract.json_shape, "");
  if (shapeErrors.length > 0) {
    return malformedResult(shapeErrors.map((reason) => `output contract: ${reason}`));
  }
  if (!Array.isArray(task?.private?.assertions)) {
    throw new Error("Grader task requires private assertions");
  }

  const reasons = [];
  const failureCategories = [];
  for (const assertion of task.private.assertions) {
    const result = evaluateAssertion(contentJson, assertion);
    if (result.pass) continue;
    reasons.push(`${assertion.path} ${result.reason}`);
    if (!failureCategories.includes(assertion.failure_category)) {
      failureCategories.push(assertion.failure_category);
    }
  }

  const pass = reasons.length === 0;
  const inconclusive = !pass && contentJson.uncertainties.length > 0;
  return {
    status: pass ? "pass" : inconclusive ? "inconclusive" : "fail",
    pass,
    reasons,
    failure_categories: failureCategories,
    automatic_rerun_allowed: false,
    manual_review_required: inconclusive,
  };
}

export function evaluateAssertion(contentJson, assertion) {
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

function resolvePointer(value, pointer) {
  if (pointer === "") return { found: true, value };
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
  const normalized = new Map(
    Object.entries(actual).map(([name, value]) => [name.toLowerCase(), String(value)]),
  );
  return Object.entries(expected).every(([name, expectedValue]) => {
    const actualValue = normalized.get(name.toLowerCase());
    return actualValue !== undefined
      && headerValueMatches(name, String(expectedValue), actualValue);
  });
}

function headerValueMatches(name, expected, actual) {
  const normalizedName = name.toLowerCase();
  if (normalizedName === "authorization" && /^Bearer <[^>]+>$/.test(expected)) {
    return /^Bearer\s+\S+$/i.test(actual);
  }
  if (normalizedName === "idempotency-key" && expected === "<operation-unique-key>") {
    return actual.length >= 1 && actual.length <= 128 && /^[\x21-\x7e]+$/.test(actual);
  }
  if (expected.includes("<")) {
    return placeholderPattern(expected).test(actual);
  }
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

function malformedResult(reasons) {
  return {
    status: "malformed",
    pass: false,
    reasons,
    failure_categories: ["output-format"],
    automatic_rerun_allowed: false,
    manual_review_required: false,
  };
}

function validateShape(actual, expected, pointer) {
  const location = pointer === "" ? "/" : pointer;

  if (typeof expected === "string") {
    if (expected === "string or null") {
      return typeof actual === "string" || actual === null
        ? []
        : [`${location} must be a string or null`];
    }
    return typeof actual === "string"
      ? []
      : [`${location} must be a string`];
  }

  if (typeof expected === "number") {
    return typeof actual === "number" && Number.isFinite(actual)
      ? []
      : [`${location} must be a finite number`];
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return [`${location} must be an array`];
    if (expected.length === 0) return [];
    return actual.flatMap((item, index) => (
      validateShape(item, expected[0], `${pointer}/${index}`)
    ));
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) return [`${location} must be an object`];
    const expectedKeys = Object.keys(expected);
    if (expectedKeys.length === 0) return [];

    if (expectedKeys.length === 1 && expectedKeys[0] === "Header-Name") {
      return Object.entries(actual).flatMap(([key, value]) => (
        typeof value === "string"
          ? []
          : [`${pointer}/${escapePointer(key)} must be a string`]
      ));
    }

    const errors = [];
    expectedKeys.forEach((key) => {
      const childPointer = `${pointer}/${escapePointer(key)}`;
      if (!Object.hasOwn(actual, key)) {
        errors.push(`${childPointer} is required`);
        return;
      }
      errors.push(...validateShape(actual[key], expected[key], childPointer));
    });
    Object.keys(actual)
      .filter((key) => !Object.hasOwn(expected, key))
      .forEach((key) => errors.push(`${pointer}/${escapePointer(key)} is not allowed`));
    return errors;
  }

  return isDeepStrictEqual(actual, expected)
    ? []
    : [`${location} must equal ${format(expected)}`];
}

function escapePointer(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
