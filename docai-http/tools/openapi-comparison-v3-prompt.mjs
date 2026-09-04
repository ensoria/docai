import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { buildRequiredOutputText } from "./openapi-comparison-v3-contract.mjs";
import {
  buildTaskContext,
  readCalibrationTaskPacket,
} from "./openapi-comparison-v3-context.mjs";
import {
  buildCalibrationSchedule,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

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
  const plan = readV3Plan();
  const resolvedRun = canonicalRun(plan, run);
  const resolvedTask = canonicalTask(plan, task);
  if (resolvedRun.task_id !== resolvedTask.id) {
    throw new Error("prompt run task_id must match the canonical task");
  }
  const canonicalContext = buildTaskContext(api, resolvedTask, resolvedRun.condition);
  if (context !== undefined && !isDeepStrictEqual(context, canonicalContext)) {
    throw new Error("prompt context identity must match the canonical calibration context");
  }

  return validatePromptRecord(buildCanonicalPromptRecord(
    plan,
    resolvedRun,
    resolvedTask,
    canonicalContext,
  ));
}

function buildCanonicalPromptRecord(plan, run, task, context) {
  const record = {
    record_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    run_id: run.run_id,
    calibration_ordinal: run.calibration_ordinal,
    batch_id: run.batch_id,
    repetition: run.repetition,
    api_id: run.api_id,
    task_id: run.task_id,
    task_class: task.class,
    profile: task.profile,
    condition: run.condition,
    target: {
      id: run.target_id,
      provider: run.provider,
    },
    context: {
      media_type: context.media_type,
      source_files: [...context.source_files],
    },
    prompt: {
      system: SYSTEM_MESSAGE,
      documentation: context.content,
      task: task.public.user_task,
      required_output: buildRequiredOutputText(task.public.output_contract),
    },
  };
  record.prompt_sha256 = sha256(renderedPromptTextUnchecked(record));
  return record;
}

export function buildCalibrationPromptRecords(plan = readV3Plan()) {
  validatePlanIdentity(plan);
  const api = { id: plan.calibration.api_id };
  const tasks = new Map(readCalibrationTaskPacket(plan).tasks.map((task) => [task.id, task]));
  const contexts = new Map();
  const records = buildCalibrationSchedule(plan).map((run) => {
    const task = tasks.get(run.task_id);
    if (!task) throw new Error(`scheduled task not found: ${run.api_id}/${run.task_id}`);
    const key = [run.api_id, run.task_id, run.condition].join("\0");
    if (!contexts.has(key)) contexts.set(key, buildTaskContext(api, task, run.condition));
    return buildPromptRecord({ run, api, task, context: contexts.get(key) });
  });
  if (records.length !== plan.calibration.planned_requests) {
    throw new Error(`calibration prompt records must contain ${plan.calibration.planned_requests} rows`);
  }
  if (new Set(records.map((record) => record.run_id)).size !== records.length) {
    throw new Error("calibration prompt records must have unique run identities");
  }
  return records;
}

