#!/usr/bin/env node

import { buildParityReport } from "./openapi-comparison-v2-context.mjs";

const privateRequired = process.argv.includes("--private-required")
  || process.env.DOCAI_BENCHMARK_PRIVATE_REQUIRED === "1";
const jsonOutput = process.argv.includes("--json");

try {
  const report = buildParityReport({ privateRequired });
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printSummary(report);
  }
  if (report.status !== "pass") process.exitCode = 1;
} catch (error) {
  console.error(`OpenAPI comparison v2 parity check failed:\n- ${error.message}`);
  process.exitCode = 1;
}

function printSummary(report) {
  console.log(`OpenAPI comparison v2 source parity check ${report.status}.`);
  console.log(`- APIs checked: ${report.summary.apis}`);
  console.log(`- Tasks checked: ${report.summary.tasks}`);
  console.log(`- Parity failures: ${report.summary.parity_failures}`);
  if (report.skipped_apis.length > 0) {
    console.log(`- Private APIs skipped: ${report.skipped_apis.join(", ")}`);
  }

  console.log("");
  console.log("| API | Task | Raw missing | Sliced missing | Parity |");
  console.log("|---|---|---:|---:|---|");
  report.tasks.forEach((task) => {
    console.log(
      `| ${task.api_id} | ${task.task_id} | ${task.raw_missing.length} | `
      + `${task.sliced_missing.length} | ${task.status} |`,
    );
  });
}
