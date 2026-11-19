#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { validatePlan } from "./check-plan.mjs";
import { PACKAGE_DIR, readPlan, buildCalibrationSchedule } from "./paths.mjs";
import { assertPlainJson } from "./strict-json.mjs";
import { USAGE_POLICY_IDS } from "./provider-usage.mjs";
import { priceUsage } from "./billing.mjs";

const CHECKED_ON = "2026-11-13";
const VALID_THROUGH = "2026-11-30";
const OUTPUT_CAP = 16384;
const CONTINGENCY = 10;
const oa = "https://developers.openai.com/api/docs/";
const an = "https://platform.claude.com/docs/en/";
const go = "https://aistudio.google.com/";
const COMMON_SETTINGS = {
  json_output_mode: "prompt-only", schema_constrained_output: false,
  sampling_parameters: "omitted", tools: false, max_output_tokens: OUTPUT_CAP,
  cache_options: "omitted-not-a-guarantee-of-zero-cache-usage",
};

export function buildModelResolutions(plan = readPlan()) {
  assertPlainJson(plan, "model resolution plan");
  validatePlan(plan);
  const target = (id, provider, model, limits, rates, settings, sources, extraScope = {}) => {
    const policy_id = USAGE_POLICY_IDS[provider];
    const record = {
      target_id: id, provider, requested_model: model, resolved_model: model,
      resolution_kind: "official-exact-id-candidate-not-account-availability",
      policy_id, model_limits: limits,
      request_settings: { ...COMMON_SETTINGS, ...settings },
      pricing_scope: { endpoint: "first-party", tier: "standard", geography: "global", currency: "USD",
        unit: "per-1000000-tokens", effective_on: CHECKED_ON, valid_through: VALID_THROUGH, ...extraScope },
      official_sources: sources.map(url => ({ url, checked_on: CHECKED_ON })),
    };
    const model_resolution_id = `calibration4-${provider}-${digest({ ...record, rates })}`;
    return { ...record, model_resolution_id,
      pricing: { provider, policy_id, model_resolution_id, usd_per_million_tokens: rates } };
  };
  return {
    resolution_version: "2", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version,
    status: "candidate", catalog_checked_on: CHECKED_ON, recheck_before_freeze: true,
    targets: [
      target("openai-frontier", "openai", "gpt-5.6-sol",
        { context_tokens: 1050000, input_tokens: 922000, max_output_tokens: 128000 },
        { input_uncached: 4, input_cache_read: 0.4, input_cache_write_1800s: 5, input_cache_write_43200s: 10, output: 20 },
        { output_token_parameter: "max_output_tokens", reasoning_parameter: "reasoning.effort", reasoning_effort: "medium", default_cache_ttl_seconds: 1800 },
        [`${oa}models/gpt-5.6-sol`, `${oa}models/gpt-5.6-sol.md`, `${oa}pricing`, `${oa}guides/prompt-caching`, "https://developers.openai.com/api/reference/resources/responses/methods/create"],
        { maximum_input_tokens_at_selected_rates: 272000, regional_or_fedramp: false }),
      target("anthropic-balanced", "anthropic", "claude-sonnet-5",
        { context_tokens: 1000000, input_tokens: 1000000, max_output_tokens: 128000 },
        { input_uncached: 2, input_cache_read: 0.2, input_cache_write_300s: 2.5, input_cache_write_3600s: 4, output: 10 },
        { output_token_parameter: "max_tokens", thinking_parameter: "thinking.type", thinking: "adaptive", effort: "omitted-default-high",
          api_version: "2023-06-01", beta_headers: false, compaction: false, advisor: false, fallback: false, default_cache_ttl_seconds: 300 },
        [`${an}models/sonnet-5/overview`, `${an}build-with-claude/prompt-caching`, `${an}build-with-claude/thinking`,
          `${an}api/messages/create?version=2023-06-01`, `${an}build-with-claude/thinking-steering-and-cost`],
        { lifecycle: "active-legacy", retirement_not_before: "2027-06-30", unexpected_iterations: "unknown-unpriced-stop-required" }),
      target("google-stable-agentic", "google", "gemini-3.8-flash",
        { input_tokens: 1048576, max_output_tokens: 65536 },
        { input_uncached: 0.75, input_cache_read: 0.075, output: 3.75 },
        { output_token_parameter: "generation_config.max_output_tokens", thinking_parameter: "generation_config.thinking_level", thinking_level: "medium", grounding: false, explicit_cache_storage: false },
        [`${go}docs/models/gemini-3.8-flash`, `${go}docs/pricing`, `${go}docs/thinking`, `${go}api-reference/interactions-api`],
        { promotion_through: "2026-12-31", explicit_cache_storage: "outside-policy" }),
    ],
  };
}

