#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import {
  adjudicationDirectory,
  blindedIdentityTermsForRuns,
  buildBlindedAdjudicationPacket,
  validateAdjudicationPacket,
} from "./openapi-comparison-v3-adjudication.mjs";
import { readCalibrationTaskPacket } from "./openapi-comparison-v3-context.mjs";
import {
  assertFinitePlainJson,
  canonicalJson,
} from "./openapi-comparison-v3-strict-json.mjs";
import { BENCHMARK_DIR, readV3Plan } from "./openapi-comparison-v3-utils.mjs";

export function checkAdjudicationPacket(input = {}) {
  assertFinitePlainJson(input, "adjudication check input");
  requireExactKeys(
    input,
    ["runs", "tasks", "packet", "requireComplete"],
    ["runs", "tasks", "packet"],
    "adjudication check input",
  );
  const requireComplete = input.requireComplete ?? false;
  if (typeof requireComplete !== "boolean") throw new TypeError("requireComplete must be a boolean");

  const expected = buildBlindedAdjudicationPacket({ runs: input.runs, tasks: input.tasks });
  const blindedTerms = blindedIdentityTermsForRuns(input.runs);
  const validation = validateAdjudicationPacket(input.packet, {
    requireComplete,
    blindedTerms,
  });
  const failures = [...validation.failures];
  if (failures.length > 0) return { failures, summary: validation.summary };

  if (!isDeepStrictEqual(packetHeader(input.packet), packetHeader(expected))) {
    failures.push("adjudication packet header does not match regenerated source evidence");
  }
  if (!sameMultiset(evidenceMultiset(input.packet), evidenceMultiset(expected))) {
    failures.push("automatic packet does not match the source inconclusive records as an evidence multiset");
  }
  return { failures, summary: validation.summary };
}

function runCli() {
  const plan = readV3Plan();
  const directory = adjudicationDirectory(plan.plan_version);
  const packetFile = path.join(directory, "review-packet.json");
  if (!fs.existsSync(packetFile)) {
    throw new Error(`adjudication packet is absent: ${path.relative(process.cwd(), packetFile)}`);
  }
  const runsFile = path.join(
    BENCHMARK_DIR,
    "private",
    "runs",
    plan.plan_version,
    "calibration",
    "runs.jsonl",
  );
  if (!fs.existsSync(runsFile)) {
    throw new Error(`calibration runs are absent: ${path.relative(process.cwd(), runsFile)}`);
  }
  const taskPacket = readCalibrationTaskPacket(plan);
  const result = checkAdjudicationPacket({
    runs: readJsonLines(runsFile),
    tasks: taskPacket.tasks,
    packet: JSON.parse(fs.readFileSync(packetFile, "utf8")),
    requireComplete: process.argv.includes("--require-complete"),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length > 0) process.exitCode = 1;
}

function packetHeader(packet) {
  return {
    packet_version: packet.packet_version,
    review_method: packet.review_method,
    evidence_role: packet.evidence_role,
    reviewer: packet.reviewer,
    case_count: packet.case_count,
  };
}

function evidenceMultiset(packet) {
  const counts = new Map();
  for (const reviewCase of packet.cases) {
    const evidence = {
      user_task: reviewCase.user_task,
      output_contract: reviewCase.output_contract,
      expected_assertions: reviewCase.expected_assertions,
      model_output: reviewCase.model_output,
      automatic_result: reviewCase.automatic_result,
    };
    const fingerprint = canonicalJson(evidence, "adjudication evidence");
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }
  return counts;
}

function sameMultiset(left, right) {
  if (left.size !== right.size) return false;
  return [...left].every(([key, count]) => right.get(key) === count);
}

function requireExactKeys(value, allowed, required, label) {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected !== undefined) throw new TypeError(`${label} has unexpected field ${unexpected}`);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) throw new TypeError(`${label} requires ${key}`);
  }
}

function readJsonLines(file) {
  const text = fs.readFileSync(file, "utf8");
  if (text === "") return [];
  if (!text.endsWith("\n")) throw new Error(`${file} must end with a newline`);
  return text.trimEnd().split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file} line ${index + 1} is not valid JSON: ${error.message}`);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
