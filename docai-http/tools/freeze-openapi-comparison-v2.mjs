#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BENCHMARK_DIR,
  readV2Plan,
} from "./openapi-comparison-v2-utils.mjs";

const REPOSITORY_ROOT = path.resolve(BENCHMARK_DIR, "..", "..", "..", "..");
const MANIFEST_FILE = path.join(BENCHMARK_DIR, "freeze-manifest.json");
const MODEL_RESOLUTIONS_FILE = path.join(BENCHMARK_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(BENCHMARK_DIR, "cost-estimate.json");
const SCHEDULE_FILE = path.join(BENCHMARK_DIR, "schedule.jsonl");

const SECRET_PATTERNS = [
  {
    name: "provider API key assignment",
    expression: /(?:OPENAI|ANTHROPIC|GOOGLE|GEMINI)_API_KEY\s*[:=]\s*(?![<${])["']?[^\s"']{8,}/i,
  },
  {
    name: "OpenAI or Anthropic-style secret",
    expression: /\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}\b/,
  },
  {
    name: "Google API key",
    expression: /\bAIza[A-Za-z0-9_-]{24,}\b/,
  },
];

export function buildFreezeManifest({
  plan,
  artifacts,
  rootDir,
  frozenAt,
}) {
  assertFrozenPlan(plan);
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new Error("freeze artifacts must be a non-empty array");
  }
  if (!frozenAt || Number.isNaN(Date.parse(frozenAt))) {
    throw new Error("frozenAt must be an ISO-compatible timestamp");
  }

  const normalizedArtifacts = artifacts.map((artifact) => {
    validateArtifactDescriptor(artifact);
    const absolutePath = resolveLogicalPath(rootDir, artifact.path);
    if (!fs.statSync(absolutePath).isFile()) {
      throw new Error(`freeze artifact is not a file: ${artifact.path}`);
    }
    assertFileContainsNoSecrets(absolutePath, artifact.path);
    return {
      class: artifact.class,
      path: normalizeLogicalPath(artifact.path),
      visibility: artifact.visibility,
      sha256: sha256File(absolutePath),
    };
  }).sort(compareArtifacts);

  assertRequiredClasses(plan, normalizedArtifacts);
  assertUniqueArtifactPaths(normalizedArtifacts);

  return {
    manifest_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    frozen_at: frozenAt,
    hash_algorithm: "sha256",
    artifact_count: normalizedArtifacts.length,
    artifacts: normalizedArtifacts,
  };
}

export function validateFrozenArtifacts({ plan, manifest, rootDir }) {
  assertFrozenPlan(plan);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("freeze manifest must be an object");
  }
  if (manifest.benchmark_id !== plan.benchmark_id) {
    throw new Error("freeze manifest benchmark_id does not match the plan");
  }
  if (manifest.plan_version !== plan.plan_version) {
    throw new Error("freeze manifest plan_version does not match the plan");
  }
  if (manifest.frozen_at !== plan.freeze.frozen_at) {
    throw new Error("freeze manifest frozen_at does not match the plan");
  }
  if (manifest.hash_algorithm !== "sha256") {
    throw new Error("freeze manifest hash_algorithm must be sha256");
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    throw new Error("freeze manifest artifacts must be a non-empty array");
  }
  if (manifest.artifact_count !== manifest.artifacts.length) {
    throw new Error("freeze manifest artifact_count does not match artifacts");
  }

  assertRequiredClasses(plan, manifest.artifacts);
  assertUniqueArtifactPaths(manifest.artifacts);
  manifest.artifacts.forEach((artifact) => {
    validateArtifactDescriptor(artifact);
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256 ?? "")) {
      throw new Error(`artifact ${artifact.path} lacks a valid SHA-256`);
    }
    const absolutePath = resolveLogicalPath(rootDir, artifact.path);
    assertFileContainsNoSecrets(absolutePath, artifact.path);
    const actual = sha256File(absolutePath);
    if (actual !== artifact.sha256) {
      throw new Error(`SHA-256 mismatch for ${artifact.path}`);
    }
  });
  return true;
}

