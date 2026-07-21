#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

const CHECKS = [
  ["check-core-fixtures", "docai-http/tools/check-core-fixtures.mjs"],
  ["check-compact-candidates", "docai-http/tools/check-compact-candidates.mjs"],
  ["check-workflow-candidates", "docai-http/tools/check-workflow-candidates.mjs"],
  ["check-webhook-candidates", "docai-http/tools/check-webhook-candidates.mjs"],
  ["check-non-json-candidates", "docai-http/tools/check-non-json-candidates.mjs"],
  ["check-polymorphism-candidates", "docai-http/tools/check-polymorphism-candidates.mjs"],
  ["check-complete-candidates", "docai-http/tools/check-complete-candidates.mjs"],
  ["check-complete-evaluations", "docai-http/tools/check-complete-evaluations.mjs"],
  ["check-rc2-evaluations", "docai-http/tools/check-rc2-evaluations.mjs"],
  ["check-openapi-comparison", "docai-http/tools/check-openapi-comparison.mjs"],
  ["check-conformance-fixtures", "docai-http/tools/check-conformance-fixtures.mjs"],
  ["check-conformance-boundary", "docai-http/tools/check-conformance-boundary.mjs"],
];

const failures = [];

CHECKS.forEach(([name, script]) => {
  console.log(`\n== ${name} ==`);
  const result = spawnSync(process.execPath, [script], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) failures.push(name);
});

if (failures.length > 0) {
  console.error("\nRelease readiness check failed:");
  failures.forEach((name) => console.error(`- ${name}`));
  process.exit(1);
}

console.log("\nRelease readiness check passed.");
