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

const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is required.");
  process.exit(1);
}

let selection;
try {
  selection = selectOpenApiPromptRuns(process.argv.slice(2), "openai", "openai-frontier");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const records = [];
for (const { prompt, task } of selection.promptRuns) {
  records.push(await runPrompt(prompt, task));
}

const written = writeOpenApiRunRecords(records);
console.log(`Recorded ${records.length} OpenAI OpenAPI comparison run(s).`);
written.forEach((write) => console.log(`- ${write.condition}: ${write.count} record(s) in ${path.relative(process.cwd(), write.outputFile)}`));
records.forEach((record) => console.log(`- ${record.run_id}: ${record.status} (${record.review.notes})`));

async function runPrompt(prompt, task) {
  const executedAt = new Date().toISOString();
  try {
    const response = await callOpenAI(prompt);
    const text = extractOutputText(response);
    const contentJson = parseModelJson(text);
    return openApiResultRecord(prompt, task, executedAt, contentJson, text, normalizeUsage(response));
  } catch (error) {
    return openApiBlockedRecord(prompt, task, executedAt, error, apiKey);
  }
}

async function callOpenAI(prompt) {
  const body = {
    model: prompt.target.model,
    instructions: promptSystem(prompt),
    input: promptUser(prompt),
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
