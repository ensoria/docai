#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  PRIMARY_PROMPTS_FILE,
  readPromptRecords,
} from "./openapi-comparison-v2-prompt.mjs";
import {
  BENCHMARK_DIR,
  readV2Plan,
} from "./openapi-comparison-v2-utils.mjs";
import {
  FileRunStore,
} from "./openapi-comparison-v2-runner.mjs";
import {
  validateFrozenArtifacts,
  validateFrozenBenchmarkOutputs,
} from "./freeze-openapi-comparison-v2.mjs";

const REPOSITORY_ROOT = path.resolve(BENCHMARK_DIR, "..", "..", "..", "..");
const PRIVATE_RUNS_DIR = path.join(BENCHMARK_DIR, "private", "runs");
const MANIFEST_FILE = path.join(BENCHMARK_DIR, "freeze-manifest.json");
const VALID_ATTEMPT_STATUSES = new Set([
  "response",
  "transport_error",
  "provider_error",
  "runner_error",
]);
const VALID_RUN_STATUSES = new Set([
  "pass",
  "fail",
  "blocked",
  "malformed",
  "inconclusive",
]);

export function checkRunState({ plan, prompts, store }) {
  const failures = [];
  const batches = plan.execution.batches.map((batch) => {
    const expectedPrompts = prompts.filter((prompt) => prompt.batch_id === batch.id);
    const expectedRunIds = new Set(expectedPrompts.map((prompt) => prompt.run_id));
    const attempts = store.listAttempts(batch.id);
    const runs = store.listRuns(batch.id);
    const checkpoint = store.readCheckpoint(batch.id);
    const report = typeof store.readReport === "function" ? store.readReport(batch.id) : null;

    if (expectedPrompts.length !== batch.planned_requests) {
      failures.push(
        `${batch.id}: expected ${batch.planned_requests} prompts; found ${expectedPrompts.length}`,
      );
    }
    if (attempts.length > plan.execution.maximum_attempts_per_work_step) {
      failures.push(`${batch.id}: attempts exceed the 100-attempt work-step cap`);
    }

    const attemptsByRun = new Map();
    attempts.forEach((attempt) => {
      validateIdentity({ plan, batch, record: attempt, expectedRunIds, type: "attempt", failures });
      if (!VALID_ATTEMPT_STATUSES.has(attempt.status)) {
        failures.push(`${batch.id}: ${attempt.run_id} has invalid attempt status ${attempt.status}`);
      }
      validateRunnerRevision({ batch, record: attempt, type: "attempt", failures });
      validateAttemptTimestamps({ batch, attempt, failures });
      if (!attemptsByRun.has(attempt.run_id)) attemptsByRun.set(attempt.run_id, []);
      attemptsByRun.get(attempt.run_id).push(attempt);
    });
    attemptsByRun.forEach((runAttempts, runId) => {
      const numbers = runAttempts.map((attempt) => attempt.attempt_number).sort((a, b) => a - b);
      const expected = Array.from({ length: numbers.length }, (_, index) => index + 1);
      if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
        failures.push(`${batch.id}: ${runId} attempt numbers must be contiguous from 1`);
      }
      if (runAttempts.length > plan.retry_policy.maximum_transport_retries_per_run + 1) {
        failures.push(`${batch.id}: ${runId} exceeds the transport retry limit`);
      }
      if (runAttempts.length > 1 && runAttempts[0].status !== "transport_error") {
        failures.push(`${batch.id}: ${runId} retried after a usable provider response`);
      }
    });

    const seenRuns = new Set();
    runs.forEach((run) => {
      validateIdentity({ plan, batch, record: run, expectedRunIds, type: "run", failures });
      if (!VALID_RUN_STATUSES.has(run.status)) {
        failures.push(`${batch.id}: ${run.run_id} has invalid run status ${run.status}`);
      }
      validateRunnerRevision({ batch, record: run, type: "run", failures });
      if (seenRuns.has(run.run_id)) failures.push(`${batch.id}: duplicate run record ${run.run_id}`);
      seenRuns.add(run.run_id);
      if (!attemptsByRun.has(run.run_id)) {
        failures.push(`${batch.id}: run ${run.run_id} has no retained attempt`);
      }
    });

    if (checkpoint) {
      validateIdentity({
        plan,
        batch,
        record: checkpoint,
        expectedRunIds: null,
        type: "checkpoint",
        failures,
      });
      if (checkpoint.attempt_count !== attempts.length) {
        failures.push(`${batch.id}: checkpoint attempt_count does not match attempts log`);
      }
      const completedIds = [...seenRuns];
      if (!sameMembers(checkpoint.completed_run_ids ?? [], completedIds)) {
        failures.push(`${batch.id}: checkpoint completed_run_ids do not match runs log`);
      }
      if (checkpoint.status === "complete" && runs.length !== batch.planned_requests) {
        failures.push(
          `${batch.id}: complete checkpoint requires ${batch.planned_requests} run records`,
        );
      }
      if (!["open", "stopped", "complete"].includes(checkpoint.status)) {
        failures.push(`${batch.id}: invalid checkpoint status ${checkpoint.status}`);
      }
    } else if (attempts.length > 0 || runs.length > 0) {
      failures.push(`${batch.id}: logs exist without a checkpoint`);
    }
    validateReport({
      plan,
      batch,
      attempts,
      runs,
      checkpoint,
      report,
      failures,
    });

    return {
      batch_id: batch.id,
      status: checkpoint?.status ?? "pending",
      attempts: attempts.length,
      runs: runs.length,
      remaining: Math.max(0, batch.planned_requests - runs.length),
      stop_reason: checkpoint?.stop_reason ?? null,
    };
  });

  return {
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    failures,
    batches,
  };
}

