#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { gradeEvaluationRecord } from "./complete-evaluation-grader.mjs";

const SPEC_VERSION = "0.11.0";
const REQUIRED_GROUPS = new Set([
  "request_construction",
  "response_handling",
  "error_handling",
  "workflow_completion",
  "token_load",
]);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "complete-candidates", `v${SPEC_VERSION}`);
const CANDIDATE_DIR = path.resolve(process.argv[2] ?? DEFAULT_DIR);
const TASKS_FILE = path.join(CANDIDATE_DIR, "evaluations", "tasks.json");
const TARGETS_FILE = path.join(CANDIDATE_DIR, "evaluations", "targets.json");
const RESULTS_FILE = path.join(CANDIDATE_DIR, "evaluations", "RESULTS.md");
const RUNS_DIR = path.join(CANDIDATE_DIR, "evaluations", "runs");
const RUN_STATUSES = new Set(["pass", "fail", "inconclusive", "blocked"]);

const failures = [];
const metrics = [];

function fail(area, detail) {
  failures.push({ area, detail });
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function profileRoot(profile) {
  return path.join(CANDIDATE_DIR, "valid", profile);
}

function profilePath(profile, relativePath) {
  return path.join(profileRoot(profile), relativePath);
}

function ensurePathInProfile(task, profile, relativePath) {
  if (!/^[A-Za-z0-9._/-]+\.md$/.test(relativePath)) {
    throw new Error(`invalid docs-root-relative path ${relativePath}`);
  }
  const file = profilePath(profile, relativePath);
  if (!fs.existsSync(file)) throw new Error(`missing ${profile} context file ${relativePath}`);
  return file;
}

function contextFor(profile, load) {
  return load
    .map((relativePath) => {
      const file = ensurePathInProfile(null, profile, relativePath);
      return `\n\n<!-- ${profile}:${relativePath} -->\n\n${read(file)}`;
    })
    .join("");
}

function contextMetrics(taskId, label, context) {
  return {
    task_id: taskId,
    label,
    utf8_bytes: Buffer.byteLength(context, "utf8"),
    characters: [...context].length,
    approx_tokens_chars_div_4: Math.ceil([...context].length / 4),
  };
}

function validateTaskPacket(packet) {
  if (packet.docai_http !== SPEC_VERSION) throw new Error(`docai_http must be ${SPEC_VERSION}`);
  if (packet.candidate !== `complete-candidates/v${SPEC_VERSION}`) {
    throw new Error(`candidate must be complete-candidates/v${SPEC_VERSION}`);
  }
  if (!Array.isArray(packet.tasks) || packet.tasks.length === 0) throw new Error("tasks must be a non-empty array");

  const declaredGroups = new Set(packet.task_groups ?? []);
  REQUIRED_GROUPS.forEach((group) => {
    if (!declaredGroups.has(group)) throw new Error(`task_groups must include ${group}`);
  });

  const ids = new Set();
  const coveredGroups = new Set();
  packet.tasks.forEach((task) => {
    validateTask(task, ids);
    coveredGroups.add(task.group);
  });

  REQUIRED_GROUPS.forEach((group) => {
    if (!coveredGroups.has(group)) throw new Error(`tasks must include group ${group}`);
  });
}

function validateTask(task, ids) {
  if (!task.id || !/^[a-z0-9-]+$/.test(task.id)) throw new Error("task id must be kebab-case");
  if (ids.has(task.id)) throw new Error(`duplicate task id ${task.id}`);
  ids.add(task.id);
  if (!REQUIRED_GROUPS.has(task.group)) throw new Error(`unknown task group ${task.group}`);
  if (!task.user_task) throw new Error(`task ${task.id} lacks user_task`);
  if (!task.expected_outcome || typeof task.expected_outcome !== "object") {
    throw new Error(`task ${task.id} lacks expected_outcome`);
  }
  if (!Array.isArray(task.evidence) || task.evidence.length === 0) {
    throw new Error(`task ${task.id} lacks evidence strings`);
  }

  if (task.profile === "full" || task.profile === "compact") {
    validateSingleProfileTask(task);
    return;
  }
  if (task.profile === "comparison") {
    validateComparisonTask(task);
    return;
  }
  throw new Error(`task ${task.id} has invalid profile ${task.profile}`);
}

function validateSingleProfileTask(task) {
  if (!Array.isArray(task.load) || task.load.length === 0) throw new Error(`task ${task.id} load must be a non-empty array`);
  const context = contextFor(task.profile, task.load);
  assertEvidence(task, context);
  metrics.push(contextMetrics(task.id, task.profile, context));
}

function validateComparisonTask(task) {
  if (!task.load || !Array.isArray(task.load.full) || !Array.isArray(task.load.compact)) {
    throw new Error(`comparison task ${task.id} must have full and compact load arrays`);
  }
  const fullContext = contextFor("full", task.load.full);
  const compactContext = contextFor("compact", task.load.compact);
  assertEvidence(task, `${fullContext}\n${compactContext}`);
  const fullMetrics = contextMetrics(task.id, "full", fullContext);
  const compactMetrics = contextMetrics(task.id, "compact", compactContext);
  metrics.push(fullMetrics, compactMetrics);
  if (task.expected_outcome?.compact_chars_must_not_exceed_full_chars && compactMetrics.characters > fullMetrics.characters) {
    throw new Error(`comparison task ${task.id} compact context is larger than full context`);
  }
}

function assertEvidence(task, context) {
  task.evidence.forEach((needle) => {
    if (!context.includes(needle)) throw new Error(`task ${task.id} evidence string not found: ${needle}`);
  });
}

try {
  const taskPacket = readJson(TASKS_FILE);
  const targetPacket = readJson(TARGETS_FILE);
  validateTaskPacket(taskPacket);
  validateTargets(targetPacket, taskPacket);
  validateRunRecords(taskPacket, targetPacket);
} catch (error) {
  fail("evaluation-packet", error.message);
}

try {
  validateResultsTargetList(read(RESULTS_FILE), readJson(TARGETS_FILE));
} catch (error) {
  fail("evaluation-results", error.message);
}

if (failures.length > 0) {
  console.error("Complete candidate evaluation check failed:");
  failures.forEach((failure) => console.error(`- ${failure.area}: ${failure.detail}`));
  process.exit(1);
}

console.log(`Complete candidate evaluation check passed for ${path.relative(process.cwd(), CANDIDATE_DIR) || "."}`);
console.log("");
console.log("| Task | Context | UTF-8 bytes | Characters | Approx tokens(chars/4) |");
console.log("|---|---|---:|---:|---:|");
metrics.forEach((row) => {
  console.log(
    `| ${row.task_id} | ${row.label} | ${row.utf8_bytes} | ${row.characters} | ${row.approx_tokens_chars_div_4} |`,
  );
});

function validateTargets(targetPacket, taskPacket) {
  if (targetPacket.docai_http !== SPEC_VERSION) throw new Error(`targets docai_http must be ${SPEC_VERSION}`);
  if (targetPacket.candidate !== taskPacket.candidate) throw new Error("targets candidate must match tasks candidate");
  if (!targetPacket.decided_on) throw new Error("targets decided_on is required");
  if (!Array.isArray(targetPacket.source_docs) || targetPacket.source_docs.length < 3) {
    throw new Error("targets must record official source docs for each provider");
  }
  ["openai", "anthropic", "google"].forEach((provider) => {
    if (!targetPacket.source_docs.some((source) => source.provider === provider && source.url && source.checked_on)) {
      throw new Error(`targets source_docs must include ${provider}`);
    }
  });

  if (!Array.isArray(targetPacket.targets) || targetPacket.targets.length === 0) throw new Error("targets must be non-empty");
  const ids = new Set();
  const requiredProviders = new Set();
  targetPacket.targets.forEach((target) => {
    validateTarget(target, ids);
    if (target.required) requiredProviders.add(target.provider);
  });
  ["openai", "anthropic", "google"].forEach((provider) => {
    if (!requiredProviders.has(provider)) throw new Error(`required targets must include ${provider}`);
  });
}

function validateTarget(target, ids) {
  if (!target.id || !/^[a-z0-9-]+$/.test(target.id)) throw new Error("target id must be kebab-case");
  if (ids.has(target.id)) throw new Error(`duplicate target id ${target.id}`);
  ids.add(target.id);
  if (!["openai", "anthropic", "google"].includes(target.provider)) {
    throw new Error(`unknown target provider ${target.provider}`);
  }
  if (!target.model || !/^[A-Za-z0-9._:@-]+$/.test(target.model)) throw new Error(`target ${target.id} has invalid model`);
  if (typeof target.required !== "boolean") throw new Error(`target ${target.id} required must be boolean`);
  if (!target.role) throw new Error(`target ${target.id} lacks role`);
  if (!Array.isArray(target.task_groups) || target.task_groups.length === 0) {
    throw new Error(`target ${target.id} task_groups must be non-empty`);
  }
  REQUIRED_GROUPS.forEach((group) => {
    if (!target.task_groups.includes(group)) throw new Error(`target ${target.id} must include task group ${group}`);
  });
}

function validateResultsTargetList(results, targetPacket) {
  if (!results.includes("## Target LLM List")) throw new Error("RESULTS.md lacks Target LLM List section");
  targetPacket.targets.forEach((target) => {
    if (!results.includes(`| ${target.id} | ${target.provider} | ${target.model} |`)) {
      throw new Error(`RESULTS.md lacks target row for ${target.id}`);
    }
  });
}

function validateRunRecords(taskPacket, targetPacket) {
  if (!fs.existsSync(RUNS_DIR)) throw new Error("evaluations/runs directory is required");

  const tasksById = new Map(taskPacket.tasks.map((task) => [task.id, task]));
  const targetsById = new Map(targetPacket.targets.map((target) => [target.id, target]));
  const seenRunIds = new Set();
  runRecordFiles().forEach((file) => {
    read(file)
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (!line.trim()) return;
        const record = parseJsonLine(file, line, index + 1);
        validateRunRecord(record, tasksById, targetsById, seenRunIds);
      });
  });
}

