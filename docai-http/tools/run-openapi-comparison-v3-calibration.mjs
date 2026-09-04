#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createAnthropicAdapter } from "./openapi-comparison-v3-anthropic-adapter.mjs";
import { readCalibrationTaskPacket } from "./openapi-comparison-v3-context.mjs";
import { createGoogleAdapter } from "./openapi-comparison-v3-google-adapter.mjs";
import { validateFrozenBenchmarkOutputs } from "./freeze-openapi-comparison-v3.mjs";
import { createOpenAIAdapter } from "./openapi-comparison-v3-openai-adapter.mjs";
import {
  CALIBRATION_RUNNER_REVISION_FILES,
  FileRunStore,
  buildRunnerRevision,
  runApprovedCalibration,
  validateLiveCalibrationPreflight,
} from "./openapi-comparison-v3-runner.mjs";
import {
  BENCHMARK_DIR,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_FILE = path.join(BENCHMARK_DIR, "private", "prompts", "calibration.jsonl");
const METRICS_FILE = path.join(
  BENCHMARK_DIR,
  "private",
  "contexts",
  "calibration-metrics.json",
);
const MODEL_RESOLUTIONS_FILE = path.join(BENCHMARK_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(BENCHMARK_DIR, "cost-estimate.json");
const FREEZE_MANIFEST_FILE = path.join(BENCHMARK_DIR, "freeze-manifest.json");
const APPROVAL_VALUE = "3.0.0-calibration.1";
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

async function runCli() {
  const mode = parseMode(process.argv.slice(2));
  const plan = readV3Plan();
  const prompts = readJsonLines(PROMPTS_FILE);
  const metrics = JSON.parse(fs.readFileSync(METRICS_FILE, "utf8"));
  const modelPacket = readOptionalJson(MODEL_RESOLUTIONS_FILE);
  const costPacket = readOptionalJson(COST_ESTIMATE_FILE);
  const freezeManifest = readOptionalJson(FREEZE_MANIFEST_FILE);
  const modelResolutions = resolutionMap(modelPacket);
  const adapters = {
    openai: createOpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY }),
    anthropic: createAnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
    google: createGoogleAdapter({ apiKey: process.env.GOOGLE_API_KEY }),
  };
  const ceilings = calibrationCeilings({ metrics, costPacket });

  printPreflight({ plan, adapters, modelResolutions, ceilings });

  if (mode === "dry-run") {
    const result = await runApprovedCalibration({
      plan,
      prompts,
      execute: false,
      adapters,
    });
    console.log(`Provider calls: ${result.report.provider_calls}`);
    return;
  }

  if (process.env.DOCAI_LIVE_LLM_APPROVED_CALIBRATION !== APPROVAL_VALUE) {
    throw new Error(
      `Live calibration requires DOCAI_LIVE_LLM_APPROVED_CALIBRATION=${APPROVAL_VALUE}`,
    );
  }
  if (modelPacket === null || costPacket === null || freezeManifest === null) {
    throw new Error(
      "Live calibration requires frozen model resolutions, cost estimate, and freeze manifest artifacts",
    );
  }

  const runnerRevision = buildRunnerRevision({
    rootDir: REPOSITORY_ROOT,
    files: CALIBRATION_RUNNER_REVISION_FILES,
  });
  const livePreflight = validateLiveCalibrationPreflight({
    plan,
    prompts,
    adapters,
    modelResolutions,
    costEstimate: costPacket,
    freezeManifest,
    validateFreezeArtifacts: ({ plan: frozenPlan }) => validateFrozenBenchmarkOutputs({
      plan: frozenPlan,
      benchmarkDir: BENCHMARK_DIR,
      privateRequired: true,
    }),
    runnerRevision,
  });
  const taskPacket = readCalibrationTaskPacket(plan);
  const tasks = new Map(taskPacket.tasks.map((task) => [task.id, task]));
  const store = new FileRunStore({
    runsDir: path.join(BENCHMARK_DIR, "private", "runs", plan.plan_version),
    checkpointsDir: path.join(BENCHMARK_DIR, "private", "checkpoints", plan.plan_version),
  });
  const result = await runApprovedCalibration({
    plan,
    prompts,
    execute: true,
    approval: process.env.DOCAI_LIVE_LLM_APPROVED_CALIBRATION,
    adapters,
    store,
    taskForPrompt(prompt) {
      const task = tasks.get(prompt.task_id);
      if (!task) throw new Error(`missing calibration task ${prompt.task_id}`);
      return task;
    },
    modelResolutions,
    runnerRevision,
    livePreflight,
  });
  console.log(JSON.stringify(result.report, null, 2));
  if (result.checkpoint.status !== "complete") process.exitCode = 1;
}

function parseMode(args) {
  if (args.length !== 1 || !["--dry-run", "--execute"].includes(args[0])) {
    throw new Error("usage: run-openapi-comparison-v3-calibration.mjs --dry-run | --execute");
  }
  return args[0] === "--execute" ? "execute" : "dry-run";
}

function printPreflight({ plan, adapters, modelResolutions, ceilings }) {
  console.log(`Plan: ${plan.benchmark_id} ${plan.plan_version}`);
  console.log(`Request ceiling: ${plan.calibration.planned_requests}`);
  console.log(`Attempt ceiling: ${plan.calibration.maximum_attempts_per_work_step}`);
  console.log(`Estimated token ceiling: ${ceilings.totalTokens}`);
  console.log(
    `Estimated cost ceiling (USD): ${ceilings.costUsd === null ? "pending Task 10 freeze" : ceilings.costUsd}`,
  );
  console.log("Targets:");
  plan.targets.forEach((target) => {
    const model = modelResolutions[target.id]?.requested_model ?? "unresolved pending Task 10";
    console.log(`- ${target.id} (${target.provider}): ${model}`);
  });
  console.log([
    "API key presence:",
    `openai=${adapters.openai.api_key_status},`,
    `anthropic=${adapters.anthropic.api_key_status},`,
    `google=${adapters.google.api_key_status}`,
  ].join(" "));
}

function calibrationCeilings({ metrics, costPacket }) {
  if (!Array.isArray(metrics?.rows) || metrics.rows.length !== 24) {
    throw new Error("calibration metrics must contain exactly 24 rows");
  }
  const inputTokens = metrics.rows.reduce((total, row) => (
    total + Math.ceil(row.prompt_approx_tokens_chars_div_4 * 1.1)
  ), 0);
  const outputTokens = metrics.rows.length * 8192;
  return {
    totalTokens: inputTokens + outputTokens,
    costUsd: costCeiling(costPacket),
  };
}

function costCeiling(packet) {
  if (packet === null) return null;
  const candidates = [
    packet.calibration?.cost_ceiling_usd,
    packet.whole_calibration?.cost_ceiling_usd,
    packet.cost_ceiling_usd,
  ];
  return candidates.find((value) => Number.isFinite(value) && value >= 0) ?? null;
}

function resolutionMap(packet) {
  if (!Array.isArray(packet?.targets)) return {};
  return Object.fromEntries(packet.targets.map((target) => [target.target_id, target]));
}

function readOptionalJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function readJsonLines(file) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.endsWith("\n")) throw new Error(`${file} must end with a newline`);
  return text.trimEnd().split("\n").map((line) => JSON.parse(line));
}

runCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
