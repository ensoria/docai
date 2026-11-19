import { assertPlainJson } from "./strict-json.mjs";
import { isDeepStrictEqual } from "node:util";
import { buildModelResolutions, validateModelResolutions } from "./estimate-cost.mjs";
import { readPlan } from "./paths.mjs";
import { nativeProviderUsage, providerCompletion } from "./provider-adapter-utils.mjs";
import { normalizeProviderUsage } from "./provider-usage.mjs";
import { priceUsage } from "./billing.mjs";

const NATIVE_FIELDS = {
  openai: new Set(["id", "object", "created_at", "completed_at", "model", "status", "output", "output_text", "usage", "error", "incomplete_details", "service_tier"]),
  anthropic: new Set(["id", "type", "role", "model", "content", "stop_reason", "stop_sequence", "usage", "error"]),
  google: new Set(["id", "object", "created", "updated", "request_id", "requestId", "responseId", "model", "modelVersion", "status", "output_text", "outputs", "output", "steps", "candidates", "usage", "usage_metadata", "usageMetadata", "stop_reason", "stopReason", "incomplete_details", "error", "create_time", "update_time"]),
};
const NESTED_NATIVE_FIELDS = new Set(["id", "type", "role", "status", "content", "text", "parts", "output", "outputs", "steps", "candidates", "finishReason", "index", "summary", "refusal", "thinking", "signature", "encrypted_content", "annotations", "start_index", "end_index", "url", "title", "code", "message", "param", "reason", "safetyRatings", "category", "probability", "blocked", "citationMetadata", "citationSources", "startIndex", "endIndex", "uri", "license"]);
const TEXT_NATIVE_TYPES = new Set(["message", "output_text", "reasoning", "summary_text", "refusal", "text", "thinking", "redacted_thinking"]);
const OPENAI_ECHO_RULES = {
  background: value => value === false,
  instructions: value => value === null || typeof value === "string",
  max_output_tokens: value => value === 16384,
  max_tool_calls: value => value === null,
  parallel_tool_calls: value => typeof value === "boolean",
  previous_response_id: value => value === null,
  prompt_cache_key: value => value === null,
  prompt_cache_retention: value => value === null,
  reasoning: value => isDeepStrictEqual(value, { effort: "medium", summary: null }) || isDeepStrictEqual(value, { effort: "medium" }),
  store: value => typeof value === "boolean",
  temperature: value => value === 1,
  top_p: value => value === 1,
  top_logprobs: value => value === 0,
  text: value => isDeepStrictEqual(value, { format: { type: "text" } })
    || isDeepStrictEqual(value, { format: { type: "text" }, verbosity: "medium" }),
  tool_choice: value => value === "auto" || value === "none",
  tools: value => Array.isArray(value) && value.length === 0,
  truncation: value => value === "disabled",
  user: value => value === null,
  metadata: value => value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(v => typeof v === "string"),
};

