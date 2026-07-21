#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  BENCHMARK_DIR,
  buildPrimarySchedule,
  readV2Plan,
  scheduleSummary,
} from "./openapi-comparison-v2-utils.mjs";

const plan = readV2Plan();
const schedule = buildPrimarySchedule(plan);
const summaryOnly = process.argv.includes("--summary");
const write = process.argv.includes("--write");

if (write) {
  const outputFile = path.join(BENCHMARK_DIR, "schedule.jsonl");
  fs.writeFileSync(outputFile, `${schedule.map((row) => JSON.stringify(row)).join("\n")}\n`);
  console.error(`Wrote ${schedule.length} primary run identities to ${path.relative(process.cwd(), outputFile)}`);
}

if (summaryOnly) {
  console.log(`Benchmark: ${plan.benchmark_id}`);
  console.log(`Plan: ${plan.plan_version} (${plan.status})`);
  console.log(`Primary requests: ${schedule.length}`);
  console.log("");
  console.log("| Batch | API | Repetition | Requests |");
  console.log("|---|---|---:|---:|");
  scheduleSummary(plan, schedule).forEach((row) => {
    console.log(`| ${row.batch_id} | ${row.api_id} | ${row.repetition} | ${row.requests} |`);
  });
} else if (!write) {
  schedule.forEach((row) => console.log(JSON.stringify(row)));
}
