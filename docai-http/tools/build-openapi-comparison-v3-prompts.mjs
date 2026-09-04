#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { BENCHMARK_DIR, readV3Plan } from "./openapi-comparison-v3-utils.mjs";
import {
  buildCalibrationPromptRecords,
  buildPromptMetricsPacket,
} from "./openapi-comparison-v3-prompt.mjs";

export const CALIBRATION_PROMPTS_FILE = path.join(BENCHMARK_DIR, "private", "prompts", "calibration.jsonl");
export const CALIBRATION_METRICS_FILE = path.join(BENCHMARK_DIR, "private", "contexts", "calibration-metrics.json");

export function calibrationPromptJsonl(records) {
  buildPromptMetricsPacket(records);
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function calibrationMetricsJson(records) {
  return `${JSON.stringify(buildPromptMetricsPacket(records), null, 2)}\n`;
}

function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => !["--write", "--summary"].includes(argument))) {
    throw new Error("usage: build-openapi-comparison-v3-prompts.mjs [--write] [--summary]");
  }
  const records = buildCalibrationPromptRecords(readV3Plan());
  const prompts = calibrationPromptJsonl(records);
  const metrics = calibrationMetricsJson(records);
  if (arguments_.includes("--write")) {
    fs.mkdirSync(path.dirname(CALIBRATION_PROMPTS_FILE), { recursive: true });
    fs.mkdirSync(path.dirname(CALIBRATION_METRICS_FILE), { recursive: true });
    fs.writeFileSync(CALIBRATION_PROMPTS_FILE, prompts);
    fs.writeFileSync(CALIBRATION_METRICS_FILE, metrics);
  }
  if (arguments_.includes("--summary") || arguments_.includes("--write")) {
    console.log(`Benchmark: ${readV3Plan().benchmark_id}`);
    console.log(`Plan: ${readV3Plan().plan_version}`);
    console.log(`Prompt records: ${records.length}`);
    console.log(`Unique run IDs: ${new Set(records.map((record) => record.run_id)).size}`);
    return;
  }
  process.stdout.write(prompts);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
