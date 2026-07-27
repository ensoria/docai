#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  PRIMARY_PROMPTS_FILE,
  buildPrimaryPromptRecords,
} from "./openapi-comparison-v2-prompt.mjs";
import { readV2Plan } from "./openapi-comparison-v2-utils.mjs";

const plan = readV2Plan();
const privateRequired = process.argv.includes("--private-required")
  || process.env.DOCAI_BENCHMARK_PRIVATE_REQUIRED === "1";
const records = buildPrimaryPromptRecords(plan, { privateRequired });
const write = process.argv.includes("--write");
const summary = process.argv.includes("--summary");

if (write) {
  fs.mkdirSync(path.dirname(PRIMARY_PROMPTS_FILE), { recursive: true });
  fs.writeFileSync(
    PRIMARY_PROMPTS_FILE,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  console.error(
    `Wrote ${records.length} primary prompt records to ${path.relative(process.cwd(), PRIMARY_PROMPTS_FILE)}`,
  );
}

if (summary || write) {
  console.log(`Benchmark: ${plan.benchmark_id}`);
  console.log(`Plan: ${plan.plan_version} (${plan.status})`);
  console.log(`Prompt records: ${records.length}`);
  console.log(`Unique run IDs: ${new Set(records.map((record) => record.run_id)).size}`);
  console.log("");
  console.log("| Condition | Records |");
  console.log("|---|---:|");
  plan.conditions.forEach((condition) => {
    console.log(`| ${condition} | ${records.filter((record) => record.condition === condition).length} |`);
  });
} else {
  records.forEach((record) => console.log(JSON.stringify(record)));
}
