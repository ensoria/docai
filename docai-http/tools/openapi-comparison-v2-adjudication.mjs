#!/usr/bin/env node

import crypto from "node:crypto";
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
import { readApiTaskPacket } from "./openapi-comparison-v2-context.mjs";
import { FileRunStore } from "./openapi-comparison-v2-runner.mjs";

const PRIVATE_DIR = path.join(BENCHMARK_DIR, "private");
const PRIVATE_RUNS_DIR = path.join(PRIVATE_DIR, "runs");
const ADJUDICATION_DIR = path.join(PRIVATE_DIR, "adjudication");
const ALLOWED_DECISIONS = new Set(["pending", "correct", "incorrect", "unresolvable"]);
const REVIEW_SEED = "20260721";

export function buildAdjudicationArtifacts({
  plan,
  batchId,
  prompts,
  runs,
  attempts,
  taskForPrompt,
}) {
  if (plan?.analysis?.manual_adjudication !== "blinded-inconclusive-only") {
    throw new Error("plan must require blinded inconclusive-only adjudication");
  }
  const promptByRun = uniqueMap(prompts, "run_id", "prompt");
  const attemptByRun = uniqueMap(
    attempts.filter((attempt) => attempt.status === "response"),
    "run_id",
    "provider response",
  );
  const sensitiveStrings = reviewerSensitiveStrings(plan, prompts);
  const selected = runs
    .filter((run) => run.batch_id === batchId && run.status === "inconclusive")
    .map((run) => {
      if (run.manual_review_required !== true) {
        throw new Error(`inconclusive run ${run.run_id} must require manual review`);
      }
      const prompt = promptByRun.get(run.run_id);
      const attempt = attemptByRun.get(run.run_id);
      if (!prompt || prompt.batch_id !== batchId) {
        throw new Error(`missing batch prompt for ${run.run_id}`);
      }
      if (!attempt?.response?.content_json) {
        throw new Error(`missing parsed provider response for ${run.run_id}`);
      }
      const task = taskForPrompt(prompt);
      const reviewId = reviewIdFor(plan, batchId, run.run_id);
      return {
        order_key: sha256(`${REVIEW_SEED}\0order\0${reviewId}`),
        review_case: sanitizeReviewerValue({
          review_id: reviewId,
          task_id: task.id,
          user_task: task.public.user_task,
          output_contract: task.public.output_contract,
          expected_assertions: task.private.assertions,
          automatic_grader: {
            reasons: run.reasons,
            failure_categories: run.failure_categories,
          },
          model_output: attempt.response.content_json,
        }, sensitiveStrings),
        mapping: {
          review_id: reviewId,
          run_id: run.run_id,
          api_id: run.api_id,
          task_id: run.task_id,
          condition: prompt.condition,
          provider: run.provider,
          target_id: run.target_id,
          requested_model: run.requested_model,
          resolved_model: run.resolved_model,
        },
      };
    })
    .sort((left, right) => left.order_key.localeCompare(right.order_key));

  const cases = selected.map((entry) => entry.review_case);
  const packet = {
    packet_version: "1",
    plan_version: plan.plan_version,
    batch_id: batchId,
    review_method: "single-reviewer-condition-provider-model-blinded",
    evidence_role: "secondary-adjudication-does-not-replace-automatic-primary",
    case_count: cases.length,
    cases,
  };
  const mapping = {
    mapping_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: batchId,
    warning: "Do not provide this file to the reviewer before decisions are final.",
    entries: selected.map((entry) => entry.mapping),
  };
  const decisions = cases.map(({ review_id: reviewId }) => ({
    review_id: reviewId,
    decision: "pending",
    rationale: "",
  }));
  const sheet = renderReviewSheet(packet);
  assertReviewerArtifactsAreBlinded({ packet, sheet, sensitiveStrings });
  return { packet, mapping, decisions, sheet };
}

