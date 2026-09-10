#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { buildCalibrationSchedule, PACKAGE_DIR } from "./paths.mjs";
import { validatePlan } from "./check-plan.mjs";
import { assertPlainJson } from "./strict-json.mjs";

const CATALOG_CHECKED_ON = "2026-09-10";
const CALIBRATION_REQUESTS = 24;
const REQUESTS_PER_TARGET = 8;
const OUTPUT_TOKENS_PER_REQUEST = 8192;
const INPUT_CONTINGENCY_PERCENT = 10;
const METRICS_FILE = path.join(PACKAGE_DIR, "private", "contexts", "calibration-metrics.json");
const MODEL_RESOLUTIONS_FILE = path.join(PACKAGE_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(PACKAGE_DIR, "cost-estimate.json");

const METRIC_METHODOLOGY = {
  context: "Exact documentation section supplied to the model.",
  prompt: "SYSTEM and USER message content joined with deterministic role labels.",
  characters: "Unicode code points.",
  approximate_tokens: "ceil(characters / 4); descriptive only, not a provider tokenizer count.",
  prompt_hash: "SHA-256 of the deterministic rendered prompt text.",
};

const METRIC_ROW_REQUIRED_KEYS = [
  "run_id",
  "calibration_ordinal",
  "batch_id",
  "api_id",
  "task_id",
  "target_id",
  "provider",
  "repetition",
  "condition",
  "prompt_sha256",
  "prompt_characters",
  "prompt_approx_tokens_chars_div_4",
];
const METRIC_ROW_OPTIONAL_KEYS = new Set([
  "context_utf8_bytes",
  "context_characters",
  "context_approx_tokens_chars_div_4",
  "prompt_utf8_bytes",
]);

const APPROVED_MODELS = [
  {
    target_id: "openai-frontier",
    provider: "openai",
    requested_model: "gpt-5.6-sol",
    resolved_model: "gpt-5.6-sol",
    resolution_kind: "exact-catalog-model-id",
    official_sources: ["https://developers.openai.com/api/docs/models/gpt-5.6-sol"],
    model_limits: { input_tokens: 1_050_000, max_output_tokens: 128_000 },
    pricing_usd_per_million_tokens: { input: 4, output: 20 },
    token_accounting: "openai-provider-specific",
    request_settings: {
      json_output_mode: "prompt-only",
      schema_constrained_output: false,
      sampling_parameters: "omitted",
      prompt_caching: false,
      tools: false,
      output_token_parameter: "max_output_tokens",
      max_output_tokens: OUTPUT_TOKENS_PER_REQUEST,
      reasoning_parameter: "reasoning.effort",
      reasoning_effort: "medium",
    },
  },
  {
    target_id: "anthropic-balanced",
    provider: "anthropic",
    requested_model: "claude-sonnet-5",
    resolved_model: "claude-sonnet-5",
    resolution_kind: "exact-catalog-model-id",
    official_sources: [
      "https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5",
      "https://platform.claude.com/docs/en/about-claude/pricing",
    ],
    model_limits: { input_tokens: 1_000_000, max_output_tokens: 128_000 },
    pricing_usd_per_million_tokens: { input: 2, output: 10 },
    token_accounting: "anthropic-provider-specific",
    request_settings: {
      json_output_mode: "prompt-only",
      schema_constrained_output: false,
      sampling_parameters: "omitted",
      prompt_caching: false,
      tools: false,
      output_token_parameter: "max_tokens",
      max_output_tokens: OUTPUT_TOKENS_PER_REQUEST,
      thinking_parameter: "thinking.type",
      thinking: "adaptive",
    },
  },
  {
    target_id: "google-stable-agentic",
    provider: "google",
    requested_model: "gemini-3.7-flash",
    resolved_model: "gemini-3.7-flash",
    resolution_kind: "exact-stable-model-id",
    official_sources: [
      "https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash",
      "https://ai.google.dev/gemini-api/docs/pricing",
    ],
    model_limits: { input_tokens: 1_048_576, max_output_tokens: 65_536 },
    pricing_usd_per_million_tokens: { input: 0.75, output: 3.75 },
    token_accounting: "google-provider-specific",
    request_settings: {
      json_output_mode: "prompt-only",
      schema_constrained_output: false,
      sampling_parameters: "omitted",
      prompt_caching: false,
      tools: false,
      grounding: false,
      output_token_parameter: "generation_config.max_output_tokens",
      max_output_tokens: OUTPUT_TOKENS_PER_REQUEST,
      thinking_parameter: "generation_config.thinking_level",
      thinking_level: "medium",
    },
  },
];

const PRICING_NOTES = {
  openai_promotion_available_at_least_through: "2026-11-21",
  openai_higher_input_rate_threshold_tokens: 272_000,
  anthropic_pricing_status: "standard",
  anthropic_previously_planned_2026_09_01_increase: "will-not-occur",
  google_promotion_effective_through: "2026-12-31",
};

const ANNOUNCED_FUTURE_PRICING = [{
  target_id: "google-stable-agentic",
  effective_from: "2027-01-01",
  pricing_usd_per_million_tokens: { input: 1.5, output: 7.5 },
}];

const METHODOLOGY = {
  input_tokens_estimate: "Deterministic ceil(characters / 4) for each complete rendered prompt.",
  input_contingency_percent: INPUT_CONTINGENCY_PERCENT,
  input_tokens_ceiling: "Apply 10% to each request estimate and round each request up before summing.",
  output_tokens_per_request_ceiling: OUTPUT_TOKENS_PER_REQUEST,
  provider_accounting: "Calculate each provider independently with its own input/output token accounting and effective rates; do not normalize token counts or prices across providers.",
  cost_ceiling: "Sum provider-specific input and output ceilings; excludes tax, discounts, caching, retries, and provider price changes after catalog_checked_on.",
};

const MODEL_RESOLUTION_KEYS = [
  "resolution_version", "benchmark_id", "plan_version", "status", "catalog_checked_on",
  "pricing_currency", "pricing_unit", "pricing_basis", "pricing_notes",
  "announced_future_pricing", "targets",
];
const MODEL_TARGET_KEYS = [
  "target_id", "provider", "requested_model", "resolved_model", "resolution_kind",
  "official_sources", "model_limits", "pricing_usd_per_million_tokens", "token_accounting",
  "request_settings",
];
const COST_ESTIMATE_KEYS = [
  "estimate_version", "benchmark_id", "plan_version", "estimated_at", "catalog_checked_on",
  "currency", "methodology", "calibration",
];
const CALIBRATION_COST_KEYS = [
  "requests", "input_tokens_estimate", "input_tokens_ceiling", "output_tokens_ceiling",
  "total_tokens_ceiling", "cost_ceiling_usd", "targets",
];
const TARGET_COST_KEYS = [
  "target_id", "provider", "requested_model", "resolved_model", "requests",
  "input_tokens_estimate", "input_tokens_ceiling", "output_tokens_ceiling",
  "total_tokens_ceiling", "pricing_usd_per_million_tokens", "token_accounting", "cost_ceiling_usd",
];

export function buildCostEstimate(input) {
  assertPlainJson(input, "cost estimate input");
  validateCostBuildInputs(input);
  const {
    plan,
    metricsPacket,
    modelResolutions,
    outputTokensPerRequestCeiling,
    inputContingencyPercent,
    estimatedAt,
  } = input;
  const resolutions = new Map(modelResolutions.targets.map((target) => [target.target_id, target]));
  const rows = metricsPacket.rows.map((row) => ({
    target_id: row.target_id,
    input_tokens_estimate: Math.ceil(row.prompt_characters / 4),
    input_tokens_ceiling: Math.ceil(Math.ceil(row.prompt_characters / 4) * (1 + inputContingencyPercent / 100)),
    output_tokens_ceiling: outputTokensPerRequestCeiling,
  }));
  const targets = plan.targets.map((plannedTarget) => {
    const resolution = resolutions.get(plannedTarget.id);
    const selected = rows.filter((row) => row.target_id === plannedTarget.id);
    const inputTokensEstimate = sum(selected, "input_tokens_estimate");
    const inputTokensCeiling = sum(selected, "input_tokens_ceiling");
    const outputTokensCeiling = sum(selected, "output_tokens_ceiling");
    return {
      target_id: plannedTarget.id,
      provider: plannedTarget.provider,
      requested_model: resolution.requested_model,
      resolved_model: resolution.resolved_model,
      requests: selected.length,
      input_tokens_estimate: inputTokensEstimate,
      input_tokens_ceiling: inputTokensCeiling,
      output_tokens_ceiling: outputTokensCeiling,
      total_tokens_ceiling: inputTokensCeiling + outputTokensCeiling,
      pricing_usd_per_million_tokens: structuredClone(resolution.pricing_usd_per_million_tokens),
      token_accounting: resolution.token_accounting,
      cost_ceiling_usd: tokenCost(inputTokensCeiling, outputTokensCeiling, resolution),
    };
  });
  const estimate = {
    estimate_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    estimated_at: estimatedAt,
    catalog_checked_on: modelResolutions.catalog_checked_on,
    currency: "USD",
    methodology: structuredClone(METHODOLOGY),
    calibration: {
      requests: rows.length,
      input_tokens_estimate: sum(targets, "input_tokens_estimate"),
      input_tokens_ceiling: sum(targets, "input_tokens_ceiling"),
      output_tokens_ceiling: sum(targets, "output_tokens_ceiling"),
      total_tokens_ceiling: sum(targets, "input_tokens_ceiling") + sum(targets, "output_tokens_ceiling"),
      cost_ceiling_usd: roundUsd(sum(targets, "cost_ceiling_usd")),
      targets,
    },
  };
  return estimate;
}

export function validateModelResolutions(plan, modelResolutions) {
  assertPlainJson({ plan, modelResolutions }, "model resolution validation input");
  validatePlanTargets(plan);
  requireExactKeys(modelResolutions, MODEL_RESOLUTION_KEYS, "model resolutions");
  requireEqual(modelResolutions.resolution_version, "1", "model resolutions resolution_version");
  requireEqual(modelResolutions.benchmark_id, plan.benchmark_id, "model resolutions benchmark_id");
  requireEqual(modelResolutions.plan_version, plan.plan_version, "model resolutions plan_version");
  requireEqual(modelResolutions.status, "frozen", "model resolutions status");
  requireEqual(modelResolutions.catalog_checked_on, CATALOG_CHECKED_ON, "model resolutions catalog_checked_on");
  requireEqual(modelResolutions.pricing_currency, "USD", "model resolutions pricing_currency");
  requireEqual(modelResolutions.pricing_unit, "per 1000000 tokens", "model resolutions pricing_unit");
  requireEqual(modelResolutions.pricing_basis, "current-standard-first-party-api-rates-effective-on-catalog-check-date", "model resolutions pricing_basis");
  requireDeepEqual(modelResolutions.pricing_notes, PRICING_NOTES, "model resolution pricing notes");
  requireDeepEqual(modelResolutions.announced_future_pricing, ANNOUNCED_FUTURE_PRICING, "model resolution announced future pricing");
  if (!Array.isArray(modelResolutions.targets) || modelResolutions.targets.length !== APPROVED_MODELS.length) {
    throw new Error("model resolutions must cover exactly three approved targets");
  }
  modelResolutions.targets.forEach((target, index) => {
    const expected = APPROVED_MODELS[index];
    requireExactKeys(target, MODEL_TARGET_KEYS, `model resolution ${expected.target_id}`);
    for (const field of ["target_id", "provider", "requested_model", "resolved_model", "resolution_kind", "token_accounting"]) {
      requireEqual(target[field], expected[field], `model resolution ${expected.target_id} ${field}`);
    }
    requireDeepEqual(target.official_sources, expected.official_sources, `model resolution ${expected.target_id} official sources`);
    requireDeepEqual(target.model_limits, expected.model_limits, `model resolution ${expected.target_id} model limits`);
    requireDeepEqual(target.pricing_usd_per_million_tokens, expected.pricing_usd_per_million_tokens, `model resolution ${expected.target_id} pricing`);
    requireDeepEqual(target.request_settings, expected.request_settings, `model resolution ${expected.target_id} request settings`);
    const plannedTarget = plan.targets[index];
    requireEqual(plannedTarget.id, expected.target_id, `model resolution ${expected.target_id} plan target`);
    requireEqual(plannedTarget.provider, expected.provider, `model resolution ${expected.target_id} plan provider`);
    if (plannedTarget.model_id !== null && plannedTarget.model_id !== expected.resolved_model) {
      throw new Error(`model resolution ${expected.target_id} does not match plan model_id`);
    }
  });
  return true;
}

export function validateCostEstimate(plan, estimate, modelResolutions, metricsPacket) {
  assertPlainJson({ plan, estimate, modelResolutions, metricsPacket }, "cost estimate validation input");
  const expected = buildCostEstimate({
    plan,
    metricsPacket,
    modelResolutions,
    outputTokensPerRequestCeiling: OUTPUT_TOKENS_PER_REQUEST,
    inputContingencyPercent: INPUT_CONTINGENCY_PERCENT,
    estimatedAt: `${CATALOG_CHECKED_ON}T00:00:00Z`,
  });
  requireDeepEqual(estimate, expected, "cost estimate does not match current metrics and approved pricing");
  return true;
}

function validateCostBuildInputs(input) {
  requireExactKeys(input, ["plan", "metricsPacket", "modelResolutions", "outputTokensPerRequestCeiling", "inputContingencyPercent", "estimatedAt"], "cost estimate input");
  const { plan, metricsPacket, modelResolutions, outputTokensPerRequestCeiling, inputContingencyPercent, estimatedAt } = input;
  validateClosedCostPlan(plan);
  validateModelResolutions(plan, modelResolutions);
  requireEqual(outputTokensPerRequestCeiling, OUTPUT_TOKENS_PER_REQUEST, "cost estimate output-token ceiling");
  requireEqual(inputContingencyPercent, INPUT_CONTINGENCY_PERCENT, "cost estimate input contingency");
  requireEqual(estimatedAt, `${CATALOG_CHECKED_ON}T00:00:00Z`, "cost estimate estimatedAt");
  requireExactKeys(metricsPacket, ["metric_version", "benchmark_id", "plan_version", "methodology", "rows"], "cost metrics");
  requireEqual(metricsPacket.metric_version, "1", "cost metrics metric_version");
  requireEqual(metricsPacket.benchmark_id, plan.benchmark_id, "cost metrics benchmark_id");
  requireEqual(metricsPacket.plan_version, plan.plan_version, "cost metrics plan_version");
  requireDeepEqual(metricsPacket.methodology, METRIC_METHODOLOGY, "cost metrics methodology");
  if (!Array.isArray(metricsPacket.rows) || metricsPacket.rows.length !== CALIBRATION_REQUESTS) {
    throw new Error("cost metrics must contain exactly 24 canonical calibration rows");
  }
  const schedule = buildCalibrationSchedule(plan);
  if (schedule.length !== CALIBRATION_REQUESTS || new Set(schedule.map((row) => row.run_id)).size !== CALIBRATION_REQUESTS) {
    throw new Error("cost calculation requires exactly 24 unique canonical calibration run identities");
  }
  const requestsByTarget = new Map(schedule.map((row) => [row.target_id, 0]));
  schedule.forEach((row) => requestsByTarget.set(row.target_id, requestsByTarget.get(row.target_id) + 1));
  plan.targets.forEach((target) => {
    if (requestsByTarget.get(target.id) !== REQUESTS_PER_TARGET) {
      throw new Error(`cost calculation requires exactly ${REQUESTS_PER_TARGET} canonical requests for ${target.id}`);
    }
  });
  if (new Set(metricsPacket.rows.map((row) => row.run_id)).size !== CALIBRATION_REQUESTS) {
    throw new Error("cost metrics must contain unique canonical calibration run identities");
  }
  metricsPacket.rows.forEach((row, index) => {
    const allowedKeys = new Set([...METRIC_ROW_REQUIRED_KEYS, ...METRIC_ROW_OPTIONAL_KEYS]);
    if (METRIC_ROW_REQUIRED_KEYS.some((key) => !Object.hasOwn(row, key)) || Object.keys(row).some((key) => !allowedKeys.has(key))) {
      throw new Error(`cost metrics row ${index + 1} has unexpected or missing fields`);
    }
    const expected = schedule[index];
    for (const [field, value] of Object.entries(expected)) {
      if (row[field] !== value) throw new Error(`cost metrics row ${index + 1} does not match canonical calibration ${field}`);
    }
    requireNonnegativeInteger(row.prompt_characters, `cost metrics row ${index + 1} prompt_characters`);
    requireEqual(row.prompt_approx_tokens_chars_div_4, Math.ceil(row.prompt_characters / 4), `cost metrics row ${index + 1} must use ceil(characters / 4)`);
    if (typeof row.prompt_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.prompt_sha256)) {
      throw new Error(`cost metrics row ${index + 1} requires prompt SHA-256`);
    }
  });
}

