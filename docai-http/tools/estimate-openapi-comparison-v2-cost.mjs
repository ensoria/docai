#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BENCHMARK_DIR,
  readV2Plan,
} from "./openapi-comparison-v2-utils.mjs";
import {
  CONTEXT_METRICS_FILE,
} from "./openapi-comparison-v2-prompt.mjs";

const MODEL_RESOLUTIONS_FILE = path.join(BENCHMARK_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(BENCHMARK_DIR, "cost-estimate.json");

export function buildCostEstimate({
  plan,
  metricsPacket,
  modelResolutions,
  outputTokensPerRequestCeiling,
  inputContingencyPercent = 0,
  estimatedAt,
}) {
  validateInputs({
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
    const resolution = resolutions.get(row.target_id);
    if (!resolution) throw new Error(`missing model resolution for target ${row.target_id}`);
    const inputEstimate = row.prompt_approx_tokens_chars_div_4;
    const inputCeiling = Math.ceil(inputEstimate * (1 + inputContingencyPercent / 100));
    const outputCeiling = outputTokensPerRequestCeiling;
    return {
      ...row,
      input_tokens_estimate: inputEstimate,
      input_tokens_ceiling: inputCeiling,
      output_tokens_ceiling: outputCeiling,
      cost_ceiling_usd: tokenCost(inputCeiling, outputCeiling, resolution),
    };
  });

  const targets = plan.targets.map((target) => {
    const resolution = resolutions.get(target.id);
    const targetRows = rows.filter((row) => row.target_id === target.id);
    return {
      target_id: target.id,
      provider: target.provider,
      requested_model: resolution.requested_model,
      resolved_model: resolution.resolved_model,
      requests: targetRows.length,
      input_tokens_estimate: sum(targetRows, "input_tokens_estimate"),
      input_tokens_ceiling: sum(targetRows, "input_tokens_ceiling"),
      output_tokens_ceiling: sum(targetRows, "output_tokens_ceiling"),
      pricing_usd_per_million_tokens: resolution.pricing_usd_per_million_tokens,
      cost_ceiling_usd: roundUsd(sum(targetRows, "cost_ceiling_usd")),
    };
  });
  const batches = plan.execution.batches.map((batch) => {
    const batchRows = rows.filter((row) => row.batch_id === batch.id);
    return {
      batch_id: batch.id,
      requests: batchRows.length,
      input_tokens_estimate: sum(batchRows, "input_tokens_estimate"),
      input_tokens_ceiling: sum(batchRows, "input_tokens_ceiling"),
      output_tokens_ceiling: sum(batchRows, "output_tokens_ceiling"),
      cost_ceiling_usd: roundUsd(sum(batchRows, "cost_ceiling_usd")),
      targets: targets.map((target) => {
        const selected = batchRows.filter((row) => row.target_id === target.target_id);
        return {
          target_id: target.target_id,
          requests: selected.length,
          input_tokens_estimate: sum(selected, "input_tokens_estimate"),
          input_tokens_ceiling: sum(selected, "input_tokens_ceiling"),
          output_tokens_ceiling: sum(selected, "output_tokens_ceiling"),
          cost_ceiling_usd: roundUsd(sum(selected, "cost_ceiling_usd")),
        };
      }),
    };
  });

  return {
    estimate_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    estimated_at: estimatedAt,
    currency: "USD",
    methodology: {
      input_tokens_estimate: "Deterministic ceil(characters / 4) for the complete rendered prompt.",
      input_contingency_percent: inputContingencyPercent,
      output_tokens_per_request_ceiling: outputTokensPerRequestCeiling,
      cost_ceiling: "Input ceiling times input list price plus output ceiling times output list price; excludes tax, discounts, caching, retries, and optional ablation.",
    },
    whole_pilot: {
      requests: rows.length,
      input_tokens_estimate: sum(rows, "input_tokens_estimate"),
      input_tokens_ceiling: sum(rows, "input_tokens_ceiling"),
      output_tokens_ceiling: sum(rows, "output_tokens_ceiling"),
      cost_ceiling_usd: roundUsd(sum(rows, "cost_ceiling_usd")),
      targets,
    },
    batches,
  };
}

export function validateModelResolutions(plan, modelResolutions) {
  if (modelResolutions?.benchmark_id !== plan?.benchmark_id) {
    throw new Error("model resolutions benchmark_id must match the plan");
  }
  if (modelResolutions.plan_version !== undefined && modelResolutions.plan_version !== plan.plan_version) {
    throw new Error("model resolutions plan_version must match the plan");
  }
  if (!Array.isArray(modelResolutions.targets) || modelResolutions.targets.length !== plan.targets.length) {
    throw new Error("model resolutions must cover every target");
  }

  const resolutions = new Map();
  modelResolutions.targets.forEach((target) => {
    if (resolutions.has(target.target_id)) {
      throw new Error(`duplicate model resolution for target ${target.target_id}`);
    }
    resolutions.set(target.target_id, target);
  });
  plan.targets.forEach((plannedTarget) => {
    const target = resolutions.get(plannedTarget.id);
    if (!target) throw new Error(`missing model resolution for target ${plannedTarget.id}`);
    const price = target.pricing_usd_per_million_tokens;
    if (target.provider !== plannedTarget.provider) {
      throw new Error(`model resolution provider mismatch for target ${plannedTarget.id}`);
    }
    if (target.requested_model !== plannedTarget.planned_model) {
      throw new Error(`requested model mismatch for target ${plannedTarget.id}`);
    }
    if (!target.resolved_model) {
      throw new Error(`resolved model is required for target ${plannedTarget.id}`);
    }
    if (target.request_settings?.json_output_mode !== "prompt-only") {
      throw new Error(`model resolution ${plannedTarget.id} must use prompt-only JSON output`);
    }
    if (Object.hasOwn(target.request_settings, "structured_json")) {
      throw new Error(`model resolution ${plannedTarget.id} must not enable structured_json`);
    }
    if (!price || !isNonNegativeNumber(price.input) || !isNonNegativeNumber(price.output)) {
      throw new Error(`model resolution ${plannedTarget.id} requires non-negative input/output prices`);
    }
  });
  return true;
}

function validateInputs({
  plan,
  metricsPacket,
  modelResolutions,
  outputTokensPerRequestCeiling,
  inputContingencyPercent,
  estimatedAt,
}) {
  if (metricsPacket?.benchmark_id !== plan?.benchmark_id) {
    throw new Error("metrics benchmark_id must match the plan");
  }
  if (metricsPacket?.plan_version !== plan?.plan_version) {
    throw new Error("metrics plan_version must match the plan");
  }
  if (!Array.isArray(metricsPacket.rows) || metricsPacket.rows.length !== plan.execution.planned_primary_requests) {
    throw new Error("metrics rows must cover every planned primary request");
  }
  validateModelResolutions(plan, modelResolutions);
  if (!Number.isInteger(outputTokensPerRequestCeiling) || outputTokensPerRequestCeiling <= 0) {
    throw new Error("outputTokensPerRequestCeiling must be a positive integer");
  }
  if (!isNonNegativeNumber(inputContingencyPercent)) {
    throw new Error("inputContingencyPercent must be non-negative");
  }
  if (!estimatedAt || Number.isNaN(Date.parse(estimatedAt))) {
    throw new Error("estimatedAt must be an ISO-compatible timestamp");
  }
}

function tokenCost(inputTokens, outputTokens, resolution) {
  const price = resolution.pricing_usd_per_million_tokens;
  return ((inputTokens * price.input) + (outputTokens * price.output)) / 1_000_000;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + row[field], 0);
}

