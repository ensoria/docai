#!/usr/bin/env node

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { FROZEN_ARTIFACT_CLASSES, validatePlan } from "./check-plan.mjs";
import { validateCostEstimate, validateModelResolutions } from "./estimate-cost.mjs";
import { buildCalibrationSchedule, PACKAGE_DIR, PLAN_FILE } from "./paths.mjs";
import { assertPlainJson } from "./strict-json.mjs";

const REPOSITORY_ROOT = path.resolve(PACKAGE_DIR, "..", "..", "..", "..", "..", "..");
const MANIFEST_FILE = path.join(PACKAGE_DIR, "freeze-manifest.json");
const MODEL_RESOLUTIONS_FILE = path.join(PACKAGE_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(PACKAGE_DIR, "cost-estimate.json");
const METRICS_FILE = path.join(PACKAGE_DIR, "private", "contexts", "calibration-metrics.json");
const PRIVATE_PROMPTS_FILE = path.join(PACKAGE_DIR, "private", "prompts", "calibration.jsonl");
const DEFAULT_FROZEN_AT = "2026-09-15T00:00:00Z";
const PACKAGE_RELATIVE_PATH = "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2";
const TEST_PATTERN = /^openapi-comparison-v3-calibration2-.*\.test\.mjs$/;
const MODEL_IDS = new Map([
  ["openai-frontier", "gpt-5.6-sol"],
  ["anthropic-balanced", "claude-sonnet-5"],
  ["google-stable-agentic", "gemini-3.7-flash"],
]);
const FROZEN_PLAN_IDENTITY_SHA256 = "71be9425fcdff8623aefbcc2cebaf8d7fb86224fd8ac36392c3ea7980ed0d707";

export const REQUIRED_ARTIFACT_CLASSES = FROZEN_ARTIFACT_CLASSES;

const PROVIDER_API_KEY_ASSIGNMENT = /\b(?:OPENAI|ANTHROPIC|GOOGLE|GEMINI)_API_KEY(?:["'`])?\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|`([^`\r\n]*)`|([^\s,}\]]+))/gi;
const SECRET_PATTERNS = [
  ["OpenAI or Anthropic-style secret", /\bsk-(?:proj-|ant-(?:api\d{2}-)?)?[A-Za-z0-9_-]{16,}\b/i],
  ["Google API key", /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ["bearer credential", /\bAuthorization\s*:\s*Bearer\s+["'`]?\s*(?![<${])[A-Za-z0-9._~+/=-]{16,}/i],
];

export function collectRubyRuntimeIdentity({ rubyExecutable = "ruby", spawn = spawnSync } = {}) {
  if (typeof rubyExecutable !== "string" || rubyExecutable.trim() === "") {
    throw new TypeError("rubyExecutable must be a non-empty string");
  }
  if (typeof spawn !== "function") throw new TypeError("spawn must be a function");
  const result = spawn(
    rubyExecutable,
    ["-rpsych", "-e", "puts RbConfig.ruby; puts RUBY_DESCRIPTION; puts Psych::VERSION"],
    { encoding: "utf8" },
  );
  if (result.error) throw new Error(`Unable to inspect Ruby/Psych runtime: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Unable to inspect Ruby/Psych runtime: ${String(result.stderr).trim()}`);
  const lines = String(result.stdout).trimEnd().split("\n");
  if (lines.length !== 3 || lines.some((line) => line === "")) {
    throw new Error("Ruby/Psych runtime identity returned an unexpected shape");
  }
  return {
    executable: fs.realpathSync(lines[0]),
    ruby_description: lines[1],
    psych_version: lines[2],
  };
}

export function collectFreezeArtifacts({
  repositoryRoot = REPOSITORY_ROOT,
  privateRequired = false,
} = {}) {
  if (typeof privateRequired !== "boolean") throw new TypeError("privateRequired must be a boolean");
  const root = path.resolve(repositoryRoot);
  const packageDir = path.join(root, PACKAGE_RELATIVE_PATH);
  const artifacts = [];

  for (const file of filesBelow(packageDir)) {
    const relativeToPackage = normalizeLogicalPath(path.relative(packageDir, file).split(path.sep).join("/"));
    if (["freeze-manifest.json", "freeze-manifest.json.lock"].includes(relativeToPackage)
        || isDynamicPrivateArtifact(relativeToPackage)) continue;
    addArtifact(artifacts, root, classForPackageFile(relativeToPackage), file, isPrivatePackagePath(relativeToPackage) ? "private" : "public");
  }

  for (const relativePrivatePath of [
    "private/prompts/calibration.jsonl",
    "private/contexts/calibration-metrics.json",
  ]) {
    const file = path.join(packageDir, ...relativePrivatePath.split("/"));
    if (privateRequired && !fs.existsSync(file)) {
      throw new Error(`required private freeze artifact is missing: ${file}`);
    }
    if (!artifacts.some((artifact) => artifact.path === `${PACKAGE_RELATIVE_PATH}/${relativePrivatePath}`)) {
      artifacts.push({
        class: "private-calibration-inputs",
        path: `${PACKAGE_RELATIVE_PATH}/${relativePrivatePath}`,
        visibility: "private",
      });
    }
  }

  const testsDir = path.join(root, "docai-http", "tools", "tests");
  const tests = fs.readdirSync(testsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && TEST_PATTERN.test(entry.name))
    .map((entry) => path.join(testsDir, entry.name));
  addFiles(artifacts, root, "calibration-tests", tests);

  const stableDir = path.join(root, "docai-http", "fixtures", "conformance", "v1.0.0");
  addFiles(artifacts, root, "authoritative-stable-sources", [
    path.join(stableDir, "source", "complete-input-set.yaml"),
    path.join(stableDir, "source", "complete-openapi.yaml"),
    path.join(stableDir, "source", "complete-behavior.yaml"),
  ]);
  addFiles(artifacts, root, "authoritative-stable-projections", [
    ...filesBelow(path.join(stableDir, "valid", "full")),
    ...filesBelow(path.join(stableDir, "valid", "compact")),
  ]);

  assertRequiredClasses(artifacts);
  assertUniqueArtifactPaths(artifacts);
  return artifacts.sort(compareArtifacts);
}

export function buildFreezeManifest({
  plan,
  artifacts,
  rootDir,
  frozenAt,
  contentOverrides = new Map(),
  runtimeIdentity = collectRubyRuntimeIdentity(),
}) {
  assertFrozenPlan(plan);
  validateRuntimeIdentity(runtimeIdentity);
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new Error("freeze artifacts must be a non-empty array");
  }
  if (frozenAt !== plan.freeze.frozen_at) throw new Error("frozenAt must match plan freeze.frozen_at");
  if (!(contentOverrides instanceof Map)) throw new TypeError("contentOverrides must be a Map");

  const normalizedArtifacts = artifacts.map((artifact) => {
    validateArtifactDescriptor(artifact, { requireHash: false });
    const logicalPath = normalizeLogicalPath(artifact.path);
    if (logicalPath === normalizeLogicalPath(path.posix.join(path.posix.dirname(findPlanPath(artifacts)), "freeze-manifest.json"))) {
      throw new Error("freeze manifest must not include itself as a self-referential artifact");
    }
    const bytes = readArtifactBytes(rootDir, logicalPath, contentOverrides);
    assertCanonicalStructuredText(bytes, logicalPath);
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
    runtime_environment: { ruby: structuredClone(runtimeIdentity) },
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
  runtimeIdentity = collectRubyRuntimeIdentity(),
}) {
  assertPlainJson({ plan, modelResolutions, artifacts, rootDir, frozenAt, planArtifactPath, runtimeIdentity }, "calibration freeze input");
  validatePlan(plan);
  if (plan.status !== "calibration-draft") throw new Error("calibration freeze requires a calibration-draft plan");
  const normalizedPlanPath = normalizeLogicalPath(planArtifactPath);
  if (!artifacts.some((artifact) => normalizeLogicalPath(artifact.path) === normalizedPlanPath)) {
    throw new Error(`freeze artifacts must include the plan path ${normalizedPlanPath}`);
  }
  assertNoRetainedFreezeIdentity({
    rootDir,
    planArtifactPath: normalizedPlanPath,
    benchmarkId: plan.benchmark_id,
    planVersion: plan.plan_version,
  });
  const resolvedModels = exactResolvedModels(plan, modelResolutions);
  const frozenPlan = structuredClone(plan);
  frozenPlan.status = "calibration-frozen";
  frozenPlan.targets.forEach((target) => { target.model_id = resolvedModels.get(target.id); });
  frozenPlan.freeze = {
    manifest: "freeze-manifest.json",
    frozen_at: frozenAt,
    artifact_set_sha256: "0".repeat(64),
    required_artifact_classes: [...REQUIRED_ARTIFACT_CLASSES],
  };
  assertFrozenPlan(frozenPlan);

  const preliminaryPlanText = canonicalJson(frozenPlan);
  const preliminaryManifest = buildFreezeManifest({
    plan: frozenPlan,
    artifacts,
    rootDir,
    frozenAt,
    contentOverrides: new Map([[normalizedPlanPath, preliminaryPlanText]]),
    runtimeIdentity,
  });
  frozenPlan.freeze.artifact_set_sha256 = artifactSetSha256(preliminaryManifest, normalizedPlanPath);
  assertPlanIdentityCommitment(frozenPlan);
  const planText = canonicalJson(frozenPlan);
  const manifest = buildFreezeManifest({
    plan: frozenPlan,
    artifacts,
    rootDir,
    frozenAt,
    contentOverrides: new Map([[normalizedPlanPath, planText]]),
    runtimeIdentity,
  });
  return { plan: frozenPlan, manifest };
}

export function validateFrozenPackage({
  packageDir = PACKAGE_DIR,
  repositoryRoot = REPOSITORY_ROOT,
  privateRequired = false,
  expectedArtifacts,
  planOverride,
  manifestOverride,
  contentOverrides = new Map(),
  runtimeIdentity = collectRubyRuntimeIdentity(),
} = {}) {
  if (typeof privateRequired !== "boolean") throw new TypeError("privateRequired must be a boolean");
  if (!(contentOverrides instanceof Map)) throw new TypeError("contentOverrides must be a Map");
  const root = path.resolve(repositoryRoot);
  const resolvedPackageDir = path.resolve(packageDir);
  assertWithinRoot(root, resolvedPackageDir, "packageDir");
  const planPath = normalizeLogicalPath(path.relative(root, path.join(resolvedPackageDir, "plan.json")).split(path.sep).join("/"));
  const plan = planOverride ?? readCanonicalJson(path.join(resolvedPackageDir, "plan.json"), planPath);
  assertFrozenPlan(plan);
  assertPlanIdentityCommitment(plan);
  const manifestPath = normalizeLogicalPath(path.relative(root, path.join(resolvedPackageDir, plan.freeze.manifest)).split(path.sep).join("/"));
  const manifest = manifestOverride ?? readCanonicalJson(path.join(resolvedPackageDir, plan.freeze.manifest), manifestPath);
  validateManifestShape(manifest, plan, runtimeIdentity);

  const expected = expectedArtifacts ?? collectFreezeArtifacts({ repositoryRoot: root, privateRequired });
  assertArtifactCoverage(manifest.artifacts, expected);
  for (const artifact of manifest.artifacts) {
    validateArtifactDescriptor(artifact, { requireHash: true });
    const absolute = resolveLogicalPath(root, artifact.path);
    if (!fs.existsSync(absolute)) {
      if (artifact.visibility === "private" && !privateRequired) continue;
      if (artifact.visibility === "private") throw new Error(`private freeze artifact is missing: ${artifact.path}`);
      throw new Error(`freeze artifact is missing: ${artifact.path}`);
    }
    const bytes = readArtifactBytes(root, artifact.path, contentOverrides);
    assertCanonicalStructuredText(bytes, artifact.path);
    assertBytesContainNoLikelySecrets(bytes, artifact.path);
    if (sha256Bytes(bytes) !== artifact.sha256) throw new Error(`SHA-256 mismatch for ${artifact.path}`);
  }

  if (artifactSetSha256(manifest, planPath) !== plan.freeze.artifact_set_sha256) {
    throw new Error("freeze manifest artifact-set seal does not match the frozen plan");
  }
  return true;
}

export function validateFrozenPromptPacket({ prompts, packageDir = PACKAGE_DIR }) {
  assertPlainJson(prompts, "Live prompt packet");
  if (!Array.isArray(prompts) || prompts.length === 0) throw new Error("Live prompt packet must be a non-empty array");
  const frozenPromptFile = path.join(path.resolve(packageDir), "private", "prompts", "calibration.jsonl");
  const frozenBytes = fs.readFileSync(frozenPromptFile);
  const regeneratedBytes = Buffer.from(`${prompts.map((prompt) => JSON.stringify(prompt)).join("\n")}\n`, "utf8");
  if (!regeneratedBytes.equals(frozenBytes)) {
    throw new Error("regenerated Live prompts do not match the frozen private prompt packet");
  }
  return true;
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
  const lockFile = `${manifestFile}.lock`;
  const suffix = `.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const temporaryManifest = `${manifestFile}${suffix}`;
  const temporaryPlan = `${planFile}${suffix}`;
  const temporaryFiles = new Set([temporaryManifest, temporaryPlan]);
  const expectedDraftBytes = draftPlanBytes(plan);
  const manifestBytes = Buffer.from(canonicalJson(manifest), "utf8");
  let lockDescriptor;
  let originalPlan;
  let manifestInstalled = false;
  let planInstalled = false;
  try {
    lockDescriptor = fsOps.openSync(lockFile, "wx", 0o600);
    fsOps.fsyncSync(lockDescriptor);
    syncPath(fsOps, path.dirname(lockFile));
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`exclusive freeze publication lock is already in progress: ${lockFile}`, { cause: error });
    throw error;
  }
  try {
    originalPlan = fsOps.readFileSync(planFile);
    const currentPlan = JSON.parse(originalPlan.toString("utf8"));
    if (currentPlan.status === "calibration-frozen") {
      throw new Error(`frozen calibration identity ${currentPlan.plan_version} is immutable`);
    }
    if (currentPlan.status !== "calibration-draft") {
      throw new Error("freeze publication requires an on-disk calibration-draft plan");
    }
    assertPublicationDraft(fsOps, planFile, expectedDraftBytes);
    assertManifestAbsent(fsOps, manifestFile);
    validatePrepared();
    writeFileDurably(fsOps, temporaryManifest, manifestBytes, { flag: "wx" });
    writeFileDurably(fsOps, temporaryPlan, canonicalJson(plan), { encoding: "utf8", flag: "wx" });

    assertPublicationDraft(fsOps, planFile, expectedDraftBytes);
    assertManifestAbsent(fsOps, manifestFile);
    fsOps.linkSync(temporaryManifest, manifestFile);
    manifestInstalled = true;
    syncPath(fsOps, path.dirname(manifestFile));
    fsOps.unlinkSync(temporaryManifest);
    temporaryFiles.delete(temporaryManifest);

    assertPublicationDraft(fsOps, planFile, expectedDraftBytes);
    assertFileBytes(fsOps, manifestFile, manifestBytes, "installed freeze manifest changed during publication");
    renameFileDurably(fsOps, temporaryPlan, planFile);
    planInstalled = true;
    temporaryFiles.delete(temporaryPlan);
    validatePublished();
  } catch (error) {
    if (planInstalled) restoreFileDurably(fsOps, planFile, originalPlan, temporaryFiles, `${suffix}.rollback-plan.tmp`);
    if (manifestInstalled && fsOps.existsSync(manifestFile)
        && fsOps.readFileSync(manifestFile).equals(manifestBytes)) {
      fsOps.unlinkSync(manifestFile);
      syncPath(fsOps, path.dirname(manifestFile));
    }
    throw error;
  } finally {
    for (const temporary of temporaryFiles) {
      if (fsOps.existsSync(temporary)) fsOps.unlinkSync(temporary);
    }
    fsOps.closeSync(lockDescriptor);
    if (fsOps.existsSync(lockFile)) {
      fsOps.unlinkSync(lockFile);
      syncPath(fsOps, path.dirname(lockFile));
    }
  }
}

function draftPlanBytes(frozenPlan) {
  const draft = structuredClone(frozenPlan);
  draft.status = "calibration-draft";
  draft.targets.forEach((target) => { target.model_id = null; });
  delete draft.freeze;
  return Buffer.from(canonicalJson(draft), "utf8");
}

function assertPublicationDraft(fsOps, planFile, expectedDraftBytes) {
  assertFileBytes(fsOps, planFile, expectedDraftBytes, "on-disk calibration draft changed during freeze publication");
}

function assertManifestAbsent(fsOps, manifestFile) {
  if (fsOps.existsSync(manifestFile)) throw new Error(`freeze publication refuses to replace existing manifest ${manifestFile}`);
}

function assertFileBytes(fsOps, file, expectedBytes, message) {
  if (!fsOps.readFileSync(file).equals(expectedBytes)) throw new Error(message);
}

function validateManifestShape(manifest, plan, runtimeIdentity) {
  assertPlainJson(manifest, "freeze manifest");
  requireExactKeys(manifest, [
    "manifest_version", "benchmark_id", "plan_version", "status", "frozen_at",
    "hash_algorithm", "artifact_count", "runtime_environment", "artifacts",
  ], "freeze manifest");
  requireEqual(manifest.manifest_version, "1", "freeze manifest manifest_version");
  requireEqual(manifest.benchmark_id, plan.benchmark_id, "freeze manifest benchmark_id");
  requireEqual(manifest.plan_version, plan.plan_version, "freeze manifest plan_version");
  requireEqual(manifest.status, "frozen", "freeze manifest status");
  requireEqual(manifest.frozen_at, plan.freeze.frozen_at, "freeze manifest frozen_at");
  requireEqual(manifest.hash_algorithm, "sha256", "freeze manifest hash_algorithm");
  validateRuntimeIdentity(runtimeIdentity);
  if (!isDeepStrictEqual(manifest.runtime_environment, { ruby: runtimeIdentity })) {
    throw new Error("freeze manifest Ruby/Psych runtime identity does not match the current runtime");
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    throw new Error("freeze manifest artifacts must be a non-empty array");
  }
  requireEqual(manifest.artifact_count, manifest.artifacts.length, "freeze manifest artifact_count");
  assertRequiredClasses(manifest.artifacts);
  assertUniqueArtifactPaths(manifest.artifacts);
  if (!isDeepStrictEqual(manifest.artifacts, [...manifest.artifacts].sort(compareArtifacts))) {
    throw new Error("freeze manifest artifacts must use canonical class/path order");
  }
}

function assertFrozenPlan(plan) {
  validatePlan(plan, { requireFrozen: true });
  if (!isDeepStrictEqual(plan.freeze.required_artifact_classes, REQUIRED_ARTIFACT_CLASSES)) {
    throw new Error("frozen plan must list the exact required artifact classes");
  }
}

function exactResolvedModels(plan, modelResolutions) {
  assertPlainJson(modelResolutions, "model resolutions");
  if (!Array.isArray(modelResolutions.targets) || modelResolutions.targets.length !== MODEL_IDS.size) {
    throw new Error("model resolutions must contain exactly three targets");
  }
  const resolved = new Map();
  modelResolutions.targets.forEach((target, index) => {
    const planned = plan.targets[index];
    if (target.target_id !== planned.id || target.resolved_model !== MODEL_IDS.get(planned.id)) {
      throw new Error(`model resolution ${planned.id} must use the exact frozen model`);
    }
    resolved.set(target.target_id, target.resolved_model);
  });
  return resolved;
}

function classForPackageFile(relativePath) {
  if (relativePath === "model-resolutions.json") return "model-resolutions";
  if (["cost-estimate.json", "MODEL-COST-PREFLIGHT.md"].includes(relativePath)) return "cost-estimate";
  if (relativePath.startsWith("private/")) return "private-calibration-inputs";
  if (relativePath.startsWith("runtime/")) return relativePath === "runtime/estimate-cost.mjs" ? "cost-estimate" : "runtime";
  if (relativePath.endsWith(".md")) return "package-documentation";
  return "calibration-inputs";
}

function isPrivatePackagePath(relativePath) {
  return relativePath.startsWith("private/") && relativePath !== "private/README.md";
}

function isDynamicPrivateArtifact(relativePath) {
  return ["private/runs/", "private/checkpoints/", "private/adjudication/"].some((prefix) => relativePath.startsWith(prefix));
}

function addFiles(artifacts, root, artifactClass, files) {
  files.forEach((file) => addArtifact(artifacts, root, artifactClass, file, "public"));
}

function addArtifact(artifacts, root, artifactClass, file, visibility) {
  if (!fs.existsSync(file)) throw new Error(`required freeze artifact is missing: ${file}`);
  assertRegularFileWithoutSymlinks(root, file);
  artifacts.push({
    class: artifactClass,
    path: normalizeLogicalPath(path.relative(root, file).split(path.sep).join("/")),
    visibility,
  });
}

function filesBelow(directory) {
  if (!fs.existsSync(directory)) throw new Error(`required freeze directory is missing: ${directory}`);
  assertRegularDirectory(directory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".DS_Store") return [];
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`freeze artifact path must not traverse a symbolic link: ${file}`);
    if (entry.isDirectory()) return filesBelow(file);
    if (entry.isFile()) return [file];
    throw new Error(`freeze artifact is not a regular file: ${file}`);
  }).sort(compareCodeUnits);
}

function findPlanPath(artifacts) {
  const plans = artifacts.filter((artifact) => artifact.path.endsWith("/plan.json"));
  if (plans.length !== 1) throw new Error("freeze artifacts must contain exactly one package plan.json");
  return plans[0].path;
}

function validateRuntimeIdentity(identity) {
  assertPlainJson(identity, "Ruby runtime identity");
  requireExactKeys(identity, ["executable", "ruby_description", "psych_version"], "Ruby runtime identity");
  for (const [key, value] of Object.entries(identity)) {
    if (typeof value !== "string" || value === "") throw new Error(`Ruby runtime identity ${key} must be a non-empty string`);
  }
}

function validateArtifactDescriptor(artifact, { requireHash }) {
  assertPlainJson(artifact, "freeze artifact descriptor");
  requireExactKeys(
    artifact,
    requireHash ? ["class", "path", "visibility", "sha256"] : ["class", "path", "visibility"],
    `freeze artifact ${String(artifact?.path ?? "<unknown>")}`,
  );
  if (!REQUIRED_ARTIFACT_CLASSES.includes(artifact.class)) {
    throw new Error(`unknown freeze artifact class ${String(artifact.class)}`);
  }
  normalizeLogicalPath(artifact.path);
  if (!["public", "private"].includes(artifact.visibility)) {
    throw new Error(`artifact ${artifact.path} visibility must be public or private`);
  }
  if (requireHash && !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw new Error(`artifact ${artifact.path} lacks a valid SHA-256`);
  }
}

function assertArtifactCoverage(actualArtifacts, expectedArtifacts) {
  if (!Array.isArray(expectedArtifacts) || expectedArtifacts.length === 0) {
    throw new Error("expectedArtifacts must be a non-empty array");
  }
  const actual = actualArtifacts.map(({ class: artifactClass, path: logicalPath, visibility }) => ({ class: artifactClass, path: logicalPath, visibility }));
  const expected = expectedArtifacts.map(({ class: artifactClass, path: logicalPath, visibility }) => ({ class: artifactClass, path: normalizeLogicalPath(logicalPath), visibility })).sort(compareArtifacts);
  if (!isDeepStrictEqual(actual, expected)) throw new Error("incomplete freeze boundary or misclassified freeze artifact");
}

function assertRequiredClasses(artifacts) {
  const classes = new Set(artifacts.map((artifact) => artifact.class));
  for (const artifactClass of REQUIRED_ARTIFACT_CLASSES) {
    if (!classes.has(artifactClass)) throw new Error(`missing required artifact class ${artifactClass}`);
  }
  const unknown = [...classes].find((artifactClass) => !REQUIRED_ARTIFACT_CLASSES.includes(artifactClass));
  if (unknown !== undefined) throw new Error(`unknown freeze artifact class ${unknown}`);
}

function assertUniqueArtifactPaths(artifacts) {
  const paths = new Set();
  for (const artifact of artifacts) {
    if (paths.has(artifact.path)) throw new Error(`duplicate freeze artifact path ${artifact.path}`);
    paths.add(artifact.path);
  }
}

function readArtifactBytes(rootDir, logicalPath, contentOverrides) {
  const normalized = normalizeLogicalPath(logicalPath);
  if (contentOverrides.has(normalized)) {
    const value = contentOverrides.get(normalized);
    if (!Buffer.isBuffer(value) && typeof value !== "string") {
      throw new TypeError(`content override for ${normalized} must be a Buffer or string`);
    }
    return Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  }
  const absolute = resolveLogicalPath(rootDir, normalized);
  if (!fs.existsSync(absolute)) throw new Error(`freeze artifact is missing: ${normalized}`);
  assertRegularFileWithoutSymlinks(rootDir, absolute);
  return fs.readFileSync(absolute);
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
    assertPlainJson(value, logicalPath);
    if (text !== canonicalJson(value)) throw new Error(`freeze artifact must use canonical JSON formatting: ${logicalPath}`);
    return;
  }
  if (!text.endsWith("\n")) throw new Error(`freeze artifact must use canonical JSONL formatting: ${logicalPath}`);
  const lines = text.slice(0, -1).split("\n");
  const values = lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (cause) {
      throw new Error(`freeze artifact must contain valid JSON at ${logicalPath} line ${index + 1}`, { cause });
    }
  });
  values.forEach((value, index) => assertPlainJson(value, `${logicalPath} line ${index + 1}`));
  if (text !== `${values.map((value) => JSON.stringify(value)).join("\n")}\n`) {
    throw new Error(`freeze artifact must use canonical JSONL formatting: ${logicalPath}`);
  }
}

function assertBytesContainNoLikelySecrets(bytes, logicalPath) {
  const text = decodeUtf8(bytes, logicalPath);
  if (text.includes("\0")) throw new Error(`freeze artifact cannot be safely scanned as UTF-8 text: ${logicalPath}`);
  for (const match of text.matchAll(PROVIDER_API_KEY_ASSIGNMENT)) {
    const value = match.slice(1).find((candidate) => candidate !== undefined) ?? "";
    if (value.length >= 12 && !/^[<${]/.test(value) && !/^[a-f0-9]{64}$/i.test(value)) {
      throw new Error(`possible secret (provider API key assignment) in ${logicalPath}`);
    }
  }
  for (const [name, expression] of SECRET_PATTERNS) {
    if (expression.test(text)) throw new Error(`possible secret (${name}) in ${logicalPath}`);
  }
}

function decodeUtf8(bytes, logicalPath) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`freeze artifact cannot be safely scanned as UTF-8 text: ${logicalPath}`);
  }
}

function normalizeLogicalPath(logicalPath) {
  if (typeof logicalPath !== "string" || logicalPath.trim() === "" || path.isAbsolute(logicalPath) || logicalPath.includes("\\")) {
    throw new Error(`artifact path must be a canonical relative path: ${String(logicalPath)}`);
  }
  const segments = logicalPath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`artifact path must be a canonical relative path: ${logicalPath}`);
  }
  return logicalPath;
}

function resolveLogicalPath(rootDir, logicalPath) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, normalizeLogicalPath(logicalPath));
  assertWithinRoot(root, resolved, `artifact path ${logicalPath}`);
  return resolved;
}

function assertWithinRoot(rootDir, candidate, label) {
  const relative = path.relative(path.resolve(rootDir), path.resolve(candidate));
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes root`);
  }
}

function assertRegularDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`freeze path must be a regular directory: ${directory}`);
}

function assertRegularFileWithoutSymlinks(rootDir, file) {
  const root = path.resolve(rootDir);
  const absolute = path.resolve(file);
  assertWithinRoot(root, absolute, `freeze artifact ${file}`);
  let current = root;
  for (const segment of path.relative(root, absolute).split(path.sep)) {
    if (segment === "") continue;
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`freeze artifact path must not traverse a symbolic link: ${current}`);
  }
  if (!fs.lstatSync(absolute).isFile()) throw new Error(`freeze artifact is not a regular file: ${file}`);
}

function artifactSetSha256(manifest, planArtifactPath) {
  const artifacts = manifest.artifacts.filter((artifact) => artifact.path !== planArtifactPath);
  if (artifacts.length === manifest.artifacts.length) throw new Error(`freeze manifest is missing plan artifact ${planArtifactPath}`);
  return sha256Bytes(Buffer.from(canonicalJson({
    runtime_environment: manifest.runtime_environment,
    artifacts,
  }), "utf8"));
}

function assertPlanIdentityCommitment(plan) {
  const committedPlan = structuredClone(plan);
  committedPlan.freeze.artifact_set_sha256 = "0".repeat(64);
  if (sha256Bytes(Buffer.from(canonicalJson(committedPlan), "utf8")) !== FROZEN_PLAN_IDENTITY_SHA256) {
    throw new Error("frozen plan identity commitment does not match the repository trust anchor");
  }
}

function assertNoRetainedFreezeIdentity({ rootDir, planArtifactPath, benchmarkId, planVersion }) {
  const manifestPath = path.posix.join(path.posix.dirname(planArtifactPath), "freeze-manifest.json");
  const manifestFile = resolveLogicalPath(rootDir, manifestPath);
  if (!fs.existsSync(manifestFile)) return;
  let retained;
  try {
    retained = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch (cause) {
    throw new Error(`existing freeze manifest prevents publication: ${manifestPath}`, { cause });
  }
  if (retained?.benchmark_id === benchmarkId && retained?.plan_version === planVersion) {
    throw new Error(`retained freeze identity ${planVersion} is immutable`);
  }
  throw new Error(`existing freeze manifest prevents publication: ${manifestPath}`);
}

function readCanonicalJson(file, logicalPath) {
  const bytes = fs.readFileSync(file);
  assertCanonicalStructuredText(bytes, logicalPath);
  return JSON.parse(bytes.toString("utf8"));
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

function compareArtifacts(left, right) {
  return compareCodeUnits(left.class, right.class) || compareCodeUnits(left.path, right.path);
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (!isDeepStrictEqual(Object.keys(value).sort(compareCodeUnits), [...expected].sort(compareCodeUnits))) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
}

function requireEqual(actual, expected, label) {
  if (!Object.is(actual, expected)) throw new Error(`${label} must be ${JSON.stringify(expected)}`);
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateCheckedInDomainInputs(plan, privateRequired) {
  const models = readCanonicalJson(MODEL_RESOLUTIONS_FILE, `${PACKAGE_RELATIVE_PATH}/model-resolutions.json`);
  validateModelResolutions(plan, models);
  const metricsPresent = fs.existsSync(METRICS_FILE);
  const promptsPresent = fs.existsSync(PRIVATE_PROMPTS_FILE);
  if (metricsPresent !== promptsPresent) throw new Error("private prompts and context metrics must either both exist or both be absent");
  if (privateRequired && !metricsPresent) throw new Error("private-required validation requires prompts and context metrics");
  if (metricsPresent) {
    const metrics = readCanonicalJson(METRICS_FILE, `${PACKAGE_RELATIVE_PATH}/private/contexts/calibration-metrics.json`);
    const estimate = readCanonicalJson(COST_ESTIMATE_FILE, `${PACKAGE_RELATIVE_PATH}/cost-estimate.json`);
    validateCostEstimate(plan, estimate, models, metrics);
  }
  const schedule = fs.readFileSync(path.join(PACKAGE_DIR, "calibration-schedule.jsonl"), "utf8")
    .trimEnd().split("\n").map((line) => JSON.parse(line));
  if (!isDeepStrictEqual(schedule, buildCalibrationSchedule(plan))) {
    throw new Error("calibration schedule does not match the frozen plan");
  }
}

function writeFreezePair(frozen, runtimeIdentity) {
  const planLogicalPath = `${PACKAGE_RELATIVE_PATH}/plan.json`;
  const planText = canonicalJson(frozen.plan);
  const expectedArtifacts = collectFreezeArtifacts({ repositoryRoot: REPOSITORY_ROOT, privateRequired: true });
  publishFreezePair({
    ...frozen,
    planFile: PLAN_FILE,
    manifestFile: MANIFEST_FILE,
    validatePrepared: () => validateFrozenPackage({
      privateRequired: true,
      expectedArtifacts,
      planOverride: frozen.plan,
      manifestOverride: frozen.manifest,
      contentOverrides: new Map([[planLogicalPath, planText]]),
      runtimeIdentity,
    }),
    validatePublished: () => validateFrozenPackage({ privateRequired: true, runtimeIdentity }),
  });
}

function runCli() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const check = args.includes("--check");
  const privateRequired = args.includes("--private-required");
  if (write === check || args.some((argument) => !["--write", "--check", "--private-required"].includes(argument))
      || args.filter((argument) => argument === "--private-required").length > 1) {
    throw new Error("usage: freeze.mjs --write | --check [--private-required]");
  }
  const runtimeIdentity = collectRubyRuntimeIdentity();
  if (check) {
    validateFrozenPackage({ privateRequired, runtimeIdentity });
    validateCheckedInDomainInputs(readCanonicalJson(PLAN_FILE, `${PACKAGE_RELATIVE_PATH}/plan.json`), privateRequired);
    console.log(`Freeze manifest check passed for ${path.relative(process.cwd(), MANIFEST_FILE)}`);
    return;
  }
  if (!privateRequired) throw new Error("freeze publication requires --private-required");
  const plan = readCanonicalJson(PLAN_FILE, `${PACKAGE_RELATIVE_PATH}/plan.json`);
  if (plan.status === "calibration-frozen") {
    try {
      validateFrozenPackage({ privateRequired: true, runtimeIdentity });
      validateCheckedInDomainInputs(plan, true);
    } catch (cause) {
      throw new Error(`frozen calibration identity ${plan.plan_version} is immutable; current artifacts differ from the published freeze`, { cause });
    }
    console.log(`Frozen calibration ${plan.plan_version} is valid; no files were written`);
    return;
  }
  validatePlan(plan);
  const models = readCanonicalJson(MODEL_RESOLUTIONS_FILE, `${PACKAGE_RELATIVE_PATH}/model-resolutions.json`);
  const metrics = readCanonicalJson(METRICS_FILE, `${PACKAGE_RELATIVE_PATH}/private/contexts/calibration-metrics.json`);
  const estimate = readCanonicalJson(COST_ESTIMATE_FILE, `${PACKAGE_RELATIVE_PATH}/cost-estimate.json`);
  validateModelResolutions(plan, models);
  validateCostEstimate(plan, estimate, models, metrics);
  const artifacts = collectFreezeArtifacts({ repositoryRoot: REPOSITORY_ROOT, privateRequired: true });
  const frozen = buildCalibrationFreeze({
    plan,
    modelResolutions: models,
    artifacts,
    rootDir: REPOSITORY_ROOT,
    frozenAt: DEFAULT_FROZEN_AT,
    planArtifactPath: `${PACKAGE_RELATIVE_PATH}/plan.json`,
    runtimeIdentity,
  });
  writeFreezePair(frozen, runtimeIdentity);
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
