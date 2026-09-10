#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { createAnthropicAdapter } from "./anthropic-adapter.mjs";
import { readTaskPacket } from "./contract.mjs";
import { createGoogleAdapter } from "./google-adapter.mjs";
import { PACKAGE_DIR, PRIVATE_DIR, readPlan } from "./paths.mjs";
import { createOpenAIAdapter } from "./openai-adapter.mjs";
import { buildCalibrationPrompts } from "./prompt.mjs";
import { FileRunStore, buildRunnerRevision, runApprovedCalibration, validateLivePreflight } from "./runner.mjs";

const APPROVAL = "3.0.0-calibration.2";

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const plan = readPlan();
  const packet = readTaskPacket(plan);
  const prompts = buildCalibrationPrompts({ plan, packet });
  const adapters = {
    openai: createOpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY }),
    anthropic: createAnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
    google: createGoogleAdapter({ apiKey: process.env.GOOGLE_API_KEY }),
  };
  printPreflight(plan, adapters);
  if (mode === "dry-run") {
    const result = await runApprovedCalibration({ plan, prompts, execute: false, adapters });
    console.log(`Provider calls: ${result.report.provider_calls}`);
    return;
  }
  if (process.env.DOCAI_LIVE_LLM_APPROVED_CALIBRATION !== APPROVAL) {
    throw new Error(`Live calibration requires DOCAI_LIVE_LLM_APPROVED_CALIBRATION=${APPROVAL}`);
  }
  const modelResolutions = readRequiredJson("model-resolutions.json");
  const costEstimate = readRequiredJson("cost-estimate.json");
  const metricsPacket = readRequiredJson(path.join("private", "contexts", "calibration-metrics.json"));
  const freezeManifest = readRequiredJson("freeze-manifest.json");
  const runnerRevision = buildRunnerRevision();
  const preflight = validateLivePreflight({
    plan, prompts, adapters, modelResolutions, costEstimate, metricsPacket, freezeManifest, runnerRevision,
    validateFreezeArtifacts: () => false,
  });
  const store = new FileRunStore({
    runsDir: path.join(PRIVATE_DIR, "runs", plan.plan_version),
    checkpointsDir: path.join(PRIVATE_DIR, "checkpoints", plan.plan_version),
  });
  const result = await runApprovedCalibration({
    plan, prompts, execute: true, approval: APPROVAL, adapters, store,
    tasks: packet.tasks.filter((task) => plan.calibration.task_ids.includes(task.id)),
    modelResolutions, runnerRevision, livePreflight: preflight,
  });
  console.log(JSON.stringify(result.report, null, 2));
}

function parseMode(args) {
  if (args.length !== 1 || !["--dry-run", "--execute"].includes(args[0])) {
    throw new Error("usage: run-calibration.mjs --dry-run | --execute");
  }
  return args[0] === "--execute" ? "execute" : "dry-run";
}

function printPreflight(plan, adapters) {
  console.log(`Plan: ${plan.benchmark_id} ${plan.plan_version}`);
  console.log(`Request ceiling: ${plan.calibration.planned_requests}`);
  console.log(`Attempt ceiling: ${plan.calibration.maximum_attempts_per_work_step}`);
  console.log(`API key presence: openai=${adapters.openai.api_key_status}, anthropic=${adapters.anthropic.api_key_status}, google=${adapters.google.api_key_status}`);
}

function readRequiredJson(...segments) {
  const file = path.join(PACKAGE_DIR, ...segments);
  if (!fs.existsSync(file)) throw new Error(`Live calibration requires ${segments.join("/")}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
