#!/usr/bin/env node

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual, types } from "node:util";
import { fileURLToPath } from "node:url";
import { isBuiltin } from "node:module";

import { FROZEN_ARTIFACT_CLASSES, validatePlan } from "./check-plan.mjs";
import { validateCostEstimate, validateModelResolutions } from "./estimate-cost.mjs";
import { buildCalibrationSchedule, PACKAGE_DIR, PLAN_FILE } from "./paths.mjs";
import { assertPlainJson } from "./strict-json.mjs";
import { FREEZE_AUTHORITY } from "./freeze-authority.mjs";

const REPOSITORY_ROOT = path.resolve(PACKAGE_DIR, "..", "..", "..", "..", "..", "..");
const MANIFEST_FILE = path.join(PACKAGE_DIR, "freeze-manifest.json");
const MODEL_RESOLUTIONS_FILE = path.join(PACKAGE_DIR, "model-resolutions.json");
const COST_ESTIMATE_FILE = path.join(PACKAGE_DIR, "cost-estimate.json");
const METRICS_FILE = path.join(PACKAGE_DIR, "private", "contexts", "calibration-metrics.json");
const PRIVATE_PROMPTS_FILE = path.join(PACKAGE_DIR, "private", "prompts", "calibration.jsonl");
const PACKAGE_RELATIVE_PATH = "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4";
const TEST_PATTERN = /^openapi-comparison-v3-calibration4-.*\.test\.mjs$/;
const MODEL_IDS = new Map([
  ["openai-frontier", "gpt-5.6-sol"],
  ["anthropic-balanced", "claude-sonnet-5"],
  ["google-stable-agentic", "gemini-3.8-flash"],
]);
export const FREEZE_AUTHORITY_PATH = `${PACKAGE_RELATIVE_PATH}/runtime/freeze-authority.mjs`;
const AUTHORITY_FILE = fileURLToPath(new URL("./freeze-authority.mjs", import.meta.url));
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MODULE_DEPENDENCIES = new Map();

function requireFreezeAnchor() {
  const authority = readAuthorityFile(path.dirname(AUTHORITY_FILE), AUTHORITY_FILE);
  assertPlainJson(FREEZE_AUTHORITY, "loaded freeze authority");
  if (!isDeepStrictEqual(authority, FREEZE_AUTHORITY)) throw new Error("loaded freeze authority changed; restart with the reviewed root");
  if (authority.manifest_sha256 === null) {
    throw new Error("calibration.4 draft freeze is disabled until phase7B establishes its reviewed trust anchor");
  }
  return authority;
}

function readAuthorityFile(root, file) {
  assertRegularFileWithoutSymlinks(root, file);
  if (fs.statSync(file).size > 4096) throw new Error("freeze authority exceeds bounded data-only record");
  const source = fs.readFileSync(file, "utf8");
  const prefix = "export const FREEZE_AUTHORITY = ";
  if (!source.startsWith(prefix) || !source.endsWith(";\n")) throw new Error("freeze authority must be a fixed data-only export");
  let authority;
  try { authority = JSON.parse(source.slice(prefix.length, -2)); }
  catch (cause) { throw new Error("freeze authority must be canonical data-only JSON", { cause }); }
  assertPlainJson(authority, "freeze authority");
  requireExactKeys(authority, ["format", "version", "benchmark_id", "plan_version", "manifest_sha256"], "freeze authority");
  if (authority.format !== "docai-calibration-freeze-authority" || authority.version !== "1"
      || authority.benchmark_id !== "docai-http-openapi-comparison-v3" || authority.plan_version !== "3.0.0-calibration.4"
      || !(authority.manifest_sha256 === null || (typeof authority.manifest_sha256 === "string" && /^[a-f0-9]{64}$/.test(authority.manifest_sha256)))) {
    throw new Error("unsupported freeze authority format, version, identity or manifest digest");
  }
  if (source !== `${prefix}${JSON.stringify(authority, null, 2)};\n`) throw new Error("freeze authority must use exact canonical data-only source");
  return authority;
}

