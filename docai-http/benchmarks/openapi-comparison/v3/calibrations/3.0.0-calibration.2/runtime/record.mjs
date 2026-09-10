import { assertPlainJson } from "./strict-json.mjs";

export const TRANSPORT_STATUSES = ["completed", "blocked", "provider-error", "transport-error", "incomplete"];
export const FORMAT_STATUSES = ["raw-json", "fenced-json", "invalid-json", "empty", "incomplete"];
export const CONTRACT_STATUSES = ["valid", "invalid", "not-evaluated"];
export const ACCURACY_STATUSES = ["pass", "fail", "inconclusive", "not-evaluated"];
export const UNCERTAINTY_STATUSES = ["none", "reported-gap", "missed-fact", "unsupported-guess", "not-evaluated"];

const REQUIRED_FIELDS = [
  "record_version", "benchmark_id", "plan_version", "run_id", "batch_id", "api_id", "task_id",
  "target_id", "provider", "condition", "repetition", "attempt_count", "transport_status",
  "format_status", "contract_status", "accuracy_status", "uncertainty_status", "failure_categories",
  "reasons", "manual_review_required", "implementation_defect",
];
const NULLABLE_STRING_AUDIT_FIELDS = [
  "content_text", "resolved_model", "provider_request_id", "stop_reason", "started_at", "ended_at", "runner_revision",
];
const JSON_AUDIT_FIELDS = ["content_json", "raw_response", "parse_error", "usage"];
const ALLOWED_FIELDS = new Set([...REQUIRED_FIELDS, ...NULLABLE_STRING_AUDIT_FIELDS, ...JSON_AUDIT_FIELDS]);

export function validateEvaluationRecord(record) {
  assertPlainJson(record, "record");
  if (Array.isArray(record)) throw new TypeError("record must be an object");
  for (const key of Object.keys(record)) if (!ALLOWED_FIELDS.has(key)) throw new Error(`unknown key ${key}`);
  for (const field of REQUIRED_FIELDS) if (!Object.hasOwn(record, field)) throw new Error(`${field} is required`);
  if (record.record_version !== "3") throw new Error('record_version must be "3"');
  for (const field of ["benchmark_id", "plan_version", "run_id", "batch_id", "api_id", "task_id", "target_id", "provider", "condition"]) {
    requireNonEmptyString(record[field], field);
  }
  requirePositiveInteger(record.repetition, "repetition");
  requirePositiveInteger(record.attempt_count, "attempt_count");
  requireEnum(record.transport_status, "transport_status", TRANSPORT_STATUSES);
  requireEnum(record.format_status, "format_status", FORMAT_STATUSES);
  requireEnum(record.contract_status, "contract_status", CONTRACT_STATUSES);
  requireEnum(record.accuracy_status, "accuracy_status", ACCURACY_STATUSES);
  requireEnum(record.uncertainty_status, "uncertainty_status", UNCERTAINTY_STATUSES);
  requireStringArray(record.failure_categories, "failure_categories");
  requireStringArray(record.reasons, "reasons");
  if (typeof record.manual_review_required !== "boolean") throw new TypeError("manual_review_required must be a boolean");
  if (typeof record.implementation_defect !== "boolean") throw new TypeError("implementation_defect must be a boolean");
  for (const field of NULLABLE_STRING_AUDIT_FIELDS) {
    if (Object.hasOwn(record, field) && record[field] !== null && typeof record[field] !== "string") {
      throw new TypeError(`${field} must be a string or null`);
    }
  }
  validateDimensions(record);
  return record;
}

export function isExceptionalRun(record) {
  validateEvaluationRecord(record);
  return record.format_status !== "raw-json" || record.contract_status === "invalid" || record.accuracy_status === "inconclusive";
}

function validateDimensions(record) {
  const laterNotEvaluated = record.contract_status === "not-evaluated"
    && record.accuracy_status === "not-evaluated" && record.uncertainty_status === "not-evaluated";
  if (record.transport_status === "incomplete") {
    if (record.format_status !== "incomplete") throw new Error("transport_status incomplete requires format_status incomplete");
    if (!laterNotEvaluated) throw new Error("transport_status incomplete requires all later dimensions to be not-evaluated");
  }
  if (["blocked", "provider-error", "transport-error"].includes(record.transport_status)) {
    if (record.format_status !== "empty") throw new Error(`transport_status ${record.transport_status} requires format_status empty`);
    if (!laterNotEvaluated) throw new Error(`transport_status ${record.transport_status} requires later dimensions to be not-evaluated`);
  }
  if (["invalid-json", "empty", "incomplete"].includes(record.format_status) && !laterNotEvaluated) {
    throw new Error(`format_status ${record.format_status} requires later dimensions to be not-evaluated`);
  }
  if (record.contract_status === "invalid" && (record.accuracy_status !== "not-evaluated" || record.uncertainty_status !== "not-evaluated")) {
    throw new Error("contract_status invalid requires accuracy_status and uncertainty_status to be not-evaluated");
  }
  if (record.contract_status === "valid") {
    if (!["pass", "fail", "inconclusive"].includes(record.accuracy_status)) throw new Error("contract_status valid requires an evaluated accuracy_status");
    if (!["none", "reported-gap", "missed-fact", "unsupported-guess"].includes(record.uncertainty_status)) throw new Error("contract_status valid requires an evaluated uncertainty_status");
  }
  if (record.manual_review_required !== (record.accuracy_status === "inconclusive")) {
    throw new Error("manual_review_required must be true exactly when accuracy_status is inconclusive");
  }
  if (record.implementation_defect && record.accuracy_status !== "not-evaluated") {
    throw new Error("implementation_defect requires accuracy_status not-evaluated");
  }
}

function requireNonEmptyString(value, field) { if (typeof value !== "string" || value === "") throw new TypeError(`${field} must be a non-empty string`); }
function requirePositiveInteger(value, field) { if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive integer`); }
function requireEnum(value, field, values) { if (!values.includes(value)) throw new Error(`${field} must be one of: ${values.join(", ")}`); }
function requireStringArray(value, field) { if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new TypeError(`${field} must be an array of strings`); }