export function collectFreezeArtifacts({
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  const benchmarkDir = path.join(
    repositoryRoot,
    "docai-http",
    "benchmarks",
    "openapi-comparison",
    "v2",
  );
  const conformanceDir = path.join(
    repositoryRoot,
    "docai-http",
    "fixtures",
    "conformance",
    "v1.0.0",
  );
  const privateDir = path.join(benchmarkDir, "private");
  const toolsDir = path.join(repositoryRoot, "docai-http", "tools");
  const artifacts = [];

  addFiles(artifacts, repositoryRoot, "authoritative-sources", [
    path.join(conformanceDir, "source", "complete-input-set.yaml"),
    path.join(conformanceDir, "source", "complete-openapi.yaml"),
    path.join(conformanceDir, "source", "complete-behavior.yaml"),
    ...filesBelow(path.join(privateDir, "holdouts", "field-service", "source")),
    ...filesBelow(path.join(privateDir, "holdouts", "media-processing", "source")),
  ]);
  addFiles(artifacts, repositoryRoot, "docai-contexts", [
    ...filesBelow(path.join(conformanceDir, "valid", "full")),
    ...filesBelow(path.join(conformanceDir, "valid", "compact")),
    ...filesBelow(path.join(privateDir, "holdouts", "field-service", "docai")),
    ...filesBelow(path.join(privateDir, "holdouts", "media-processing", "docai")),
  ]);
  addFiles(artifacts, repositoryRoot, "tasks-and-expected-outcomes", [
    path.join(benchmarkDir, "continuity", "tasks.json"),
    path.join(privateDir, "holdouts", "field-service", "tasks.json"),
    path.join(privateDir, "holdouts", "media-processing", "tasks.json"),
  ]);
  addFiles(artifacts, repositoryRoot, "prompt-templates-and-output-schemas", [
    path.join(benchmarkDir, "contracts.json"),
    path.join(toolsDir, "openapi-comparison-v2-contract.mjs"),
    path.join(toolsDir, "openapi-comparison-v2-prompt.mjs"),
    path.join(privateDir, "prompts", "primary.jsonl"),
  ]);
  addFiles(artifacts, repositoryRoot, "graders", [
    path.join(toolsDir, "openapi-comparison-v2-grader.mjs"),
    path.join(benchmarkDir, "continuity", "positive-results.json"),
    path.join(benchmarkDir, "continuity", "negative-results.json"),
    path.join(privateDir, "holdouts", "field-service", "positive-results.json"),
    path.join(privateDir, "holdouts", "field-service", "negative-results.json"),
    path.join(privateDir, "holdouts", "media-processing", "positive-results.json"),
    path.join(privateDir, "holdouts", "media-processing", "negative-results.json"),
  ]);
  addFiles(artifacts, repositoryRoot, "context-builders", [
    path.join(toolsDir, "openapi-comparison-v2-context.mjs"),
    path.join(toolsDir, "openapi-comparison-v2-utils.mjs"),
    path.join(toolsDir, "check-openapi-comparison-v2-parity.mjs"),
    path.join(privateDir, "contexts", "context-metrics.json"),
  ]);
  addFiles(artifacts, repositoryRoot, "model-resolutions", [path.join(benchmarkDir, "model-resolutions.json")]);
  addFiles(artifacts, repositoryRoot, "cost-estimate", [path.join(benchmarkDir, "cost-estimate.json")]);
  addFiles(artifacts, repositoryRoot, "execution-schedule", [path.join(benchmarkDir, "schedule.jsonl")]);
  return artifacts;
}

export function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assertFrozenPlan(plan) {
  if (plan?.status !== "frozen") throw new Error("plan status must be frozen");
  if (!/^2\.0\.0-frozen\.\d+$/.test(plan.plan_version ?? "")) {
    throw new Error("plan_version must identify a frozen v2 plan");
  }
  if (!plan.freeze?.frozen_at || Number.isNaN(Date.parse(plan.freeze.frozen_at))) {
    throw new Error("plan freeze.frozen_at must be an ISO-compatible timestamp");
  }
}

function assertRequiredClasses(plan, artifacts) {
  const classes = new Set(artifacts.map((artifact) => artifact.class));
  (plan.freeze?.required_artifact_classes ?? []).forEach((artifactClass) => {
    if (!classes.has(artifactClass)) {
      throw new Error(`missing required artifact class ${artifactClass}`);
    }
  });
}

function assertUniqueArtifactPaths(artifacts) {
  const paths = new Set();
  artifacts.forEach((artifact) => {
    if (paths.has(artifact.path)) throw new Error(`duplicate freeze artifact path ${artifact.path}`);
    paths.add(artifact.path);
  });
}

function validateArtifactDescriptor(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    throw new Error("freeze artifact descriptor must be an object");
  }
  if (typeof artifact.class !== "string" || artifact.class.trim() === "") {
    throw new Error("freeze artifact class must be a non-empty string");
  }
  if (typeof artifact.path !== "string" || artifact.path.trim() === "") {
    throw new Error("freeze artifact path must be a non-empty string");
  }
  if (!["public", "private"].includes(artifact.visibility)) {
    throw new Error(`artifact ${artifact.path} visibility must be public or private`);
  }
}

