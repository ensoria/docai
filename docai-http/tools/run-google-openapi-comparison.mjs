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

const INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("GOOGLE_API_KEY is required.");
  process.exit(1);
}

let selection;
try {
  selection = selectOpenApiPromptRuns(process.argv.slice(2), "google", "google-stable-agentic");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const records = [];
for (const { prompt, task } of selection.promptRuns) {
  records.push(await runPrompt(prompt, task));
}

const written = writeOpenApiRunRecords(records);
console.log(`Recorded ${records.length} Google OpenAPI comparison run(s).`);
written.forEach((write) => console.log(`- ${write.condition}: ${write.count} record(s) in ${path.relative(process.cwd(), write.outputFile)}`));
records.forEach((record) => console.log(`- ${record.run_id}: ${record.status} (${record.review.notes})`));

async function runPrompt(prompt, task) {
  const executedAt = new Date().toISOString();
  try {
    const interaction = await callGoogle(prompt);
    const text = extractOutputText(interaction);
    const contentJson = parseModelJson(text);
    return openApiResultRecord(prompt, task, executedAt, contentJson, text, normalizeUsage(interaction));
  } catch (error) {
    return openApiBlockedRecord(prompt, task, executedAt, error, apiKey);
  }
}

async function callGoogle(prompt) {
  const body = {
    model: prompt.target.model,
    system_instruction: promptSystem(prompt),
    input: promptUser(prompt),
    generation_config: {
      temperature: Number(prompt.temperature ?? 0),
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
    const text = interaction.output
      .map((item) => item.text ?? item.content ?? "")
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }
  if (Array.isArray(interaction.steps)) {
    const text = interaction.steps
      .flatMap((step) => step.output ?? step.content ?? [])
      .map((item) => item.text ?? "")
      .filter(Boolean)
      .join("\n");
    if (text) return text;
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
