#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  CONTEXT_METRICS_FILE,
  CONTEXT_METRICS_MARKDOWN_FILE,
  PRIMARY_PROMPTS_FILE,
  buildPromptMetricsPacket,
  readPromptRecords,
} from "./openapi-comparison-v2-prompt.mjs";

const records = readPromptRecords(PRIMARY_PROMPTS_FILE);
const packet = buildPromptMetricsPacket(records);
const write = process.argv.includes("--write");

if (write) {
  fs.mkdirSync(path.dirname(CONTEXT_METRICS_FILE), { recursive: true });
  fs.writeFileSync(CONTEXT_METRICS_FILE, `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(CONTEXT_METRICS_MARKDOWN_FILE, metricsMarkdown(packet));
  console.error(
    `Wrote ${packet.rows.length} context metric rows to ${path.relative(process.cwd(), CONTEXT_METRICS_FILE)}`,
  );
}

console.log(`Benchmark: ${packet.benchmark_id}`);
console.log(`Plan: ${packet.plan_version}`);
console.log(`Metric rows: ${packet.rows.length}`);
console.log(`Provider tokenizer counts: ${hasTokenizerCounts(packet) ? "present" : "not recorded"}`);

function hasTokenizerCounts(metricsPacket) {
  return metricsPacket.rows.some((row) => Object.keys(row.tokenizer_counts).length > 0);
}

function metricsMarkdown(metricsPacket) {
  const grouped = new Map();
  metricsPacket.rows.forEach((row) => {
    const key = `${row.api_id}\0${row.task_id}\0${row.condition}`;
    if (!grouped.has(key)) grouped.set(key, row);
  });

  const lines = [
    "# OpenAPI Comparison v2 Context Metrics",
    "",
    "These deterministic local measurements are descriptive. Characters/4 is not a provider tokenizer count.",
    "",
    `Benchmark: \`${metricsPacket.benchmark_id}\``,
    "",
    `Plan: \`${metricsPacket.plan_version}\``,
    "",
    `Primary run rows: ${metricsPacket.rows.length}`,
    "",
    "| API | Task | Condition | Context bytes | Context chars | Context chars/4 | Prompt bytes | Prompt chars | Prompt chars/4 |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|",
  ];

  grouped.forEach((row) => {
    lines.push(
      `| ${row.api_id} | ${row.task_id} | ${row.condition} | `
      + `${row.context_utf8_bytes} | ${row.context_characters} | `
      + `${row.context_approx_tokens_chars_div_4} | ${row.prompt_utf8_bytes} | `
      + `${row.prompt_characters} | ${row.prompt_approx_tokens_chars_div_4} |`,
    );
  });
  lines.push(
    "",
    "Provider tokenizer counts are omitted until a stable tokenizer is available without adding a benchmark runtime dependency. Provider-reported input tokens remain the primary efficiency measurement during Live execution.",
    "",
  );
  return lines.join("\n");
}
