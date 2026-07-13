#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import { gradeEvaluationResponse } from "./complete-evaluation-grader.mjs";
import {
  buildPromptRecord,
  blockedRecord,
  mergeRunRecords,
  outputFileForGroup,
  parseArgs,
  parseJsonOrText,
  parseModelJson,
  readJson,
  redact,
  selectTarget,
  selectTasks,
  TARGETS_FILE,
  TASKS_FILE,
} from "./complete-evaluation-runner-utils.mjs";

const MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 2048;

const args = parseArgs(process.argv.slice(2), "request_construction", "anthropic-balanced");
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("ANTHROPIC_API_KEY is required.");
  process.exit(1);
}

const taskPacket = readJson(TASKS_FILE);
const targetPacket = readJson(TARGETS_FILE);
let target;
let tasks;
try {
  target = selectTarget(targetPacket, args.target, "anthropic");
  tasks = selectTasks(taskPacket, args.group, args.task);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const records = [];
for (const task of tasks) {
  const prompt = buildPromptRecord(taskPacket, target, task);
  records.push(await runPrompt(prompt, task));
}

const outputFile = outputFileForGroup(args.group);
mergeRunRecords(outputFile, records);
console.log(`Recorded ${records.length} ${args.target} ${args.group} run(s) in ${path.relative(process.cwd(), outputFile)}`);
records.forEach((record) => {
  console.log(`- ${record.run_id}: ${record.status} (${record.review.notes})`);
});

async function runPrompt(prompt, task) {
  const executedAt = new Date().toISOString();
  try {
    const message = await callAnthropic(prompt);
    const text = extractOutputText(message);
    const contentJson = parseModelJson(text);
    const grade = gradeEvaluationResponse(contentJson, task);
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
        usage: normalizeUsage(message),
      },
    };
  } catch (error) {
    return blockedRecord(prompt, task, executedAt, error, apiKey);
  }
}

async function callAnthropic(prompt) {
  const body = {
    model: prompt.target.model,
    max_tokens: MAX_TOKENS,
    system: prompt.system,
    messages: [
      {
        role: "user",
        content: prompt.user,
      },
    ],
  };
  const response = await fetch(MESSAGES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = parseJsonOrText(text);
  if (!response.ok) {
    throw new Error(`Anthropic API HTTP ${response.status}: ${summarizeProviderError(parsed)}`);
  }
  return parsed;
}

function summarizeProviderError(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return redact(text, apiKey).slice(0, 600);
}

function extractOutputText(message) {
  if (Array.isArray(message.content)) {
    const text = message.content
      .map((content) => (content.type === "text" ? content.text : ""))
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }
  throw new Error("Anthropic response did not include text content");
}

function normalizeUsage(message) {
  const usage = message.usage ?? {};
  return {
    input_tokens: usage.input_tokens ?? null,
    output_tokens: usage.output_tokens ?? null,
    total_tokens: usage.input_tokens && usage.output_tokens ? usage.input_tokens + usage.output_tokens : null,
  };
}
