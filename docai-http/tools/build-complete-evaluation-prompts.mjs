#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "0.11.0";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "complete-candidates", `v${SPEC_VERSION}`);
const CANDIDATE_DIR = path.resolve(process.env.DOCAI_COMPLETE_CANDIDATE_DIR ?? DEFAULT_DIR);
const TASKS_FILE = path.join(CANDIDATE_DIR, "evaluations", "tasks.json");
const TARGETS_FILE = path.join(CANDIDATE_DIR, "evaluations", "targets.json");
const VALID_GROUPS = new Set([
  "request_construction",
  "response_handling",
  "error_handling",
  "workflow_completion",
  "token_load",
  "all",
]);

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const group = positional[0] ?? "request_construction";
const includeOptional = process.argv.includes("--include-optional");
const summary = process.argv.includes("--summary");

if (!VALID_GROUPS.has(group)) {
  console.error(`Unknown task group: ${group}`);
  console.error(`Use one of: ${[...VALID_GROUPS].join(", ")}`);
  process.exit(1);
}

const taskPacket = readJson(TASKS_FILE);
const targetPacket = readJson(TARGETS_FILE);
const records = buildPromptRecords(taskPacket, targetPacket);

if (summary) {
  printSummary(records);
} else {
  records.forEach((record) => console.log(JSON.stringify(record)));
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function buildPromptRecords(taskPacket, targetPacket) {
  const selectedTasks = taskPacket.tasks.filter((task) => group === "all" || task.group === group);
  const selectedTargets = targetPacket.targets.filter((target) => includeOptional || target.required);
  const records = [];

  selectedTargets.forEach((target) => {
    selectedTasks.forEach((task) => {
      if (!target.task_groups.includes(task.group)) return;
      records.push(buildPromptRecord(taskPacket, targetPacket, target, task));
    });
  });

  if (records.length === 0) {
    throw new Error(`No prompt records found for group ${group}`);
  }
  return records;
}

function buildPromptRecord(taskPacket, targetPacket, target, task) {
  const context = contextForTask(task);
  const system = [
    "You are evaluating a DocAI HTTP generated documentation set.",
    "Use only the provided context. Do not invent API behavior that is not stated in the context.",
    "Return strict JSON only, with no Markdown fences or prose outside the JSON object.",
  ].join(" ");

  const user = [
    "# Evaluation Task",
    `DocAI HTTP version: ${taskPacket.docai_http}`,
    `Candidate: ${taskPacket.candidate}`,
    `Task ID: ${task.id}`,
    `Task group: ${task.group}`,
    `Profile: ${task.profile}`,
    "",
    "## User Task",
    task.user_task,
    "",
    "## Required Output",
    outputContract(task.group),
    "",
    "## Context",
    context,
  ].join("\n");

  return {
    run_id: `${target.id}__${task.id}`,
    docai_http: taskPacket.docai_http,
    candidate: taskPacket.candidate,
    target: {
      id: target.id,
      provider: target.provider,
      model: target.model,
      required: target.required,
    },
    task: {
      id: task.id,
      group: task.group,
      profile: task.profile,
      context_files: contextFileList(task),
    },
    temperature: targetPacket.selection_policy.temperature,
    tools: targetPacket.selection_policy.tools,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

function contextForTask(task) {
  if (task.profile === "comparison") {
    return ["full", "compact"]
      .map((profile) => contextForProfile(profile, task.load[profile]))
      .join("\n\n");
  }
  return contextForProfile(task.profile, task.load);
}

function contextForProfile(profile, load) {
  return load
    .map((relativePath) => {
      const file = path.join(CANDIDATE_DIR, "valid", profile, relativePath);
      return `<!-- ${profile}:${relativePath} -->\n\n${read(file)}`;
    })
    .join("\n\n");
}

function contextFileList(task) {
  if (task.profile === "comparison") {
    return {
      full: task.load.full,
      compact: task.load.compact,
    };
  }
  return task.load;
}

function outputContract(taskGroup) {
  if (taskGroup === "request_construction") {
    return [
      "Return an object with:",
      "- `method`: HTTP method.",
      "- `path`: request path, including any required path or query values if applicable.",
      "- `headers`: object of request headers to send.",
      "- `body`: JSON object, multipart part list, raw body descriptor, or `null`.",
      "- `omitted_optional_fields`: array of optional fields intentionally omitted.",
      "- `evidence`: array of short context quotes or section names used.",
      "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
    ].join("\n");
  }

  if (taskGroup === "response_handling") {
    return [
      "Return an object with:",
      "- `success_status`: selected success status code.",
      "- `body_handling`: fields, nullability, and body-presence behavior to handle.",
      "- `headers`: response headers to read, or `none`.",
      "- `related_followups`: related workflow or webhook files to consider.",
      "- `evidence`: array of short context quotes or section names used.",
      "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
    ].join("\n");
  }

  if (taskGroup === "error_handling") {
    return [
      "Return an object with:",
      "- `endpoint_errors`: endpoint-specific error cases and caller actions.",
      "- `common_errors`: common error cases and caller actions.",
      "- `retry_policy`: retry or non-retry behavior.",
      "- `evidence`: array of short context quotes or section names used.",
      "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
    ].join("\n");
  }

  if (taskGroup === "workflow_completion") {
    return [
      "Return an object with:",
      "- `steps`: ordered workflow steps with endpoint, values to pass, values to keep, and resulting state.",
      "- `failure_recovery`: recovery actions and preserved state for failure branches.",
      "- `webhook_reconciliation`: webhook matching and reconciliation behavior.",
      "- `evidence`: array of short context quotes or section names used.",
      "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
    ].join("\n");
  }

  return [
    "Return an object with:",
    "- `loaded_contexts`: the full and compact contexts compared.",
    "- `preferred_context`: `full`, `compact`, or `tie` for this task.",
    "- `reason`: concise explanation based only on the supplied contexts.",
    "- `evidence`: array of short context quotes or section names used.",
    "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
  ].join("\n");
}

function printSummary(records) {
  console.log(`Prompt records: ${records.length}`);
  console.log(`Task group: ${group}`);
  console.log(`Targets: ${unique(records.map((record) => record.target.id)).join(", ")}`);
  console.log(`Tasks: ${unique(records.map((record) => record.task.id)).join(", ")}`);
}

function unique(values) {
  return [...new Set(values)];
}
