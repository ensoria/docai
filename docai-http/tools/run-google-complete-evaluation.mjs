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
const RUNS_DIR = path.join(CANDIDATE_DIR, "evaluations", "runs");
const INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const VALID_GROUPS = new Set(["request_construction", "response_handling", "error_handling", "workflow_completion", "token_load"]);

const args = parseArgs(process.argv.slice(2));
const group = args.group ?? "request_construction";
const targetId = args.target ?? "google-stable-agentic";
const taskFilter = args.task ?? null;
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("GOOGLE_API_KEY is required.");
  process.exit(1);
}
if (!VALID_GROUPS.has(group)) {
  console.error(`Unknown task group: ${group}`);
  process.exit(1);
}

const taskPacket = readJson(TASKS_FILE);
const targetPacket = readJson(TARGETS_FILE);
const target = targetPacket.targets.find((candidate) => candidate.id === targetId);
if (!target) {
  console.error(`Unknown target: ${targetId}`);
  process.exit(1);
}
if (target.provider !== "google") {
  console.error(`Target ${targetId} is provider ${target.provider}, not google.`);
  process.exit(1);
}

const tasks = taskPacket.tasks.filter((task) => task.group === group && (!taskFilter || task.id === taskFilter));
if (tasks.length === 0) {
  console.error(`No tasks found for group ${group}${taskFilter ? ` and task ${taskFilter}` : ""}.`);
  process.exit(1);
}

const records = [];
for (const task of tasks) {
  const prompt = buildPromptRecord(target, task);
  const record = await runPrompt(prompt, task);
  records.push(record);
}

const outputFile = path.join(RUNS_DIR, `${group.replaceAll("_", "-")}.jsonl`);
mergeRunRecords(outputFile, records);
console.log(`Recorded ${records.length} ${targetId} ${group} run(s) in ${path.relative(process.cwd(), outputFile)}`);
records.forEach((record) => {
  console.log(`- ${record.run_id}: ${record.status} (${record.review.notes})`);
});

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") {
      parsed.target = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--task") {
      parsed.task = argv[index + 1];
      index += 1;
      continue;
    }
    if (!arg.startsWith("--") && !parsed.group) parsed.group = arg;
  }
  return parsed;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function buildPromptRecord(target, task) {
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
    target,
    task,
    system,
    user,
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

async function runPrompt(prompt, task) {
  const executedAt = new Date().toISOString();
  try {
    const interaction = await callGoogle(prompt);
    const text = extractOutputText(interaction);
    const contentJson = parseModelJson(text);
    const grade = gradeRequestConstruction(contentJson, task);
    return {
      run_id: prompt.run_id,
      target_id: prompt.target.id,
      task_id: task.id,
      provider: prompt.target.provider,
      model: prompt.target.model,
      executed_at: executedAt,
      status: grade.pass ? "pass" : "fail",
      review: {
        matches_expected_outcome: grade.pass,
        fixture_gap: false,
        notes: grade.reasons.join("; "),
      },
      response: {
        content_json: contentJson,
        content_text: text,
        usage: normalizeUsage(interaction),
      },
    };
  } catch (error) {
    return blockedRecord(prompt, task, executedAt, error);
  }
}

async function callGoogle(prompt) {
  const body = {
    model: prompt.target.model,
    system_instruction: prompt.system,
    input: prompt.user,
    generation_config: {
      temperature: Number(targetPacket.selection_policy.temperature ?? 0),
    },
  };
  const response = await fetch(INTERACTIONS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = parseJsonOrText(text);
  if (!response.ok) {
    throw new Error(`Google API HTTP ${response.status}: ${summarizeProviderError(parsed)}`);
  }
  return parsed;
}

function parseJsonOrText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { output_text: text };
  }
}

function summarizeProviderError(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replaceAll(apiKey, "<redacted>").slice(0, 600);
}

function extractOutputText(interaction) {
  if (typeof interaction.output_text === "string") return interaction.output_text;
  if (Array.isArray(interaction.output)) {
    return interaction.output
      .map((item) => item.text ?? item.content ?? "")
      .filter(Boolean)
      .join("\n");
  }
  if (Array.isArray(interaction.steps)) {
    return interaction.steps
      .flatMap((step) => step.output ?? step.content ?? [])
      .map((item) => item.text ?? "")
      .filter(Boolean)
      .join("\n");
  }
  throw new Error("Google response did not include output_text");
}

function parseModelJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function normalizeUsage(interaction) {
  const usage = interaction.usage_metadata ?? interaction.usageMetadata ?? interaction.usage ?? {};
  return {
    input_tokens: usage.input_token_count ?? usage.promptTokenCount ?? usage.input_tokens ?? null,
    output_tokens: usage.output_token_count ?? usage.candidatesTokenCount ?? usage.output_tokens ?? null,
    total_tokens: usage.total_token_count ?? usage.totalTokenCount ?? usage.total_tokens ?? null,
  };
}