function assertFileContainsNoSecrets(file, logicalPath) {
  if (!fs.existsSync(file)) throw new Error(`freeze artifact is missing: ${logicalPath}`);
  const content = fs.readFileSync(file);
  if (content.includes(0)) return;
  const text = content.toString("utf8");
  SECRET_PATTERNS.forEach(({ name, expression }) => {
    if (expression.test(text)) {
      throw new Error(`possible secret (${name}) in ${logicalPath}`);
    }
  });
}

function addFiles(artifacts, root, artifactClass, files) {
  files.forEach((file) => {
    if (!fs.existsSync(file)) throw new Error(`required freeze artifact is missing: ${file}`);
    artifacts.push({
      class: artifactClass,
      path: normalizeLogicalPath(path.relative(root, file)),
      visibility: isPrivatePath(file) ? "private" : "public",
    });
  });
}

function filesBelow(directory) {
  if (!fs.existsSync(directory)) throw new Error(`required freeze directory is missing: ${directory}`);
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.name === ".DS_Store") return [];
      if (entry.isDirectory()) return filesBelow(file);
      return entry.isFile() ? [file] : [];
    })
    .sort();
}

function isPrivatePath(file) {
  return normalizeLogicalPath(file).includes("/benchmarks/openapi-comparison/v2/private/");
}

function normalizeLogicalPath(file) {
  return file.split(path.sep).join("/");
}

function resolveLogicalPath(rootDir, logicalPath) {
  if (path.isAbsolute(logicalPath)) throw new Error(`artifact path must be relative: ${logicalPath}`);
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(resolvedRoot, logicalPath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`artifact path escapes root: ${logicalPath}`);
  }
  return resolved;
}

function compareArtifacts(left, right) {
  return left.class.localeCompare(right.class) || left.path.localeCompare(right.path);
}

function runCli() {
  const plan = readV2Plan();
  if (process.argv.includes("--check")) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
    validateFrozenArtifacts({ plan, manifest, rootDir: REPOSITORY_ROOT });
    console.log(`Freeze manifest check passed for ${path.relative(process.cwd(), MANIFEST_FILE)}`);
    return;
  }
  if (!process.argv.includes("--write")) {
    console.error("Usage: freeze-openapi-comparison-v2.mjs --write | --check");
    process.exitCode = 2;
    return;
  }

  for (const requiredFile of [MODEL_RESOLUTIONS_FILE, COST_ESTIMATE_FILE, SCHEDULE_FILE]) {
    if (!fs.existsSync(requiredFile)) {
      throw new Error(`required preflight output is missing: ${path.relative(process.cwd(), requiredFile)}`);
    }
  }
  const artifacts = collectFreezeArtifacts();
  const manifest = buildFreezeManifest({
    plan,
    artifacts,
    rootDir: REPOSITORY_ROOT,
    frozenAt: plan.freeze.frozen_at,
  });
  fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.artifact_count} hashes to ${path.relative(process.cwd(), MANIFEST_FILE)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
