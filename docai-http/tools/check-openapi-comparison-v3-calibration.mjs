#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { evaluateCalibrationGate } from "./openapi-comparison-v3-calibration-gate.mjs";
import { BENCHMARK_DIR, readV3Plan } from "./openapi-comparison-v3-utils.mjs";

export function checkCalibrationGate(input) {
  return evaluateCalibrationGate(input);
}

function runCli() {
  const plan = readV3Plan();
  const schedule = readJsonLines(path.join(BENCHMARK_DIR, "calibration-schedule.jsonl"));
  const runsFile = path.join(
    BENCHMARK_DIR,
    "private",
    "runs",
    plan.plan_version,
    "calibration",
    "runs.jsonl",
  );
  const result = checkCalibrationGate({
    plan,
    schedule,
    runs: fs.existsSync(runsFile) ? readJsonLines(runsFile) : [],
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}

function readJsonLines(file) {
  const text = fs.readFileSync(file, "utf8");
  if (text === "") return [];
  if (!text.endsWith("\n")) throw new Error(`${file} must end with a newline`);
  return text.trimEnd().split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file} line ${index + 1} is not valid JSON: ${error.message}`);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