export function collectFreezeAuthority(input = {}) {
  rejectUnknownOptions(input, ["repositoryRoot"]);
  const { repositoryRoot = REPOSITORY_ROOT } = input;
  const root = path.resolve(repositoryRoot), file = path.join(root, FREEZE_AUTHORITY_PATH);
  readAuthorityFile(root, file);
  return { path: FREEZE_AUTHORITY_PATH, role: "trusted-freeze-authority" };
}

function assertAuthorityPath(packageDir, repositoryRoot) {
  const file = path.join(packageDir, "runtime/freeze-authority.mjs");
  readAuthorityFile(repositoryRoot, file);
  if (!fs.readFileSync(file).equals(fs.readFileSync(AUTHORITY_FILE))) throw new Error("package freeze authority differs from the fixed trusted root");
}

function assertManifestAuthority(bytes) {
  const authority = requireFreezeAnchor();
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_MANIFEST_BYTES || sha256Bytes(bytes) !== authority.manifest_sha256) {
    throw new Error("exact manifest bytes do not match the trusted freeze authority");
  }
  return authority;
}

function assertAuthenticatedPair(plan, manifest) {
  assertPlainJson({ plan, manifest }, "authenticated freeze pair");
  const authority = assertManifestAuthority(Buffer.from(canonicalJson(manifest), "utf8"));
  assertFrozenPlan(plan);
  if (plan.benchmark_id !== authority.benchmark_id || plan.plan_version !== authority.plan_version) throw new Error("frozen plan identity differs from freeze authority");
  const planPath = findPlanPath(manifest.artifacts);
  if (manifest.artifacts.find(artifact => artifact.path === planPath).sha256 !== sha256Bytes(Buffer.from(canonicalJson(plan), "utf8"))) throw new Error("final plan bytes do not match the authenticated manifest");
  if (artifactSetSha256(manifest, planPath) !== plan.freeze.artifact_set_sha256) throw new Error("freeze manifest artifact-set seal does not match the frozen plan");
}

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
  collectFreezeAuthority({ repositoryRoot: root });

  for (const file of filesBelow(packageDir)) {
    const relativeToPackage = normalizeLogicalPath(path.relative(packageDir, file).split(path.sep).join("/"));
    if (["freeze-manifest.json", "freeze-manifest.json.lock", "runtime/freeze-authority.mjs"].includes(relativeToPackage)
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
    .filter((entry) => TEST_PATTERN.test(entry.name))
    .map((entry) => {
      const file = path.join(testsDir, entry.name);
      assertRegularFileWithoutSymlinks(root, file);
      return file;
    });
  const dependencies = collectModuleDependencies(root, [
    ...tests,
    ...filesBelow(path.join(packageDir, "runtime")).filter((file) => file.endsWith(".mjs")),
  ]);
  for (const file of dependencies) {
    if (file === path.join(root, FREEZE_AUTHORITY_PATH)) continue;
    if (artifacts.some((artifact) => artifact.path === path.relative(root, file).split(path.sep).join("/"))) continue;
    addArtifact(artifacts, root, "calibration-tests", file, "public");
  }

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
    if (logicalPath === path.posix.join(path.posix.dirname(findPlanPath(artifacts)), "runtime/freeze-authority.mjs")) throw new Error("trusted freeze authority is not an authenticated payload artifact");
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
  frozenAt,
  planArtifactPath,
  runtimeIdentity = collectRubyRuntimeIdentity(),
}) {
  if (typeof frozenAt !== "string" || !Number.isFinite(Date.parse(frozenAt))) throw new Error("offline freeze preparation requires an explicit frozenAt timestamp");
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

export function validateFrozenPackage(input = {}) {
  requireFreezeAnchor();
  rejectUnknownOptions(input, ["packageDir", "repositoryRoot", "privateRequired", "expectedArtifacts", "planOverride", "manifestOverride", "contentOverrides", "runtimeIdentity"]);
  const {
    packageDir = PACKAGE_DIR,
    repositoryRoot = REPOSITORY_ROOT,
    privateRequired = false,
    expectedArtifacts,
    planOverride,
    manifestOverride,
    contentOverrides = new Map(),
    runtimeIdentity = collectRubyRuntimeIdentity(),
  } = input;
  if (typeof privateRequired !== "boolean") throw new TypeError("privateRequired must be a boolean");
  if (!(contentOverrides instanceof Map)) throw new TypeError("contentOverrides must be a Map");
  const root = path.resolve(repositoryRoot);
  const resolvedPackageDir = path.resolve(packageDir);
  assertWithinRoot(root, resolvedPackageDir, "packageDir");
  assertAuthorityPath(resolvedPackageDir, root);
  const planPath = normalizeLogicalPath(path.relative(root, path.join(resolvedPackageDir, "plan.json")).split(path.sep).join("/"));
  const manifestPath = normalizeLogicalPath(path.relative(root, path.join(resolvedPackageDir, "freeze-manifest.json")).split(path.sep).join("/"));
  const manifestFile = resolveLogicalPath(root, manifestPath);
  let manifestBytes;
  if (manifestOverride !== undefined) {
    assertPlainJson(manifestOverride, "prepared manifest");
    manifestBytes = Buffer.from(canonicalJson(manifestOverride), "utf8");
    if (fs.existsSync(manifestFile)) {
      assertRegularFileWithoutSymlinks(root, manifestFile);
      if (!fs.readFileSync(manifestFile).equals(manifestBytes)) throw new Error("manifest override differs from fixed on-disk manifest bytes");
    } else assertRegularDirectory(path.dirname(manifestFile));
  } else {
    assertRegularFileWithoutSymlinks(root, manifestFile);
    if (fs.statSync(manifestFile).size > MAX_MANIFEST_BYTES) throw new Error("freeze manifest exceeds bounded authority input");
    manifestBytes = fs.readFileSync(manifestFile);
  }
  assertManifestAuthority(manifestBytes);
  assertCanonicalStructuredText(manifestBytes, manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  for (const key of contentOverrides.keys()) if (key !== planPath) throw new Error("prepared content overrides may only supply the authenticated final plan");
  const plan = planOverride ?? readCanonicalJson(path.join(resolvedPackageDir, "plan.json"), planPath);
  assertFrozenPlan(plan);
  validateManifestShape(manifest, plan, runtimeIdentity);

  const expected = expectedArtifacts ?? collectFreezeArtifacts({ repositoryRoot: root, privateRequired });
  assertArtifactCoverage(manifest.artifacts, expected);
  assertAuthenticatedPair(plan, manifest);
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

export function publishFreezePair(input) {
  requireFreezeAnchor();
  rejectUnknownOptions(input, ["plan", "manifest", "planFile", "manifestFile", "validatePrepared", "validatePublished", "fsOps"]);
  const {
    plan,
    manifest,
    planFile,
    manifestFile,
    validatePrepared,
    validatePublished,
    fsOps = fs,
  } = input;
  assertAuthenticatedPair(plan, manifest);
  if (typeof planFile !== "string" || typeof manifestFile !== "string" || path.basename(planFile) !== "plan.json"
      || path.resolve(manifestFile) !== path.join(path.dirname(path.resolve(planFile)), "freeze-manifest.json")) {
    throw new Error("freeze publication requires fixed plan.json and freeze-manifest.json output paths");
  }
  assertAuthorityPath(path.dirname(planFile), path.dirname(planFile));
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
  const lockBytes = Buffer.from(suffix, "utf8");
  let lockDescriptor;
  let originalPlan;
  let originalPlanMode;
  let manifestInstalled = false;
  let planInstalled = false;
  let lockReleased = false;
  try {
    lockDescriptor = fsOps.openSync(lockFile, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`exclusive freeze publication lock is already in progress: ${lockFile}`, { cause: error });
    throw error;
  }
  try {
    fsOps.writeFileSync(lockDescriptor, lockBytes);
    fsOps.fsyncSync(lockDescriptor);
    syncPath(fsOps, path.dirname(lockFile));
    originalPlan = fsOps.readFileSync(planFile);
    originalPlanMode = fsOps.statSync(planFile).mode & 0o777;
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
    assertAuthenticatedPair(plan, manifest);
    writeFileDurably(fsOps, temporaryManifest, manifestBytes, { flag: "wx" });
    writeFileDurably(fsOps, temporaryPlan, canonicalJson(plan), { encoding: "utf8", flag: "wx", mode: originalPlanMode });

    assertPublicationDraft(fsOps, planFile, expectedDraftBytes);
    assertManifestAbsent(fsOps, manifestFile);
    fsOps.linkSync(temporaryManifest, manifestFile);
    manifestInstalled = true;
    syncPath(fsOps, path.dirname(manifestFile));
    fsOps.unlinkSync(temporaryManifest);
    temporaryFiles.delete(temporaryManifest);

    assertPublicationDraft(fsOps, planFile, expectedDraftBytes);
    assertFileBytes(fsOps, manifestFile, manifestBytes, "installed freeze manifest changed during publication");
    fsOps.renameSync(temporaryPlan, planFile);
    planInstalled = true;
    temporaryFiles.delete(temporaryPlan);
    syncPath(fsOps, path.dirname(planFile));
    validatePublished();
    assertAuthenticatedPair(plan, manifest);
    for (const temporary of temporaryFiles) {
      if (fsOps.existsSync(temporary)) fsOps.unlinkSync(temporary);
      temporaryFiles.delete(temporary);
    }
    fsOps.closeSync(lockDescriptor);
    lockDescriptor = undefined;
    try {
      fsOps.unlinkSync(lockFile);
    } catch (error) {
      // An unlink error need not prove ownership survived. Never roll back or
      // remove a successor's lock if the owned token is absent or unverifiable.
      const cleanupErrors = [{ operation: "release-lock", message: error instanceof Error ? error.message : String(error) }];
      let stillOwned = false;
      try {
        stillOwned = fsOps.readFileSync(lockFile).equals(lockBytes);
      } catch (inspectionError) {
        if (inspectionError?.code !== "ENOENT") cleanupErrors.push({
          operation: "inspect-lock", message: inspectionError instanceof Error ? inspectionError.message : String(inspectionError),
        });
      }
      if (stillOwned) throw error;
      lockReleased = true;
      return { status: "committed-with-cleanup-error", cleanupErrors };
    }
    lockReleased = true;
  } catch (error) {
    if (planInstalled) restoreFileDurably(fsOps, planFile, originalPlan, temporaryFiles, `${suffix}.rollback-plan.tmp`, originalPlanMode);
    if (manifestInstalled && fsOps.existsSync(manifestFile)
        && fsOps.readFileSync(manifestFile).equals(manifestBytes)) {
      fsOps.unlinkSync(manifestFile);
      syncPath(fsOps, path.dirname(manifestFile));
    }
    throw error;
  } finally {
    if (!lockReleased) {
      for (const temporary of temporaryFiles) {
        if (fsOps.existsSync(temporary)) fsOps.unlinkSync(temporary);
      }
      if (lockDescriptor !== undefined) fsOps.closeSync(lockDescriptor);
      if (fsOps.existsSync(lockFile)) {
        fsOps.unlinkSync(lockFile);
        syncPath(fsOps, path.dirname(lockFile));
      }
    }
  }
  // The lock is released: never restore files or remove a subsequent owner's lock.
  try {
    syncPath(fsOps, path.dirname(lockFile));
  } catch (error) {
    return { status: "committed-with-cleanup-error", cleanupErrors: [
      { operation: "sync-lock-directory", message: error instanceof Error ? error.message : String(error) },
    ] };
  }
  return { status: "committed" };
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

function collectModuleDependencies(root, entrypoints) {
  const runtimeDir = path.join(root, PACKAGE_RELATIVE_PATH, "runtime");
  const found = new Set();
  let pending = entrypoints;
  while (pending.length > 0) {
    const batch = [...new Set(pending)].filter((file) => !found.has(file));
    if (batch.length === 0) break;
    batch.forEach((file) => { assertRegularFileWithoutSymlinks(root, file); found.add(file); });
    // V8 parses ESM imports/re-exports without evaluating any module or test.
    const sources = new Map(batch.map(file => [file, fs.readFileSync(file, "utf8")]));
    const uncached = batch.filter(file => MODULE_DEPENDENCIES.get(file)?.sha256 !== sha256Bytes(sources.get(file)));
    const parsed = uncached.length === 0 ? null : spawnSync(process.execPath, ["--no-warnings", "--experimental-vm-modules", "--input-type=module", "-e", `
      import fs from "node:fs";
      import vm from "node:vm";
      const files = JSON.parse(fs.readFileSync(0, "utf8"));
      console.log(JSON.stringify(files.map(({ file, source }) => new vm.SourceTextModule(source, { identifier: file }).dependencySpecifiers)));
    `], { input: JSON.stringify(uncached.map(file => ({ file, source: sources.get(file) }))), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (parsed && (parsed.error || parsed.status !== 0)) throw new Error(`unable to parse freeze dependency closure: ${parsed.error?.message ?? parsed.stderr}`);
    if (parsed) JSON.parse(parsed.stdout).forEach((specifiers, index) => MODULE_DEPENDENCIES.set(uncached[index], {
      sha256: sha256Bytes(sources.get(uncached[index])), specifiers,
    }));
    const imports = batch.map(file => MODULE_DEPENDENCIES.get(file).specifiers);
    pending = [];
    imports.forEach((specifiers, index) => {
      const runtime = batch[index].startsWith(`${runtimeDir}${path.sep}`);
      const dependencies = [...specifiers];
      if (runtime) {
        // Inspect every raw keyword candidate, even inside inert text. This is
        // conservative, not a lexer: no earlier string/comment can hide a call.
        // V8 rejects escaped keywords; all legal trivia/line terminators are consumed.
        const source = sources.get(batch[index]);
        for (const match of source.matchAll(/\bimport\b/g)) {
          const tail = source.slice(match.index + match[0].length);
          const trivia = /^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n\u2028\u2029]*(?:\r\n|[\r\n\u2028\u2029]|$))*/.exec(tail)[0];
          const expression = tail.slice(trivia.length);
          if (!expression.startsWith("(")) continue;
          // Only one plain, unescaped string literal, with no options or comments.
          const literal = /^\(\s*(["'])([^"'\\\r\n\u2028\u2029]+)\1\s*\)/.exec(expression);
          if (!literal) throw new Error(`unbound dynamic runtime import: ${batch[index]}`);
          dependencies.push(literal[2]);
        }
      }
      for (const specifier of dependencies) {
        if (specifier.startsWith("node:") && isBuiltin(specifier)) continue;
        if (!specifier.startsWith("./") && !specifier.startsWith("../")) throw new Error(`unsupported freeze dependency: ${specifier}`);
        const file = path.resolve(path.dirname(batch[index]), specifier);
        assertWithinRoot(root, file, "freeze dependency");
        if (runtime) assertWithinRoot(runtimeDir, file, "runtime dependency must remain in package");
        if (!file.endsWith(".mjs")) throw new Error(`freeze dependency must be an explicit .mjs file: ${specifier}`);
        pending.push(file);
      }
    });
  }
  return [...found].sort(compareCodeUnits);
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
  const absolute = resolveLogicalPath(rootDir, normalized);
  if (!fs.existsSync(absolute)) throw new Error(`freeze artifact is missing: ${normalized}`);
  assertRegularFileWithoutSymlinks(rootDir, absolute);
  if (contentOverrides.has(normalized)) {
    const value = contentOverrides.get(normalized);
    if (!Buffer.isBuffer(value) && typeof value !== "string") {
      throw new TypeError(`content override for ${normalized} must be a Buffer or string`);
    }
    return Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  }
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

function rejectUnknownOptions(input, allowed) {
  if (input === null || typeof input !== "object" || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype
      || Object.getOwnPropertySymbols(input).length > 0
      || Object.entries(Object.getOwnPropertyDescriptors(input)).some(([key, descriptor]) => !allowed.includes(key) || !descriptor.enumerable || !("value" in descriptor))) {
    throw new Error("unsupported freeze options; authority cannot be overridden");
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
  if (options.mode !== undefined) fsOps.chmodSync(file, options.mode);
  syncPath(fsOps, file);
}

function renameFileDurably(fsOps, source, destination) {
  fsOps.renameSync(source, destination);
  syncPath(fsOps, path.dirname(destination));
}

function restoreFileDurably(fsOps, destination, contents, temporaryFiles, suffix, mode) {
  const temporary = `${destination}${suffix}`;
  temporaryFiles.add(temporary);
  writeFileDurably(fsOps, temporary, contents, { flag: "wx", mode });
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
  return publishFreezePair({
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
  const candidateIndex = args.indexOf("--candidate");
  let candidateFile;
  if (candidateIndex !== -1) {
    candidateFile = args[candidateIndex + 1];
    if (!candidateFile || candidateFile.startsWith("--")) throw new Error("--candidate requires a reviewed offline candidate file");
    args.splice(candidateIndex, 2);
  }
  const write = args.includes("--write");
  const check = args.includes("--check");
  const privateRequired = args.includes("--private-required");
  if (write === check || (check && candidateFile) || args.some((argument) => !["--write", "--check", "--private-required"].includes(argument))
      || args.filter((argument) => argument === "--private-required").length > 1) {
    throw new Error("usage: freeze.mjs --write --private-required --candidate <file> | --check [--private-required]");
  }
  requireFreezeAnchor();
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
  if (!candidateFile) throw new Error("draft publication requires --candidate with the reviewed offline plan/manifest pair");
  const absoluteCandidate = path.resolve(candidateFile);
  assertRegularFileWithoutSymlinks(REPOSITORY_ROOT, absoluteCandidate);
  if (fs.statSync(absoluteCandidate).size > 2 * MAX_MANIFEST_BYTES) throw new Error("offline freeze candidate exceeds bounded input");
  const frozen = readCanonicalJson(absoluteCandidate, "offline-candidate.json");
  requireExactKeys(frozen, ["plan", "manifest"], "offline freeze candidate");
  assertAuthenticatedPair(frozen.plan, frozen.manifest);
  if (Date.parse(frozen.plan.freeze.frozen_at) > Date.now()) throw new Error("freeze publication requires a reviewed real UTC timestamp, not future time");
  if (!Buffer.from(canonicalJson(plan)).equals(draftPlanBytes(frozen.plan))) throw new Error("offline freeze candidate differs from the on-disk draft");
  const publication = writeFreezePair(frozen, runtimeIdentity);
  if (publication.status === "committed-with-cleanup-error") {
    console.error(`FREEZE_COMMITTED_CLEANUP_ERROR: frozen plan and manifest were committed; ${JSON.stringify(publication.cleanupErrors)}. Do not retry publication or rebaseline. Run freeze.mjs --check --private-required, inspect lock/directory durability, and resolve cleanup before proceeding. This is not Live authorization.`);
    process.exitCode = 2;
    return;
  }
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
