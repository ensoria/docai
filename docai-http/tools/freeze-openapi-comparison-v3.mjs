#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildCostEstimate,
  validateCostEstimate,
  validateModelResolutions,
} from "./estimate-openapi-comparison-v3-cost.mjs";
import {
  buildPromptMetricsPacket,
} from "./openapi-comparison-v3-prompt.mjs";
import { assertFinitePlainJson } from "./openapi-comparison-v3-strict-json.mjs";
import {
  BENCHMARK_DIR,
  buildCalibrationSchedule,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

const REPOSITORY_ROOT = path.resolve(BENCHMARK_DIR, "..", "..", "..", "..");
const MANIFEST_FILE = path.join(BENCHMARK_DIR, "freeze-manifest.json");
const PLAN_FILE = path.join(BENCHMARK_DIR, "plan.json");
const MODEL_RESOLUTIONS_FILE = path.join(BENCHMARK_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(BENCHMARK_DIR, "cost-estimate.json");
const SCHEDULE_FILE = path.join(BENCHMARK_DIR, "calibration-schedule.jsonl");
const PROMPTS_FILE = path.join(BENCHMARK_DIR, "private", "prompts", "calibration.jsonl");
const METRICS_FILE = path.join(BENCHMARK_DIR, "private", "contexts", "calibration-metrics.json");
const DEFAULT_FROZEN_AT = "2026-09-03T00:00:00Z";

export const REQUIRED_ARTIFACT_CLASSES = Object.freeze([
  "authoritative-sources",
  "docai-contexts",
  "tasks-and-expected-outcomes",
  "contracts-and-prompts",
  "parser-and-graders",
  "context-builders",
  "provider-adapters-and-runner",
  "calibration-schedule-and-gate",
  "model-resolutions",
  "cost-estimate",
  "imported-v2-dependencies",
]);

export const V2_IMPORTED_DEPENDENCIES = Object.freeze([
  "docai-http/tools/openapi-comparison-v2-context.mjs",
  "docai-http/tools/openapi-comparison-v2-contract.mjs",
  "docai-http/tools/openapi-comparison-v2-utils.mjs",
  "docai-http/benchmarks/openapi-comparison/v2/plan.json",
  "docai-http/benchmarks/openapi-comparison/v2/contracts.json",
]);

const MODEL_IDS = new Map([
  ["openai-frontier", "gpt-5.6-sol"],
  ["anthropic-balanced", "claude-sonnet-5"],
  ["google-stable-agentic", "gemini-3.7-flash"],
]);

const PROVIDER_API_KEY_ASSIGNMENT = /\b(?:OPENAI|ANTHROPIC|GOOGLE|GEMINI)_API_KEY(?:["'`])?\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|`([^`\r\n]*)`|([^\s,}\]]+))/gi;

const SECRET_PATTERNS = [
  {
    name: "OpenAI or Anthropic-style secret",
    expression: /\bsk-(?:proj-|ant-(?:api\d{2}-)?)?[A-Za-z0-9_-]{16,}\b/i,
  },
  {
    name: "Google API key",
    expression: /\bAIza[A-Za-z0-9_-]{30,}\b/,
  },
  {
    name: "bearer credential",
    expression: /\bAuthorization\s*:\s*Bearer\s+["'`]?\s*(?![<${])[A-Za-z0-9._~+/=-]{16,}/i,
  },
];

export function buildFreezeManifest({
  plan,
  artifacts,
  rootDir,
  frozenAt,
  contentOverrides = new Map(),
}) {
  assertFrozenPlan(plan);
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new Error("freeze artifacts must be a non-empty array");
  }
  if (frozenAt !== plan.freeze.frozen_at) {
    throw new Error("frozenAt must match plan freeze.frozen_at");
  }
  if (!(contentOverrides instanceof Map)) {
    throw new TypeError("contentOverrides must be a Map");
  }

  const normalizedArtifacts = artifacts.map((artifact) => {
    validateArtifactDescriptor(artifact, { requireHash: false });
    const logicalPath = normalizeLogicalPath(artifact.path);
    if (logicalPath === plan.freeze.manifest) {
      throw new Error("freeze manifest must not include itself as a self-referential artifact");
    }
    const bytes = readArtifactBytes(rootDir, logicalPath, contentOverrides);
    if (artifact.class !== "imported-v2-dependencies") {
      assertCanonicalStructuredText(bytes, logicalPath);
    }
    assertBytesContainNoLikelySecrets(bytes, logicalPath);
    return {
      class: artifact.class,
      path: logicalPath,
      visibility: artifact.visibility,
      sha256: sha256Bytes(bytes),
    };
  }).sort(compareArtifacts);
  assertRequiredClasses(normalizedArtifacts);
  assertUniqueArtifactPaths(normalizedArtifacts);

  return {
    manifest_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    status: "frozen",
    frozen_at: frozenAt,
    hash_algorithm: "sha256",
    artifact_count: normalizedArtifacts.length,
    artifacts: normalizedArtifacts,
  };
}

export function buildCalibrationFreeze({
  plan,
  modelResolutions,
  artifacts,
  rootDir,
  frozenAt = DEFAULT_FROZEN_AT,
  planArtifactPath,
}) {
  assertFinitePlainJson({ plan, modelResolutions, artifacts, frozenAt, planArtifactPath }, "calibration freeze input");
  if (!plan || plan.status !== "calibration-draft") {
    throw new Error("calibration freeze requires a calibration-draft plan");
  }
  const normalizedPlanPath = normalizeLogicalPath(planArtifactPath);
  assertNoRetainedFreezeIdentity({
    rootDir,
    planArtifactPath: normalizedPlanPath,
    benchmarkId: plan.benchmark_id,
    planVersion: plan.plan_version,
  });
  validateModelResolutions(plan, modelResolutions);
  if (!artifacts.some((artifact) => normalizeLogicalPath(artifact.path) === normalizedPlanPath)) {
    throw new Error(`freeze artifacts must include the plan path ${normalizedPlanPath}`);
  }
  const frozenPlan = structuredClone(plan);
  frozenPlan.status = "calibration-frozen";
  const resolutionById = new Map(
    modelResolutions.targets.map((target) => [target.target_id, target.resolved_model]),
  );
  frozenPlan.targets.forEach((target) => { target.model_id = resolutionById.get(target.id); });
  frozenPlan.freeze = {
    manifest: "freeze-manifest.json",
    frozen_at: frozenAt,
    artifact_set_sha256: "0".repeat(64),
    required_artifact_classes: [...REQUIRED_ARTIFACT_CLASSES],
  };
  assertFrozenPlan(frozenPlan);

  const preliminaryPlanText = `${JSON.stringify(frozenPlan, null, 2)}\n`;
  const preliminaryManifest = buildFreezeManifest({
    plan: frozenPlan,
    artifacts,
    rootDir,
    frozenAt,
    contentOverrides: new Map([[normalizedPlanPath, Buffer.from(preliminaryPlanText, "utf8")]]),
  });
  frozenPlan.freeze.artifact_set_sha256 = artifactSetSha256(preliminaryManifest, normalizedPlanPath);
  const planText = `${JSON.stringify(frozenPlan, null, 2)}\n`;
  const manifest = buildFreezeManifest({
    plan: frozenPlan,
    artifacts,
    rootDir,
    frozenAt,
    contentOverrides: new Map([[normalizedPlanPath, Buffer.from(planText, "utf8")]]),
  });
  return { plan: frozenPlan, manifest };
}

export function validateFrozenArtifacts({
  plan,
  manifest,
  rootDir,
  privateRequired = false,
  expectedArtifacts = undefined,
  contentOverrides = new Map(),
}) {
  assertFrozenPlan(plan);
  if (typeof privateRequired !== "boolean") throw new TypeError("privateRequired must be a boolean");
  if (!(contentOverrides instanceof Map)) throw new TypeError("contentOverrides must be a Map");
  assertFinitePlainJson(manifest, "freeze manifest");
  requireExactKeys(manifest, [
    "manifest_version",
    "benchmark_id",
    "plan_version",
    "status",
    "frozen_at",
    "hash_algorithm",
    "artifact_count",
    "artifacts",
  ], "freeze manifest");
  requireEqual(manifest.manifest_version, "1", "freeze manifest manifest_version");
  requireEqual(manifest.benchmark_id, plan.benchmark_id, "freeze manifest benchmark_id");
  requireEqual(manifest.plan_version, plan.plan_version, "freeze manifest plan_version");
  requireEqual(manifest.status, "frozen", "freeze manifest status");
  requireEqual(manifest.frozen_at, plan.freeze.frozen_at, "freeze manifest frozen_at");
  requireEqual(manifest.hash_algorithm, "sha256", "freeze manifest hash_algorithm");
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    throw new Error("freeze manifest artifacts must be a non-empty array");
  }
  requireEqual(manifest.artifact_count, manifest.artifacts.length, "freeze manifest artifact_count");
  if (expectedArtifacts !== undefined) {
    assertExpectedArtifactCoverage(manifest.artifacts, expectedArtifacts);
  }
  assertRequiredClasses(manifest.artifacts);
  assertUniqueArtifactPaths(manifest.artifacts);
  const sorted = [...manifest.artifacts].sort(compareArtifacts);
  if (!isDeepStrictEqual(manifest.artifacts, sorted)) {
    throw new Error("freeze manifest artifacts must use canonical class/path order");
  }

  manifest.artifacts.forEach((artifact) => {
    validateArtifactDescriptor(artifact, { requireHash: true });
    const absolutePath = resolveLogicalPath(rootDir, artifact.path);
    if (!fs.existsSync(absolutePath)) {
      if (artifact.visibility === "private" && !privateRequired) return;
      if (artifact.visibility === "private") {
        throw new Error(`private freeze artifact is missing: ${artifact.path}`);
      }
      throw new Error(`freeze artifact is missing: ${artifact.path}`);
    }
    const bytes = readArtifactBytes(rootDir, artifact.path, contentOverrides);
    if (artifact.class !== "imported-v2-dependencies") {
      assertCanonicalStructuredText(bytes, artifact.path);
    }
    assertBytesContainNoLikelySecrets(bytes, artifact.path);
    const actual = sha256Bytes(bytes);
    if (actual !== artifact.sha256) throw new Error(`SHA-256 mismatch for ${artifact.path}`);
  });
  return true;
}

export function validateFrozenBenchmarkOutputs({
  plan,
  benchmarkDir = BENCHMARK_DIR,
  privateRequired = false,
  manifestOverride = undefined,
  contentOverrides = new Map(),
}) {
  assertFrozenPlan(plan);
  const repositoryRoot = path.resolve(benchmarkDir, "..", "..", "..", "..");
  const modelResolutions = readJson(path.join(benchmarkDir, "model-resolutions.json"));
  const estimate = readJson(path.join(benchmarkDir, "cost-estimate.json"));
  validateModelResolutions(plan, modelResolutions);
  validateCostEstimate(plan, estimate, modelResolutions);

  const schedule = readJsonLines(path.join(benchmarkDir, "calibration-schedule.jsonl"));
  if (!isDeepStrictEqual(schedule, buildCalibrationSchedule(plan))) {
    throw new Error("calibration-schedule.jsonl does not match the frozen plan");
  }

  const promptExists = fs.existsSync(path.join(benchmarkDir, "private", "prompts", "calibration.jsonl"));
  const metricsExists = fs.existsSync(path.join(benchmarkDir, "private", "contexts", "calibration-metrics.json"));
  if (privateRequired && (!promptExists || !metricsExists)) {
    throw new Error("private-required validation requires calibration prompts and context metrics");
  }
  if (promptExists !== metricsExists) {
    throw new Error("calibration prompts and context metrics must either both exist or both be absent");
  }
  if (promptExists) {
    const prompts = readJsonLines(path.join(benchmarkDir, "private", "prompts", "calibration.jsonl"));
    const metrics = readJson(path.join(benchmarkDir, "private", "contexts", "calibration-metrics.json"));
    const regeneratedMetrics = buildPromptMetricsPacket(prompts);
    if (!isDeepStrictEqual(metrics, regeneratedMetrics)) {
      throw new Error("private calibration metrics do not match regenerated prompts");
    }
    const regeneratedEstimate = buildCostEstimate({
      plan,
      metricsPacket: metrics,
      modelResolutions,
      outputTokensPerRequestCeiling: estimate.methodology.output_tokens_per_request_ceiling,
      inputContingencyPercent: estimate.methodology.input_contingency_percent,
      estimatedAt: estimate.estimated_at,
    });
    if (!isDeepStrictEqual(estimate, regeneratedEstimate)) {
      throw new Error("cost estimate does not match the private calibration metrics");
    }
  }

  const manifestFile = path.join(benchmarkDir, plan.freeze.manifest);
  const manifestLogicalPath = normalizeLogicalPath(path.relative(repositoryRoot, manifestFile));
  let manifest = manifestOverride;
  if (manifest === undefined) {
    const manifestBytes = readArtifactBytes(repositoryRoot, manifestLogicalPath, new Map());
    assertCanonicalStructuredText(manifestBytes, manifestLogicalPath);
    assertBytesContainNoLikelySecrets(manifestBytes, manifestLogicalPath);
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  }
  const planLogicalPath = normalizeLogicalPath(
    path.relative(repositoryRoot, path.join(benchmarkDir, "plan.json")),
  );
  requireEqual(
    artifactSetSha256(manifest, planLogicalPath),
    plan.freeze.artifact_set_sha256,
    "freeze manifest artifact-set seal",
  );
  const expectedArtifacts = collectFreezeArtifacts({ repositoryRoot, privateRequired });
  assertManifestCoverage(manifest, expectedArtifacts);
  validateFrozenArtifacts({
    plan,
    manifest,
    rootDir: repositoryRoot,
    privateRequired,
    contentOverrides,
  });
  return true;
}

export function collectFreezeArtifacts({
  repositoryRoot = REPOSITORY_ROOT,
  privateRequired = false,
} = {}) {
  const benchmarkDir = path.join(
    repositoryRoot,
    "docai-http",
    "benchmarks",
    "openapi-comparison",
    "v3",
  );
  const conformanceDir = path.join(
    repositoryRoot,
    "docai-http",
    "fixtures",
    "conformance",
    "v1.0.0",
  );
  const toolsDir = path.join(repositoryRoot, "docai-http", "tools");
  const artifacts = [];

  addFiles(artifacts, repositoryRoot, "authoritative-sources", [
    path.join(conformanceDir, "source", "complete-input-set.yaml"),
    path.join(conformanceDir, "source", "complete-openapi.yaml"),
    path.join(conformanceDir, "source", "complete-behavior.yaml"),
  ]);
  addFiles(artifacts, repositoryRoot, "docai-contexts", [
    ...filesBelow(path.join(conformanceDir, "valid", "full")),
    ...filesBelow(path.join(conformanceDir, "valid", "compact")),
  ]);
  addFiles(artifacts, repositoryRoot, "tasks-and-expected-outcomes", [
    path.join(benchmarkDir, "continuity", "tasks.json"),
  ]);
  addFiles(artifacts, repositoryRoot, "contracts-and-prompts", [
    path.join(benchmarkDir, "contracts.json"),
    path.join(benchmarkDir, "private", "README.md"),
    path.join(toolsDir, "openapi-comparison-v3-contract.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-prompt.mjs"),
    path.join(toolsDir, "build-openapi-comparison-v3-prompts.mjs"),
  ]);
  addOptionalPrivateFile(
    artifacts,
    repositoryRoot,
    "contracts-and-prompts",
    path.join(benchmarkDir, "private", "prompts", "calibration.jsonl"),
    privateRequired,
  );
  addFiles(artifacts, repositoryRoot, "parser-and-graders", [
    path.join(toolsDir, "openapi-comparison-v3-parser.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-grader.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-record.mjs"),
  ]);
  addFiles(artifacts, repositoryRoot, "context-builders", [
    path.join(toolsDir, "openapi-comparison-v3-context.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-utils.mjs"),
    path.join(toolsDir, "check-openapi-comparison-v3-parity.mjs"),
  ]);
  addOptionalPrivateFile(
    artifacts,
    repositoryRoot,
    "context-builders",
    path.join(benchmarkDir, "private", "contexts", "calibration-metrics.json"),
    privateRequired,
  );
  addFiles(artifacts, repositoryRoot, "provider-adapters-and-runner", [
    path.join(toolsDir, "openapi-comparison-v3-provider-errors.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-provider-adapter-utils.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-openai-adapter.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-anthropic-adapter.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-google-adapter.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-runner.mjs"),
    path.join(toolsDir, "run-openapi-comparison-v3-calibration.mjs"),
    path.join(toolsDir, "check-openapi-comparison-v3-runs.mjs"),
  ]);
  addFiles(artifacts, repositoryRoot, "calibration-schedule-and-gate", [
    path.resolve(benchmarkDir, "..", "V2-DIAGNOSTIC-CLOSURE.md"),
    path.join(benchmarkDir, "README.md"),
    path.join(benchmarkDir, "PLAN.md"),
    path.join(benchmarkDir, "CALIBRATION.md"),
    path.join(benchmarkDir, "ARTIFACT-CONTRACT.md"),
    path.join(benchmarkDir, "plan.json"),
    path.join(benchmarkDir, "calibration-schedule.jsonl"),
    path.join(toolsDir, "build-openapi-comparison-v3-calibration-schedule.mjs"),
    path.join(toolsDir, "check-openapi-comparison-v3-plan.mjs"),
    path.join(toolsDir, "freeze-openapi-comparison-v3.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-calibration-gate.mjs"),
    path.join(toolsDir, "check-openapi-comparison-v3-calibration.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-adjudication.mjs"),
    path.join(toolsDir, "check-openapi-comparison-v3-adjudication.mjs"),
    path.join(toolsDir, "openapi-comparison-v3-strict-json.mjs"),
  ]);
  addFiles(artifacts, repositoryRoot, "model-resolutions", [
    path.join(benchmarkDir, "model-resolutions.json"),
  ]);
  addFiles(artifacts, repositoryRoot, "cost-estimate", [
    path.join(benchmarkDir, "cost-estimate.json"),
    path.join(benchmarkDir, "MODEL-COST-PREFLIGHT.md"),
    path.join(toolsDir, "estimate-openapi-comparison-v3-cost.mjs"),
  ]);
  addFiles(artifacts, repositoryRoot, "imported-v2-dependencies", [
    ...V2_IMPORTED_DEPENDENCIES.map((file) => path.join(repositoryRoot, file)),
  ]);
  return artifacts.sort(compareArtifacts);
}

export function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function assertFrozenPlan(plan) {
  assertFinitePlainJson(plan, "frozen calibration plan");
  if (plan?.benchmark_id !== "docai-http-openapi-comparison-v3") {
    throw new Error("frozen plan must use the v3 benchmark identity");
  }
  if (plan.plan_version !== "3.0.0-calibration.1") {
    throw new Error("frozen plan must use 3.0.0-calibration.1");
  }
  if (plan.status !== "calibration-frozen") {
    throw new Error("plan status must be calibration-frozen");
  }
  if (!Array.isArray(plan.targets) || plan.targets.length !== MODEL_IDS.size) {
    throw new Error("frozen plan must contain exactly three model targets");
  }
  plan.targets.forEach((target) => {
    if (target.model_id !== MODEL_IDS.get(target.id)) {
      throw new Error(`frozen plan target ${String(target.id)} has the wrong model_id`);
    }
  });
  if (plan.freeze?.manifest !== "freeze-manifest.json") {
    throw new Error("frozen plan freeze manifest must be freeze-manifest.json");
  }
  if (typeof plan.freeze.frozen_at !== "string" || Number.isNaN(Date.parse(plan.freeze.frozen_at))) {
    throw new Error("frozen plan freeze.frozen_at must be an ISO-compatible timestamp");
  }
  if (!/^[a-f0-9]{64}$/.test(plan.freeze.artifact_set_sha256 ?? "")) {
    throw new Error("frozen plan freeze.artifact_set_sha256 must be a SHA-256 digest");
  }
  if (!isDeepStrictEqual(plan.freeze.required_artifact_classes, REQUIRED_ARTIFACT_CLASSES)) {
    throw new Error("frozen plan must list the exact required artifact classes");
  }
}

function assertManifestCoverage(manifest, expectedArtifacts) {
  const actual = manifest.artifacts.map(({ class: artifactClass, path: logicalPath, visibility }) => ({
    class: artifactClass,
    path: logicalPath,
    visibility,
  }));
  const expected = expectedArtifacts.map(({ class: artifactClass, path: logicalPath, visibility }) => ({
    class: artifactClass,
    path: logicalPath,
    visibility,
  }));
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error("freeze manifest does not cover the exact collected calibration boundary");
  }
}

function assertExpectedArtifactCoverage(actualArtifacts, expectedArtifacts) {
  if (!Array.isArray(expectedArtifacts) || expectedArtifacts.length === 0) {
    throw new Error("expectedArtifacts must be a non-empty array");
  }
  const expectedByPath = new Map();
  expectedArtifacts.forEach((artifact) => {
    validateArtifactDescriptor(artifact, { requireHash: false });
    const logicalPath = normalizeLogicalPath(artifact.path);
    if (expectedByPath.has(logicalPath)) throw new Error(`duplicate expected freeze artifact path ${logicalPath}`);
    expectedByPath.set(logicalPath, artifact);
  });
  const actualByPath = new Map(actualArtifacts.map((artifact) => [artifact.path, artifact]));
  for (const [logicalPath, expected] of expectedByPath) {
    const actual = actualByPath.get(logicalPath);
    if (!actual) throw new Error(`incomplete freeze boundary: missing ${logicalPath}`);
    if (actual.class !== expected.class || actual.visibility !== expected.visibility) {
      throw new Error(`misclassified freeze artifact ${logicalPath}`);
    }
  }
  for (const logicalPath of actualByPath.keys()) {
    if (!expectedByPath.has(logicalPath)) {
      throw new Error(`incomplete freeze boundary: unexpected ${logicalPath}`);
    }
  }
}

function assertRequiredClasses(artifacts) {
  const classes = new Set(artifacts.map((artifact) => artifact.class));
  REQUIRED_ARTIFACT_CLASSES.forEach((artifactClass) => {
    if (!classes.has(artifactClass)) throw new Error(`missing required artifact class ${artifactClass}`);
  });
  const unknown = [...classes].find((artifactClass) => !REQUIRED_ARTIFACT_CLASSES.includes(artifactClass));
  if (unknown !== undefined) throw new Error(`unknown freeze artifact class ${unknown}`);
}

function assertUniqueArtifactPaths(artifacts) {
  const paths = new Set();
  artifacts.forEach((artifact) => {
    if (paths.has(artifact.path)) throw new Error(`duplicate freeze artifact path ${artifact.path}`);
    paths.add(artifact.path);
  });
}

function validateArtifactDescriptor(artifact, { requireHash }) {
  assertFinitePlainJson(artifact, "freeze artifact descriptor");
  requireExactKeys(
    artifact,
    requireHash ? ["class", "path", "visibility", "sha256"] : ["class", "path", "visibility"],
    `freeze artifact ${String(artifact?.path ?? "<unknown>")}`,
  );
  if (!REQUIRED_ARTIFACT_CLASSES.includes(artifact.class)) {
    throw new Error(`unknown freeze artifact class ${String(artifact.class)}`);
  }
  if (typeof artifact.path !== "string" || artifact.path.trim() === "") {
    throw new Error("freeze artifact path must be a non-empty string");
  }
  if (!['public', 'private'].includes(artifact.visibility)) {
    throw new Error(`artifact ${artifact.path} visibility must be public or private`);
  }
  if (requireHash && !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw new Error(`artifact ${artifact.path} lacks a valid SHA-256`);
  }
}

function readArtifactBytes(rootDir, logicalPath, contentOverrides) {
  const normalizedPath = normalizeLogicalPath(logicalPath);
  if (contentOverrides.has(normalizedPath)) {
    const override = contentOverrides.get(normalizedPath);
    if (!Buffer.isBuffer(override) && typeof override !== "string") {
      throw new TypeError(`content override for ${normalizedPath} must be a Buffer or string`);
    }
    return Buffer.isBuffer(override) ? override : Buffer.from(override, "utf8");
  }
  const absolutePath = resolveLogicalPath(rootDir, normalizedPath);
  if (!fs.existsSync(absolutePath)) throw new Error(`freeze artifact is missing: ${normalizedPath}`);
  assertNoSymlinkComponents(rootDir, absolutePath);
  const stat = fs.lstatSync(absolutePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`freeze artifact is not a regular file: ${normalizedPath}`);
  }
  return fs.readFileSync(absolutePath);
}

function assertBytesContainNoLikelySecrets(bytes, logicalPath) {
  const text = decodeUtf8(bytes, logicalPath);
  if (text.includes("\0")) {
    throw new Error(`freeze artifact cannot be safely scanned as UTF-8 text: ${logicalPath}`);
  }
  for (const match of text.matchAll(PROVIDER_API_KEY_ASSIGNMENT)) {
    const value = match.slice(1).find((candidate) => candidate !== undefined) ?? "";
    const allowed = /^[<${]/.test(value) || /^[a-f0-9]{64}$/i.test(value);
    if (value.length >= 12 && !allowed) {
      throw new Error(`possible secret (provider API key assignment) in ${logicalPath}`);
    }
  }
  for (const { name, expression } of SECRET_PATTERNS) {
    if (expression.test(text)) throw new Error(`possible secret (${name}) in ${logicalPath}`);
  }
}

function assertCanonicalStructuredText(bytes, logicalPath) {
  if (!logicalPath.endsWith(".json") && !logicalPath.endsWith(".jsonl")) return;
  const text = decodeUtf8(bytes, logicalPath);
  if (logicalPath.endsWith(".json")) {
    let value;
    try {
      value = JSON.parse(text);
    } catch (cause) {
      throw new Error(`freeze artifact must contain valid JSON: ${logicalPath}`, { cause });
    }
    assertFinitePlainJson(value, logicalPath);
    if (text !== `${JSON.stringify(value, null, 2)}\n`) {
      throw new Error(`freeze artifact must use canonical JSON formatting: ${logicalPath}`);
    }
    return;
  }

  if (!text.endsWith("\n")) throw new Error(`freeze artifact must use canonical JSONL formatting: ${logicalPath}`);
  const lines = text.slice(0, -1).split("\n");
  const values = lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (cause) {
      throw new Error(
        `freeze artifact must contain valid JSON at ${logicalPath} line ${index + 1}`,
        { cause },
      );
    }
  });
  values.forEach((value, index) => assertFinitePlainJson(value, `${logicalPath} line ${index + 1}`));
  const canonical = `${values.map((value) => JSON.stringify(value)).join("\n")}\n`;
  if (text !== canonical) throw new Error(`freeze artifact must use canonical JSONL formatting: ${logicalPath}`);
}

