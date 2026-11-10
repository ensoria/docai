#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readTaskPacket } from "./contract.mjs";
import { PACKAGE_DIR, PRIVATE_DIR, buildCalibrationSchedule, readPlan } from "./paths.mjs";
import { buildCalibrationPrompts, buildPromptMetrics } from "./prompt.mjs";
import { validatePlan } from "./check-plan.mjs";
import { assertPlainJson } from "./strict-json.mjs";

export const CALIBRATION_SCHEDULE_FILE = path.join(PACKAGE_DIR, "calibration-schedule.jsonl");
export const CALIBRATION_PROMPTS_FILE = path.join(PRIVATE_DIR, "prompts", "calibration.jsonl");
export const CALIBRATION_METRICS_FILE = path.join(PRIVATE_DIR, "contexts", "calibration-metrics.json");

export function assertSafePrivateOutputPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new TypeError("private output path must be a non-empty string");
  }
  rejectSymlinkPath(PRIVATE_DIR, candidate, "private");
  return candidate;
}

export function buildCanonicalPromptArtifacts(input = {}) {
  assertPlainJson(input, "canonical prompt artifact input");
  const { plan = readPlan(), packet = undefined } = input;
  validatePlan(plan);
  const resolvedPacket = packet ?? readTaskPacket(plan);
  const schedule = buildCalibrationSchedule(plan);
  validateSchedule(schedule, plan);
  const prompts = buildCalibrationPrompts({ plan, packet: resolvedPacket });
  const metrics = buildPromptMetrics(prompts, { plan, packet: resolvedPacket });
  return { schedule, prompts, metrics };
}

export function writeCanonicalPromptArtifacts(input = {}) {
  const { schedule, prompts, metrics } = buildCanonicalPromptArtifacts(input);
  const scheduleJsonl = `${schedule.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const promptsJsonl = `${prompts.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const metricsJson = `${JSON.stringify(metrics, null, 2)}\n`;

  assertCheckedInSchedule(scheduleJsonl);
  atomicWritePrivate(CALIBRATION_PROMPTS_FILE, promptsJsonl);
  atomicWritePrivate(CALIBRATION_METRICS_FILE, metricsJson);
  return { schedule, prompts, metrics };
}

function validateSchedule(schedule, plan) {
  if (!Array.isArray(schedule) || schedule.length !== plan.calibration.planned_requests) {
    throw new Error(`calibration schedule must contain ${plan.calibration.planned_requests} rows`);
  }
  const expected = buildCalibrationSchedule(plan);
  if (JSON.stringify(schedule) !== JSON.stringify(expected)) {
    throw new Error("calibration schedule must match the canonical plan-derived matrix");
  }
  if (new Set(schedule.map((row) => row.run_id)).size !== schedule.length) {
    throw new Error("calibration schedule must have unique run identities");
  }
}

function assertCheckedInSchedule(expectedJsonl) {
  rejectSymlinkPath(PACKAGE_DIR, CALIBRATION_SCHEDULE_FILE);
  if (!fs.existsSync(CALIBRATION_SCHEDULE_FILE)) {
    throw new Error(`canonical calibration schedule is missing: ${CALIBRATION_SCHEDULE_FILE}`);
  }
  const stat = fs.lstatSync(CALIBRATION_SCHEDULE_FILE);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("canonical calibration schedule must be a regular file");
  }
  if (fs.readFileSync(CALIBRATION_SCHEDULE_FILE, "utf8") !== expectedJsonl) {
    throw new Error("canonical calibration schedule does not match the plan-derived matrix");
  }
}