export function promptMessages(record) {
  validatePromptRecord(record);
  return [
    { role: "system", content: record.prompt.system },
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
  requireFiniteJsonValue(record, "prompt record");
  requirePlainObject(record, "prompt record");
  rejectPrivateKeys(record, "prompt record");
  requireExactKeys(record, "prompt record", [
    "record_version",
    "benchmark_id",
    "plan_version",
    "run_id",
    "calibration_ordinal",
    "batch_id",
    "repetition",
    "api_id",
    "task_id",
    "task_class",
    "profile",
    "condition",
    "target",
    "context",
    "prompt",
    "prompt_sha256",
  ]);

  for (const field of [
    "record_version",
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
    requireNonemptyString(record[field], `prompt record ${field}`);
  }
  if (!Number.isInteger(record.calibration_ordinal) || record.calibration_ordinal < 1) {
    throw new Error("prompt record calibration_ordinal must be a positive integer");
  }
  if (record.repetition !== 1) throw new Error("prompt record repetition must be 1");

  requireExactKeys(record.target, "prompt record target", ["id", "provider"]);
  requireNonemptyString(record.target.id, "prompt record target.id");
  requireNonemptyString(record.target.provider, "prompt record target.provider");
  requireExactKeys(record.context, "prompt record context", ["media_type", "source_files"]);
  requireNonemptyString(record.context.media_type, "prompt record context.media_type");
  if (!Array.isArray(record.context.source_files) || record.context.source_files.length === 0
      || record.context.source_files.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new Error("prompt record context.source_files must be a non-empty string array");
  }
  requireExactKeys(record.prompt, "prompt record prompt", ["system", "documentation", "task", "required_output"]);
  for (const field of ["system", "documentation", "task", "required_output"]) {
    requireNonemptyString(record.prompt[field], `prompt record prompt.${field}`);
  }

  const canonical = canonicalPromptRecord(record);
  for (const field of Object.keys(canonical)) {
    if (field !== "prompt_sha256" && !isDeepStrictEqual(record[field], canonical[field])) {
      throw new Error(`prompt record must match canonical calibration field ${field}`);
    }
  }
  requireNonemptyString(record.prompt_sha256, "prompt record prompt_sha256");
  if (!/^[a-f0-9]{64}$/.test(record.prompt_sha256)) {
    throw new Error("prompt record prompt_sha256 must be a SHA-256 hex digest");
  }
  if (record.prompt_sha256 !== sha256(renderedPromptTextUnchecked(record))) {
    throw new Error("prompt record prompt_sha256 must match rendered prompt text");
  }
  return record;
}

export function buildPromptMetricsPacket(records) {
  const plan = validateCanonicalPromptMatrix(records);
  const rows = records.map((record) => promptMetric(record));
  return {
    metric_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    methodology: {
      context: "Exact documentation section supplied to the model.",
      prompt: "SYSTEM and USER message content joined with deterministic role labels.",
      characters: "Unicode code points.",
      approximate_tokens: "ceil(characters / 4); descriptive only, not a provider tokenizer count.",
      prompt_hash: "SHA-256 of the deterministic rendered prompt text.",
    },
    rows,
  };
}

function promptMetric(record) {
  const context = textMetrics(record.prompt.documentation);
  const prompt = textMetrics(renderedPromptTextUnchecked(record));
  return {
    run_id: record.run_id,
    calibration_ordinal: record.calibration_ordinal,
    batch_id: record.batch_id,
    api_id: record.api_id,
    task_id: record.task_id,
    target_id: record.target.id,
    provider: record.target.provider,
    repetition: record.repetition,
    condition: record.condition,
    prompt_sha256: record.prompt_sha256,
    context_utf8_bytes: context.utf8_bytes,
    context_characters: context.characters,
    context_approx_tokens_chars_div_4: context.approx_tokens_chars_div_4,
    prompt_utf8_bytes: prompt.utf8_bytes,
    prompt_characters: prompt.characters,
    prompt_approx_tokens_chars_div_4: prompt.approx_tokens_chars_div_4,
  };
}

function canonicalRun(plan, run) {
  validatePlanIdentity(plan);
  const expected = buildCalibrationSchedule(plan).find((candidate) => candidate.run_id === run?.run_id);
  if (!expected || !isDeepStrictEqual(run, expected)) {
    throw new Error("prompt run identity must match the calibration schedule");
  }
  return expected;
}

function canonicalTask(plan, task) {
  const expected = readCalibrationTaskPacket(plan).tasks.find((candidate) => candidate.id === task?.id);
  if (!expected || !isDeepStrictEqual(task, expected)) {
    throw new Error("prompt task identity must match the canonical task packet");
  }
  return expected;
}

function canonicalPromptRecord(record) {
  const plan = readV3Plan();
  const run = buildCalibrationSchedule(plan).find((candidate) => candidate.run_id === record.run_id);
  if (!run) throw new Error("prompt record must match a canonical calibration run");
  const task = readCalibrationTaskPacket(plan).tasks.find((candidate) => candidate.id === run.task_id);
  if (!task) throw new Error("prompt record must match a canonical calibration task");
  const context = buildTaskContext({ id: run.api_id }, task, run.condition);
  return buildCanonicalPromptRecord(plan, run, task, context);
}

function validateCanonicalPromptMatrix(records) {
  requireFiniteJsonValue(records, "prompt records");
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("prompt records must be a non-empty array");
  }

  const plan = readV3Plan();
  const schedule = buildCalibrationSchedule(plan);
  if (records.length !== plan.calibration.planned_requests || records.length !== schedule.length) {
    throw new Error(`prompt records must contain the exact ${schedule.length}-record canonical calibration matrix`);
  }
  records.forEach((record) => validatePromptRecord(record));

  const runIds = records.map((record) => record.run_id);
  const uniqueRunIds = new Set(runIds);
  if (uniqueRunIds.size !== records.length) {
    throw new Error("prompt records must have unique canonical run identities");
  }
  const expectedRunIds = new Set(schedule.map((run) => run.run_id));
  if (uniqueRunIds.size !== expectedRunIds.size
      || [...uniqueRunIds].some((runId) => !expectedRunIds.has(runId))) {
    throw new Error("prompt records must contain the exact canonical calibration matrix");
  }
  return plan;
}

function validatePlanIdentity(plan) {
  const current = readV3Plan();
  if (!isDeepStrictEqual(plan, current)) {
    throw new Error("prompt plan identity must match the checked-in calibration plan");
  }
}

function renderedPromptTextUnchecked(record) {
  return [
    `SYSTEM\n${record.prompt.system}`,
    [
      "USER",
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
  ].join("\n\n");
}

function textMetrics(text) {
  const characters = [...text].length;
  return {
    utf8_bytes: Buffer.byteLength(text, "utf8"),
    characters,
    approx_tokens_chars_div_4: Math.ceil(characters / 4),
  };
}

function rejectPrivateKeys(value, location, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) throw new Error(`${location} must not contain a cycle`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectPrivateKeys(item, `${location}[${index}]`, seen));
    seen.delete(value);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PROMPT_KEYS.has(key)) {
      throw new Error(`${location} must not contain private key ${key}`);
    }
    rejectPrivateKeys(child, `${location}.${key}`, seen);
  }
  seen.delete(value);
}

