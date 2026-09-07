import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CHECKS } from "../check-release-readiness.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const READINESS_SCRIPT = path.join(REPOSITORY_ROOT, "docai-http", "tools", "check-release-readiness.mjs");

test("release readiness runs frozen v3 checks without requiring private responses", () => {
  assert.deepEqual(
    CHECKS.filter(([name]) => name.includes("openapi-comparison-v3")),
    [
      ["check-openapi-comparison-v3-plan", "docai-http/tools/check-openapi-comparison-v3-plan.mjs", ["--frozen"]],
      ["freeze-openapi-comparison-v3", "docai-http/tools/freeze-openapi-comparison-v3.mjs", ["--check"]],
      ["check-openapi-comparison-v3-parity", "docai-http/tools/check-openapi-comparison-v3-parity.mjs"],
    ],
  );

  const result = spawnSync(process.execPath, [READINESS_SCRIPT], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /== check-openapi-comparison-v3-plan ==/);
  assert.match(result.stdout, /== freeze-openapi-comparison-v3 ==/);
  assert.match(result.stdout, /== check-openapi-comparison-v3-parity ==/);
  assert.doesNotMatch(result.stdout, /private-required/);
  assert.match(
    result.stdout,
    /3\.0\.0-calibration\.1 remains blocked from Live execution/,
  );
});
