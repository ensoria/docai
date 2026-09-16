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
    /3\.0\.0-calibration\.2 is frozen but requires separate, explicit Live approval/,
  );
  assert.match(
    result.stdout,
    /A passing general readiness check is not authorization for Live execution/,
  );
});

test("calibration 2 operator handoff stops at readiness pending separate Live approval", () => {
  const runbook = fs.readFileSync(RUNBOOK, "utf8");
  const todo = fs.readFileSync(TODO, "utf8");
  const commands = [
    `node ${CALIBRATION_2_PLAN_CHECK} --frozen`,
    `node ${CALIBRATION_2_ROOT}/runtime/freeze.mjs --check`,
    `node ${CALIBRATION_2_ROOT}/runtime/check-parity.mjs`,
    `node ${CALIBRATION_2_ROOT}/runtime/run-calibration.mjs --dry-run`,
    `DOCAI_LIVE_LLM_APPROVED_CALIBRATION=3.0.0-calibration.2 \\\n  node ${CALIBRATION_2_ROOT}/runtime/run-calibration.mjs --execute`,
    `node ${CALIBRATION_2_ROOT}/runtime/check-runs.mjs`,
    `node ${CALIBRATION_2_ROOT}/runtime/check-gate.mjs`,
    `node ${CALIBRATION_2_ROOT}/runtime/check-adjudication.mjs`,
    `node ${CALIBRATION_2_ROOT}/runtime/check-adjudication.mjs --require-complete`,
  ];

  commands.forEach((command) => assert.ok(runbook.includes(command), `runbook is missing command: ${command}`));
  assert.match(runbook, /buildBlindedAdjudicationPacket/);
  assert.match(runbook, /writeBlindedAdjudicationPacket/);
  assert.match(runbook, /node --input-type=module <<'NODE'/);
  assert.match(runbook, /public plan and freeze checks validate the three exact models/i);
  assert.match(runbook, /dry run reports the plan identity, 24-request\s+ceiling, 100-attempt\s+ceiling/i);
  assert.match(runbook, /3\.0\.0-calibration\.1[\s\S]*Execution blocked/);
  assert.match(runbook, /3\.0\.0-calibration\.2 is frozen[\s\S]*separate, explicit Live approval/);
  assert.match(runbook, /passing general readiness check is not authorization for Live execution/i);

  assert.match(todo, /- \[x\] Supersede `3\.0\.0-calibration\.1`/);
  assert.match(todo, /- \[x\] Freeze `3\.0\.0-calibration\.2`/);
  assert.match(todo, /- \[x\] Add frozen `3\.0\.0-calibration\.2` plan, public freeze, and parity checks/);
  assert.match(todo, /- \[ \] Execute `3\.0\.0-calibration\.2` Live/);
  assert.match(todo, /- \[ \] Record the verified `3\.0\.0-calibration\.2` gate result/);
  assert.match(todo, /- \[ \] Record any conditional `3\.0\.0-calibration\.2` adjudication result/);
  assert.match(todo, /- \[ \] Design and freeze `3\.0\.0-frozen\.1`/);
  for (let batch = 1; batch <= 9; batch += 1) {
    assert.match(todo, new RegExp("- \\[ \\] Execute primary batch `b" + String(batch).padStart(2, "0") + "`"));
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
