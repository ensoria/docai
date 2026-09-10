#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readTaskPacket } from "./contract.mjs";
import { verifyCalibrationEvidence } from "./evidence-verifier.mjs";
import { PACKAGE_DIR, PRIVATE_DIR, readPlan } from "./paths.mjs";
import { buildCalibrationPrompts } from "./prompt.mjs";
import { FileRunStore, buildRunnerRevision } from "./runner.mjs";

export function checkCalibrationRunState({ plan, prompts, tasks, store, runnerRevision, secretValues = [] }) {
  const attempts = store.listAttempts("calibration");
  const runs = store.listRuns("calibration");
  const checkpoint = store.readCheckpoint("calibration");
  const verified = verifyCalibrationEvidence({ plan, prompts, tasks, attempts, runs, checkpoint, expectedRunnerRevision: runnerRevision });
  const failures = [...verified.failures];
  const serialized = JSON.stringify({ attempts, runs, checkpoint });
  if (secretValues.some((value) => typeof value === "string" && value !== "" && serialized.includes(value))) failures.push("private run state contains a configured secret value");
  return { benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, failures, calibration: { status: checkpoint?.status ?? "pending", attempts: checkpoint?.attempt_count ?? attempts.length, runs: verified.evidence?.runs.length ?? 0, remaining: Math.max(0, 24 - (verified.evidence?.runs.length ?? 0)), stop_reason: checkpoint?.stop_reason ?? null } };
}

function main() {
  const plan = readPlan();
  const packet = readTaskPacket(plan);
  const store = new FileRunStore({ runsDir: path.join(PRIVATE_DIR, "runs", plan.plan_version), checkpointsDir: path.join(PRIVATE_DIR, "checkpoints", plan.plan_version) });
  const result = checkCalibrationRunState({ plan, prompts: buildCalibrationPrompts({ plan, packet }), tasks: packet.tasks.filter((task) => plan.calibration.task_ids.includes(task.id)), store, runnerRevision: buildRunnerRevision(), secretValues: [process.env.OPENAI_API_KEY, process.env.ANTHROPIC_API_KEY, process.env.GOOGLE_API_KEY] });
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
