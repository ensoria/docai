import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildCostEstimate,
  validateCostEstimate,
  validateModelResolutions,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/estimate-cost.mjs";
import {
  PACKAGE_DIR,
  buildCalibrationSchedule,
  readPlan,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const CHECKED_ON = "2026-09-10";
const ESTIMATED_AT = "2026-09-10T00:00:00Z";
const METRICS_FILE = path.join(PACKAGE_DIR, "private", "contexts", "calibration-metrics.json");

test("accepts only the exact 2026-09-10 official model resolutions and request settings", () => {
  const plan = draftPlan();
  const models = modelResolutions(plan);

  assert.doesNotThrow(() => validateModelResolutions(plan, models));
  assert.deepEqual(models.targets.map((target) => ({
    target_id: target.target_id,
    model: target.resolved_model,
    limits: target.model_limits,
    price: target.pricing_usd_per_million_tokens,
    settings: target.request_settings,
    sources: target.official_sources,
  })), [
    {
      target_id: "openai-frontier",
      model: "gpt-5.6-sol",
      limits: { input_tokens: 1_050_000, max_output_tokens: 128_000 },
      price: { input: 4, output: 20 },
      settings: {
        json_output_mode: "prompt-only",
        schema_constrained_output: false,
        sampling_parameters: "omitted",
        prompt_caching: false,
        tools: false,
        output_token_parameter: "max_output_tokens",
        max_output_tokens: 8192,
        reasoning_parameter: "reasoning.effort",
        reasoning_effort: "medium",
      },
      sources: ["https://developers.openai.com/api/docs/models/gpt-5.6-sol"],
    },
    {
      target_id: "anthropic-balanced",
      model: "claude-sonnet-5",
      limits: { input_tokens: 1_000_000, max_output_tokens: 128_000 },
      price: { input: 2, output: 10 },
      settings: {
        json_output_mode: "prompt-only",
        schema_constrained_output: false,
        sampling_parameters: "omitted",
        prompt_caching: false,
        tools: false,
        output_token_parameter: "max_tokens",
        max_output_tokens: 8192,
        thinking_parameter: "thinking.type",
        thinking: "adaptive",
      },
      sources: [
        "https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5",
        "https://platform.claude.com/docs/en/about-claude/pricing",
      ],
    },
    {
      target_id: "google-stable-agentic",
      model: "gemini-3.7-flash",
      limits: { input_tokens: 1_048_576, max_output_tokens: 65_536 },
      price: { input: 0.75, output: 3.75 },
      settings: {
        json_output_mode: "prompt-only",
        schema_constrained_output: false,
        sampling_parameters: "omitted",
        prompt_caching: false,
        tools: false,
        grounding: false,
        output_token_parameter: "generation_config.max_output_tokens",
        max_output_tokens: 8192,
        thinking_parameter: "generation_config.thinking_level",
        thinking_level: "medium",
      },
      sources: [
        "https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash",
        "https://ai.google.dev/gemini-api/docs/pricing",
      ],
    },
  ]);
  assert.deepEqual(models.pricing_notes, {
    openai_promotion_available_at_least_through: "2026-11-21",
    openai_higher_input_rate_threshold_tokens: 272_000,
    anthropic_pricing_status: "standard",
    anthropic_previously_planned_2026_09_01_increase: "will-not-occur",
    google_promotion_effective_through: "2026-12-31",
  });
  assert.deepEqual(models.announced_future_pricing, [{
    target_id: "google-stable-agentic",
    effective_from: "2027-01-01",
    pricing_usd_per_million_tokens: { input: 1.5, output: 7.5 },
  }]);
});

test("rejects model aliases, target duplication, pricing drift, and sampling drift", () => {
  const plan = draftPlan();
  const mutations = [
    (packet) => { packet.targets[0].resolved_model = "gpt-5.6-sol-latest"; },
    (packet) => { packet.targets[2] = structuredClone(packet.targets[0]); },
    (packet) => { packet.targets[1].pricing_usd_per_million_tokens.output = 20; },
    (packet) => { packet.targets[1].request_settings.sampling_parameters = "temperature=0"; },
    (packet) => { packet.targets[2].request_settings.thinking_level = "high"; },
    (packet) => { packet.catalog_checked_on = "2026-09-09"; },
  ];

  for (const mutate of mutations) {
    const packet = modelResolutions(plan);
    mutate(packet);
    assert.throws(() => validateModelResolutions(plan, packet), /model resolution|catalog|pricing|request settings/);
  }
});

test("calculates each request with ceil(chars / 4), then a rounded-up 10 percent contingency", () => {
  const plan = draftPlan();
  const estimate = buildCostEstimate(costInputs(plan, syntheticMetrics(plan)));

  assert.deepEqual(estimate.calibration, {
    requests: 24,
    input_tokens_estimate: 25,
    input_tokens_ceiling: 49,
    output_tokens_ceiling: 196_608,
    total_tokens_ceiling: 196_657,
    cost_ceiling_usd: 2.211952,
    targets: [
      targetCost("openai-frontier", "openai", "gpt-5.6-sol", 9, 17, { input: 4, output: 20 }, "openai-provider-specific", 1.310788),
      targetCost("anthropic-balanced", "anthropic", "claude-sonnet-5", 8, 16, { input: 2, output: 10 }, "anthropic-provider-specific", 0.655392),
      targetCost("google-stable-agentic", "google", "gemini-3.7-flash", 8, 16, { input: 0.75, output: 3.75 }, "google-provider-specific", 0.245772),
    ],
  });
  assert.doesNotThrow(() => validateCostEstimate(plan, estimate, modelResolutions(plan), syntheticMetrics(plan)));
});

test("rejects any request count other than 24 or provider allocation other than eight each", () => {
  const plan = draftPlan();
  const short = syntheticMetrics(plan);
  short.rows.pop();
  assert.throws(() => buildCostEstimate(costInputs(plan, short)), /exactly 24/);

  const duplicateProvider = syntheticMetrics(plan);
  duplicateProvider.rows[8].target_id = "openai-frontier";
  duplicateProvider.rows[8].provider = "openai";
  assert.throws(() => buildCostEstimate(costInputs(plan, duplicateProvider)), /canonical calibration/);
});

test("rejects duplicate task or run identities before cost calculation", () => {
  const duplicateTaskPlan = draftPlan();
  duplicateTaskPlan.calibration.task_ids[1] = duplicateTaskPlan.calibration.task_ids[0];
  assert.throws(
    () => buildCostEstimate(costInputs(duplicateTaskPlan, syntheticMetrics(duplicateTaskPlan))),
    /calibration tasks|closed calibration plan/,
  );

  const plan = draftPlan();
  const metrics = syntheticMetrics(plan);
  metrics.rows[1].run_id = metrics.rows[0].run_id;
  assert.throws(() => buildCostEstimate(costInputs(plan, metrics)), /canonical calibration run identities/);
});

test("rejects token-method drift and aggregate or provider-cost tampering", () => {
  const plan = draftPlan();
  const inconsistent = syntheticMetrics(plan);
  inconsistent.rows[0].prompt_approx_tokens_chars_div_4 = 1;
  assert.throws(() => buildCostEstimate(costInputs(plan, inconsistent)), /ceil\(characters \/ 4\)/);
  assert.throws(
    () => buildCostEstimate({ ...costInputs(plan, syntheticMetrics(plan)), inputContingencyPercent: 0 }),
    /input contingency/,
  );
  assert.throws(
    () => buildCostEstimate({ ...costInputs(plan, syntheticMetrics(plan)), outputTokensPerRequestCeiling: 4096 }),
    /output-token ceiling/,
  );

  const estimate = buildCostEstimate(costInputs(plan, syntheticMetrics(plan)));
  estimate.calibration.targets[0].cost_ceiling_usd += 1;
  estimate.calibration.cost_ceiling_usd += 1;
  assert.throws(() => validateCostEstimate(plan, estimate, modelResolutions(plan), syntheticMetrics(plan)), /cost estimate/);
});

test("rebuilds from current metrics and rejects a coherent lower ceiling", () => {
  const plan = draftPlan();
  const metrics = syntheticMetrics(plan);
  const models = modelResolutions(plan);
  const estimate = buildCostEstimate(costInputs(plan, metrics));
  const tampered = structuredClone(estimate);
  const target = tampered.calibration.targets[0];
  target.input_tokens_estimate = 0;
  target.input_tokens_ceiling = 0;
  target.total_tokens_ceiling = target.output_tokens_ceiling;
  target.cost_ceiling_usd = (target.output_tokens_ceiling * target.pricing_usd_per_million_tokens.output) / 1_000_000;
  tampered.calibration.input_tokens_estimate = tampered.calibration.targets.reduce((total, entry) => total + entry.input_tokens_estimate, 0);
  tampered.calibration.input_tokens_ceiling = tampered.calibration.targets.reduce((total, entry) => total + entry.input_tokens_ceiling, 0);
  tampered.calibration.total_tokens_ceiling = tampered.calibration.targets.reduce((total, entry) => total + entry.total_tokens_ceiling, 0);
  tampered.calibration.cost_ceiling_usd = tampered.calibration.targets.reduce((total, entry) => total + entry.cost_ceiling_usd, 0);

  assert.throws(
    () => validateCostEstimate(plan, tampered, models, metrics),
    /current metrics|canonical metrics|cost estimate/,
  );
});

test("rejects hostile cost inputs before accessors, coercions, or Proxy traps execute", () => {
  const plan = draftPlan();
  const { proxy, trapCalls } = countedProxy(modelResolutions(plan));
  assert.throws(() => validateModelResolutions(plan, proxy), /Proxy/);
  assert.equal(trapCalls(), 0);

  let getterCalls = 0;
  const accessorPacket = {};
  Object.defineProperty(accessorPacket, "targets", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return [];
    },
  });
  assert.throws(() => validateModelResolutions(plan, accessorPacket), /plain JSON/);
  assert.equal(getterCalls, 0);

  let coercions = 0;
  const numericCoercion = {
    valueOf() {
      coercions += 1;
      return 8192;
    },
  };
  assert.throws(
    () => buildCostEstimate({
      ...costInputs(plan, syntheticMetrics(plan)),
      outputTokensPerRequestCeiling: numericCoercion,
    }),
    /plain JSON|output-token ceiling/,
  );
  assert.equal(coercions, 0);

  let inputGetterCalls = 0;
  const accessorInput = {};
  Object.defineProperty(accessorInput, "plan", {
    enumerable: true,
    get() {
      inputGetterCalls += 1;
      return plan;
    },
  });
  assert.throws(() => buildCostEstimate(accessorInput), /plain JSON/);
  assert.equal(inputGetterCalls, 0);
});

