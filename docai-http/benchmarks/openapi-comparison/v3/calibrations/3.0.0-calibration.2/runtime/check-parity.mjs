#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildParityReport } from "./context.mjs";

function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 0) throw new Error("usage: check-parity.mjs");
  const report = buildParityReport();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "pass") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`OpenAPI comparison v3 calibration.2 parity check failed:\n- ${error.message}`);
    process.exitCode = 1;
  }
}
