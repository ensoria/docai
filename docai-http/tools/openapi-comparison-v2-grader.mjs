import { isDeepStrictEqual } from "node:util";

export function gradeBenchmarkResponse(contentJson, task) {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) {
    return {
      status: "malformed",
      pass: false,
      reasons: ["response must be a JSON object"],
      failure_categories: ["output-format"],
    };
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

  return {
    status: reasons.length === 0 ? "pass" : "fail",
    pass: reasons.length === 0,
    reasons,
    failure_categories: failureCategories,
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
