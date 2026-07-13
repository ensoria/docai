#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import { gradeRequestConstructionResponse } from "./complete-evaluation-grader.mjs";
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

const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

const args = parseArgs(process.argv.slice(2), "request_construction", "openai-frontier");
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("OPENAI_API_KEY is required.");
  process.exit(1);
}

const taskPacket = readJson(TASKS_FILE);
const targetPacket = readJson(TARGETS_FILE);
let target;
let tasks;
try {
  target = selectTarget(targetPacket, args.target, "openai");
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
    const response = await callOpenAI(prompt);
    const text = extractOutputText(response);
    const contentJson = parseModelJson(text);
    const grade = gradeRequestConstructionResponse(contentJson, task);
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
        usage: normalizeUsage(response),
      },
    };
  } catch (error) {
    return blockedRecord(prompt, task, executedAt, error, apiKey);
  }
}

async function callOpenAI(prompt) {
  const body = {
    model: prompt.target.model,
    instructions: prompt.system,
    input: prompt.user,
    temperature: Number(targetPacket.selection_policy.temperature ?? 0),
  };
  const response = await fetch(RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = parseJsonOrText(text);
  if (!response.ok) {
    throw new Error(`OpenAI API HTTP ${response.status}: ${summarizeProviderError(parsed)}`);
  }
  return parsed;
}

function summarizeProviderError(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return redact(text, apiKey).slice(0, 600);
}

function extractOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  if (Array.isArray(response.output)) {
    const text = response.output
      .flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }
  throw new Error("OpenAI response did not include output text");
}

function normalizeUsage(response) {
  const usage = response.usage ?? {};
  return {
    input_tokens: usage.input_tokens ?? null,
    output_tokens: usage.output_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
  };
}