function blockedRecord(prompt, task, executedAt, error) {
  return {
    run_id: prompt.run_id,
    target_id: prompt.target.id,
    task_id: task.id,
    provider: prompt.target.provider,
    model: prompt.target.model,
    executed_at: executedAt,
    status: "blocked",
    blocked_reason: error.message.replaceAll(apiKey, "<redacted>").slice(0, 600),
    review: {
      fixture_gap: false,
      notes: `Provider call blocked: ${error.message.replaceAll(apiKey, "<redacted>").slice(0, 240)}`,
    },
  };
}

function gradeRequestConstruction(contentJson, task) {
  if (task.group !== "request_construction") {
    return { pass: false, reasons: [`no automated grader for task group ${task.group}`] };
  }
  const reasons = [];
  if (contentJson.method !== task.expected_outcome.method) reasons.push(`method expected ${task.expected_outcome.method}`);
  if (contentJson.path !== task.expected_outcome.path) reasons.push(`path expected ${task.expected_outcome.path}`);
  validateExpectedHeaders(task, contentJson, reasons);
  validateExpectedBody(task, contentJson, reasons);
  validateExpectedParts(task, contentJson, reasons);
  return {
    pass: reasons.length === 0,
    reasons: reasons.length === 0 ? ["matched request construction expected outcome"] : reasons,
  };
}

function validateExpectedHeaders(task, response, reasons) {
  if (!Array.isArray(task.expected_outcome.headers)) return;
  const actualHeaders = normalizeHeaders(response.headers);
  task.expected_outcome.headers.forEach((header) => {
    const separator = header.indexOf(":");
    const name = header.slice(0, separator).trim().toLowerCase();
    const expectedValue = header.slice(separator + 1).trim().toLowerCase();
    const actualValue = actualHeaders.get(name);
    if (!actualValue) {
      reasons.push(`missing header ${name}`);
      return;
    }
    if (actualValue !== expectedValue) reasons.push(`header ${name} expected ${expectedValue}`);
  });
}

function normalizeHeaders(headers) {
  if (Array.isArray(headers)) {
    return new Map(
      headers.map((header) => {
        const separator = header.indexOf(":");
        return [header.slice(0, separator).trim().toLowerCase(), header.slice(separator + 1).trim().toLowerCase()];
      }),
    );
  }
  if (headers && typeof headers === "object") {
    return new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).toLowerCase()]));
  }
  return new Map();
}

function validateExpectedBody(task, response, reasons) {
  if (!task.expected_outcome.body) return;
  if (!response.body || typeof response.body !== "object" || Array.isArray(response.body)) {
    reasons.push("response body object is required");
    return;
  }
  Object.entries(task.expected_outcome.body).forEach(([key, value]) => {
    if (response.body[key] !== value) reasons.push(`body.${key} expected ${value}`);
  });
  (task.expected_outcome.omit_optional_fields ?? []).forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(response.body, field)) reasons.push(`optional field ${field} should be omitted`);
  });
}

function validateExpectedParts(task, response, reasons) {
  if (!Array.isArray(task.expected_outcome.parts)) return;
  const actualParts = normalizeParts(response);
  task.expected_outcome.parts.forEach((expectedPart) => {
    const actualPart = actualParts.get(expectedPart.name);
    if (!actualPart) {
      reasons.push(`missing multipart part ${expectedPart.name}`);
      return;
    }
    if (expectedPart.filename_required && actualPart.filename_required === false) {
      reasons.push(`multipart part ${expectedPart.name} requires filename`);
    }
    if (expectedPart.content_type && actualPart.content_type !== expectedPart.content_type) {
      reasons.push(`multipart part ${expectedPart.name} content_type expected ${expectedPart.content_type}`);
    }
  });
  if (task.expected_outcome.content_type) {
    const contentType = String(response.content_type ?? response.headers?.["Content-Type"] ?? response.headers?.["content-type"] ?? "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) reasons.push("content_type must include multipart/form-data");
    if (!contentType.includes("boundary") && !String(response.boundary ?? "").toLowerCase().includes("library")) {
      reasons.push("multipart boundary delegation must be represented");
    }
  }
}

function normalizeParts(response) {
  const rawParts = response.parts ?? response.body?.parts ?? response.body;
  if (!Array.isArray(rawParts)) return new Map();
  return new Map(rawParts.filter((part) => part && part.name).map((part) => [part.name, part]));
}

function mergeRunRecords(outputFile, newRecords) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const existing = fs.existsSync(outputFile)
    ? read(outputFile)
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
    : [];
  const byRunId = new Map(existing.map((record) => [record.run_id, record]));
  newRecords.forEach((record) => byRunId.set(record.run_id, record));
  const lines = [...byRunId.values()].sort((left, right) => left.run_id.localeCompare(right.run_id)).map((record) => JSON.stringify(record));
  fs.writeFileSync(outputFile, `${lines.join("\n")}\n`);
}
