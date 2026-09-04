#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import {
  CALIBRATION_METRICS_FILE,
} from "./build-openapi-comparison-v3-prompts.mjs";
import { assertFinitePlainJson } from "./openapi-comparison-v3-strict-json.mjs";
import {
  BENCHMARK_DIR,
  buildCalibrationSchedule,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

const MODEL_RESOLUTIONS_FILE = path.join(BENCHMARK_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(BENCHMARK_DIR, "cost-estimate.json");
const CATALOG_CHECKED_ON = "2026-09-03";
const CALIBRATION_REQUESTS = 24;
const OUTPUT_TOKENS_PER_REQUEST = 8192;
const INPUT_CONTINGENCY_PERCENT = 10;
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

const TOP_LEVEL_MODEL_KEYS = [
  "resolution_version",
  "benchmark_id",
  "plan_version",
  "status",
  "catalog_checked_on",
  "pricing_currency",
  "pricing_unit",
  "pricing_basis",
  "pricing_notes",
  "announced_future_pricing",
  "targets",
];

const MODEL_TARGET_KEYS = [
  "target_id",
  "provider",
  "requested_model",
  "resolved_model",
  "resolution_kind",
  "official_sources",
  "model_limits",
  "pricing_usd_per_million_tokens",
  "token_accounting",
  "request_settings",
];

const APPROVED_MODELS = [
  {
    target_id: "openai-frontier",
    provider: "openai",
    requested_model: "gpt-5.6-sol",
    resolved_model: "gpt-5.6-sol",
    resolution_kind: "exact-catalog-model-id",
    official_sources: [
      "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
      "https://developers.openai.com/api/docs/guides/latest-model",
    ],
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
    resolution_kind: "exact-pinned-model-id",
    official_sources: [
      "https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5",
      "https://platform.claude.com/docs/en/about-claude/pricing",
      "https://platform.claude.com/docs/en/build-with-claude/effort",
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
      "https://ai.google.dev/gemini-api/docs/latest-model",
      "https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash",
      "https://ai.google.dev/gemini-api/docs/pricing",
      "https://ai.google.dev/api/interactions-api",
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

const APPROVED_PRICING_NOTES = {
  openai_promotion_available_at_least_through: "2026-11-21",
  google_promotion_effective_through: "2026-12-31",
};

const APPROVED_FUTURE_PRICING = [{
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

export function buildCostEstimate({
  plan,
  metricsPacket,
  modelResolutions,
  outputTokensPerRequestCeiling,
  inputContingencyPercent,
  estimatedAt,
}) {
  validateCostInputs({
    plan,
    metricsPacket,
    modelResolutions,
    outputTokensPerRequestCeiling,
    inputContingencyPercent,
    estimatedAt,
  });
  const resolutions = new Map(
    modelResolutions.targets.map((target) => [target.target_id, target]),
  );
  const rows = metricsPacket.rows.map((row) => {
    const inputEstimate = Math.ceil(row.prompt_characters / 4);
    const inputCeiling = Math.ceil(inputEstimate * (1 + inputContingencyPercent / 100));
    return {
      target_id: row.target_id,
      input_tokens_estimate: inputEstimate,
      input_tokens_ceiling: inputCeiling,
      output_tokens_ceiling: outputTokensPerRequestCeiling,
    };
  });

  const targets = plan.targets.map((plannedTarget) => {
    const resolution = resolutions.get(plannedTarget.id);
    const selected = rows.filter((row) => row.target_id === plannedTarget.id);
    const inputEstimate = sum(selected, "input_tokens_estimate");
    const inputCeiling = sum(selected, "input_tokens_ceiling");
    const outputCeiling = sum(selected, "output_tokens_ceiling");
    return {
      target_id: plannedTarget.id,
      provider: plannedTarget.provider,
      requested_model: resolution.requested_model,
      resolved_model: resolution.resolved_model,
      requests: selected.length,
      input_tokens_estimate: inputEstimate,
      input_tokens_ceiling: inputCeiling,
      output_tokens_ceiling: outputCeiling,
      total_tokens_ceiling: inputCeiling + outputCeiling,
      pricing_usd_per_million_tokens: structuredClone(
        resolution.pricing_usd_per_million_tokens,
      ),
      token_accounting: resolution.token_accounting,
      cost_ceiling_usd: tokenCost(inputCeiling, outputCeiling, resolution),
    };
  });
  const inputEstimate = sum(targets, "input_tokens_estimate");
  const inputCeiling = sum(targets, "input_tokens_ceiling");
  const outputCeiling = sum(targets, "output_tokens_ceiling");
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
      input_tokens_estimate: inputEstimate,
      input_tokens_ceiling: inputCeiling,
      output_tokens_ceiling: outputCeiling,
      total_tokens_ceiling: inputCeiling + outputCeiling,
      cost_ceiling_usd: roundUsd(sum(targets, "cost_ceiling_usd")),
      targets,
    },
  };
  validateCostEstimate(plan, estimate, modelResolutions);
  return estimate;
}

export function validateModelResolutions(plan, modelResolutions) {
  assertFinitePlainJson({ plan, modelResolutions }, "model resolution validation input");
  validatePlanTargets(plan);
  requireExactKeys(modelResolutions, TOP_LEVEL_MODEL_KEYS, "model resolutions");
  requireEqual(modelResolutions.resolution_version, "1", "model resolutions resolution_version");
  requireEqual(modelResolutions.benchmark_id, plan.benchmark_id, "model resolutions benchmark_id");
  requireEqual(modelResolutions.plan_version, plan.plan_version, "model resolutions plan_version");
  requireEqual(modelResolutions.status, "frozen", "model resolutions status");
  requireEqual(modelResolutions.catalog_checked_on, CATALOG_CHECKED_ON, "model resolutions catalog_checked_on");
  requireEqual(modelResolutions.pricing_currency, "USD", "model resolutions pricing_currency");
  requireEqual(modelResolutions.pricing_unit, "per 1000000 tokens", "model resolutions pricing_unit");
  requireEqual(
    modelResolutions.pricing_basis,
    "current-standard-first-party-api-rates-effective-on-catalog-check-date",
    "model resolutions pricing_basis",
  );
  requireDeepEqual(
    modelResolutions.pricing_notes,
    APPROVED_PRICING_NOTES,
    "model resolution pricing notes",
  );
  requireDeepEqual(
    modelResolutions.announced_future_pricing,
    APPROVED_FUTURE_PRICING,
    "model resolution announced future pricing",
  );
  if (!Array.isArray(modelResolutions.targets)
      || modelResolutions.targets.length !== APPROVED_MODELS.length) {
    throw new Error("model resolutions must cover exactly three approved targets");
  }

  modelResolutions.targets.forEach((target, index) => {
    const expected = APPROVED_MODELS[index];
    requireExactKeys(target, MODEL_TARGET_KEYS, `model resolution ${expected.target_id}`);
    for (const field of [
      "target_id",
      "provider",
      "requested_model",
      "resolved_model",
      "resolution_kind",
      "token_accounting",
    ]) {
      requireEqual(target[field], expected[field], `model resolution ${expected.target_id} ${field}`);
    }
    requireDeepEqual(target.official_sources, expected.official_sources, `model resolution ${expected.target_id} official sources`);
    requireDeepEqual(target.model_limits, expected.model_limits, `model resolution ${expected.target_id} model limits`);
    requireDeepEqual(
      target.pricing_usd_per_million_tokens,
      expected.pricing_usd_per_million_tokens,
      `model resolution ${expected.target_id} pricing`,
    );
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

export function validateCostEstimate(plan, estimate, modelResolutions) {
  assertFinitePlainJson({ plan, estimate, modelResolutions }, "cost estimate validation input");
  validateModelResolutions(plan, modelResolutions);
  requireExactKeys(estimate, [
    "estimate_version",
    "benchmark_id",
    "plan_version",
    "estimated_at",
    "catalog_checked_on",
    "currency",
    "methodology",
    "calibration",
  ], "cost estimate");
  requireEqual(estimate.estimate_version, "1", "cost estimate estimate_version");
  requireEqual(estimate.benchmark_id, plan.benchmark_id, "cost estimate benchmark_id");
  requireEqual(estimate.plan_version, plan.plan_version, "cost estimate plan_version");
  requireEqual(estimate.catalog_checked_on, modelResolutions.catalog_checked_on, "cost estimate catalog_checked_on");
  requireEqual(estimate.currency, "USD", "cost estimate currency");
  if (typeof estimate.estimated_at !== "string" || Number.isNaN(Date.parse(estimate.estimated_at))) {
    throw new Error("cost estimate estimated_at must be an ISO-compatible timestamp");
  }
  requireDeepEqual(estimate.methodology, METHODOLOGY, "cost estimate methodology");

  const calibration = estimate.calibration;
  requireExactKeys(calibration, [
    "requests",
    "input_tokens_estimate",
    "input_tokens_ceiling",
    "output_tokens_ceiling",
    "total_tokens_ceiling",
    "cost_ceiling_usd",
    "targets",
  ], "cost estimate calibration");
  requireEqual(calibration.requests, CALIBRATION_REQUESTS, "cost estimate calibration requests");
  for (const field of [
    "input_tokens_estimate",
    "input_tokens_ceiling",
    "output_tokens_ceiling",
    "total_tokens_ceiling",
  ]) requireNonnegativeInteger(calibration[field], `cost estimate calibration ${field}`);
  requireEqual(
    calibration.output_tokens_ceiling,
    CALIBRATION_REQUESTS * OUTPUT_TOKENS_PER_REQUEST,
    "cost estimate calibration output_tokens_ceiling",
  );
  requireEqual(
    calibration.total_tokens_ceiling,
    calibration.input_tokens_ceiling + calibration.output_tokens_ceiling,
    "cost estimate calibration total_tokens_ceiling",
  );
  if (!Array.isArray(calibration.targets) || calibration.targets.length !== plan.targets.length) {
    throw new Error("cost estimate calibration targets must cover every provider separately");
  }

  const resolutionById = new Map(
    modelResolutions.targets.map((target) => [target.target_id, target]),
  );
  calibration.targets.forEach((target, index) => {
    const plannedTarget = plan.targets[index];
    const resolution = resolutionById.get(plannedTarget.id);
    requireExactKeys(target, [
      "target_id",
      "provider",
      "requested_model",
      "resolved_model",
      "requests",
      "input_tokens_estimate",
      "input_tokens_ceiling",
      "output_tokens_ceiling",
      "total_tokens_ceiling",
      "pricing_usd_per_million_tokens",
      "token_accounting",
      "cost_ceiling_usd",
    ], `cost estimate target ${plannedTarget.id}`);
    requireEqual(target.target_id, plannedTarget.id, `cost estimate target ${plannedTarget.id} target_id`);
    requireEqual(target.provider, plannedTarget.provider, `cost estimate target ${plannedTarget.id} provider`);
    requireEqual(target.requested_model, resolution.requested_model, `cost estimate target ${plannedTarget.id} requested_model`);
    requireEqual(target.resolved_model, resolution.resolved_model, `cost estimate target ${plannedTarget.id} resolved_model`);
    requireEqual(target.requests, 8, `cost estimate target ${plannedTarget.id} requests`);
    for (const field of [
      "input_tokens_estimate",
      "input_tokens_ceiling",
      "output_tokens_ceiling",
      "total_tokens_ceiling",
    ]) requireNonnegativeInteger(target[field], `cost estimate target ${plannedTarget.id} ${field}`);
    requireEqual(
      target.output_tokens_ceiling,
      target.requests * OUTPUT_TOKENS_PER_REQUEST,
      `cost estimate target ${plannedTarget.id} output_tokens_ceiling`,
    );
    requireEqual(
      target.total_tokens_ceiling,
      target.input_tokens_ceiling + target.output_tokens_ceiling,
      `cost estimate target ${plannedTarget.id} total_tokens_ceiling`,
    );
    requireDeepEqual(
      target.pricing_usd_per_million_tokens,
      resolution.pricing_usd_per_million_tokens,
      `cost estimate target ${plannedTarget.id} provider pricing`,
    );
    requireEqual(target.token_accounting, resolution.token_accounting, `cost estimate target ${plannedTarget.id} token accounting`);
    requireEqual(
      target.cost_ceiling_usd,
      tokenCost(target.input_tokens_ceiling, target.output_tokens_ceiling, resolution),
      `cost estimate target ${plannedTarget.id} cost_ceiling_usd`,
    );
  });

  for (const field of [
    "input_tokens_estimate",
    "input_tokens_ceiling",
    "output_tokens_ceiling",
    "total_tokens_ceiling",
  ]) {
    requireEqual(
      calibration[field],
      sum(calibration.targets, field),
      `cost estimate calibration ${field} provider sum`,
    );
  }
  requireEqual(
    calibration.cost_ceiling_usd,
    roundUsd(sum(calibration.targets, "cost_ceiling_usd")),
    "cost estimate calibration provider-specific cost sum",
  );
  return true;
}

function validateCostInputs({
  plan,
  metricsPacket,
  modelResolutions,
  outputTokensPerRequestCeiling,
  inputContingencyPercent,
  estimatedAt,
}) {
  assertFinitePlainJson({
    plan,
    metricsPacket,
    modelResolutions,
    outputTokensPerRequestCeiling,
    inputContingencyPercent,
    estimatedAt,
  }, "cost estimate input");
  validateModelResolutions(plan, modelResolutions);
  requireEqual(outputTokensPerRequestCeiling, OUTPUT_TOKENS_PER_REQUEST, "cost estimate output-token ceiling");
  requireEqual(inputContingencyPercent, INPUT_CONTINGENCY_PERCENT, "cost estimate input contingency");
  if (typeof estimatedAt !== "string" || Number.isNaN(Date.parse(estimatedAt))) {
    throw new Error("cost estimate estimatedAt must be an ISO-compatible timestamp");
  }
  if (metricsPacket.benchmark_id !== plan.benchmark_id
      || metricsPacket.plan_version !== plan.plan_version) {
    throw new Error("cost metrics identity must match the calibration plan");
  }
  if (!Array.isArray(metricsPacket.rows)
      || metricsPacket.rows.length !== CALIBRATION_REQUESTS) {
    throw new Error("cost metrics must contain exactly 24 canonical calibration rows");
  }
  const schedule = buildCalibrationSchedule(plan);
  metricsPacket.rows.forEach((row, index) => {
    const actualKeys = Object.keys(row);
    const allowedKeys = new Set([...METRIC_ROW_REQUIRED_KEYS, ...METRIC_ROW_OPTIONAL_KEYS]);
    if (METRIC_ROW_REQUIRED_KEYS.some((key) => !Object.hasOwn(row, key))
        || actualKeys.some((key) => !allowedKeys.has(key))) {
      throw new Error(`cost metrics row ${index + 1} has unexpected or missing fields`);
    }
    const expected = schedule[index];
    for (const [field, value] of Object.entries(expected)) {
      if (row[field] !== value) {
        throw new Error(`cost metrics row ${index + 1} does not match canonical calibration ${field}`);
      }
    }
    requireNonnegativeInteger(row.prompt_characters, `cost metrics row ${index + 1} prompt_characters`);
    const expectedTokens = Math.ceil(row.prompt_characters / 4);
    if (row.prompt_approx_tokens_chars_div_4 !== expectedTokens) {
      throw new Error(`cost metrics row ${index + 1} must use ceil(characters / 4)`);
    }
    if (typeof row.prompt_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.prompt_sha256)) {
      throw new Error(`cost metrics row ${index + 1} requires prompt SHA-256`);
    }
  });
}

function validatePlanTargets(plan) {
  if (plan?.benchmark_id !== "docai-http-openapi-comparison-v3"
      || plan?.plan_version !== "3.0.0-calibration.1") {
    throw new Error("model resolutions require the approved v3 calibration identity");
  }
  if (!Array.isArray(plan.targets) || plan.targets.length !== APPROVED_MODELS.length) {
    throw new Error("model resolutions require exactly three plan targets");
  }
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
}

function requireEqual(actual, expected, label) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}`);
  }
}

function requireDeepEqual(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`${label} does not match the approved value`);
}

function requireNonnegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer`);
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

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function runCli() {
  const arguments_ = process.argv.slice(2);
  const allowed = new Set([
    "--write",
    "--estimated-at",
    "--output-tokens",
    "--input-contingency-percent",
  ]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!allowed.has(argument)) throw new Error("usage: estimate-openapi-comparison-v3-cost.mjs [--write] [--estimated-at ISO] [--output-tokens 8192] [--input-contingency-percent 10]");
    if (argument !== "--write") index += 1;
  }

  const plan = readV3Plan();
  const metricsPacket = JSON.parse(fs.readFileSync(CALIBRATION_METRICS_FILE, "utf8"));
  const modelResolutions = JSON.parse(fs.readFileSync(MODEL_RESOLUTIONS_FILE, "utf8"));
  const estimatedAt = optionValue("--estimated-at")
    ?? `${modelResolutions.catalog_checked_on}T00:00:00Z`;
  const estimate = buildCostEstimate({
    plan,
    metricsPacket,
    modelResolutions,
    outputTokensPerRequestCeiling: Number(optionValue("--output-tokens") ?? OUTPUT_TOKENS_PER_REQUEST),
    inputContingencyPercent: Number(optionValue("--input-contingency-percent") ?? INPUT_CONTINGENCY_PERCENT),
    estimatedAt,
  });
  if (process.argv.includes("--write")) {
    fs.writeFileSync(COST_ESTIMATE_FILE, `${JSON.stringify(estimate, null, 2)}\n`);
    console.error(`Wrote cost estimate to ${path.relative(process.cwd(), COST_ESTIMATE_FILE)}`);
  }
  console.log(`Calibration cost ceiling: $${estimate.calibration.cost_ceiling_usd.toFixed(6)} (${estimate.calibration.requests} requests)`);
  estimate.calibration.targets.forEach((target) => {
    console.log(`${target.target_id}: $${target.cost_ceiling_usd.toFixed(6)} (${target.requests} requests)`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
