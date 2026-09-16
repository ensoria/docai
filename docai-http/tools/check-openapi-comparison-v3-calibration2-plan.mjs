#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { validatePlan } from "../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-plan.mjs";
import { readPlan } from "../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";

function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 1 || arguments_[0] !== "--frozen") {
    console.error("Usage: check-openapi-comparison-v3-calibration2-plan.mjs --frozen");
    process.exitCode = 2;
    return;
  }

  try {
    validatePlan(readPlan(), { requireFrozen: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  console.log("OpenAPI comparison v3 calibration.2 frozen plan check passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