function validateRunnerRevision({ batch, record, type, failures }) {
  if (typeof record.runner_revision !== "string" || record.runner_revision.trim() === "") {
    failures.push(`${batch.id}: ${type} ${record.run_id} runner_revision is required`);
  }
}

function validateAttemptTimestamps({ batch, attempt, failures }) {
  const started = Date.parse(attempt.started_at);
  const completed = Date.parse(attempt.completed_at);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) {
    failures.push(`${batch.id}: attempt ${attempt.run_id} requires valid timestamps`);
  } else if (completed < started) {
    failures.push(`${batch.id}: attempt ${attempt.run_id} completed before it started`);
  }
}

function validateReport({
  plan,
  batch,
  attempts,
  runs,
  checkpoint,
  report,
  failures,
}) {
  const hasState = attempts.length > 0 || runs.length > 0 || checkpoint !== null;
  if (!report) {
    if (hasState) failures.push(`${batch.id}: run state exists without a batch report`);
    return;
  }
  validateIdentity({
    plan,
    batch,
    record: report,
    expectedRunIds: null,
    type: "report",
    failures,
  });
  if (report.counts?.attempted !== attempts.length) {
    failures.push(`${batch.id}: report attempt count does not match attempts log`);
  }
  if (report.counts?.completed !== runs.length) {
    failures.push(`${batch.id}: report completed count does not match runs log`);
  }
  if (report.status !== (checkpoint?.status ?? "pending")) {
    failures.push(`${batch.id}: report status does not match checkpoint`);
  }
  const revisions = [...new Set(
    [...attempts, ...runs].map((record) => record.runner_revision).filter(Boolean),
  )].sort();
  if (!sameMembers(report.runner_revisions ?? [], revisions)) {
    failures.push(`${batch.id}: report runner_revisions do not match retained records`);
  }
}

function validateIdentity({
  plan,
  batch,
  record,
  expectedRunIds,
  type,
  failures,
}) {
  if (record.benchmark_id !== plan.benchmark_id) {
    failures.push(`${batch.id}: ${type} benchmark_id does not match frozen plan`);
  }
  if (record.plan_version !== plan.plan_version) {
    failures.push(`${batch.id}: ${type} plan_version does not match frozen plan`);
  }
  if (record.batch_id !== batch.id) {
    failures.push(`${batch.id}: ${type} batch_id mismatch`);
  }
  if (expectedRunIds && !expectedRunIds.has(record.run_id)) {
    failures.push(`${batch.id}: ${type} has unknown run_id ${record.run_id}`);
  }
}

function sameMembers(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function runCli() {
  const plan = readV2Plan();
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  validateFrozenBenchmarkOutputs({ plan });
  validateFrozenArtifacts({ plan, manifest, rootDir: REPOSITORY_ROOT });
  const prompts = readPromptRecords(PRIMARY_PROMPTS_FILE);
  const store = new FileRunStore(path.join(PRIVATE_RUNS_DIR, plan.plan_version));
  const result = checkRunState({ plan, prompts, store });

  console.log(`OpenAPI comparison v2 run check for ${plan.plan_version}`);
  console.log("");
  console.log("| Batch | Status | Attempts | Runs | Remaining | Stop reason |");
  console.log("|---|---|---:|---:|---:|---|");
  result.batches.forEach((batch) => {
    console.log(
      `| ${batch.batch_id} | ${batch.status} | ${batch.attempts} | `
      + `${batch.runs} | ${batch.remaining} | ${batch.stop_reason ?? ""} |`,
    );
  });

  if (result.failures.length > 0) {
    console.error("Run checker failed:");
    result.failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log("\nRun checker passed.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
