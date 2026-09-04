#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BENCHMARK_DIR,
  buildCalibrationSchedule,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

export const CALIBRATION_SCHEDULE_FILE = path.join(BENCHMARK_DIR, "calibration-schedule.jsonl");

export function calibrationScheduleJsonl(plan) {
  return `${buildCalibrationSchedule(plan).map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => argument !== "--write")) {
    throw new Error("usage: build-openapi-comparison-v3-calibration-schedule.mjs [--write]");
  }

  const jsonl = calibrationScheduleJsonl(readV3Plan());
  if (arguments_.includes("--write")) {
    fs.writeFileSync(CALIBRATION_SCHEDULE_FILE, jsonl);
    return;
  }
  process.stdout.write(jsonl);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
