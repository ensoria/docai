import { types } from "node:util";

const TOP_LEVEL_DRAFT_KEYS = [
  "benchmark_id",
  "plan_version",
  "status",
  "conditions",
  "targets",
  "calibration",
  "future_primary_design",
];

const EXPECTED_CONDITIONS = [
  "openapi-raw",
  "openapi-sliced",
  "openapi-enriched",
  "docai-selected",
];

const EXPECTED_TARGETS = [
  ["openai-frontier", "openai"],
  ["anthropic-balanced", "anthropic"],
  ["google-stable-agentic", "google"],
];

const EXPECTED_TASK_IDS = [
  "upload-document-request",
  "complete-checkout-workflow",
];

const FUTURE_PRIMARY_DESIGN_KEYS = [
  "api_count",
  "tasks_per_api",
  "target_count",
  "repetitions",
  "condition_count",
  "planned_requests",
  "batch_count",
  "requests_per_batch",
];

export function validatePlan(plan, { requireFrozen = false } = {}) {
  if (typeof requireFrozen !== "boolean") {
    throw new TypeError("requireFrozen must be a boolean");
  }

  assertPlainJson(plan, "plan");
  const failures = [];
  const assert = (condition, area, message) => {
    if (!condition) failures.push(`${area}: ${message}`);
  };

  assertExactKeys(plan, TOP_LEVEL_DRAFT_KEYS, "plan", failures);
  assert(plan.benchmark_id === "docai-http-openapi-comparison-v3", "identity", "unexpected benchmark_id");
  assert(plan.plan_version === "3.0.0-calibration.2", "identity", "unexpected plan_version");
  assert(plan.status === "calibration-draft", "identity", "status must be calibration-draft");
  if (requireFrozen) {
    assert(false, "freeze", "status must be calibration-frozen");
  }

  assertExactSequence(plan.conditions, EXPECTED_CONDITIONS, "conditions", failures);
  assert(Array.isArray(plan.targets) && plan.targets.length === 3, "targets", "exactly three targets are required");
  if (Array.isArray(plan.targets)) {
    const targetPairs = [];
    plan.targets.forEach((target, index) => {
      assertExactKeys(target, ["id", "provider", "model_id"], `targets[${index}]`, failures);
      targetPairs.push(`${target.id}/${target.provider}`);
      assert(target.model_id === null, `target:${target.id ?? "<unknown>"}`, "model_id must remain null until catalog verification");
    });
    assertExactSequence(targetPairs, EXPECTED_TARGETS.map(([id, provider]) => `${id}/${provider}`), "targets", failures);
  }

  const calibration = plan.calibration;
  assertExactKeys(calibration, [
    "api_id",
    "task_ids",
    "repetitions",
    "planned_requests",
    "maximum_attempts_per_work_step",
    "gate",
  ], "calibration", failures);
  assert(calibration.api_id === "complete-commerce", "calibration", "api_id must be complete-commerce");
  assertExactSequence(calibration.task_ids, EXPECTED_TASK_IDS, "calibration tasks", failures);
  assertExactSequence(calibration.repetitions, [1], "calibration repetitions", failures);
  assert(calibration.planned_requests === 24, "calibration", "planned_requests must be 24");
  assert(calibration.maximum_attempts_per_work_step === 100, "calibration", "maximum_attempts_per_work_step must be 100");
  assertExactKeys(calibration.gate, ["minimum_automated_decisions", "maximum_exceptional_runs"], "calibration gate", failures);
  assert(calibration.gate.minimum_automated_decisions === 23, "calibration gate", "minimum_automated_decisions must be 23");
  assert(calibration.gate.maximum_exceptional_runs === 1, "calibration gate", "maximum_exceptional_runs must be 1");
  assert(
    calibration.task_ids.length * plan.targets.length * calibration.repetitions.length * plan.conditions.length === 24,
    "calibration",
    "matrix must calculate 24 requests",
  );

  const primary = plan.future_primary_design;
  assertExactKeys(primary, FUTURE_PRIMARY_DESIGN_KEYS, "future primary", failures);
  assert(primary.api_count === 3, "future primary", "api_count must be 3");
  assert(primary.tasks_per_api === 6, "future primary", "tasks_per_api must be 6");
  assert(primary.target_count === 3, "future primary", "target_count must be 3");
  assert(primary.repetitions === 3, "future primary", "repetitions must be 3");
  assert(primary.condition_count === 4, "future primary", "condition_count must be 4");
  assert(primary.planned_requests === 648, "future primary", "planned_requests must be 648");
  assert(primary.batch_count === 9, "future primary", "batch_count must be 9");
  assert(primary.requests_per_batch === 72, "future primary", "requests_per_batch must be 72");
  assert(
    primary.api_count * primary.tasks_per_api * primary.target_count * primary.repetitions * primary.condition_count === 648,
    "future primary",
    "matrix must calculate 648 requests",
  );
  assert(primary.batch_count * primary.requests_per_batch === 648, "future primary", "batches must calculate 648 requests");

  if (failures.length > 0) {
    throw new Error(`OpenAPI comparison v3 calibration.2 plan check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }
}

function assertPlainJson(value, location, ancestors = new Set()) {
  if (types.isProxy(value)) {
    throw new TypeError(`${location} must be plain JSON; Proxy values are not allowed`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError(`${location} must be plain JSON; non-finite numbers are not allowed`);
  }
  if (typeof value !== "object") {
    throw new TypeError(`${location} must be plain JSON`);
  }
  if (ancestors.has(value)) {
    throw new TypeError(`${location} must be plain JSON; cycles are not allowed`);
  }
  if (Array.isArray(value) && Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${location} must be a plain JSON array`);
  }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${location} must be a plain JSON object`);
  }

  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${location} must be plain JSON; symbol keys are not allowed`);
  }
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || !keys.every((key, index) => key === String(index))) {
      throw new TypeError(`${location} must be plain JSON; arrays must contain only own indexed data`);
    }
  }
  Object.entries(descriptors).forEach(([key, descriptor]) => {
    if (Array.isArray(value) && key === "length") return;
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${location}.${key} must be a plain JSON value`);
    }
    assertPlainJson(descriptor.value, Array.isArray(value) ? `${location}[${key}]` : `${location}.${key}`, ancestors);
  });
  if (Array.isArray(value) && Object.keys(value).length !== value.length) {
    throw new TypeError(`${location} must be plain JSON; sparse arrays are not allowed`);
  }
  ancestors.delete(value);
}

function assertExactKeys(value, expected, area, failures) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${area}: must be an object`);
    return;
  }
  const actual = Object.keys(value);
  actual.forEach((key) => {
    if (!expected.includes(key)) failures.push(`${area}: unknown key ${key}`);
  });
  expected.forEach((key) => {
    if (!actual.includes(key)) failures.push(`${area}: missing key ${key}`);
  });
}

function assertExactSequence(actual, expected, area, failures) {
  if (!Array.isArray(actual)) {
    failures.push(`${area}: must be an array`);
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${area}: must match the approved order ${expected.join(", ")}`);
  }
}
