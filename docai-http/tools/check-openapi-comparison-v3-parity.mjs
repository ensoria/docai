#!/usr/bin/env node

import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildParityReport } from "./openapi-comparison-v3-context.mjs";

function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => argument !== "--json")) {
    throw new Error("usage: check-openapi-comparison-v3-parity.mjs [--json]");
  }
  const report = buildParityReport();
  if (arguments_.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`OpenAPI comparison v3 source parity check ${report.status}.`);
    console.log(`- APIs checked: ${report.summary.apis}`);
    console.log(`- Tasks checked: ${report.summary.tasks}`);
    console.log(`- Parity failures: ${report.summary.parity_failures}`);
  }
  if (report.status !== "pass") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`OpenAPI comparison v3 parity check failed:\n- ${error.message}`);
    process.exitCode = 1;
  }
}
