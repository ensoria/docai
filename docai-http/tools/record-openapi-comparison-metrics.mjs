#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  contextMetrics,
  OPENAPI_BASELINE_DIR,
  parseCommonArgs,
  readJson,
  selectComparableTasks,
  selectOpenApiConditions,
  SOURCE_OPENAPI_FILE,
  TASKS_FILE,
} from "./openapi-comparison-utils.mjs";

const args = parseCommonArgs(process.argv.slice(2));
const taskPacket = readJson(TASKS_FILE);
const conditions = selectOpenApiConditions(args.condition);
const tasks = selectComparableTasks(taskPacket, args.group, args.task);
const metrics = [];

for (const condition of conditions) {
  for (const task of tasks) {
    metrics.push(contextMetrics(task, condition));
  }
}

const packet = {
  docai_http: taskPacket.docai_http,
  candidate: taskPacket.candidate,
  baseline: "openapi-comparison",
  recorded_at: new Date().toISOString(),
  source: path.relative(process.cwd(), SOURCE_OPENAPI_FILE),
  metrics,
};

fs.mkdirSync(OPENAPI_BASELINE_DIR, { recursive: true });
fs.writeFileSync(path.join(OPENAPI_BASELINE_DIR, "context-metrics.json"), `${JSON.stringify(packet, null, 2)}\n`);
fs.writeFileSync(path.join(OPENAPI_BASELINE_DIR, "CONTEXT-METRICS.md"), metricsMarkdown(packet));

console.log(`Recorded ${metrics.length} OpenAPI comparison context metric row(s) in ${path.relative(process.cwd(), OPENAPI_BASELINE_DIR)}`);

function metricsMarkdown(packet) {
  const lines = [
    "# OpenAPI Baseline Context Metrics",
    "",
    "These deterministic local metrics describe the context supplied to OpenAPI comparison prompts. They are not provider tokenizer counts and are not live LLM results.",
    "",
    `Recorded at: ${packet.recorded_at}`,
    "",
    `Source: \`${packet.source}\``,
    "",
    "| Task | Group | Condition | UTF-8 bytes | Characters | Approx tokens(chars/4) |",
    "|---|---|---|---:|---:|---:|",
  ];

  packet.metrics.forEach((row) => {
    lines.push(
      `| ${row.task_id} | ${row.task_group} | ${row.condition} | ${row.context_utf8_bytes} | ${row.context_characters} | ${row.approx_tokens_chars_div_4} |`,
    );
  });

  lines.push(
    "",
    "Conditions:",
    "",
    "- `raw`: the complete source OpenAPI YAML as authored.",
    "- `sliced`: only the mapped OpenAPI paths, schemas, webhooks, and workflow extension blocks for the task.",
    "- `enriched`: the sliced OpenAPI context plus selected authoritative Markdown behavior notes used as an enrichment proxy for source facts not expressed in raw OpenAPI.",
    "",
  );
  return `${lines.join("\n")}`;
}