function decodeUtf8(bytes, logicalPath) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`freeze artifact cannot be safely scanned as UTF-8 text: ${logicalPath}`);
  }
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

function addOptionalPrivateFile(artifacts, root, artifactClass, file, privateRequired) {
  if (!fs.existsSync(file) && privateRequired) {
    throw new Error(`required private freeze artifact is missing: ${file}`);
  }
  artifacts.push({
    class: artifactClass,
    path: normalizeLogicalPath(path.relative(root, file)),
    visibility: "private",
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
  return file.split(path.sep).join("/").includes("/benchmarks/openapi-comparison/v3/private/");
}

function normalizeLogicalPath(file) {
  if (typeof file !== "string" || file.trim() === "") throw new Error("artifact path must be a non-empty string");
  if (path.isAbsolute(file) || file.includes("\\")) {
    throw new Error(`artifact path must be a canonical relative path: ${file}`);
  }
  const segments = file.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`artifact path must be a canonical relative path: ${file}`);
  }
  return file;
}

function resolveLogicalPath(rootDir, logicalPath) {
  if (path.isAbsolute(logicalPath)) throw new Error(`artifact path must be relative: ${logicalPath}`);
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(resolvedRoot, logicalPath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`artifact path escapes root: ${logicalPath}`);
  }
  return resolved;
}

