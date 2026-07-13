#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import { gradeEvaluationResponse } from "./complete-evaluation-grader.mjs";
import {
  CANDIDATE_DIR,
  mergeRunRecords,
  outputFileForGroup,
  parseArgs,
  read,
  readJson,
  TARGETS_FILE,
  TASKS_FILE,
} from "./complete-evaluation-runner-utils.mjs";

const args = parseArgs(process.argv.slice(2), "token_load", "required");
const taskPacket = readJson(TASKS_FILE);
const targetPacket = readJson(TARGETS_FILE);
const tasks = selectTokenLoadTasks(taskPacket, args.task);
const targets = selectTargets(targetPacket, args.target);
const records = [];
const executedAt = new Date().toISOString();

for (const target of targets) {
  for (const task of tasks) {
    const contentJson = buildTokenLoadResult(task, target);
    const grade = gradeEvaluationResponse(contentJson, task);
    records.push({
      run_id: `${target.id}__${task.id}`,
      target_id: target.id,
      task_id: task.id,
      provider: target.provider,
      model: target.model,
      executed_at: executedAt,
      status: grade.pass ? "pass" : "fail",
      review: {
        matches_expected_outcome: grade.pass,
        fixture_gap: false,
        notes: grade.reasons.join("; "),
      },
      response: {
        content_json: contentJson,
        usage: {
          input_tokens: null,
          output_tokens: null,
          total_tokens: null,
          source: "deterministic local context metrics; not provider tokenizer usage",
        },
      },
    });
  }
}

const outputFile = outputFileForGroup("token_load");
mergeRunRecords(outputFile, records);
console.log(`Recorded ${records.length} token_load metric run(s) in ${path.relative(process.cwd(), outputFile)}`);
records.forEach((record) => {
  console.log(`- ${record.run_id}: ${record.status} (${record.review.notes})`);
});

function selectTokenLoadTasks(packet, taskFilter) {
  const tasks = packet.tasks.filter((task) => task.group === "token_load" && (!taskFilter || task.id === taskFilter));
  if (tasks.length === 0) throw new Error(`No token_load tasks found${taskFilter ? ` for ${taskFilter}` : ""}.`);
  return tasks;
}

function selectTargets(packet, targetFilter) {
  if (targetFilter && targetFilter !== "required") {
    const target = packet.targets.find((candidate) => candidate.id === targetFilter);
    if (!target) throw new Error(`Unknown target: ${targetFilter}`);
    return [target];
  }
  return packet.targets.filter((target) => target.required);
}

function buildTokenLoadResult(task, target) {
  const metrics = ["full", "compact"].map((profile) => profileMetrics(profile, task.load[profile]));
  const full = metrics.find((metric) => metric.profile === "full");
  const compact = metrics.find((metric) => metric.profile === "compact");
  const savedCharacters = full.characters - compact.characters;
  const savedApproxTokens = full.approx_tokens_chars_div_4 - compact.approx_tokens_chars_div_4;
  return {
    loaded_contexts: metrics,
    metrics_by_profile: Object.fromEntries(metrics.map((metric) => [metric.profile, metric])),
    preferred_context: compact.characters < full.characters ? "compact" : compact.characters === full.characters ? "tie" : "full",
    reason: `Compact context saves ${savedCharacters} characters and approximately ${savedApproxTokens} chars/4 tokens versus full for ${task.id}.`,
    provider_usage: "not collected; local deterministic context metrics only",
    target_model: target.model,
    evidence: task.evidence,
    uncertainties: [
      "Approximate tokens use characters divided by 4, not provider-specific tokenizers.",
      "Provider-reported usage is not comparable across providers and is not recorded by this local metric run.",
    ],
  };
}

function profileMetrics(profile, load) {
  const context = contextForProfile(profile, load);
  const characters = [...context].length;
  return {
    profile,
    utf8_bytes: Buffer.byteLength(context, "utf8"),
    characters,
    approx_tokens_chars_div_4: Math.ceil(characters / 4),
  };
}

function contextForProfile(profile, load) {
  return load
    .map((relativePath) => {
      const file = path.join(CANDIDATE_DIR, "valid", profile, relativePath);
      return `\n\n<!-- ${profile}:${relativePath} -->\n\n${read(file)}`;
    })
    .join("");
}
