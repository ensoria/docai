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

const INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

const args = parseArgs(process.argv.slice(2), "request_construction", "google-stable-agentic");
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("GOOGLE_API_KEY is required.");
  process.exit(1);
}

const taskPacket = readJson(TASKS_FILE);
const targetPacket = readJson(TARGETS_FILE);
let target;
let tasks;
try {
  target = selectTarget(targetPacket, args.target, "google");
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
    const interaction = await callGoogle(prompt);
    const text = extractOutputText(interaction);
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
        usage: normalizeUsage(interaction),
      },
    };
  } catch (error) {
    return blockedRecord(prompt, task, executedAt, error, apiKey);
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

function summarizeProviderError(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return redact(text, apiKey).slice(0, 600);
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

function normalizeUsage(interaction) {
  const usage = interaction.usage_metadata ?? interaction.usageMetadata ?? interaction.usage ?? {};
  return {
    input_tokens: usage.input_token_count ?? usage.promptTokenCount ?? usage.input_tokens ?? null,
    output_tokens: usage.output_token_count ?? usage.candidatesTokenCount ?? usage.output_tokens ?? null,
    total_tokens: usage.total_token_count ?? usage.totalTokenCount ?? usage.total_tokens ?? null,
  };
}
