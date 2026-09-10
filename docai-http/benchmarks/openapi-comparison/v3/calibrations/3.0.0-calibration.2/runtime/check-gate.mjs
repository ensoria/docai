#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readTaskPacket } from "./contract.mjs";
import { verifyCalibrationEvidence } from "./evidence-verifier.mjs";
import { evaluateCalibrationGate } from "./gate.mjs";
import { PRIVATE_DIR, readPlan } from "./paths.mjs";
import { buildCalibrationPrompts } from "./prompt.mjs";
import { buildRunnerRevision, FileRunStore } from "./runner.mjs";
import { assertPlainJson } from "./strict-json.mjs";

export function checkCalibrationGate(input) {
  assertPlainJson(input, "gate check input");
  const result = verifyCalibrationEvidence(input);
  return { verification: { failures: result.failures }, gate: result.evidence === null ? null : evaluateCalibrationGate(result.evidence) };
}

function runCli() {
  const plan = readPlan();
  const taskPacketTasks = readTaskPacket(plan).tasks;
  const tasks = taskPacketTasks.filter((task) => plan.calibration.task_ids.includes(task.id));
  const prompts = buildCalibrationPrompts({ plan, packet: { benchmark_id: plan.benchmark_id, api_id: plan.calibration.api_id, tasks: taskPacketTasks } });
  const store = new FileRunStore({ runsDir: path.join(PRIVATE_DIR, "runs", plan.plan_version), checkpointsDir: path.join(PRIVATE_DIR, "checkpoints", plan.plan_version) });
  const result = checkCalibrationGate({ plan, prompts, tasks, attempts: store.listAttempts(), runs: store.listRuns(), checkpoint: store.readCheckpoint(), expectedRunnerRevision: buildRunnerRevision() });
  console.log(JSON.stringify(result, null, 2));
  if (result.gate === null || !result.gate.passed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