function runRecordFiles() {
  return fs
    .readdirSync(RUNS_DIR)
    .filter((name) => name.endsWith(".jsonl") && !name.endsWith(".example.jsonl"))
    .map((name) => path.join(RUNS_DIR, name));
}

function parseJsonLine(file, line, lineNumber) {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`${path.relative(CANDIDATE_DIR, file)}:${lineNumber} is not valid JSON: ${error.message}`);
  }
}

function validateRunRecord(record, tasksById, targetsById, seenRunIds) {
  if (!record.run_id || !/^[a-z0-9-]+__[a-z0-9-]+$/.test(record.run_id)) {
    throw new Error("run record run_id must be <target-id>__<task-id>");
  }
  if (seenRunIds.has(record.run_id)) throw new Error(`duplicate run record ${record.run_id}`);
  seenRunIds.add(record.run_id);

  const target = targetsById.get(record.target_id);
  if (!target) throw new Error(`run record ${record.run_id} has unknown target_id ${record.target_id}`);
  const task = tasksById.get(record.task_id);
  if (!task) throw new Error(`run record ${record.run_id} has unknown task_id ${record.task_id}`);
  if (record.run_id !== `${record.target_id}__${record.task_id}`) {
    throw new Error(`run record ${record.run_id} does not match target_id/task_id`);
  }
  if (record.provider !== target.provider) throw new Error(`run record ${record.run_id} provider does not match target`);
  if (record.model !== target.model) throw new Error(`run record ${record.run_id} model does not match target`);
  if (!target.task_groups.includes(task.group)) {
    throw new Error(`run record ${record.run_id} uses target that does not include task group ${task.group}`);
  }
  if (!record.executed_at || Number.isNaN(Date.parse(record.executed_at))) {
    throw new Error(`run record ${record.run_id} executed_at must be an ISO-compatible timestamp`);
  }
  if (!RUN_STATUSES.has(record.status)) throw new Error(`run record ${record.run_id} has invalid status ${record.status}`);
  validateRunReview(record, task);
}

