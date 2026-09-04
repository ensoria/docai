#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  FileRunStore,
  selectCalibrationPrompts,
  validateRetainedLedger,
} from "./openapi-comparison-v3-runner.mjs";
import {
  BENCHMARK_DIR,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

const BATCH_ID = "calibration";

export function checkCalibrationRunState({
  plan,
  prompts,
  store,
  secretValues = [],
}) {
  const selected = selectCalibrationPrompts({ plan, prompts });
  const attempts = store.listAttempts(BATCH_ID);
  const runs = store.listRuns(BATCH_ID);
  const checkpoint = store.readCheckpoint(BATCH_ID);
  const ledger = validateRetainedLedger({ plan, prompts: selected, attempts, runs, checkpoint });
  const failures = [...ledger.failures];
  validateNoSecrets({ attempts, runs, checkpoint, secretValues, failures });

  return {
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    failures,
    calibration: {
      status: checkpoint?.status ?? "pending",
      attempts: checkpoint?.attempt_count ?? attempts.length,
      runs: ledger.distinct_run_ids.length,
      remaining: Math.max(0, selected.length - ledger.distinct_run_ids.length),
      stop_reason: checkpoint?.stop_reason ?? null,
    },
  };
}

function validateNoSecrets({ attempts, runs, checkpoint, secretValues, failures }) {
  const serialized = JSON.stringify({ attempts, runs, checkpoint });
  for (const secret of secretValues) {
    if (typeof secret === "string" && secret !== "" && serialized.includes(secret)) {
      failures.push("private run state contains a configured secret value");
      break;
    }
  }
}

function readJsonLines(file) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.endsWith("\n")) throw new Error(`${file} must end with a newline`);
  return text.trimEnd().split("\n").map((line) => JSON.parse(line));
}

function runCli() {
  const plan = readV3Plan();
  const promptsFile = path.join(BENCHMARK_DIR, "private", "prompts", "calibration.jsonl");
  const prompts = readJsonLines(promptsFile);
  const store = new FileRunStore({
    runsDir: path.join(BENCHMARK_DIR, "private", "runs", plan.plan_version),
    checkpointsDir: path.join(BENCHMARK_DIR, "private", "checkpoints", plan.plan_version),
  });
  const result = checkCalibrationRunState({
    plan,
    prompts,
    store,
    secretValues: [
      process.env.OPENAI_API_KEY,
      process.env.ANTHROPIC_API_KEY,
      process.env.GOOGLE_API_KEY,
    ],
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length > 0) process.exitCode = 1;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runCli();
