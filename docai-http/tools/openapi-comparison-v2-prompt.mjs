import fs from "node:fs";
import path from "node:path";

import { buildRequiredOutputText } from "./openapi-comparison-v2-contract.mjs";
import {
  buildTaskContext,
  readApiTaskPacket,
  resolveApiArtifacts,
} from "./openapi-comparison-v2-context.mjs";
import {
  BENCHMARK_DIR,
  buildPrimarySchedule,
  readV2Plan,
} from "./openapi-comparison-v2-utils.mjs";

export const PRIVATE_PROMPTS_DIR = path.join(BENCHMARK_DIR, "private", "prompts");
export const PRIMARY_PROMPTS_FILE = path.join(PRIVATE_PROMPTS_DIR, "primary.jsonl");
export const PRIVATE_CONTEXTS_DIR = path.join(BENCHMARK_DIR, "private", "contexts");
export const CONTEXT_METRICS_FILE = path.join(PRIVATE_CONTEXTS_DIR, "context-metrics.json");
export const CONTEXT_METRICS_MARKDOWN_FILE = path.join(PRIVATE_CONTEXTS_DIR, "CONTEXT-METRICS.md");

const SYSTEM_MESSAGE = [
  "You implement HTTP clients from supplied API documentation.",
  "Use only the supplied documentation.",
  "Do not invent missing behavior, fields, defaults, retry rules, or wire details.",
  "When required information is absent, record the gap in the output contract's uncertainties field.",
  "Return exactly the required JSON object with no Markdown fence or surrounding prose.",
].join(" ");

const FORBIDDEN_PROMPT_KEYS = new Set([
  "assertions",
  "evidence",
  "expected_outcome",
  "fact_ids",
  "fact_inventory",
  "failure_category",
  "grader",
  "grader_evidence",
  "missing_fact_ids",
  "private",
  "raw_missing",
  "sliced_missing",
]);

export function buildPromptRecord({ run, api, task, context = undefined }) {
  const taskContext = context ?? buildTaskContext(api, task, run.condition);
  const record = {
    record_version: "1",
    benchmark_id: run.run_id.split("__", 1)[0],
    plan_version: run.run_id.split("__")[1],
    run_id: run.run_id,
    batch_id: run.batch_id,
    batch_ordinal: run.batch_ordinal,
    repetition: run.repetition,
    api_id: run.api_id,
    task_id: run.task_id,
    task_class: task.class,
    profile: task.profile,
    condition: run.condition,
    target: {
      id: run.target_id,
      provider: run.provider,
      planned_model: run.planned_model,
    },
    context: {
      media_type: taskContext.media_type,
      source_files: [...taskContext.source_files],
    },
    prompt: {
      system: SYSTEM_MESSAGE,
      documentation: taskContext.content,
      task: task.public.user_task,
      required_output: buildRequiredOutputText(task.public.output_contract),
    },
  };
  validatePromptRecord(record);
  return record;
}

export function buildPrimaryPromptRecords(plan = readV2Plan(), { privateRequired = false } = {}) {
  const apis = new Map(plan.apis.map((api) => [api.id, api]));
  const tasksByApi = new Map();

  plan.apis.forEach((api) => {
    const artifacts = resolveApiArtifacts(api);
    if (!fs.existsSync(artifacts.task_packet)) {
      if (privateRequired || !api.private_until_run_close) {
        throw new Error(`Required task packet is missing for ${api.id}: ${artifacts.task_packet}`);
      }
      throw new Error(
        `Cannot export the complete primary prompt set without private task packet ${artifacts.task_packet}`,
      );
    }
    const packet = readApiTaskPacket(api, plan);
    tasksByApi.set(api.id, new Map(packet.tasks.map((task) => [task.id, task])));
  });

  const contextCache = new Map();
  return buildPrimarySchedule(plan).map((run) => {
    const api = apis.get(run.api_id);
    const task = tasksByApi.get(run.api_id)?.get(run.task_id);
    if (!api || !task) throw new Error(`Scheduled task not found: ${run.api_id}/${run.task_id}`);

    const contextKey = [run.api_id, run.task_id, run.condition].join("\0");
    if (!contextCache.has(contextKey)) {
      contextCache.set(contextKey, buildTaskContext(api, task, run.condition));
    }
    return buildPromptRecord({
      run,
      api,
      task,
      context: contextCache.get(contextKey),
    });
  });
}

