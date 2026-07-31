#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  validateFrozenArtifacts,
  validateFrozenBenchmarkOutputs,
} from "./freeze-openapi-comparison-v2.mjs";
import { buildPrimarySchedule } from "./openapi-comparison-v2-utils.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARK_DIR = path.resolve(SCRIPT_DIR, "..", "benchmarks", "openapi-comparison", "v2");
const REPOSITORY_ROOT = path.resolve(BENCHMARK_DIR, "..", "..", "..", "..");
const PLAN_FILE = path.join(BENCHMARK_DIR, "plan.json");
const PLAN_DOC = path.join(BENCHMARK_DIR, "PLAN.md");
const requireFrozen = process.argv.includes("--frozen");
const failures = [];

function fail(area, message) {
  failures.push(`${area}: ${message}`);
}

function assert(condition, area, message) {
  if (!condition) fail(area, message);
}

let plan;
try {
  plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
} catch (error) {
  fail("plan", `cannot read plan.json: ${error.message}`);
}

if (plan) validatePlan(plan);

if (!fs.existsSync(PLAN_DOC)) fail("plan", "PLAN.md is required");

if (failures.length > 0) {
  console.error("OpenAPI comparison v2 plan check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const qualifier = requireFrozen ? "frozen" : plan.status;
console.log(`OpenAPI comparison v2 ${qualifier} plan check passed for ${path.relative(process.cwd(), BENCHMARK_DIR)}`);
if (!requireFrozen && plan.status !== "frozen") {
  console.log("Live execution remains locked until the --frozen check passes.");
}

function validatePlan(candidate) {
  assert(candidate.benchmark_id === "docai-http-openapi-comparison-v2", "identity", "unexpected benchmark_id");
  assert(/^2\.0\.0-(draft|frozen)\.\d+$/.test(candidate.plan_version), "identity", "plan_version must identify a v2 draft or frozen revision");
  assert(["pre-registration-draft", "frozen"].includes(candidate.status), "identity", "status must be pre-registration-draft or frozen");
  assert(candidate.created_on === "2026-07-21", "identity", "created_on must retain the original preregistration date");

  const conditions = candidate.conditions ?? [];
  assertSameMembers(conditions, ["openapi-raw", "openapi-sliced", "openapi-enriched", "docai-selected"], "conditions");
  assert(candidate.claims?.raw_size_headline_allowed === false, "claims", "raw OpenAPI size headlines must be disabled");
  assert(candidate.outcomes?.primary?.[0] === "automated_task_pass", "outcomes", "automated task pass must be the first primary outcome");
  assert(candidate.outcomes?.primary?.[1] === "provider_input_tokens", "outcomes", "provider input tokens must be the second primary outcome");

  const apis = candidate.apis ?? [];
  assert(apis.length === 3, "matrix", "exactly three APIs are required");
  assert(new Set(apis.map((api) => api.id)).size === 3, "matrix", "API ids must be unique");
  assert(apis.filter((api) => api.kind === "holdout" && api.private_until_run_close).length === 2, "matrix", "exactly two private holdout APIs are required");
  apis.forEach((api) => {
    assert(api.docai_http === "1.0.0", `api:${api.id}`, "DocAI context must use Stable 1.0.0");
    assert(Array.isArray(api.tasks) && api.tasks.length === 6, `api:${api.id}`, "exactly six tasks are required");
    assert(new Set(api.tasks).size === 6, `api:${api.id}`, "task ids must be unique within the API");
  });

  const targets = candidate.targets ?? [];
  assert(targets.length === 3, "matrix", "exactly three targets are required");
  assertSameMembers(targets.map((target) => target.provider), ["openai", "anthropic", "google"], "targets");
  targets.forEach((target) => {
    assert(Boolean(target.id), "targets", "every target requires an id");
    assert(Boolean(target.planned_model), `target:${target.id}`, "planned_model is required");
    assert(target.catalog_verification_required === true, `target:${target.id}`, "official catalog verification must be required");
  });

  assertSameMembers(candidate.repetitions ?? [], [1, 2, 3], "repetitions");
  validateExecution(candidate, apis, targets, conditions);
  validatePolicies(candidate);
  validateFreeze(candidate);
}

function validateExecution(candidate, apis, targets, conditions) {
  const execution = candidate.execution ?? {};
  const calculatedTotal = apis.reduce((sum, api) => sum + api.tasks.length, 0)
    * targets.length
    * (candidate.repetitions?.length ?? 0)
    * conditions.length;
  assert(calculatedTotal === 648, "execution", `matrix calculates ${calculatedTotal} requests instead of 648`);
  assert(execution.planned_primary_requests === calculatedTotal, "execution", "planned_primary_requests must match the matrix");
  assert(execution.planned_requests_per_batch === 72, "execution", "each batch must plan 72 requests");
  assert(execution.maximum_attempts_per_work_step === 100, "execution", "work-step hard cap must be 100 attempts");
  assert(execution.one_batch_per_work_step === true, "execution", "only one batch may run in a work step");
  assert(execution.approval_required_after_each_batch === true, "execution", "each batch boundary must require approval");

  const batches = execution.batches ?? [];
  assert(batches.length === 9, "execution", "exactly nine batches are required");
  assert(new Set(batches.map((batch) => batch.id)).size === batches.length, "execution", "batch ids must be unique");
  assert(batches.every((batch) => batch.planned_requests === 72), "execution", "every batch must contain 72 planned requests");

  const expectedPairs = new Set();
  apis.forEach((api) => candidate.repetitions.forEach((repetition) => expectedPairs.add(`${api.id}__${repetition}`)));
  batches.forEach((batch) => {
    const key = `${batch.api}__${batch.repetition}`;
    assert(expectedPairs.delete(key), `batch:${batch.id}`, `unexpected or duplicate API/repetition pair ${key}`);
  });
  assert(expectedPairs.size === 0, "execution", `missing API/repetition batches: ${[...expectedPairs].join(", ")}`);
  assert(batches.reduce((sum, batch) => sum + batch.planned_requests, 0) === 648, "execution", "batch request sum must be 648");

  const schedule = buildPrimarySchedule(candidate);
  assert(schedule.length === 648, "schedule", `generated schedule has ${schedule.length} rows instead of 648`);
  assert(new Set(schedule.map((row) => row.run_id)).size === 648, "schedule", "generated run IDs must be unique");
  assert(schedule.every((row, index) => row.primary_ordinal === index + 1), "schedule", "primary ordinals must be contiguous");
  batches.forEach((batch) => {
    const rows = schedule.filter((row) => row.batch_id === batch.id);
    assert(rows.length === 72, `schedule:${batch.id}`, `generated batch has ${rows.length} rows instead of 72`);
    assert(new Set(rows.map((row) => `${row.target_id}__${row.task_id}__${row.condition}`)).size === 72, `schedule:${batch.id}`, "paired identities must be unique");
    assertSameMembers([...new Set(rows.map((row) => row.condition))], conditions, `schedule:${batch.id}:conditions`);
  });
}

function validatePolicies(candidate) {
  const retry = candidate.retry_policy ?? {};
  assert(retry.maximum_transport_retries_per_run === 1, "retry", "at most one transport retry is allowed");
  assert(retry.retry_only_before_usable_provider_response === true, "retry", "retry must be limited to pre-response transport failures");
  assert(retry.content_or_grader_failure_retry === false, "retry", "content and grader failures must not be retried");
  assert(retry.all_attempts_count_toward_step_cap === true, "retry", "all attempts must count toward the cap");
  assert(retry.retain_all_attempts === true, "retry", "all attempts must be retained");

  assert(candidate.exclusion_policy?.silent_exclusion_allowed === false, "exclusion", "silent exclusions must be prohibited");
  assertSameMembers(candidate.exclusion_policy?.statuses ?? [], ["pass", "fail", "blocked", "malformed", "inconclusive"], "statuses");
  assert(candidate.analysis?.pairing_unit?.join("/") === "api/task/target/repetition", "analysis", "unexpected pairing unit");
  assert(candidate.analysis?.bootstrap_resamples === 10000, "analysis", "bootstrap resamples must remain frozen at 10000");
  assert(candidate.analysis?.bootstrap_seed === 20260721, "analysis", "bootstrap seed must remain frozen");
  assert(candidate.analysis?.familywise_correction === "holm", "analysis", "Holm correction is required");
  assert(candidate.analysis?.cross_provider_cost_pooling === false, "analysis", "cross-provider costs must not be pooled");
  assert(candidate.ablation?.included_in_primary_648 === false, "ablation", "ablation must remain outside the primary matrix");
  assert(candidate.ablation?.separate_approval_required === true, "ablation", "ablation requires separate approval");
  assert(candidate.ablation?.maximum_attempts_per_work_step === 100, "ablation", "ablation step cap must be 100");
}

function validateFreeze(candidate) {
  const freeze = candidate.freeze ?? {};
  assert(freeze.manifest === "freeze-manifest.json", "freeze", "freeze manifest path must be freeze-manifest.json");
  assert((freeze.required_artifact_classes ?? []).length >= 8, "freeze", "all artifact classes must be listed before freezing");

  if (!requireFrozen) return;
  assert(candidate.status === "frozen", "freeze", "plan status must be frozen before Live LLM execution");
  assert(/^2\.0\.0-frozen\.\d+$/.test(candidate.plan_version), "freeze", "frozen plan_version is required");
  assert(Boolean(freeze.frozen_at) && !Number.isNaN(Date.parse(freeze.frozen_at)), "freeze", "frozen_at must be an ISO-compatible timestamp");

  const manifestFile = path.join(BENCHMARK_DIR, freeze.manifest ?? "freeze-manifest.json");
  assert(fs.existsSync(manifestFile), "freeze", "freeze-manifest.json is required");
  if (!fs.existsSync(manifestFile)) return;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    assert(manifest.benchmark_id === candidate.benchmark_id, "freeze", "manifest benchmark_id must match plan");
    assert(manifest.plan_version === candidate.plan_version, "freeze", "manifest plan_version must match plan");
    assert(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0, "freeze", "manifest artifacts are required");
    const classes = new Set((manifest.artifacts ?? []).map((artifact) => artifact.class));
    freeze.required_artifact_classes.forEach((artifactClass) => {
      assert(classes.has(artifactClass), "freeze", `manifest lacks artifact class ${artifactClass}`);
    });
    (manifest.artifacts ?? []).forEach((artifact) => {
      assert(/^[a-f0-9]{64}$/.test(artifact.sha256 ?? ""), "freeze", `artifact ${artifact.path ?? "<unknown>"} lacks SHA-256`);
    });
    validateFrozenArtifacts({
      plan: candidate,
      manifest,
      rootDir: REPOSITORY_ROOT,
    });
    validateFrozenBenchmarkOutputs({
      plan: candidate,
      benchmarkDir: BENCHMARK_DIR,
    });
  } catch (error) {
    fail("freeze", `cannot validate freeze manifest: ${error.message}`);
  }
}

function assertSameMembers(actual, expected, area) {
  const actualValues = [...actual].sort();
  const expectedValues = [...expected].sort();
  assert(JSON.stringify(actualValues) === JSON.stringify(expectedValues), area, `expected ${expectedValues.join(", ")}; found ${actualValues.join(", ")}`);
}