function assertNoSymlinkComponents(rootDir, absolutePath) {
  const root = path.resolve(rootDir);
  const relative = path.relative(root, absolutePath);
  let current = root;
  for (const segment of relative.split(path.sep)) {
    if (segment === "") continue;
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`freeze artifact path must not traverse a symbolic link: ${current}`);
  }
}

function compareArtifacts(left, right) {
  return compareCodeUnits(left.class, right.class) || compareCodeUnits(left.path, right.path);
}

function compareCodeUnits(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`${label} has unexpected or missing fields`);
}

function requireEqual(actual, expected, label) {
  if (!Object.is(actual, expected)) throw new Error(`${label} must be ${JSON.stringify(expected)}`);
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function artifactSetSha256(manifest, planArtifactPath) {
  const artifacts = manifest.artifacts.filter((artifact) => artifact.path !== planArtifactPath);
  if (artifacts.length === manifest.artifacts.length) {
    throw new Error(`freeze manifest is missing plan artifact ${planArtifactPath}`);
  }
  return sha256Bytes(Buffer.from(`${JSON.stringify(artifacts, null, 2)}\n`, "utf8"));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonLines(file) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.endsWith("\n")) throw new Error(`${file} must end with a newline`);
  if (text === "") return [];
  return text.trimEnd().split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file} line ${index + 1} is not valid JSON: ${error.message}`);
    }
  });
}

function assertNoRetainedFreezeIdentity({
  rootDir,
  planArtifactPath,
  benchmarkId,
  planVersion,
  fsOps = fs,
}) {
  const manifestLogicalPath = normalizeLogicalPath(path.posix.join(
    path.posix.dirname(planArtifactPath),
    "freeze-manifest.json",
  ));
  const manifestFile = resolveLogicalPath(rootDir, manifestLogicalPath);
  if (!fsOps.existsSync(manifestFile)) return;
  let retained;
  try {
    retained = JSON.parse(fsOps.readFileSync(manifestFile, "utf8"));
  } catch (cause) {
    throw new Error(`existing freeze manifest prevents publication: ${manifestLogicalPath}`, { cause });
  }
  if (retained?.benchmark_id === benchmarkId && retained?.plan_version === planVersion) {
    throw new Error(`frozen calibration identity ${planVersion} is immutable`);
  }
}

function syncPath(fsOps, file) {
  const descriptor = fsOps.openSync(file, "r");
  try {
    fsOps.fsyncSync(descriptor);
  } finally {
    fsOps.closeSync(descriptor);
  }
}

function writeFileDurably(fsOps, file, contents, options) {
  fsOps.writeFileSync(file, contents, options);
  syncPath(fsOps, file);
}

function renameFileDurably(fsOps, source, destination) {
  fsOps.renameSync(source, destination);
  syncPath(fsOps, path.dirname(destination));
}

function restoreFileDurably(fsOps, destination, contents, temporaryFiles, suffix) {
  const temporary = `${destination}${suffix}`;
  temporaryFiles.add(temporary);
  writeFileDurably(fsOps, temporary, contents, { flag: "wx" });
  renameFileDurably(fsOps, temporary, destination);
  temporaryFiles.delete(temporary);
}

export function publishFreezePair({
  plan,
  manifest,
  planFile,
  manifestFile,
  validatePrepared,
  validatePublished,
  fsOps = fs,
}) {
  if (typeof validatePrepared !== "function" || typeof validatePublished !== "function") {
    throw new TypeError("freeze publication requires prepared and published validators");
  }
  const planText = `${JSON.stringify(plan, null, 2)}\n`;
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const suffix = `.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const temporaryPlan = `${planFile}${suffix}`;
  const temporaryManifest = `${manifestFile}${suffix}`;
  const temporaryFiles = new Set([temporaryPlan, temporaryManifest]);
  const originalPlan = fsOps.readFileSync(planFile);
  const originalManifest = fsOps.existsSync(manifestFile) ? fsOps.readFileSync(manifestFile) : null;
  const currentPlan = JSON.parse(originalPlan.toString("utf8"));
  if (currentPlan.status === "calibration-frozen") {
    throw new Error(`frozen calibration identity ${currentPlan.plan_version} is immutable`);
  }
  if (currentPlan.status !== "calibration-draft") {
    throw new Error("freeze publication requires an on-disk calibration-draft plan");
  }
  if (originalManifest !== null) {
    let retained;
    try {
      retained = JSON.parse(originalManifest.toString("utf8"));
    } catch (cause) {
      throw new Error("existing freeze manifest prevents publication", { cause });
    }
    if (retained?.benchmark_id === plan.benchmark_id
        && retained?.plan_version === plan.plan_version) {
      throw new Error(`frozen calibration identity ${plan.plan_version} is immutable`);
    }
  }
  validatePrepared();
  try {
    writeFileDurably(fsOps, temporaryManifest, manifestText, { encoding: "utf8", flag: "wx" });
    writeFileDurably(fsOps, temporaryPlan, planText, { encoding: "utf8", flag: "wx" });
    renameFileDurably(fsOps, temporaryManifest, manifestFile);
    temporaryFiles.delete(temporaryManifest);
    renameFileDurably(fsOps, temporaryPlan, planFile);
    temporaryFiles.delete(temporaryPlan);
    validatePublished();
  } catch (error) {
    restoreFileDurably(fsOps, planFile, originalPlan, temporaryFiles, `${suffix}.rollback-plan.tmp`);
    if (originalManifest === null) {
      if (fsOps.existsSync(manifestFile)) {
        fsOps.unlinkSync(manifestFile);
        syncPath(fsOps, path.dirname(manifestFile));
      }
    } else {
      restoreFileDurably(
        fsOps,
        manifestFile,
        originalManifest,
        temporaryFiles,
        `${suffix}.rollback-manifest.tmp`,
      );
    }
    throw error;
  } finally {
    for (const temporary of temporaryFiles) {
      if (fsOps.existsSync(temporary)) fsOps.unlinkSync(temporary);
    }
  }
}