// One reconstruction policy for execution, retained verification and crash recovery.
export function reconstructAttemptAccounting(input) {
  assertPlainJson(input, "native accounting input");
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 3
      || ["provider", "targetId", "rawResponse"].some(key => !Object.hasOwn(input, key))) throw new TypeError("native accounting input requires provider, targetId and rawResponse");
  const { provider, targetId, rawResponse } = input;
  const plan = readPlan();
  const models = buildModelResolutions(plan);
  validateModelResolutions(plan, models, { checkedOn: models.catalog_checked_on });
  const target = models.targets.find(t => t.target_id === targetId && t.provider === provider);
  if (!target) throw new Error("native accounting requires exact canonical target");
  const issues = [];
  const raw = rawResponse && typeof rawResponse === "object" && !Array.isArray(rawResponse) ? rawResponse : {};
  const identities = ["model", "modelVersion"].filter(key => Object.hasOwn(raw, key)).map(key => raw[key]);
  const nativeModel = identities.length > 0 && identities.every(v => typeof v === "string" && v === target.resolved_model) ? target.resolved_model : null;
  if (nativeModel === null) issues.push("missing, conflicting or mismatched native model identity");
  for (const key of Object.keys(raw)) {
    const echoRule = provider === "openai" && Object.hasOwn(OPENAI_ECHO_RULES, key) ? OPENAI_ECHO_RULES[key] : null;
    if (echoRule !== null) {
      if (!echoRule(raw[key])) issues.push(`native request echo differs from fixed policy: ${key}`);
    } else if (!NATIVE_FIELDS[provider].has(key)) issues.push(`unsupported native response field: ${key}`);
  }
  if (Object.hasOwn(raw, "service_tier") && raw.service_tier !== "default") issues.push("unsupported native service tier");
  if (provider === "google") {
    if (Object.hasOwn(raw, "object") && raw.object !== "interaction") issues.push("unsupported Google native object");
    for (const key of ["created", "updated"]) {
      if (Object.hasOwn(raw, key) && (typeof raw[key] !== "string" || !Number.isFinite(Date.parse(raw[key])))) issues.push(`invalid Google ${key} timestamp`);
    }
  }
  inspectNativeFeatures(raw, issues, "root", provider);
  const usage = normalizeProviderUsage({ provider, nativeUsage: nativeProviderUsage(provider, raw) });
  if (usage.input_tokens !== null && usage.input_tokens > (target.pricing_scope.maximum_input_tokens_at_selected_rates ?? target.model_limits.input_tokens)) issues.push("native input exceeds reviewed pricing tier");
  const charge = issues.length === 0 ? priceUsage({ usage, pricing: target.pricing })
    : { status: "unknown", estimated_usd: null, issues: [...issues] };
  return { accounting_version: "2", policy_id: target.policy_id, model_resolution_id: target.model_resolution_id,
    native_model: nativeModel, pricing: target.pricing, usage, charge, issues };
}

function inspectNativeFeatures(value, issues, scope = "root", provider) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach(v => inspectNativeFeatures(v, issues, scope, provider)); return; }
  if (provider === "openai" && scope === "content" && value.type === "output_text") {
    if (!closedNativeShape(value, ["type", "text"], ["annotations", "logprobs"], issues, "OpenAI output_text")) return;
    if (typeof value.text !== "string") issues.push("OpenAI output_text.text must be a string");
    for (const key of ["annotations", "logprobs"]) {
      if (Object.hasOwn(value, key) && (!Array.isArray(value[key]) || value[key].length !== 0)) issues.push(`OpenAI output_text.${key} must be an empty array under the fixed policy`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    // Exact native usage shape is checked by the provider's shared v2 normalizer.
    if (scope === "root" && ["usage", "usage_metadata", "usageMetadata"].includes(key)) continue;
    if (scope === "root" && provider === "openai" && Object.hasOwn(OPENAI_ECHO_RULES, key)) continue;
    if (scope === "root" && provider === "google" && key === "steps") {
      validateGoogleSteps(child, issues);
      continue;
    }
    if (scope !== "root" && !NESTED_NATIVE_FIELDS.has(key)) issues.push(`unsupported nested native field: ${scope}.${key}`);
    if (/^(iterations|tools?|tool_use|server_tool_use|compaction|advisor|fallback|groundingMetadata|grounding_metadata|cachedContent|serviceTier|speed|inference_geo|geography)$/.test(key)) issues.push(`unsupported charge-bearing field: ${key}`);
    if (key === "type" && scope !== "error" && !TEXT_NATIVE_TYPES.has(child)) issues.push(`unsupported native content type: ${String(child)}`);
    if (provider === "google" && key === "signature") issues.push("Google signature outside an approved thought step");
    inspectNativeFeatures(child, issues, scope === "error" ? "error" : key, provider);
  }
}

function closedNativeShape(value, required, optional, issues, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || required.some(key => !Object.hasOwn(value, key))
      || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) {
    issues.push(`${label} has an unsupported native shape`);
    return false;
  }
  return true;
}

