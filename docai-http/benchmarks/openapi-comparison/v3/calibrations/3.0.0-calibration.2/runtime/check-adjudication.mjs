#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { checkBlindedAdjudicationPacket } from "./adjudication.mjs";
import { readTaskPacket } from "./contract.mjs";
import { verifyCalibrationEvidence } from "./evidence-verifier.mjs";
import { PRIVATE_DIR, readPlan } from "./paths.mjs";
import { buildCalibrationPrompts } from "./prompt.mjs";
import { buildRunnerRevision, FileRunStore, readApprovedPrivateUtf8File } from "./runner.mjs";
import { assertPlainJson } from "./strict-json.mjs";

export function checkAdjudicationPacket(input) {
  assertPlainJson(input, "adjudication check input");
  const { evidence, ...rest } = input;
  return checkBlindedAdjudicationPacket({ evidence, ...rest });
}

function runCli() {
  const plan = readPlan();
  const taskPacketTasks = readTaskPacket(plan).tasks;
  const tasks = taskPacketTasks.filter((task) => plan.calibration.task_ids.includes(task.id));
  const prompts = buildCalibrationPrompts({ plan, packet: { benchmark_id: plan.benchmark_id, api_id: plan.calibration.api_id, tasks: taskPacketTasks } });
  const store = new FileRunStore({ runsDir: path.join(PRIVATE_DIR, "runs", plan.plan_version), checkpointsDir: path.join(PRIVATE_DIR, "checkpoints", plan.plan_version) });
  const verification = verifyCalibrationEvidence({ plan, prompts, tasks, attempts: store.listAttempts(), runs: store.listRuns(), checkpoint: store.readCheckpoint(), expectedRunnerRevision: buildRunnerRevision() });
  if (verification.evidence === null) throw new Error(`calibration evidence verification failed:\n- ${verification.failures.join("\n- ")}`);
  const packetText = readApprovedPrivateUtf8File({ root: path.join(PRIVATE_DIR, "adjudication"), segments: [plan.plan_version, "review-packet.json"] });
  const result = checkAdjudicationPacket({ evidence: verification.evidence, tasks, packet: JSON.parse(packetText), requireComplete: process.argv.includes("--require-complete") });
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
