import path from "node:path";

import { gradeEvaluationResponse } from "./complete-evaluation-grader.mjs";
import { mergeRunRecords, redact } from "./complete-evaluation-runner-utils.mjs";
import {
  buildOpenApiPromptRecord,
  OPENAPI_BASELINE_DIR,
  parseCommonArgs,
  readJson,
  selectComparableTasks,
  selectOpenApiConditions,
  selectTargets,
  TARGETS_FILE,
  TASKS_FILE,
} from "./openapi-comparison-utils.mjs";

const RUNS_DIR = path.join(OPENAPI_BASELINE_DIR, "runs");

export function selectOpenApiPromptRuns(argv, provider, defaultTarget) {
  const args = parseCommonArgs(argv, "request_construction", "raw");
  if (args.target === "required") args.target = defaultTarget;

  const taskPacket = readJson(TASKS_FILE);
  const targetPacket = readJson(TARGETS_FILE);
  const selectedTargets = selectTargets(targetPacket, args.target, args.includeOptional).filter((target) => target.provider === provider);
  if (selectedTargets.length === 0) {
    throw new Error(`No ${provider} target selected. Use --target with a ${provider} target id.`);
  }

  const tasks = selectComparableTasks(taskPacket, args.group, args.task);
  const conditions = selectOpenApiConditions(args.condition);
  const promptRuns = [];

  conditions.forEach((condition) => {
    selectedTargets.forEach((target) => {
      tasks.forEach((task) => {
        if (!target.task_groups.includes(task.group)) return;
        promptRuns.push({
          condition,
          target,
          task,
          prompt: buildOpenApiPromptRecord(taskPacket, targetPacket, target, task, condition),
        });
      });
    });
  });

  if (promptRuns.length === 0) {
    throw new Error(`No OpenAPI comparison prompt runs selected for ${provider}.`);
  }

  return { args, promptRuns };
}

export function openApiResultRecord(prompt, task, executedAt, contentJson, contentText, usage) {
  const grade = gradeEvaluationResponse(contentJson, task);
  return {
    run_id: prompt.run_id,
    docai_http: prompt.docai_http,
    candidate: prompt.candidate,
    baseline: prompt.baseline,
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
      content_text: contentText,
      usage,
    },
  };
}

export function openApiBlockedRecord(prompt, task, executedAt, error, apiKey) {
  const redacted = redact(error.message, apiKey);
  return {
    run_id: prompt.run_id,
    docai_http: prompt.docai_http,
    candidate: prompt.candidate,
    baseline: prompt.baseline,
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

export function writeOpenApiRunRecords(records) {
  const byCondition = new Map();
  records.forEach((record) => {
    const condition = record.baseline.condition;
    if (!byCondition.has(condition)) byCondition.set(condition, []);
    byCondition.get(condition).push(record);
  });

  return [...byCondition.entries()].map(([condition, conditionRecords]) => {
    const outputFile = path.join(RUNS_DIR, `${condition}.jsonl`);
    mergeRunRecords(outputFile, conditionRecords);
    return { condition, outputFile, count: conditionRecords.length };
  });
}

export function promptSystem(prompt) {
  const message = prompt.messages.find((candidate) => candidate.role === "system");
  if (!message?.content) throw new Error(`OpenAPI prompt ${prompt.run_id} lacks a system message.`);
  return message.content;
}

export function promptUser(prompt) {
  const message = prompt.messages.find((candidate) => candidate.role === "user");
  if (!message?.content) throw new Error(`OpenAPI prompt ${prompt.run_id} lacks a user message.`);
  return message.content;
}
