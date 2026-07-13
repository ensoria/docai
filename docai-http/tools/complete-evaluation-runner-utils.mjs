import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const SPEC_VERSION = "0.11.0";
export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "complete-candidates", `v${SPEC_VERSION}`);
export const CANDIDATE_DIR = path.resolve(process.env.DOCAI_COMPLETE_CANDIDATE_DIR ?? DEFAULT_DIR);
export const TASKS_FILE = path.join(CANDIDATE_DIR, "evaluations", "tasks.json");
export const TARGETS_FILE = path.join(CANDIDATE_DIR, "evaluations", "targets.json");
export const RUNS_DIR = path.join(CANDIDATE_DIR, "evaluations", "runs");
export const VALID_GROUPS = new Set(["request_construction", "response_handling", "error_handling", "workflow_completion", "token_load"]);

export function parseArgs(argv, defaultGroup, defaultTarget) {
  const parsed = {
    group: defaultGroup,
    target: defaultTarget,
    task: null,
  };
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
    if (!arg.startsWith("--") && parsed.group === defaultGroup) parsed.group = arg;
  }
  return parsed;
}

export function read(file) {
  return fs.readFileSync(file, "utf8");
}

export function readJson(file) {
  return JSON.parse(read(file));
}

export function selectTarget(targetPacket, targetId, provider) {
  const target = targetPacket.targets.find((candidate) => candidate.id === targetId);
  if (!target) throw new Error(`Unknown target: ${targetId}`);
  if (target.provider !== provider) throw new Error(`Target ${targetId} is provider ${target.provider}, not ${provider}.`);
  return target;
}

export function selectTasks(taskPacket, group, taskFilter) {
  if (!VALID_GROUPS.has(group)) throw new Error(`Unknown task group: ${group}`);
  const tasks = taskPacket.tasks.filter((task) => task.group === group && (!taskFilter || task.id === taskFilter));
  if (tasks.length === 0) {
    throw new Error(`No tasks found for group ${group}${taskFilter ? ` and task ${taskFilter}` : ""}.`);
  }
  return tasks;
}

export function buildPromptRecord(taskPacket, target, task) {
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
      "- `boundary_handling`: for multipart/form-data requests, describe whether multipart boundary generation is delegated to the HTTP library; otherwise omit or set to `null`.",
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

export function parseModelJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function parseJsonOrText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { output_text: text };
  }
}

export function blockedRecord(prompt, task, executedAt, error, apiKey) {
  const redacted = redact(error.message, apiKey);
  return {
    run_id: prompt.run_id,
    target_id: prompt.target.id,
    task_id: task.id,
    provider: prompt.target.provider,
    model: prompt.target.model,
    executed_at: executedAt,
    status: "blocked",
    blocked_reason: redacted.slice(0, 600),
    review: {
      fixture_gap: false,
      notes: `Provider call blocked: ${redacted.slice(0, 240)}`,
    },
  };
}

export function redact(value, apiKey) {
  return String(value ?? "").replaceAll(apiKey, "<redacted>");
}

export function outputFileForGroup(group) {
  return path.join(RUNS_DIR, `${group.replaceAll("_", "-")}.jsonl`);
}

export function mergeRunRecords(outputFile, newRecords) {
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