function validateClosedCostPlan(plan) {
  try {
    validatePlan(plan);
  } catch (error) {
    throw new Error(`cost calculation requires a closed calibration plan: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validatePlanTargets(plan) {
  if (plan.benchmark_id !== "docai-http-openapi-comparison-v3" || plan.plan_version !== "3.0.0-calibration.2") {
    throw new Error("model resolutions require the approved calibration identity");
  }
  if (!Array.isArray(plan.targets) || plan.targets.length !== APPROVED_MODELS.length) {
    throw new Error("model resolutions require exactly three plan targets");
  }
}

function requireExactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (!isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) throw new Error(`${label} has unexpected or missing fields`);
}

function requireEqual(actual, expected, label) {
  if (!Object.is(actual, expected)) throw new Error(`${label} must be ${JSON.stringify(expected)}`);
}

function requireDeepEqual(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`${label} does not match the approved value`);
}

function requireNonnegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer`);
}

function requireNonnegativeIntegerFields(value, fields) {
  fields.forEach((field) => requireNonnegativeInteger(value[field], `cost estimate ${field}`));
}

function tokenCost(inputTokens, outputTokens, resolution) {
  const price = resolution.pricing_usd_per_million_tokens;
  return roundUsd(((inputTokens * price.input) + (outputTokens * price.output)) / 1_000_000);
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + row[field], 0);
}