test("checked-in artifacts reproduce the exact 24-request provider ceilings", () => {
  const plan = readPlan();
  const models = readJson(path.join(PACKAGE_DIR, "model-resolutions.json"));
  const estimate = readJson(path.join(PACKAGE_DIR, "cost-estimate.json"));
  const metrics = readJson(METRICS_FILE);

  assert.doesNotThrow(() => validateModelResolutions(plan, models));
  assert.doesNotThrow(() => validateCostEstimate(plan, estimate, models, metrics));
  assert.deepEqual(estimate, buildCostEstimate({
    plan,
    metricsPacket: metrics,
    modelResolutions: models,
    outputTokensPerRequestCeiling: 8192,
    inputContingencyPercent: 10,
    estimatedAt: ESTIMATED_AT,
  }));
});

test("cost implementation has no calibration.1 runtime dependency", () => {
  const source = fs.readFileSync(path.join(PACKAGE_DIR, "runtime", "estimate-cost.mjs"), "utf8");
  assert.doesNotMatch(source, /3\.0\.0-calibration\.1|tools\/estimate-openapi-comparison-v3-cost/);
  assert.equal(path.relative(REPOSITORY_ROOT, PACKAGE_DIR).includes("3.0.0-calibration.2"), true);
});

function costInputs(plan, metricsPacket) {
  return {
    plan,
    metricsPacket,
    modelResolutions: modelResolutions(plan),
    outputTokensPerRequestCeiling: 8192,
    inputContingencyPercent: 10,
    estimatedAt: ESTIMATED_AT,
  };
}