function atomicWritePrivate(file, contents) {
  const parent = path.dirname(file);
  prepareTrustedPrivateDirectory(parent);
  assertSafePrivateOutputPath(file);
  const temporary = path.join(parent, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  const descriptor = fs.openSync(temporary, privateOpenFlags(fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL), 0o600);
  let temporaryStat;
  try {
    assertPrivateFileDescriptor(descriptor, temporary);
    fs.fchmodSync(descriptor, 0o600);
    fs.writeFileSync(descriptor, contents, "utf8");
    fs.fsyncSync(descriptor);
    temporaryStat = fs.fstatSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    assertTrustedPrivateDirectory(parent);
    rejectSymlink(file);
    fs.renameSync(temporary, file);
    const finalDescriptor = fs.openSync(file, privateOpenFlags(fs.constants.O_RDONLY));
    try {
      const finalStat = assertPrivateFileDescriptor(finalDescriptor, file);
      if (finalStat.dev !== temporaryStat.dev || finalStat.ino !== temporaryStat.ino) {
        throw new Error(`private output identity changed during atomic replacement: ${file}`);
      }
      fs.fchmodSync(finalDescriptor, 0o600);
      fs.fsyncSync(finalDescriptor);
    } finally {
      fs.closeSync(finalDescriptor);
    }
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function prepareTrustedPrivateDirectory(directory) {
  assertSafePrivateOutputPath(directory);
  assertTrustedAncestry(path.dirname(PRIVATE_DIR));
  const relative = path.relative(PRIVATE_DIR, directory);
  const directories = [PRIVATE_DIR];
  let current = PRIVATE_DIR;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    directories.push(current);
  }
  for (const candidate of directories) {
    rejectSymlink(candidate);
    if (!pathExists(candidate)) fs.mkdirSync(candidate, { mode: 0o700 });
    assertTrustedPrivateDirectory(candidate, { normalizeMode: true });
  }
}

function assertTrustedAncestry(directory) {
  const resolved = path.resolve(directory);
  const root = path.parse(resolved).root;
  let current = root;
  const candidates = [root];
  for (const segment of path.relative(root, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    candidates.push(current);
  }
  for (const candidate of candidates) {
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`private output ancestry must contain only real directories: ${candidate}`);
    }
    if ((stat.mode & 0o022) !== 0) {
      throw new Error(`private output has a group or other writable ancestor: ${candidate}`);
    }
  }
}

function assertTrustedPrivateDirectory(directory, { normalizeMode = false } = {}) {
  assertSafePrivateOutputPath(directory);
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`private path must be a real directory: ${directory}`);
  }
  assertCurrentUserOwner(stat, directory);
  if ((stat.mode & 0o022) !== 0) {
    throw new Error(`private directory must not be group or other writable: ${directory}`);
  }
  if (normalizeMode && (stat.mode & 0o777) !== 0o700) fs.chmodSync(directory, 0o700);
  const finalStat = fs.lstatSync(directory);
  assertCurrentUserOwner(finalStat, directory);
  if ((finalStat.mode & 0o777) !== 0o700) {
    throw new Error(`private directory must have mode 0700: ${directory}`);
  }
}

function assertPrivateFileDescriptor(descriptor, file) {
  const stat = fs.fstatSync(descriptor);
  if (!stat.isFile()) throw new Error(`private output must be a regular file: ${file}`);
  assertCurrentUserOwner(stat, file);
  return stat;
}

function assertCurrentUserOwner(stat, candidate) {
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error(`private path must be owned by the current user: ${candidate}`);
  }
}

function privateOpenFlags(flags) {
  return Number.isInteger(fs.constants.O_NOFOLLOW) ? flags | fs.constants.O_NOFOLLOW : flags;
}

function pathExists(candidate) {
  try {
    fs.lstatSync(candidate);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function rejectSymlinkPath(root, candidate, label = "package") {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`unsafe ${label} path: ${candidate}`);
  }
  rejectSymlink(resolvedRoot);
  let current = resolvedRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    rejectSymlink(current);
  }
}

function rejectSymlink(candidate) {
  try {
    if (fs.lstatSync(candidate).isSymbolicLink()) {
      throw new Error(`symlinks are not allowed in private paths: ${candidate}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => argument !== "--summary")) {
    throw new Error("usage: build-prompts.mjs [--summary]");
  }
  const { prompts } = writeCanonicalPromptArtifacts();
  if (arguments_.includes("--summary")) {
    console.log(`Benchmark: ${readPlan().benchmark_id}`);
    console.log(`Plan: ${readPlan().plan_version}`);
    console.log(`Prompt records: ${prompts.length}`);
    console.log(`Unique run IDs: ${new Set(prompts.map((record) => record.run_id)).size}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