export function promptMessages(record) {
  validatePromptRecord(record);
  return [
    {
      role: "system",
      content: record.prompt.system,
    },
    {
      role: "user",
      content: [
        "# Documentation",
        "",
        record.prompt.documentation.trimEnd(),
        "",
        "# Task",
        "",
        record.prompt.task,
        "",
        "# Required Output",
        "",
        record.prompt.required_output,
      ].join("\n"),
    },
  ];
}

export function renderedPromptText(record) {
  return promptMessages(record)
    .map((message) => `${message.role.toUpperCase()}\n${message.content}`)
    .join("\n\n");
}

export function validatePromptRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Prompt record must be an object");
  }
  findForbiddenKey(record, "prompt record");

  for (const field of [
    "benchmark_id",
    "plan_version",
    "run_id",
    "batch_id",
    "api_id",
    "task_id",
    "task_class",
    "profile",
    "condition",
  ]) {
    if (typeof record[field] !== "string" || record[field].trim() === "") {
      throw new Error(`Prompt record ${field} must be a non-empty string`);
    }
  }
  if (!record.prompt || typeof record.prompt !== "object" || Array.isArray(record.prompt)) {
    throw new Error("Prompt record prompt must be an object");
  }
  for (const field of ["system", "documentation", "task", "required_output"]) {
    if (typeof record.prompt[field] !== "string" || record.prompt[field].trim() === "") {
      throw new Error(`Prompt record prompt.${field} must be a non-empty string`);
    }
  }
  if (!record.context || !Array.isArray(record.context.source_files)) {
    throw new Error("Prompt record context.source_files must be an array");
  }
  return record;
}

export function textMetrics(text) {
  const characters = [...text].length;
  return {
    utf8_bytes: Buffer.byteLength(text, "utf8"),
    characters,
    approx_tokens_chars_div_4: Math.ceil(characters / 4),
  };
}

export function buildPromptMetric(record, { tokenizers = [] } = {}) {
  validatePromptRecord(record);
  const context = textMetrics(record.prompt.documentation);
  const rendered = renderedPromptText(record);
  const prompt = textMetrics(rendered);
  const tokenizerCounts = {};

  tokenizers.forEach((tokenizer) => {
    if (!tokenizer || typeof tokenizer.id !== "string" || typeof tokenizer.count !== "function") {
      throw new Error("Tokenizer must provide a string id and count(text) function");
    }
    const count = tokenizer.count(rendered);
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Tokenizer ${tokenizer.id} returned an invalid count`);
    }
    tokenizerCounts[tokenizer.id] = count;
  });

  return {
    run_id: record.run_id,
    batch_id: record.batch_id,
    api_id: record.api_id,
    task_id: record.task_id,
    target_id: record.target.id,
    repetition: record.repetition,
    condition: record.condition,
    context_utf8_bytes: context.utf8_bytes,
    context_characters: context.characters,
    context_approx_tokens_chars_div_4: context.approx_tokens_chars_div_4,
    prompt_utf8_bytes: prompt.utf8_bytes,
    prompt_characters: prompt.characters,
    prompt_approx_tokens_chars_div_4: prompt.approx_tokens_chars_div_4,
    tokenizer_counts: tokenizerCounts,
  };
}

export function buildPromptMetricsPacket(records, options = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Prompt records must be a non-empty array");
  }
  const rows = records.map((record) => buildPromptMetric(record, options));
  return {
    metric_version: "1",
    benchmark_id: records[0].benchmark_id,
    plan_version: records[0].plan_version,
    methodology: {
      context: "Exact documentation section supplied to the model.",
      prompt: "SYSTEM and USER message content joined with deterministic role labels.",
      characters: "Unicode code points.",
      approximate_tokens: "ceil(characters / 4); descriptive only, not a provider tokenizer count.",
      tokenizer_counts: "Empty unless a stable tokenizer is explicitly injected without adding a runtime dependency.",
    },
    rows,
  };
}

export function readPromptRecords(file = PRIMARY_PROMPTS_FILE) {
  const text = fs.readFileSync(file, "utf8").trim();
  if (text === "") throw new Error(`Prompt record file is empty: ${file}`);
  return text.split("\n").map((line, index) => {
    try {
      return validatePromptRecord(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid prompt record at ${file}:${index + 1}: ${error.message}`);
    }
  });
}

function findForbiddenKey(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKey(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  Object.entries(value).forEach(([key, child]) => {
    if (FORBIDDEN_PROMPT_KEYS.has(key)) {
      throw new Error(`${location} must not contain private key ${key}`);
    }
    findForbiddenKey(child, `${location}.${key}`);
  });
}