// Integrity/support checks are reusable by preflight; only freeze + separate approval can authorize sends.
export function validateModelResolutions(plan, packet, options = {}) {
  assertPlainJson(plan, "model resolution plan");
  assertPlainJson(packet, "model resolutions");
  assertPlainJson(options, "model resolution validation options");
  closed(options, ["checkedOn"], "model resolution validation options");
  validatePlan(plan);
  checkDate(options.checkedOn ?? new Date().toISOString().slice(0, 10));
  if (!isDeepStrictEqual(packet, buildModelResolutions(plan))) {
    throw new Error("model resolution identity, catalog, pricing, policy, sources or request settings differ from reviewed candidate");
  }
}

export function buildCostEstimate(input = {}) {
  assertPlainJson(input, "cost estimate input");
  closed(input, ["plan", "metricsPacket", "modelResolutions", "outputTokensPerRequestCeiling", "inputContingencyPercent", "estimatedAt"], "cost estimate input");
  const { plan = readPlan(), metricsPacket, modelResolutions,
    outputTokensPerRequestCeiling = OUTPUT_CAP, inputContingencyPercent = CONTINGENCY,
    estimatedAt = `${CHECKED_ON}T00:00:00Z` } = input;
  if (outputTokensPerRequestCeiling !== OUTPUT_CAP) throw new Error("output-token ceiling must be 16384");
  if (inputContingencyPercent !== CONTINGENCY) throw new Error("input contingency must be 10 percent per request");
  if (typeof estimatedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(estimatedAt) || !Number.isFinite(Date.parse(estimatedAt))) {
    throw new Error("cost estimate requires a UTC estimatedAt timestamp");
  }
  validateModelResolutions(plan, modelResolutions, { checkedOn: estimatedAt.slice(0, 10) });
  validateMetrics(plan, metricsPacket);
  const targets = modelResolutions.targets.map(target => {
    const rows = metricsPacket.rows.filter(row => row.target_id === target.target_id);
    const tokenEstimates = rows.map(row => row.prompt_approx_tokens_chars_div_4);
    const ceilings = tokenEstimates.map(tokens => Math.ceil(tokens * (100 + CONTINGENCY) / 100));
    for (const tokens of ceilings) {
      if (tokens > (target.pricing_scope.maximum_input_tokens_at_selected_rates ?? target.model_limits.input_tokens)) {
        throw new Error("cost estimate input exceeds selected price tier (OpenAI maximum 272000) or model input limit");
      }
      if (tokens + OUTPUT_CAP > (target.model_limits.context_tokens ?? Infinity)) throw new Error("cost estimate exceeds shared context limit");
    }
    const inputKeys = Object.keys(target.pricing.usd_per_million_tokens).filter(key => key !== "output");
    // A linear disjoint-category price is maximized by assigning all input to one category.
    // Evaluate each category through the accepted billing function, never a second billing formula.
    const categoryCeilings = Object.fromEntries(inputKeys.map(key => [key,
      ceilings.reduce((sum, tokens) => sum + projectedPrice(target, tokens, key), 0)]));
    const input_tokens_ceiling = sum(ceilings);
    return {
      target_id: target.target_id, provider: target.provider, requested_model: target.requested_model,
      resolved_model: target.resolved_model, model_resolution_id: target.model_resolution_id, policy_id: target.policy_id,
      requests: rows.length, input_contingency_percent: CONTINGENCY,
      input_tokens_estimate: sum(tokenEstimates), input_tokens_ceiling,
      output_tokens_ceiling: rows.length * OUTPUT_CAP,
      total_tokens_ceiling: input_tokens_ceiling + rows.length * OUTPUT_CAP,
      category_cost_ceilings_usd: categoryCeilings,
      cost_ceiling_usd: Math.max(...Object.values(categoryCeilings)),
    };
  });
  return {
    estimate_version: "2", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version,
    status: "candidate-not-spending-authorization", estimated_at: estimatedAt,
    valid_through: VALID_THROUGH, model_resolutions_sha256: digest(modelResolutions), metrics_sha256: digest(metricsPacket),
    methodology: {
      input: "Per complete prompt ceil(Unicode code points / 4), then ceil(tokens * 110 / 100); approximate, not provider measured usage.",
      charge: "Maximum priceUsage projection over every supported disjoint input category; inclusive generated output charged once.",
      retries: "No extra spending allocation; unknown potentially billed attempts require safe stop, not zero charge.",
      rounding: "Unrounded USD for stops; display rounding is non-authoritative.",
    },
    calibration: {
      requests: 24, input_tokens_estimate: sum(targets.map(t => t.input_tokens_estimate)),
      input_tokens_ceiling: sum(targets.map(t => t.input_tokens_ceiling)), output_tokens_ceiling: 393216,
      total_tokens_ceiling: sum(targets.map(t => t.total_tokens_ceiling)),
      cost_ceiling_usd: sum(targets.map(t => t.cost_ceiling_usd)), targets,
    },
  };
}

