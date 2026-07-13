#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { gradeEvaluationRecord } from "./complete-evaluation-grader.mjs";
import {
  OPENAPI_BASELINE_DIR,
  OPENAPI_CONDITIONS,
  read,
  readJson,
  selectComparableTasks,
  TARGETS_FILE,
  TASKS_FILE,
} from "./openapi-comparison-utils.mjs";

const RUN_STATUSES = new Set(["pass", "fail", "inconclusive", "blocked"]);
const RUNS_DIR = path.join(OPENAPI_BASELINE_DIR, "runs");
const METRICS_FILE = path.join(OPENAPI_BASELINE_DIR, "context-metrics.json");
const failures = [];

function fail(area, detail) {
  failures.push({ area, detail });
}

try {
  const taskPacket = readJson(TASKS_FILE);
  const targetPacket = readJson(TARGETS_FILE);
  const liveTasks = selectComparableTasks(taskPacket, "all", null);
  validateContextMetrics(readJson(METRICS_FILE), taskPacket, liveTasks);
  validateRunRecords(taskPacket, targetPacket, liveTasks);
} catch (error) {
  fail("openapi-comparison", error.message);
}

if (failures.length > 0) {
  console.error("OpenAPI comparison check failed:");
  failures.forEach((failure) => console.error(`- ${failure.area}: ${failure.detail}`));
  process.exit(1);
}

console.log(`OpenAPI comparison check passed for ${path.relative(process.cwd(), OPENAPI_BASELINE_DIR)}`);

function validateContextMetrics(packet, taskPacket, liveTasks) {
  if (packet.docai_http !== taskPacket.docai_http) throw new Error("context metrics docai_http must match tasks");
  if (packet.candidate !== taskPacket.candidate) throw new Error("context metrics candidate must match tasks");
  if (packet.baseline !== "openapi-comparison") throw new Error("context metrics baseline must be openapi-comparison");
  if (!packet.recorded_at || Number.isNaN(Date.parse(packet.recorded_at))) {
    throw new Error("context metrics recorded_at must be an ISO-compatible timestamp");
  }
  if (!Array.isArray(packet.metrics)) throw new Error("context metrics must be an array");

  const expectedIds = new Set();
  OPENAPI_CONDITIONS.forEach((condition) => {
    liveTasks.forEach((task) => expectedIds.add(`${condition}__${task.id}`));
  });

  const seenIds = new Set();
  packet.metrics.forEach((row) => {
    validateMetricRow(row, liveTasks);
    const id = `${row.condition}__${row.task_id}`;
    if (seenIds.has(id)) throw new Error(`duplicate context metric row ${id}`);
    seenIds.add(id);
  });

  expectedIds.forEach((id) => {
    if (!seenIds.has(id)) throw new Error(`missing context metric row ${id}`);
  });
}

function validateMetricRow(row, liveTasks) {
  const task = liveTasks.find((candidate) => candidate.id === row.task_id);
  if (!task) throw new Error(`context metric has unknown task_id ${row.task_id}`);
  if (row.task_group !== task.group) throw new Error(`context metric ${row.task_id} task_group must be ${task.group}`);
  if (!OPENAPI_CONDITIONS.includes(row.condition)) throw new Error(`context metric ${row.task_id} has invalid condition ${row.condition}`);
  ["context_utf8_bytes", "context_characters", "approx_tokens_chars_div_4"].forEach((field) => {
    if (!Number.isInteger(Number(row[field])) || Number(row[field]) <= 0) {
      throw new Error(`context metric ${row.condition}__${row.task_id} must include positive ${field}`);
    }
  });
}