function roundUsd(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function runCli() {
  const plan = readV2Plan();
  const metricsPacket = JSON.parse(fs.readFileSync(CONTEXT_METRICS_FILE, "utf8"));
  const modelResolutions = JSON.parse(fs.readFileSync(MODEL_RESOLUTIONS_FILE, "utf8"));
  const outputTokens = Number(optionValue("--output-tokens") ?? 4096);
  const inputContingencyPercent = Number(optionValue("--input-contingency-percent") ?? 10);
  const estimatedAt = optionValue("--estimated-at") ?? new Date().toISOString();
  const estimate = buildCostEstimate({
    plan,
    metricsPacket,
    modelResolutions,
    outputTokensPerRequestCeiling: outputTokens,
    inputContingencyPercent,
    estimatedAt,
  });

  if (process.argv.includes("--write")) {
    fs.writeFileSync(COST_ESTIMATE_FILE, `${JSON.stringify(estimate, null, 2)}\n`);
    console.error(`Wrote cost estimate to ${path.relative(process.cwd(), COST_ESTIMATE_FILE)}`);
  }
  console.log(`Whole-pilot cost ceiling: $${estimate.whole_pilot.cost_ceiling_usd.toFixed(2)}`);
  estimate.batches.forEach((batch) => {
    console.log(`${batch.batch_id}: $${batch.cost_ceiling_usd.toFixed(2)} (${batch.requests} requests)`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