export function validateCostEstimate(plan, estimate, modelResolutions, metricsPacket, options = {}) {
  assertPlainJson(estimate, "cost estimate");
  validateModelResolutions(plan, modelResolutions, options);
  const expected = buildCostEstimate({ plan, modelResolutions, metricsPacket, estimatedAt: estimate?.estimated_at ?? null });
  if (!isDeepStrictEqual(estimate, expected)) throw new Error("cost estimate differs from current metrics, model packet or reviewed envelope");
}

function projectedPrice(target, tokens, selectedKey) {
  const components = Object.keys(target.pricing.usd_per_million_tokens).filter(key => key !== "output").map(key => ({
    kind: key === "input_uncached" ? "uncached" : key === "input_cache_read" ? "cache-read" : "cache-write",
    tokens: key === selectedKey ? tokens : 0,
    ttl_seconds: key.startsWith("input_cache_write_") ? Number(key.slice(18, -1)) : null,
    pricing_key: key,
  }));
  const usage = {
    usage_version: "2", policy_id: target.policy_id, provider: target.provider,
    input_tokens: tokens, output_tokens: OUTPUT_CAP, total_tokens: tokens + OUTPUT_CAP,
    native_total_tokens: null, total_provenance: "derived", input_components: components,
    reasoning_tokens: target.provider === "google" ? 0 : null,
    final_output_tokens: target.provider === "google" ? OUTPUT_CAP : null,
    reasoning_in_output: target.provider !== "google", accounting_status: "complete", issues: [],
  };
  const result = priceUsage({ usage, pricing: target.pricing });
  if (result.status !== "complete") throw new Error(`cost projection cannot be priced: ${result.issues.join(", ")}`);
  return result.estimated_usd;
}

function validateMetrics(plan, packet) {
  assertPlainJson(packet, "cost metrics");
  if (packet?.metric_version !== "1" || packet.benchmark_id !== plan.benchmark_id || packet.plan_version !== plan.plan_version
    || packet.methodology?.approximate_tokens !== "ceil(characters / 4); descriptive only, not a provider tokenizer count."
    || !Array.isArray(packet.rows) || packet.rows.length !== 24) throw new Error("cost metrics require current identity, method and exactly 24 rows");
  const schedule = buildCalibrationSchedule(plan);
  packet.rows.forEach((row, i) => {
    if (!Object.entries(schedule[i]).every(([key, value]) => row[key] === value)) throw new Error("cost metrics must match canonical calibration run identities");
    for (const prefix of ["context", "prompt"]) {
      const chars = row[`${prefix}_characters`];
      const bytes = row[`${prefix}_utf8_bytes`];
      const tokens = row[`${prefix}_approx_tokens_chars_div_4`];
      if (!Number.isSafeInteger(chars) || chars <= 0 || !Number.isSafeInteger(bytes) || bytes < chars || bytes > chars * 4
        || tokens !== Math.ceil(chars / 4)) throw new Error("cost metrics require valid sizes and ceil(characters / 4)");
    }
    if (row.context_characters > row.prompt_characters || row.context_utf8_bytes > row.prompt_utf8_bytes
      || !/^[a-f0-9]{64}$/.test(row.prompt_sha256 ?? "")) throw new Error("cost metrics require full prompt payload and SHA-256 identity");
  });
}

function checkDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || date < CHECKED_ON || date > VALID_THROUGH) throw new Error("model resolution catalog/pricing expired or requires recheck");
}
function closed(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`${label} has unknown options or invalid shape`);
}
function sum(values) { return values.reduce((a, b) => a + b, 0); }
function digest(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error("usage: estimate-cost.mjs (read-only candidate validation)");
    const read = file => JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, file), "utf8"));
    const plan = readPlan();
    const models = read("model-resolutions.json");
    const estimate = read("cost-estimate.json");
    validateModelResolutions(plan, models);
    validateCostEstimate(plan, estimate, models, read("private/contexts/calibration-metrics.json"));
    console.log(JSON.stringify({ status: "candidate-valid-not-authorized", ...estimate.calibration }, null, 2));
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