function writeFreezePair({ plan, manifest }) {
  const planLogicalPath = normalizeLogicalPath(path.relative(REPOSITORY_ROOT, PLAN_FILE));
  const planText = `${JSON.stringify(plan, null, 2)}\n`;
  publishFreezePair({
    plan,
    manifest,
    planFile: PLAN_FILE,
    manifestFile: MANIFEST_FILE,
    validatePrepared: () => validateFrozenBenchmarkOutputs({
      plan,
      privateRequired: true,
      manifestOverride: manifest,
      contentOverrides: new Map([[planLogicalPath, Buffer.from(planText, "utf8")]]),
    }),
    validatePublished: () => validateFrozenBenchmarkOutputs({ plan, privateRequired: true }),
  });
}

function runCli() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  const privateRequired = process.argv.includes("--private-required");
  if (write === check || process.argv.slice(2).some((argument) => (
    !["--write", "--check", "--private-required"].includes(argument)
  ))) {
    throw new Error("usage: freeze-openapi-comparison-v3.mjs --write | --check [--private-required]");
  }

  if (check) {
    const plan = readV3Plan();
    const manifest = readJson(MANIFEST_FILE);
    validateFrozenBenchmarkOutputs({ plan, privateRequired });
    validateFrozenArtifacts({
      plan,
      manifest,
      rootDir: REPOSITORY_ROOT,
      privateRequired,
    });
    console.log(`Freeze manifest check passed for ${path.relative(process.cwd(), MANIFEST_FILE)}`);
    return;
  }

  const plan = readV3Plan();
  if (plan.status === "calibration-frozen") {
    try {
      validateFrozenBenchmarkOutputs({ plan, privateRequired: true });
    } catch (cause) {
      throw new Error(
        `frozen calibration identity ${plan.plan_version} is immutable; current artifacts differ from the published freeze`,
        { cause },
      );
    }
    console.log(`Frozen calibration ${plan.plan_version} is valid; no files were written`);
    return;
  }
  const modelResolutions = readJson(MODEL_RESOLUTIONS_FILE);
  const costEstimate = readJson(COST_ESTIMATE_FILE);
  validateModelResolutions(plan, modelResolutions);
  validateCostEstimate(plan, costEstimate, modelResolutions);
  const artifacts = collectFreezeArtifacts({
    repositoryRoot: REPOSITORY_ROOT,
    privateRequired: true,
  });
  const frozenAt = plan.freeze?.frozen_at ?? DEFAULT_FROZEN_AT;
  const frozen = buildCalibrationFreeze({
    plan,
    modelResolutions,
    artifacts,
    rootDir: REPOSITORY_ROOT,
    frozenAt,
    planArtifactPath: normalizeLogicalPath(path.relative(REPOSITORY_ROOT, PLAN_FILE)),
  });
  writeFreezePair(frozen);
  console.log(`Wrote ${frozen.manifest.artifact_count} hashes and froze ${path.relative(process.cwd(), PLAN_FILE)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