function draftPlan() {
  const plan = structuredClone(readPlan());
  plan.status = "calibration-draft";
  plan.targets.forEach((target) => { target.model_id = null; });
  delete plan.freeze;
  return plan;
}

function syntheticMetrics(plan) {
  return {
    metric_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    methodology: {
      context: "Exact documentation section supplied to the model.",
      prompt: "SYSTEM and USER message content joined with deterministic role labels.",
      characters: "Unicode code points.",
      approximate_tokens: "ceil(characters / 4); descriptive only, not a provider tokenizer count.",
      prompt_hash: "SHA-256 of the deterministic rendered prompt text.",
    },
    rows: buildCalibrationSchedule(plan).map((row, index) => {
      const promptCharacters = index === 0 ? 5 : 4;
      return {
        ...row,
        prompt_sha256: "a".repeat(64),
        context_utf8_bytes: promptCharacters,
        context_characters: promptCharacters,
        context_approx_tokens_chars_div_4: Math.ceil(promptCharacters / 4),
        prompt_utf8_bytes: promptCharacters,
        prompt_characters: promptCharacters,
        prompt_approx_tokens_chars_div_4: Math.ceil(promptCharacters / 4),
      };
    }),
  };
}

function modelResolutions(plan) {
  return {
    resolution_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    status: "frozen",
    catalog_checked_on: CHECKED_ON,
    pricing_currency: "USD",
    pricing_unit: "per 1000000 tokens",
    pricing_basis: "current-standard-first-party-api-rates-effective-on-catalog-check-date",
    pricing_notes: {
      openai_promotion_available_at_least_through: "2026-11-21",
      openai_higher_input_rate_threshold_tokens: 272_000,
      anthropic_pricing_status: "standard",
      anthropic_previously_planned_2026_09_01_increase: "will-not-occur",
      google_promotion_effective_through: "2026-12-31",
    },
    announced_future_pricing: [{
      target_id: "google-stable-agentic",
      effective_from: "2027-01-01",
      pricing_usd_per_million_tokens: { input: 1.5, output: 7.5 },
    }],
    targets: [
      modelTarget("openai-frontier", "openai", "gpt-5.6-sol", "exact-catalog-model-id", ["https://developers.openai.com/api/docs/models/gpt-5.6-sol"], { input_tokens: 1_050_000, max_output_tokens: 128_000 }, { input: 4, output: 20 }, "openai-provider-specific", {
        json_output_mode: "prompt-only", schema_constrained_output: false, sampling_parameters: "omitted", prompt_caching: false, tools: false, output_token_parameter: "max_output_tokens", max_output_tokens: 8192, reasoning_parameter: "reasoning.effort", reasoning_effort: "medium",
      }),
      modelTarget("anthropic-balanced", "anthropic", "claude-sonnet-5", "exact-catalog-model-id", ["https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5", "https://platform.claude.com/docs/en/about-claude/pricing"], { input_tokens: 1_000_000, max_output_tokens: 128_000 }, { input: 2, output: 10 }, "anthropic-provider-specific", {
        json_output_mode: "prompt-only", schema_constrained_output: false, sampling_parameters: "omitted", prompt_caching: false, tools: false, output_token_parameter: "max_tokens", max_output_tokens: 8192, thinking_parameter: "thinking.type", thinking: "adaptive",
      }),
      modelTarget("google-stable-agentic", "google", "gemini-3.7-flash", "exact-stable-model-id", ["https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash", "https://ai.google.dev/gemini-api/docs/pricing"], { input_tokens: 1_048_576, max_output_tokens: 65_536 }, { input: 0.75, output: 3.75 }, "google-provider-specific", {
        json_output_mode: "prompt-only", schema_constrained_output: false, sampling_parameters: "omitted", prompt_caching: false, tools: false, grounding: false, output_token_parameter: "generation_config.max_output_tokens", max_output_tokens: 8192, thinking_parameter: "generation_config.thinking_level", thinking_level: "medium",
      }),
    ],
  };
}