function requireFiniteJsonValue(value, location, ancestors = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new Error(`${location} must be a finite JSON value`);
  }
  if (typeof value !== "object") throw new Error(`${location} must be a finite JSON value`);
  if (ancestors.has(value)) throw new Error(`${location} must not contain a cycle`);

  ancestors.add(value);
  if (Array.isArray(value)) {
    requireDenseJsonArray(value, location);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      requireFiniteJsonValue(descriptor.value, `${location}[${index}]`, ancestors);
    }
  } else {
    requirePlainJsonProperties(value, location);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      requireFiniteJsonValue(descriptor.value, `${location}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

function requireDenseJsonArray(value, location) {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new Error(`${location} must be a finite JSON value`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== value.length + 1 || !ownKeys.includes("length")) {
    throw new Error(`${location} must be a finite JSON value`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw new Error(`${location} must be a finite JSON value`);
    }
  }
}

function requirePlainJsonProperties(value, location) {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${location} must be a finite JSON value`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key === "symbol" || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw new Error(`${location} must be a finite JSON value`);
    }
  }
}

function requirePlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new Error(`${name} must be a plain object`);
  }
}

function requireExactKeys(value, name, keys) {
  requirePlainObject(value, name);
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${name} has unknown key ${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) throw new Error(`${name} requires ${key}`);
  }
}

function requireNonemptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} must be a non-empty string`);
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