export function checkAdjudicationArtifacts({
  expected,
  packet,
  mapping,
  decisions,
  sheet,
  requireComplete = false,
}) {
  const failures = [];
  const expectedArtifacts = expected ?? { packet, mapping, sheet };
  if (!sameJson(packet, expectedArtifacts.packet)) {
    failures.push("review packet does not match regenerated source records");
  }
  if (!sameJson(mapping, expectedArtifacts.mapping)) {
    failures.push("review mapping does not match regenerated source records");
  }
  if (sheet !== expectedArtifacts.sheet) {
    failures.push("review sheet does not match regenerated packet");
  }

  const expectedIds = expectedArtifacts.packet?.cases?.map((entry) => entry.review_id) ?? [];
  const decisionIds = decisions.map((entry) => entry.review_id);
  if (new Set(decisionIds).size !== decisionIds.length) {
    failures.push("decision review IDs must be unique");
  }
  if (!sameMembers(expectedIds, decisionIds)) {
    failures.push("decision review IDs do not match packet cases");
  }

  const summary = { pending: 0, correct: 0, incorrect: 0, unresolvable: 0 };
  decisions.forEach((entry) => {
    if (!ALLOWED_DECISIONS.has(entry.decision)) {
      failures.push(`${entry.review_id}: invalid decision ${entry.decision}`);
      return;
    }
    summary[entry.decision] += 1;
    if (typeof entry.rationale !== "string") {
      failures.push(`${entry.review_id}: rationale must be a string`);
    } else if (entry.decision !== "pending" && entry.rationale.trim() === "") {
      failures.push(`${entry.review_id}: completed decision requires a rationale`);
    }
    if (requireComplete && entry.decision === "pending") {
      failures.push(`${entry.review_id}: pending decision is not allowed`);
    }
  });

  return {
    failures,
    summary: { total: decisions.length, ...summary },
  };
}

export function writeAdjudicationArtifacts({ directory, artifacts }) {
  fs.mkdirSync(directory, { recursive: true });
  writeJson(path.join(directory, "review-packet.json"), artifacts.packet);
  writeJson(path.join(directory, "DO-NOT-SHARE-review-map.json"), artifacts.mapping);
  fs.writeFileSync(path.join(directory, "review-sheet.md"), artifacts.sheet);
  const decisionsFile = path.join(directory, "decisions.jsonl");
  const decisionsCreated = !fs.existsSync(decisionsFile);
  if (decisionsCreated) writeJsonLines(decisionsFile, artifacts.decisions);
  return { directory, decisions_created: decisionsCreated };
}

export function adjudicationDirectory(planVersion, batchId) {
  if (!/^[A-Za-z0-9.-]+$/.test(planVersion) || !/^[a-z0-9-]+$/.test(batchId)) {
    throw new Error("invalid adjudication identity");
  }
  return path.join(ADJUDICATION_DIR, planVersion, batchId);
}

export function buildCurrentAdjudicationArtifacts(batchId) {
  const plan = readV2Plan();
  const prompts = readPromptRecords(PRIMARY_PROMPTS_FILE);
  const store = new FileRunStore(path.join(PRIVATE_RUNS_DIR, plan.plan_version));
  const checkpoint = store.readCheckpoint(batchId);
  const report = store.readReport(batchId);
  if (checkpoint?.status !== "complete") throw new Error(`${batchId} must be complete`);
  if (report?.review_gate?.required !== true) throw new Error(`${batchId} does not require review`);
  return {
    plan,
    artifacts: buildAdjudicationArtifacts({
      plan,
      batchId,
      prompts,
      runs: store.listRuns(batchId),
      attempts: store.listAttempts(batchId),
      taskForPrompt: buildTaskLookup(plan),
    }),
  };
}

export function readAdjudicationArtifacts(directory) {
  return {
    packet: readJson(path.join(directory, "review-packet.json")),
    mapping: readJson(path.join(directory, "DO-NOT-SHARE-review-map.json")),
    decisions: readJsonLines(path.join(directory, "decisions.jsonl")),
    sheet: fs.readFileSync(path.join(directory, "review-sheet.md"), "utf8"),
  };
}

function renderReviewSheet(packet) {
  const lines = [
    "# Blinded Manual Adjudication Sheet",
    "",
    `Plan: \`${packet.plan_version}\``,
    "",
    `Batch: \`${packet.batch_id}\``,
    "",
    `Cases: ${packet.case_count}`,
    "",
    "The automatic grader remains the primary result. This review is secondary and covers only inconclusive records.",
    "Do not open `DO-NOT-SHARE-review-map.json` until all decisions are final.",
    "Decision records are edited in `decisions.jsonl`.",
    "Use `correct`, `incorrect`, or `unresolvable`, and provide a concise rationale.",
    "",
  ];
  packet.cases.forEach((entry, index) => {
    lines.push(
      `## Case ${index + 1}: ${entry.review_id}`,
      "",
      `Task: ${entry.user_task}`,
      "",
      `Output contract: \`${entry.output_contract}\``,
      "",
      "Expected assertions:",
      "",
      "````json",
      JSON.stringify(entry.expected_assertions, null, 2),
      "````",
      "",
      "Model output:",
      "",
      "````json",
      JSON.stringify(entry.model_output, null, 2),
      "````",
      "",
      "Automatic grader:",
      "",
      "````json",
      JSON.stringify(entry.automatic_grader, null, 2),
      "````",
      "",
    );
  });
  return `${lines.join("\n")}\n`;
}