function validateRunReview(record, task) {
  if (!record.review || typeof record.review !== "object") throw new Error(`run record ${record.run_id} lacks review object`);
  if (typeof record.review.fixture_gap !== "boolean") {
    throw new Error(`run record ${record.run_id} review.fixture_gap must be boolean`);
  }
  if (typeof record.review.notes !== "string" || record.review.notes.trim() === "") {
    throw new Error(`run record ${record.run_id} review.notes is required`);
  }
  if (record.status === "blocked") {
    if (typeof record.blocked_reason !== "string" || record.blocked_reason.trim() === "") {
      throw new Error(`blocked run record ${record.run_id} requires blocked_reason`);
    }
    return;
  }
  if (typeof record.review.matches_expected_outcome !== "boolean") {
    throw new Error(`run record ${record.run_id} review.matches_expected_outcome must be boolean`);
  }
  if (record.status === "pass" && !record.review.matches_expected_outcome) {
    throw new Error(`pass run record ${record.run_id} must match expected outcome`);
  }
  if (record.status === "fail" && record.review.matches_expected_outcome) {
    throw new Error(`fail run record ${record.run_id} must not match expected outcome`);
  }
  if (!record.response || typeof record.response !== "object") {
    throw new Error(`run record ${record.run_id} lacks response object`);
  }
  validateAutomatedOutcome(record, task);
}

function validateAutomatedOutcome(record, task) {
  if (task.group === "request_construction" || task.group === "response_handling") {
    if (record.status === "inconclusive" && record.review.fixture_gap) return;
    const result = gradeEvaluationRecord(record, task);
    if (record.review.matches_expected_outcome !== result.pass) {
      throw new Error(
        `run record ${record.run_id} review.matches_expected_outcome disagrees with ${task.group} grader: ${result.reasons.join("; ")}`,
      );
    }
  }
}