function validateGoogleSteps(steps, issues) {
  if (!Array.isArray(steps)) { issues.push("Google steps must be an array"); return; }
  for (const step of steps) {
    if (step?.type === "model_output") {
      if (closedNativeShape(step, ["type", "content"], [], issues, "Google model_output")) validateGoogleTextBlocks(step.content, issues, "model_output.content");
    } else if (step?.type === "thought") {
      if (!closedNativeShape(step, ["type", "signature"], ["summary"], issues, "Google thought")) continue;
      if (typeof step.signature !== "string" || step.signature.length === 0) issues.push("Google thought signature must be a nonempty string");
      if (Object.hasOwn(step, "summary")) validateGoogleTextBlocks(step.summary, issues, "thought.summary");
    } else {
      issues.push("unsupported Google Interactions step type");
    }
  }
}

function validateGoogleTextBlocks(blocks, issues, label) {
  if (!Array.isArray(blocks)) { issues.push(`Google ${label} must be an array`); return; }
  for (const block of blocks) {
    if (closedNativeShape(block, ["type", "text"], [], issues, `Google ${label} text`)
        && (block.type !== "text" || typeof block.text !== "string")) issues.push(`unsupported Google ${label} content`);
  }
}

export function nativeAccountingForAttempt(attempt) {
  assertPlainJson(attempt, "attempt accounting input");
  return reconstructAttemptAccounting({ provider: attempt.provider, targetId: attempt.target_id,
    rawResponse: attempt.response?.raw_response ?? attempt.error?.response_body ?? null });
}

export function validateAttemptAccounting(attempt) {
  const expected = nativeAccountingForAttempt(attempt);
  if (!isDeepStrictEqual(attempt.accounting, expected)) throw new Error("retained native accounting, pricing or policy mismatch");
  if (attempt.response) {
    if (!isDeepStrictEqual(attempt.response.usage, expected.usage)) throw new Error("response usage differs from native evidence");
    if (!isDeepStrictEqual(attempt.response.completion, providerCompletion(attempt.provider, attempt.response.raw_response))) throw new Error("completion differs from native evidence");
    if (expected.native_model !== null && attempt.response.resolved_model !== expected.native_model) throw new Error("adapter resolved model differs from native evidence");
  }
  if (attempt.status === "provider-error") {
    if (!isDeepStrictEqual(attempt.error.usage, expected.usage)) throw new Error("HTTP error usage differs from native evidence");
    const completion = { ...providerCompletion(attempt.provider, attempt.error.response_body), complete: false, category: "incomplete" };
    if (!isDeepStrictEqual(attempt.error.completion, completion)) throw new Error("HTTP error completion differs from native evidence");
  }
  return expected;
}

export function accountingStopReason(attempts, limits) {
  assertPlainJson(attempts, "budget attempts");
  assertPlainJson(limits, "budget limits");
  if (!limits || typeof limits !== "object" || Array.isArray(limits) || Object.keys(limits).length !== 2
      || ![limits.tokenCeiling, limits.costCeiling].every(value => Number.isFinite(value) && value > 0)) throw new TypeError("budget requires positive tokenCeiling and costCeiling");
  const { tokenCeiling, costCeiling } = limits;
  let tokens = 0, cost = 0;
  for (const attempt of attempts) {
    const usage = attempt?.accounting?.usage;
    const charge = attempt?.accounting?.charge;
    if (charge?.status !== "complete" || usage?.usage_version !== "2"
        || !Number.isSafeInteger(usage.total_tokens) || usage.total_tokens < 0
        || !Number.isFinite(charge.estimated_usd) || charge.estimated_usd < 0) return "accounting-unknown";
    tokens += usage.total_tokens;
    cost += charge.estimated_usd;
    if (tokens >= tokenCeiling) return "token-ceiling";
    if (cost >= costCeiling) return "cost-ceiling";
  }
  return null;
}

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
  if (record.record_version !== "4") throw new Error('record_version must be "4"');
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
  if (record.usage != null && record.usage.usage_version !== "2") throw new Error("record usage must be a v2 ledger");
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
