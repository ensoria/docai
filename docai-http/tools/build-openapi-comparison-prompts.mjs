#!/usr/bin/env node

import process from "node:process";

import {
  buildOpenApiPromptRecord,
  parseCommonArgs,
  readJson,
  selectComparableTasks,
  selectOpenApiConditions,
  selectTargets,
  TARGETS_FILE,
  TASKS_FILE,
} from "./openapi-comparison-utils.mjs";

const args = parseCommonArgs(process.argv.slice(2));
const taskPacket = readJson(TASKS_FILE);
const targetPacket = readJson(TARGETS_FILE);
const conditions = selectOpenApiConditions(args.condition);
const tasks = selectComparableTasks(taskPacket, args.group, args.task);
const targets = selectTargets(targetPacket, args.target, args.includeOptional);
const records = [];

for (const condition of conditions) {
  for (const target of targets) {
    for (const task of tasks) {
      if (!target.task_groups.includes(task.group)) continue;
      records.push(buildOpenApiPromptRecord(taskPacket, targetPacket, target, task, condition));
    }
  }
}

if (records.length === 0) throw new Error("No OpenAPI comparison prompt records selected.");

if (args.summary) {
  console.log(`Prompt records: ${records.length}`);
  console.log(`Task group: ${args.group}`);
  console.log(`Conditions: ${unique(records.map((record) => record.baseline.condition)).join(", ")}`);
  console.log(`Targets: ${unique(records.map((record) => record.target.id)).join(", ")}`);
  console.log(`Tasks: ${unique(records.map((record) => record.task.id)).join(", ")}`);
} else {
  records.forEach((record) => console.log(JSON.stringify(record)));
}

function unique(values) {
  return [...new Set(values)];
}
