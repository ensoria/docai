import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CHECKS } from "../check-release-readiness.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const READINESS_SCRIPT = path.join(REPOSITORY_ROOT, "docai-http", "tools", "check-release-readiness.mjs");
const RUNBOOK = path.join(REPOSITORY_ROOT, "docai-http", "OPENAPI-COMPARISON-V3-CALIBRATION-RUNBOOK.md");
const TODO = path.join(REPOSITORY_ROOT, "docai-http", "TODO-post-v1.0.0.md");
const CALIBRATION_2_ROOT = "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2";
const CALIBRATION_2_PLAN_CHECK = "docai-http/tools/check-openapi-comparison-v3-calibration2-plan.mjs";
const CALIBRATION_3_ROOT = "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3";

test("release readiness runs frozen v3 checks without requiring private responses", () => {
  assert.deepEqual(
    CHECKS.filter(([name]) => name.includes("openapi-comparison-v3")),
    [
      ["check-openapi-comparison-v3-plan", "docai-http/tools/check-openapi-comparison-v3-plan.mjs", ["--frozen"]],
      ["freeze-openapi-comparison-v3", "docai-http/tools/freeze-openapi-comparison-v3.mjs", ["--check"]],
      ["check-openapi-comparison-v3-parity", "docai-http/tools/check-openapi-comparison-v3-parity.mjs"],
      ["check-openapi-comparison-v3-calibration2-plan", CALIBRATION_2_PLAN_CHECK, ["--frozen"]],
      ["freeze-openapi-comparison-v3-calibration2", `${CALIBRATION_2_ROOT}/runtime/freeze.mjs`, ["--check"]],
      ["check-openapi-comparison-v3-calibration2-parity", `${CALIBRATION_2_ROOT}/runtime/check-parity.mjs`],
      ["check-openapi-comparison-v3-calibration3-plan", `${CALIBRATION_3_ROOT}/runtime/check-plan.mjs`, ["--frozen"]],
      ["freeze-openapi-comparison-v3-calibration3", `${CALIBRATION_3_ROOT}/runtime/freeze.mjs`, ["--check"]],
      ["check-openapi-comparison-v3-calibration3-parity", `${CALIBRATION_3_ROOT}/runtime/check-parity.mjs`],
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
  assert.match(result.stdout, /== check-openapi-comparison-v3-calibration2-plan ==/);
  assert.match(result.stdout, /== freeze-openapi-comparison-v3-calibration2 ==/);
  assert.match(result.stdout, /== check-openapi-comparison-v3-calibration2-parity ==/);
  assert.doesNotMatch(result.stdout, /private-required/);
  assert.match(
    result.stdout,
    /3\.0\.0-calibration\.1 remains blocked from Live execution/,
  );
  assert.match(
    result.stdout,
    /3\.0\.0-calibration\.2 remains blocked from Live execution/,
  );
  assert.match(
    result.stdout,
    /A passing general readiness check is not authorization for Live execution/,
  );
  assert.match(result.stdout, /3\.0\.0-calibration\.3 is frozen but requires separate, explicit Live approval/);
});

test("calibration 3 handoff contains executable checks and leaves Live work pending", () => {
  const runbook = fs.readFileSync(RUNBOOK, "utf8");
  const todo = fs.readFileSync(TODO, "utf8");
  for (const command of ["check-plan.mjs --frozen", "freeze.mjs --check", "check-parity.mjs", "run-calibration.mjs --dry-run", "run-calibration.mjs --execute", "check-runs.mjs", "check-gate.mjs", "check-adjudication.mjs --require-complete"]) {
    assert.ok(runbook.includes(`node ${CALIBRATION_3_ROOT}/runtime/${command}`), command);
  }
  assert.ok(runbook.includes("DOCAI_LIVE_LLM_APPROVED_CALIBRATION=3.0.0-calibration.3"));
  assert.match(runbook, /3\.0\.0-calibration\.3`? is frozen[\s\S]*separate, explicit Live approval/);
  assert.match(todo, /- \[ \] Execute `3\.0\.0-calibration\.3` Live/);
  assert.match(todo, /- \[ \] Record the verified `3\.0\.0-calibration\.3` gate result/);
});

test("historical calibrations remain blocked and future execution stays pending", () => {
  const runbook = fs.readFileSync(RUNBOOK, "utf8");
  const todo = fs.readFileSync(TODO, "utf8");
  assert.match(runbook, /Execution blocked:[\s\S]*3\.0\.0-calibration\.1/);
  assert.match(runbook, /Execution blocked:[\s\S]*3\.0\.0-calibration\.2/);
  assert.match(runbook, /passing general readiness check is not authorization for Live execution/i);
  assert.match(runbook, /buildBlindedAdjudicationPacket/);
  assert.match(runbook, /writeBlindedAdjudicationPacket/);
  assert.ok(runbook.includes("node --input-type=module <<\'NODE\'"));
  assert.match(todo, /- \[x\] Supersede `3\.0\.0-calibration\.1`/);
  assert.match(todo, /- \[x\] Freeze `3\.0\.0-calibration\.2`/);
  assert.match(todo, /- \[ \] Execute `3\.0\.0-calibration\.2` Live/);
  assert.match(todo, /- \[ \] Record the verified `3\.0\.0-calibration\.2` gate result/);
  assert.match(todo, /- \[ \] Design and freeze `3\.0\.0-frozen\.1`/);
  for (let batch = 1; batch <= 9; batch += 1) {
    assert.ok(todo.includes("- [ ] Execute primary batch `b" + String(batch).padStart(2, "0") + "`"));
  }
});

test("calibration 2 plan checker is an executable closed CLI", () => {
  const valid = spawnSync(process.execPath, [CALIBRATION_2_PLAN_CHECK, "--frozen"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /calibration\.2 frozen plan check passed/);

  const invalid = spawnSync(process.execPath, [CALIBRATION_2_PLAN_CHECK, "--definitely-invalid"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Usage:/);
});