function validateRunRecords(taskPacket, targetPacket, liveTasks) {
  if (!fs.existsSync(RUNS_DIR)) return;

  const tasksById = new Map(liveTasks.map((task) => [task.id, task]));
  const targetsById = new Map(targetPacket.targets.map((target) => [target.id, target]));
  const seenRunIds = new Set();

  runRecordFiles().forEach((file) => {
    read(file)
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (!line.trim()) return;
        const record = parseJsonLine(file, line, index + 1);
        validateRunRecord(record, taskPacket, tasksById, targetsById, seenRunIds);
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
    throw new Error(`${path.relative(OPENAPI_BASELINE_DIR, file)}:${lineNumber} is not valid JSON: ${error.message}`);
  }
}

function validateRunRecord(record, taskPacket, tasksById, targetsById, seenRunIds) {
  if (!record.run_id || !/^openapi-(raw|sliced|enriched)__[a-z0-9-]+__[a-z0-9-]+$/.test(record.run_id)) {
    throw new Error("OpenAPI run record run_id must be openapi-<condition>__<target-id>__<task-id>");
  }
  if (seenRunIds.has(record.run_id)) throw new Error(`duplicate OpenAPI run record ${record.run_id}`);
  seenRunIds.add(record.run_id);

  const condition = conditionFromRunId(record.run_id);
  if (!record.baseline || record.baseline.format !== "openapi") {
    throw new Error(`OpenAPI run record ${record.run_id} baseline.format must be openapi`);
  }
  if (record.baseline.condition !== condition) {
    throw new Error(`OpenAPI run record ${record.run_id} baseline.condition must be ${condition}`);
  }

  const target = targetsById.get(record.target_id);
  if (!target) throw new Error(`OpenAPI run record ${record.run_id} has unknown target_id ${record.target_id}`);
  const task = tasksById.get(record.task_id);
  if (!task) throw new Error(`OpenAPI run record ${record.run_id} has unknown task_id ${record.task_id}`);
  if (record.run_id !== `openapi-${condition}__${record.target_id}__${record.task_id}`) {
    throw new Error(`OpenAPI run record ${record.run_id} does not match condition/target_id/task_id`);
  }
  if (record.provider !== target.provider) throw new Error(`OpenAPI run record ${record.run_id} provider does not match target`);
  if (record.model !== target.model) throw new Error(`OpenAPI run record ${record.run_id} model does not match target`);
  if (!target.task_groups.includes(task.group)) {
    throw new Error(`OpenAPI run record ${record.run_id} uses target that does not include task group ${task.group}`);
  }
  if (record.docai_http !== taskPacket.docai_http) throw new Error(`OpenAPI run record ${record.run_id} docai_http must match tasks`);
  if (record.candidate !== taskPacket.candidate) throw new Error(`OpenAPI run record ${record.run_id} candidate must match tasks`);
  if (!record.executed_at || Number.isNaN(Date.parse(record.executed_at))) {
    throw new Error(`OpenAPI run record ${record.run_id} executed_at must be an ISO-compatible timestamp`);
  }
  if (!RUN_STATUSES.has(record.status)) throw new Error(`OpenAPI run record ${record.run_id} has invalid status ${record.status}`);
  validateRunReview(record, task);
}

function conditionFromRunId(runId) {
  return runId.slice("openapi-".length).split("__")[0];
}

function validateRunReview(record, task) {
  if (!record.review || typeof record.review !== "object") throw new Error(`OpenAPI run record ${record.run_id} lacks review object`);
  if (typeof record.review.fixture_gap !== "boolean") {
    throw new Error(`OpenAPI run record ${record.run_id} review.fixture_gap must be boolean`);
  }
  if (typeof record.review.notes !== "string" || record.review.notes.trim() === "") {
    throw new Error(`OpenAPI run record ${record.run_id} review.notes is required`);
  }
  if (record.status === "blocked") {
    if (typeof record.blocked_reason !== "string" || record.blocked_reason.trim() === "") {
      throw new Error(`blocked OpenAPI run record ${record.run_id} requires blocked_reason`);
    }
    return;
  }
  if (typeof record.review.matches_expected_outcome !== "boolean") {
    throw new Error(`OpenAPI run record ${record.run_id} review.matches_expected_outcome must be boolean`);
  }
  if (record.status === "pass" && !record.review.matches_expected_outcome) {
    throw new Error(`pass OpenAPI run record ${record.run_id} must match expected outcome`);
  }
  if (record.status === "fail" && record.review.matches_expected_outcome) {
    throw new Error(`fail OpenAPI run record ${record.run_id} must not match expected outcome`);
  }
  if (!record.response || typeof record.response !== "object") {
    throw new Error(`OpenAPI run record ${record.run_id} lacks response object`);
  }

  const result = gradeEvaluationRecord(record, task);
  if (record.review.matches_expected_outcome !== result.pass) {
    throw new Error(
      `OpenAPI run record ${record.run_id} review.matches_expected_outcome disagrees with ${task.group} grader: ${result.reasons.join("; ")}`,
    );
  }
}