function roundUsd(value) {
  return Math.round((value + Number.EPSILON) * 10_000_000) / 10_000_000;
}

function runCli() {
  const args = process.argv.slice(2);
  if (!args.every((arg) => arg === "--write") || args.filter((arg) => arg === "--write").length > 1) {
    throw new Error("usage: estimate-cost.mjs [--write]");
  }
  const plan = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "plan.json"), "utf8"));
  const metricsPacket = JSON.parse(fs.readFileSync(METRICS_FILE, "utf8"));
  const modelResolutions = JSON.parse(fs.readFileSync(MODEL_RESOLUTIONS_FILE, "utf8"));
  const estimate = buildCostEstimate({
    plan,
    metricsPacket,
    modelResolutions,
    outputTokensPerRequestCeiling: OUTPUT_TOKENS_PER_REQUEST,
    inputContingencyPercent: INPUT_CONTINGENCY_PERCENT,
    estimatedAt: `${CATALOG_CHECKED_ON}T00:00:00Z`,
  });
  if (args.includes("--write")) fs.writeFileSync(COST_ESTIMATE_FILE, `${JSON.stringify(estimate, null, 2)}\n`, "utf8");
  console.log(`Calibration cost ceiling: $${estimate.calibration.cost_ceiling_usd.toFixed(7)} (${estimate.calibration.requests} requests)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
