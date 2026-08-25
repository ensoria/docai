#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import {
  adjudicationDirectory,
  buildCurrentAdjudicationArtifacts,
  checkAdjudicationArtifacts,
  readAdjudicationArtifacts,
} from "./openapi-comparison-v2-adjudication.mjs";

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function runCli() {
  const batchId = optionValue("--batch");
  if (!batchId) {
    console.error(
      "Usage: check-openapi-comparison-v2-adjudication.mjs --batch <id> [--require-complete]",
    );
    process.exitCode = 2;
    return;
  }
  const { plan, artifacts: expected } = buildCurrentAdjudicationArtifacts(batchId);
  const directory = adjudicationDirectory(plan.plan_version, batchId);
  const actual = readAdjudicationArtifacts(directory);
  const result = checkAdjudicationArtifacts({
    expected,
    ...actual,
    requireComplete: process.argv.includes("--require-complete"),
  });

  console.log(`Adjudication check for ${plan.plan_version}/${batchId}`);
  console.log(`Directory: ${path.relative(process.cwd(), directory)}`);
  console.log("");
  console.log("| Total | Pending | Correct | Incorrect | Unresolvable |");
  console.log("|---:|---:|---:|---:|---:|");
  console.log(
    `| ${result.summary.total} | ${result.summary.pending} | ${result.summary.correct} | `
    + `${result.summary.incorrect} | ${result.summary.unresolvable} |`,
  );

  if (result.failures.length > 0) {
    console.error("Adjudication check failed:");
    result.failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log("\nAdjudication check passed.");
  }
}

runCli();
