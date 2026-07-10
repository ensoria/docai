#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "0.11.0";
const REQUIRED_GROUPS = new Set(["request_construction", "response_handling", "error_handling", "token_load"]);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "complete-candidates", `v${SPEC_VERSION}`);
const CANDIDATE_DIR = path.resolve(process.argv[2] ?? DEFAULT_DIR);
const TASKS_FILE = path.join(CANDIDATE_DIR, "evaluations", "tasks.json");
const TARGETS_FILE = path.join(CANDIDATE_DIR, "evaluations", "targets.json");
const RESULTS_FILE = path.join(CANDIDATE_DIR, "evaluations", "RESULTS.md");

const failures = [];
const metrics = [];

function fail(area, detail) {
  failures.push({ area, detail });
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function profileRoot(profile) {
  return path.join(CANDIDATE_DIR, "valid", profile);
}

function profilePath(profile, relativePath) {
  return path.join(profileRoot(profile), relativePath);
}

function ensurePathInProfile(task, profile, relativePath) {
  if (!/^[A-Za-z0-9._/-]+\.md$/.test(relativePath)) {
    throw new Error(`invalid docs-root-relative path ${relativePath}`);
  }
  const file = profilePath(profile, relativePath);
  if (!fs.existsSync(file)) throw new Error(`missing ${profile} context file ${relativePath}`);
  return file;
}

function contextFor(profile, load) {
  return load
    .map((relativePath) => {
      const file = ensurePathInProfile(null, profile, relativePath);
      return `\n\n<!-- ${profile}:${relativePath} -->\n\n${read(file)}`;
    })
    .join("");
}

function contextMetrics(taskId, label, context) {
  return {
    task_id: taskId,
    label,
    utf8_bytes: Buffer.byteLength(context, "utf8"),
    characters: [...context].length,
    approx_tokens_chars_div_4: Math.ceil([...context].length / 4),
  };
}

function validateTaskPacket(packet) {
  if (packet.docai_http !== SPEC_VERSION) throw new Error(`docai_http must be ${SPEC_VERSION}`);
  if (packet.candidate !== `complete-candidates/v${SPEC_VERSION}`) {
    throw new Error(`candidate must be complete-candidates/v${SPEC_VERSION}`);
  }
  if (!Array.isArray(packet.tasks) || packet.tasks.length === 0) throw new Error("tasks must be a non-empty array");

  const declaredGroups = new Set(packet.task_groups ?? []);
  REQUIRED_GROUPS.forEach((group) => {
    if (!declaredGroups.has(group)) throw new Error(`task_groups must include ${group}`);
  });

  const ids = new Set();
  const coveredGroups = new Set();
  packet.tasks.forEach((task) => {
    validateTask(task, ids);
    coveredGroups.add(task.group);
  });

  REQUIRED_GROUPS.forEach((group) => {
    if (!coveredGroups.has(group)) throw new Error(`tasks must include group ${group}`);
  });
}

function validateTask(task, ids) {
  if (!task.id || !/^[a-z0-9-]+$/.test(task.id)) throw new Error("task id must be kebab-case");
  if (ids.has(task.id)) throw new Error(`duplicate task id ${task.id}`);
  ids.add(task.id);
  if (!REQUIRED_GROUPS.has(task.group)) throw new Error(`unknown task group ${task.group}`);
  if (!task.user_task) throw new Error(`task ${task.id} lacks user_task`);
  if (!task.expected_outcome || typeof task.expected_outcome !== "object") {
    throw new Error(`task ${task.id} lacks expected_outcome`);
  }
  if (!Array.isArray(task.evidence) || task.evidence.length === 0) {
    throw new Error(`task ${task.id} lacks evidence strings`);
  }

  if (task.profile === "full" || task.profile === "compact") {
    validateSingleProfileTask(task);
    return;
  }
  if (task.profile === "comparison") {
    validateComparisonTask(task);
    return;
  }
  throw new Error(`task ${task.id} has invalid profile ${task.profile}`);
}

function validateSingleProfileTask(task) {
  if (!Array.isArray(task.load) || task.load.length === 0) throw new Error(`task ${task.id} load must be a non-empty array`);
  const context = contextFor(task.profile, task.load);
  assertEvidence(task, context);
  metrics.push(contextMetrics(task.id, task.profile, context));
}

function validateComparisonTask(task) {
  if (!task.load || !Array.isArray(task.load.full) || !Array.isArray(task.load.compact)) {
    throw new Error(`comparison task ${task.id} must have full and compact load arrays`);
  }
  const fullContext = contextFor("full", task.load.full);
  const compactContext = contextFor("compact", task.load.compact);
  assertEvidence(task, `${fullContext}\n${compactContext}`);
  const fullMetrics = contextMetrics(task.id, "full", fullContext);
  const compactMetrics = contextMetrics(task.id, "compact", compactContext);
  metrics.push(fullMetrics, compactMetrics);
  if (task.expected_outcome?.compact_chars_must_not_exceed_full_chars && compactMetrics.characters > fullMetrics.characters) {
    throw new Error(`comparison task ${task.id} compact context is larger than full context`);
  }
}

function assertEvidence(task, context) {
  task.evidence.forEach((needle) => {
    if (!context.includes(needle)) throw new Error(`task ${task.id} evidence string not found: ${needle}`);
  });
}

try {
  const packet = readJson(TASKS_FILE);
  validateTaskPacket(packet);
  validateTargets(readJson(TARGETS_FILE), packet);
} catch (error) {
  fail("evaluation-packet", error.message);
}

try {
  validateResultsTargetList(read(RESULTS_FILE), readJson(TARGETS_FILE));
} catch (error) {
  fail("evaluation-results", error.message);
}

if (failures.length > 0) {
  console.error("Complete candidate evaluation check failed:");
  failures.forEach((failure) => console.error(`- ${failure.area}: ${failure.detail}`));
  process.exit(1);
}

console.log(`Complete candidate evaluation check passed for ${path.relative(process.cwd(), CANDIDATE_DIR) || "."}`);
console.log("");
console.log("| Task | Context | UTF-8 bytes | Characters | Approx tokens(chars/4) |");
console.log("|---|---|---:|---:|---:|");
metrics.forEach((row) => {
  console.log(
    `| ${row.task_id} | ${row.label} | ${row.utf8_bytes} | ${row.characters} | ${row.approx_tokens_chars_div_4} |`,
  );
});

function validateTargets(targetPacket, taskPacket) {
  if (targetPacket.docai_http !== SPEC_VERSION) throw new Error(`targets docai_http must be ${SPEC_VERSION}`);
  if (targetPacket.candidate !== taskPacket.candidate) throw new Error("targets candidate must match tasks candidate");
  if (!targetPacket.decided_on) throw new Error("targets decided_on is required");
  if (!Array.isArray(targetPacket.source_docs) || targetPacket.source_docs.length < 3) {
    throw new Error("targets must record official source docs for each provider");
  }
  ["openai", "anthropic", "google"].forEach((provider) => {
    if (!targetPacket.source_docs.some((source) => source.provider === provider && source.url && source.checked_on)) {
      throw new Error(`targets source_docs must include ${provider}`);
    }
  });

  if (!Array.isArray(targetPacket.targets) || targetPacket.targets.length === 0) throw new Error("targets must be non-empty");
  const ids = new Set();
  const requiredProviders = new Set();
  targetPacket.targets.forEach((target) => {
    validateTarget(target, ids);
    if (target.required) requiredProviders.add(target.provider);
  });
  ["openai", "anthropic", "google"].forEach((provider) => {
    if (!requiredProviders.has(provider)) throw new Error(`required targets must include ${provider}`);
  });
}

function validateTarget(target, ids) {
  if (!target.id || !/^[a-z0-9-]+$/.test(target.id)) throw new Error("target id must be kebab-case");
  if (ids.has(target.id)) throw new Error(`duplicate target id ${target.id}`);
  ids.add(target.id);
  if (!["openai", "anthropic", "google"].includes(target.provider)) {
    throw new Error(`unknown target provider ${target.provider}`);
  }
  if (!target.model || !/^[A-Za-z0-9._:@-]+$/.test(target.model)) throw new Error(`target ${target.id} has invalid model`);
  if (typeof target.required !== "boolean") throw new Error(`target ${target.id} required must be boolean`);
  if (!target.role) throw new Error(`target ${target.id} lacks role`);
  if (!Array.isArray(target.task_groups) || target.task_groups.length === 0) {
    throw new Error(`target ${target.id} task_groups must be non-empty`);
  }
  REQUIRED_GROUPS.forEach((group) => {
    if (!target.task_groups.includes(group)) throw new Error(`target ${target.id} must include task group ${group}`);
  });
}

function validateResultsTargetList(results, targetPacket) {
  if (!results.includes("## Target LLM List")) throw new Error("RESULTS.md lacks Target LLM List section");
  targetPacket.targets.forEach((target) => {
    if (!results.includes(`| ${target.id} | ${target.provider} | ${target.model} |`)) {
      throw new Error(`RESULTS.md lacks target row for ${target.id}`);
    }
  });
}
