#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readTaskPacket } from "./contract.mjs";
import { verifyCalibrationEvidence } from "./evidence-verifier.mjs";
import { PACKAGE_DIR, PRIVATE_DIR, readPlan } from "./paths.mjs";
import { buildCalibrationPrompts } from "./prompt.mjs";
import { FileRunStore, buildCalibrationReport, buildRunnerRevision } from "./runner.mjs";

export function checkCalibrationRunState({ plan, prompts, tasks, store, runnerRevision, secretValues = [] }) {
  const attempts = store.listAttempts("calibration");
  const runs = store.listRuns("calibration");
  const checkpoint = store.readCheckpoint("calibration");
  const verified = verifyCalibrationEvidence({ plan, prompts, tasks, attempts, runs, checkpoint, expectedRunnerRevision: runnerRevision });
  const failures = [...verified.failures];
  const serialized = JSON.stringify({ attempts, runs, checkpoint });
  if (secretValues.some((value) => typeof value === "string" && value !== "" && serialized.includes(value))) failures.push("private run state contains a configured secret value");
  let report = null;
  if (failures.length === 0) {
    try { report = buildCalibrationReport({ evidence: verified.evidence }); }
    catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
  }
  return { benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, failures, report, calibration: report === null ? null : { status: report.status, attempts: report.counts.attempts, runs: report.counts.completed, remaining: report.counts.remaining, stop_reason: report.stop_reason } };
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
