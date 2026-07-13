#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import { parseJsonOrText, parseModelJson, redact } from "./complete-evaluation-runner-utils.mjs";
import {
  openApiBlockedRecord,
  openApiResultRecord,
  promptSystem,
  promptUser,
  selectOpenApiPromptRuns,
  writeOpenApiRunRecords,
} from "./openapi-comparison-provider-utils.mjs";

const MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 4096;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY is required.");
  process.exit(1);
}

let selection;
try {
  selection = selectOpenApiPromptRuns(process.argv.slice(2), "anthropic", "anthropic-balanced");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const records = [];
for (const { prompt, task } of selection.promptRuns) {
  records.push(await runPrompt(prompt, task));
}

const written = writeOpenApiRunRecords(records);
console.log(`Recorded ${records.length} Anthropic OpenAPI comparison run(s).`);
written.forEach((write) => console.log(`- ${write.condition}: ${write.count} record(s) in ${path.relative(process.cwd(), write.outputFile)}`));
records.forEach((record) => console.log(`- ${record.run_id}: ${record.status} (${record.review.notes})`));

async function runPrompt(prompt, task) {
  const executedAt = new Date().toISOString();
  try {
    const message = await callAnthropic(prompt);
    const text = extractOutputText(message);
    const contentJson = parseModelJson(text);
    return openApiResultRecord(prompt, task, executedAt, contentJson, text, normalizeUsage(message));
  } catch (error) {
    return openApiBlockedRecord(prompt, task, executedAt, error, apiKey);
  }
}

async function callAnthropic(prompt) {
  const body = {
    model: prompt.target.model,
    max_tokens: MAX_TOKENS,
    system: promptSystem(prompt),
    messages: [
      {
        role: "user",
        content: promptUser(prompt),
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