function modelTarget(targetId, provider, model, resolutionKind, sources, limits, pricing, tokenAccounting, settings) {
  return {
    target_id: targetId,
    provider,
    requested_model: model,
    resolved_model: model,
    resolution_kind: resolutionKind,
    official_sources: sources,
    model_limits: limits,
    pricing_usd_per_million_tokens: pricing,
    token_accounting: tokenAccounting,
    request_settings: settings,
  };
}

function targetCost(targetId, provider, model, estimate, ceiling, pricing, accounting, cost) {
  return {
    target_id: targetId,
    provider,
    requested_model: model,
    resolved_model: model,
    requests: 8,
    input_tokens_estimate: estimate,
    input_tokens_ceiling: ceiling,
    output_tokens_ceiling: 65_536,
    total_tokens_ceiling: ceiling + 65_536,
    pricing_usd_per_million_tokens: pricing,
    token_accounting: accounting,
    cost_ceiling_usd: cost,
  };
}

function countedProxy(target) {
  let trapCalls = 0;
  const proxy = new Proxy(target, {
    get(target_, property, receiver) {
      trapCalls += 1;
      return Reflect.get(target_, property, receiver);
    },
    getPrototypeOf(target_) {
      trapCalls += 1;
      return Reflect.getPrototypeOf(target_);
    },
    ownKeys(target_) {
      trapCalls += 1;
      return Reflect.ownKeys(target_);
    },
    getOwnPropertyDescriptor(target_, property) {
      trapCalls += 1;
      return Reflect.getOwnPropertyDescriptor(target_, property);
    },
  });
  return { proxy, trapCalls: () => trapCalls };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
