#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DOCAI_HTTP_DIR = path.resolve(SCRIPT_DIR, "..");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "docai-http-conformance-boundary-"));
const ISOLATED_DIR = path.join(TEMP_ROOT, "docai-http");

try {
  fs.mkdirSync(path.join(ISOLATED_DIR, "tools"), { recursive: true });
  fs.mkdirSync(path.join(ISOLATED_DIR, "fixtures", "conformance"), { recursive: true });
  fs.copyFileSync(path.join(DOCAI_HTTP_DIR, "README.md"), path.join(ISOLATED_DIR, "README.md"));
  fs.copyFileSync(
    path.join(DOCAI_HTTP_DIR, "tools", "check-conformance-fixtures.mjs"),
    path.join(ISOLATED_DIR, "tools", "check-conformance-fixtures.mjs"),
  );
  fs.cpSync(
    path.join(DOCAI_HTTP_DIR, "fixtures", "conformance", "v1.0.0"),
    path.join(ISOLATED_DIR, "fixtures", "conformance", "v1.0.0"),
    { recursive: true },
  );

  const result = spawnSync(process.execPath, ["docai-http/tools/check-conformance-fixtures.mjs"], {
    cwd: TEMP_ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);

  const isolatedOpenApi = path.join(
    ISOLATED_DIR,
    "fixtures",
    "conformance",
    "v1.0.0",
    "source",
    "complete-openapi.yaml",
  );
  const openapi = fs.readFileSync(isolatedOpenApi, "utf8");
  const mutatedOpenApi = openapi.replace(
    '$ref: "#/components/schemas/CartValidationResponse"',
    '$ref: "#/components/schemas/MissingCartValidationResponse"',
  );
  if (mutatedOpenApi === openapi) throw new Error("source-contract negative-test mutation did not apply");
  fs.writeFileSync(isolatedOpenApi, mutatedOpenApi);

  const negativeResult = spawnSync(process.execPath, ["docai-http/tools/check-conformance-fixtures.mjs"], {
    cwd: TEMP_ROOT,
    encoding: "utf8",
  });
  const negativeOutput = `${negativeResult.stdout ?? ""}\n${negativeResult.stderr ?? ""}`;
  if (negativeResult.status === 0 || !negativeOutput.includes("/carts/{id}/validate has no single block")) {
    process.stderr.write(negativeOutput);
    throw new Error("source-contract negative test did not fail for the removed cart response schema reference");
  }
  console.log("Stable conformance boundary check passed in an isolated tree.");
  console.log("Stable conformance source-contract negative test rejected a missing response schema reference.");
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
}