function reviewerSensitiveStrings(plan, prompts) {
  return [...new Set([
    ...plan.conditions,
    "OpenAPI",
    "DocAI HTTP",
    "DocAI",
    ...plan.targets.flatMap((target) => [
      target.id,
      target.provider,
      target.planned_model,
    ]),
    ...prompts.map((prompt) => prompt.run_id),
  ].filter(Boolean))].sort((left, right) => right.length - left.length);
}

function sanitizeReviewerValue(value, sensitiveStrings) {
  if (typeof value === "string") return redactReviewerString(value, sensitiveStrings);
  if (Array.isArray(value)) return value.map((entry) => sanitizeReviewerValue(entry, sensitiveStrings));
  if (isPlainObject(value)) {
    const result = {};
    Object.entries(value).forEach(([key, child]) => {
      const sanitizedKey = redactReviewerString(key, sensitiveStrings);
      if (Object.hasOwn(result, sanitizedKey)) {
        throw new Error(`reviewer redaction creates duplicate key ${sanitizedKey}`);
      }
      result[sanitizedKey] = sanitizeReviewerValue(child, sensitiveStrings);
    });
    return result;
  }
  return value;
}

function redactReviewerString(value, sensitiveStrings) {
  let result = value;
  sensitiveStrings.forEach((sensitive) => {
    const replacement = /openapi|docai/i.test(sensitive)
      ? "<documentation-format-redacted>"
      : "<provider-redacted>";
    result = result.replace(new RegExp(escapeRegExp(sensitive), "gi"), replacement);
  });
  return result;
}

function assertReviewerArtifactsAreBlinded({ packet, sheet, sensitiveStrings }) {
  const text = `${JSON.stringify(packet)}\n${sheet}`;
  sensitiveStrings.forEach((sensitive) => {
    if (new RegExp(escapeRegExp(sensitive), "i").test(text)) {
      throw new Error(`reviewer artifact leaks blinded value ${sensitive}`);
    }
  });
}

function buildTaskLookup(plan) {
  const tasks = new Map();
  plan.apis.forEach((api) => {
    const packet = readApiTaskPacket(api, plan);
    packet.tasks.forEach((task) => tasks.set(`${api.id}\0${task.id}`, task));
  });
  return (prompt) => {
    const task = tasks.get(`${prompt.api_id}\0${prompt.task_id}`);
    if (!task) throw new Error(`task not found for ${prompt.api_id}/${prompt.task_id}`);
    return task;
  };
}

function reviewIdFor(plan, batchId, runId) {
  return `R-${sha256(`${REVIEW_SEED}\0${plan.benchmark_id}\0${plan.plan_version}\0${batchId}\0${runId}`)
    .slice(0, 12).toUpperCase()}`;
}

function uniqueMap(values, key, label) {
  const result = new Map();
  values.forEach((value) => {
    if (result.has(value[key])) throw new Error(`duplicate ${label} ${value[key]}`);
    result.set(value[key], value);
  });
  return result;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameMembers(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonLines(file, values) {
  fs.writeFileSync(file, `${values.map((value) => JSON.stringify(value)).join("\n")}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonLines(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  return text === "" ? [] : text.split("\n").map((line) => JSON.parse(line));
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function runCli() {
  const batchId = optionValue("--batch");
  if (!batchId || !process.argv.includes("--write")) {
    console.error("Usage: openapi-comparison-v2-adjudication.mjs --batch <id> --write");
    process.exitCode = 2;
    return;
  }
  const { plan, artifacts } = buildCurrentAdjudicationArtifacts(batchId);
  const directory = adjudicationDirectory(plan.plan_version, batchId);
  const result = writeAdjudicationArtifacts({ directory, artifacts });
  console.log(`Wrote ${artifacts.packet.case_count} blinded review cases to ${path.relative(process.cwd(), directory)}`);
  console.log(`Decision file: ${result.decisions_created ? "created" : "preserved"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
