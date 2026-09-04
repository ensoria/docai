import assert from "node:assert/strict";
import test from "node:test";

import { validateV3Plan } from "../check-openapi-comparison-v3-plan.mjs";

test("accepts the calibration draft without executable primary data", () => {
  assert.doesNotThrow(() => validateV3Plan(validPlan()));
});

test("accepts only the exact model-bound calibration plan when frozen validation is required", () => {
  const plan = frozenPlan();

  assert.doesNotThrow(() => validateV3Plan(plan, { requireFrozen: true }));

  const draft = validPlan();
  assert.throws(
    () => validateV3Plan(draft, { requireFrozen: true }),
    /status must be calibration-frozen/,
  );

  plan.targets[0].model_id = "gpt-5.6-sol-latest";
  assert.throws(
    () => validateV3Plan(plan, { requireFrozen: true }),
    /model_id must be gpt-5\.6-sol/,
  );

  const unsealed = frozenPlan();
  delete unsealed.freeze.artifact_set_sha256;
  assert.throws(
    () => validateV3Plan(unsealed, { requireFrozen: true }),
    /artifact_set_sha256 must be a SHA-256 digest/,
  );
});

test("rejects a missing v2 diagnostic closure document", () => {
  assert.throws(
    () => validateV3Plan(validPlan(), { closureDocumentExists: false }),
    /V2-DIAGNOSTIC-CLOSURE\.md is required/,
  );
});

test("rejects a benchmark identity outside v3", () => {
  const plan = validPlan();
  plan.benchmark_id = "docai-http-openapi-comparison-v2";

  assert.throws(() => validateV3Plan(plan), /unexpected benchmark_id/);
});

test("rejects a calibration request count other than 24", () => {
  const plan = validPlan();
  plan.calibration.planned_requests = 23;

  assert.throws(
    () => validateV3Plan(plan),
    /planned_requests must be 24/,
  );
});

test("rejects calibration gate thresholds other than 23 automated decisions and 1 exceptional run", () => {
  const plan = validPlan();
  plan.calibration.gate.minimum_automated_decisions = 22;
  plan.calibration.gate.maximum_exceptional_runs = 2;

  assert.throws(
    () => validateV3Plan(plan),
    /minimum_automated_decisions must be 23[\s\S]*maximum_exceptional_runs must be 1/,
  );
});

test("rejects primary schedule, run identity, and approval data in a calibration plan", () => {
  [
    ["schedule_rows", [{ run_id: "primary-run-1" }]],
    ["run_ids", ["primary-run-1"]],
    ["approval_state", "approved"],
  ].forEach(([key, value]) => {
    const plan = validPlan();
    plan.future_primary_design[key] = value;

    assert.throws(() => validateV3Plan(plan), new RegExp(`unknown key ${key}`));
  });
});

test("rejects a primary_schedule key in future primary design metadata", () => {
  const plan = validPlan();
  plan.future_primary_design.primary_schedule = [];

  assert.throws(
    () => validateV3Plan(plan),
    /unknown key primary_schedule/,
  );
});

test("rejects a primary_run_identity key in future primary design metadata", () => {
  const plan = validPlan();
  plan.future_primary_design.primary_run_identity = "primary-run-1";

  assert.throws(
    () => validateV3Plan(plan),
    /unknown key primary_run_identity/,
  );
});

function validPlan() {
  return {
    benchmark_id: "docai-http-openapi-comparison-v3",
    plan_version: "3.0.0-calibration.1",
    status: "calibration-draft",
    conditions: [
      "openapi-raw",
      "openapi-sliced",
      "openapi-enriched",
      "docai-selected",
    ],
    targets: [
      { id: "openai-frontier", provider: "openai", model_id: null },
      { id: "anthropic-balanced", provider: "anthropic", model_id: null },
      { id: "google-stable-agentic", provider: "google", model_id: null },
    ],
    calibration: {
      api_id: "complete-commerce",
      task_ids: ["upload-document-request", "complete-checkout-workflow"],
      repetitions: [1],
      planned_requests: 24,
      maximum_attempts_per_work_step: 100,
      gate: {
        minimum_automated_decisions: 23,
        maximum_exceptional_runs: 1,
      },
    },
    future_primary_design: {
      api_count: 3,
      tasks_per_api: 6,
      target_count: 3,
      repetitions: 3,
      condition_count: 4,
      planned_requests: 648,
      batch_count: 9,
      requests_per_batch: 72,
    },
  };
}

function frozenPlan() {
  const plan = validPlan();
  plan.status = "calibration-frozen";
  plan.targets[0].model_id = "gpt-5.6-sol";
  plan.targets[1].model_id = "claude-sonnet-5";
  plan.targets[2].model_id = "gemini-3.7-flash";
  plan.freeze = {
    manifest: "freeze-manifest.json",
    frozen_at: "2026-09-03T00:00:00Z",
    artifact_set_sha256: "a".repeat(64),
    required_artifact_classes: [
      "authoritative-sources",
      "docai-contexts",
      "tasks-and-expected-outcomes",
      "contracts-and-prompts",
      "parser-and-graders",
      "context-builders",
      "provider-adapters-and-runner",
      "calibration-schedule-and-gate",
      "model-resolutions",
      "cost-estimate",
      "imported-v2-dependencies",
    ],
  };
  return plan;
}
