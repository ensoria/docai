import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_ARTIFACT_CLASSES,
  collectFreezeArtifacts,
  collectRubyRuntimeIdentity,
  validateFrozenPackage as validateProductionFreeze,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/freeze.mjs";
import { PACKAGE_DIR, readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/paths.mjs";
import { validatePlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/check-plan.mjs";
import { cliFixture } from "./calibration4-cli-helpers.mjs";
import { syntheticFreezeRuntime } from "./calibration4-freeze-helpers.mjs";

const synthetic = await syntheticFreezeRuntime();
after(synthetic.cleanup);
const { buildCalibrationFreeze, buildFreezeManifest, publishFreezePair, validateFrozenPackage } = synthetic.freeze;
// All November10 timestamps below are synthetic fixture data, not a .4 freeze.

test("transitive helpers are manifest-bound and tampering is rejected", async () => {
  for (const helper of ["calibration4-stop-helpers.mjs", "calibration4-cli-helpers.mjs", "calibration4-evidence-helpers.mjs"]) {
    const f = await cliFixture();
    try {
      fs.appendFileSync(path.join(f.root, "docai-http/tools/tests", helper), "\n// tampered fixture\n");
      assert.throws(() => f.assertFrozen(), /SHA-256 mismatch/);
      fs.unlinkSync(path.join(f.root, "docai-http/tools/tests", helper));
      assert.throws(() => f.assertFrozen(), /ENOENT|missing/);
    } finally { f.cleanup(); }
  }
});

test("missing and newly imported helper edges fail closed", async () => {
  for (const missing of [false, true]) {
    const f = await cliFixture();
    try {
      const tests = path.join(f.root, "docai-http/tools/tests");
      const helper = path.join(tests, "calibration4-stop-helpers.mjs");
      const dependency = path.join(tests, "fixture-nested-helper.mjs");
      fs.appendFileSync(helper, '\nexport * from "./fixture-nested-helper.mjs";\n');
      if (!missing) fs.writeFileSync(dependency, "export const synthetic = true;\n");
      assert.throws(() => f.assertFrozen(), /incomplete freeze boundary|ENOENT|missing/);
      if (!missing) {
        const closure = collectFreezeArtifacts({ repositoryRoot: f.root, privateRequired: true });
        assert.ok(closure.some((row) => row.path.endsWith("/fixture-nested-helper.mjs")));
        fs.unlinkSync(dependency);
        assert.throws(() => collectFreezeArtifacts({ repositoryRoot: f.root }), /ENOENT|missing/);
      }
    } finally { f.cleanup(); }
  }
});

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const PACKAGE_PATH = path.relative(REPOSITORY_ROOT, PACKAGE_DIR).split(path.sep).join("/");
const PLAN_PATH = `${PACKAGE_PATH}/plan.json`;
const MANIFEST_PATH = `${PACKAGE_PATH}/freeze-manifest.json`;
const PRIVATE_PROMPTS_PATH = `${PACKAGE_PATH}/private/prompts/calibration.jsonl`;
const PRIVATE_METRICS_PATH = `${PACKAGE_PATH}/private/contexts/calibration-metrics.json`;
const EXPECTED_MODEL_IDS = ["gpt-5.6-sol", "claude-sonnet-5", "gemini-3.8-flash"];

test("collects the complete calibration.4 package, test, Stable, and private freeze boundary", () => {
  const artifacts = collectFreezeArtifacts({ repositoryRoot: REPOSITORY_ROOT, privateRequired: true });
  const paths = artifacts.map((artifact) => artifact.path);
  const packageFiles = filesBelow(PACKAGE_DIR)
    .map((file) => path.relative(REPOSITORY_ROOT, file).split(path.sep).join("/"))
    .filter((file) => file !== MANIFEST_PATH && file !== `${PACKAGE_PATH}/runtime/freeze-authority.mjs` && !["runs", "checkpoints", "adjudication"].some(store => file.startsWith(`${PACKAGE_PATH}/private/${store}/`)));
  const calibrationTests = fs.readdirSync(TEST_DIR)
    .filter((file) => /^openapi-comparison-v3-calibration4-.*\.test\.mjs$/.test(file))
    .map((file) => `docai-http/tools/tests/${file}`)
    .sort(compareCodeUnits);

  assert.deepEqual([...new Set(paths)].sort(compareCodeUnits), [...paths].sort(compareCodeUnits));
  assert.deepEqual(packageFiles.filter((file) => !paths.includes(file)), []);
  assert.deepEqual(calibrationTests.filter((file) => !paths.includes(file)), []);
  assert.ok(paths.includes(PRIVATE_PROMPTS_PATH));
  assert.ok(paths.includes(PRIVATE_METRICS_PATH));
  assert.deepEqual(
    artifacts.filter((artifact) => [PRIVATE_PROMPTS_PATH, PRIVATE_METRICS_PATH].includes(artifact.path))
      .map((artifact) => artifact.visibility),
    ["private", "private"],
  );
  assert.ok(paths.includes("docai-http/fixtures/conformance/v1.0.0/source/complete-openapi.yaml"));
  assert.ok(paths.includes("docai-http/fixtures/conformance/v1.0.0/source/complete-behavior.yaml"));
  assert.ok(paths.includes("docai-http/fixtures/conformance/v1.0.0/valid/full/resources/documents.md"));
  assert.ok(paths.includes("docai-http/fixtures/conformance/v1.0.0/valid/compact/workflows/checkout.md"));
  assert.ok(paths.includes(`${PACKAGE_PATH}/runtime/freeze.mjs`));
  for (const helper of ["calibration4-stop-helpers.mjs", "calibration4-cli-helpers.mjs"]) {
    assert.ok(paths.includes(`docai-http/tools/tests/${helper}`), `unbound transitive helper: ${helper}`);
  }

  const runtimeFiles = filesBelow(path.join(PACKAGE_DIR, "runtime"))
    .map((file) => path.relative(REPOSITORY_ROOT, file).split(path.sep).join("/"));
  assert.deepEqual(runtimeFiles.filter((file) => !paths.includes(file)), [`${PACKAGE_PATH}/runtime/freeze-authority.mjs`]);
  assert.equal(
    runtimeFiles.some((file) => fs.readFileSync(path.join(REPOSITORY_ROOT, file), "utf8").includes("3.0.0-calibration.1")),
    false,
  );
  assert.deepEqual([...new Set(artifacts.map((artifact) => artifact.class))].sort(compareCodeUnits), [...REQUIRED_ARTIFACT_CLASSES].sort(compareCodeUnits));
});

test("records the executable Ruby identity, RUBY_DESCRIPTION, and Psych version", () => {
  const identity = collectRubyRuntimeIdentity();
  const result = spawnSync(identity.executable, ["-rpsych", "-e", "puts RbConfig.ruby; puts RUBY_DESCRIPTION; puts Psych::VERSION"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const [executable, rubyDescription, psychVersion] = result.stdout.trimEnd().split("\n");
  assert.deepEqual(identity, {
    executable: fs.realpathSync(executable),
    ruby_description: rubyDescription,
    psych_version: psychVersion,
  });
});

test("runtime imports cannot escape into mutable repository helpers", async () => {
  const f = await cliFixture();
  try {
    const external = path.join(f.root, "docai-http/tools/mutable.mjs");
    fs.writeFileSync(external, "export const mutable = true;\n");
    fs.appendFileSync(path.join(f.packageDir, "runtime/parser.mjs"), '\nimport "../../../../../../tools/mutable.mjs";\n');
    assert.throws(() => collectFreezeArtifacts({ repositoryRoot: f.root }), /runtime dependency.*package|runtime import/);
  } finally { f.cleanup(); }
});

test("closure rejects symlinked canonical tests and does not silently omit arbitrary files", async () => {
  const f = await cliFixture();
  try {
    const unexpected = path.join(f.packageDir, ".DS_Store");
    fs.writeFileSync(unexpected, "synthetic inventory sentinel\n");
    assert.ok(collectFreezeArtifacts({ repositoryRoot: f.root }).some(row => row.path.endsWith("/.DS_Store")));
    fs.unlinkSync(unexpected);
    const link = path.join(f.root, "docai-http/tools/tests/openapi-comparison-v3-calibration4-linked.test.mjs");
    fs.symlinkSync(path.join(f.root, "docai-http/tools/tests/openapi-comparison-v3-calibration4-cli.test.mjs"), link);
    assert.throws(() => collectFreezeArtifacts({ repositoryRoot: f.root }), /symbolic link/);
  } finally { f.cleanup(); }
});

test("runtime dependency closure rejects bare, absolute, missing and computed import edges", async () => {
  const f = await cliFixture();
  try {
    const file = path.join(f.packageDir, "runtime/parser.mjs"), bytes = fs.readFileSync(file);
    for (const edge of ['import "unbound-package";', 'import "/tmp/unbound.mjs";', 'import "./missing.mjs";',
      'export * from "./missing.mjs";', 'const late = () => import("unbound-package");',
      'const late = specifier => import(specifier);', 'const late = () => import /* boundary */ ("../../../../../../tools/mutable.mjs");']) {
      fs.writeFileSync(file, Buffer.concat([bytes, Buffer.from(`\n${edge}\n`)]));
      assert.throws(() => collectFreezeArtifacts({ repositoryRoot: f.root }), /unsupported|ENOENT|missing|unbound|runtime dependency/);
    }
    fs.writeFileSync(file, bytes);
    const helper = path.join(f.packageDir, "runtime/synthetic-late.mjs");
    fs.writeFileSync(helper, "export const synthetic = true;\n");
    fs.appendFileSync(file, '\nconst late = () => import("./synthetic-late.mjs");\n');
    assert.ok(collectFreezeArtifacts({ repositoryRoot: f.root }).some(row => row.path.endsWith("/synthetic-late.mjs")));
    fs.unlinkSync(helper);
    assert.throws(() => collectFreezeArtifacts({ repositoryRoot: f.root }), /ENOENT|missing/);
  } finally { f.cleanup(); }
});

test("fixture manifest rejects every unsafe logical path and secret family", () => {
  withFreezeFixture(({ root, frozenPlan, artifacts, runtimeIdentity }) => {
    const manifest = candidate => buildFreezeManifest({ plan: frozenPlan, artifacts: candidate, rootDir: root,
      frozenAt: frozenPlan.freeze.frozen_at, runtimeIdentity });
    for (const unsafe of ["", "/tmp/escape", "../escape", "package/../escape", "package//input.json", "./package/input.json", "package/./input.json", "package\\input.json"]) {
      const candidate = structuredClone(artifacts); candidate[0].path = unsafe;
      assert.throws(() => manifest(candidate), /canonical relative path|escapes root/);
    }
    const documentation = path.join(root, "package/README.md");
    for (const secret of ["sk-" + "a".repeat(24), "sk-ant-api03-" + "b".repeat(24), "AIza" + "c".repeat(32),
      "Authorization: Bearer " + "d".repeat(24), 'GOOGLE_API_KEY="' + "e".repeat(24) + '"']) {
      fs.writeFileSync(documentation, secret + "\n");
      assert.throws(() => manifest(artifacts), /possible secret/);
    }
    for (const bytes of [Buffer.from([0xff]), Buffer.from("unsafe\0text")]) {
      fs.writeFileSync(documentation, bytes);
      assert.throws(() => manifest(artifacts), /UTF-8/);
    }
  });
});

for (const [name, terminator] of [["LF", "\n"], ["CR", "\r"], ["CRLF", "\r\n"], ["LS", "\u2028"], ["PS", "\u2029"]]) {
  test(`R1 dynamic imports fail closed after ${name} line comments`, async () => {
    const f = await cliFixture();
    try {
      const file = path.join(f.packageDir, "runtime/parser.mjs");
      const before = fs.readFileSync(file);
      for (const argument of ['"/tmp/task7-unbound.mjs"', '"../../../../../../tools/mutable.mjs"',
        '"unbound-package"', "specifier", '`./${specifier}.mjs`', '"./parser.mjs", {}']) {
        fs.writeFileSync(file, Buffer.concat([before, Buffer.from(`\nconst late = specifier => import// boundary${terminator}(${argument});\n`)]));
        assert.throws(() => collectFreezeArtifacts({ repositoryRoot: f.root }), /unsupported|unbound|runtime dependency/,
          `${name}: ${argument}`);
      }
      for (const argument of ['"./parser.mjs"', '"node:fs"']) {
        fs.writeFileSync(file, Buffer.concat([before, Buffer.from(`\nconst late = () => import/* first */// boundary${terminator}/* last */(${argument});\n`)]));
        assert.doesNotThrow(() => collectFreezeArtifacts({ repositoryRoot: f.root }));
      }
      assert.equal(f.calls(), 0);
    } finally { f.cleanup(); }
  });
}

for (const stage of ["close-lock", "unlink-lock"]) {
  test(`R2 ${stage} failure while owned restores exact draft and permits retry`, () => {
    withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
      const directory = path.join(root, "package"), planFile = path.join(directory, "plan.json"), manifestFile = path.join(directory, "freeze-manifest.json");
      const lockFile = `${manifestFile}.lock`;
      fs.chmodSync(planFile, 0o640);
      const before = fs.readFileSync(planFile), inventory = fs.readdirSync(directory).sort();
      const frozen = buildCalibrationFreeze({ plan, modelResolutions: models, artifacts, rootDir: root,
        frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity });
      let lockDescriptor, published = false, injected = false;
      const fsOps = tracingFs([], {
        openSync(file, ...args) { const descriptor = fs.openSync(file, ...args); if (file === lockFile) lockDescriptor = descriptor; return descriptor; },
        closeSync(descriptor) {
          if (published && !injected && stage === "close-lock" && descriptor === lockDescriptor) { injected = true; throw new Error("injected owned-lock close failure"); }
          fs.closeSync(descriptor);
        },
        unlinkSync(file) {
          if (published && !injected && stage === "unlink-lock" && file === lockFile) { injected = true; throw new Error("injected owned-lock unlink failure"); }
          fs.unlinkSync(file);
        },
      });
      const input = { ...frozen, planFile, manifestFile, fsOps, validatePrepared: () => true, validatePublished: () => { published = true; } };
      assert.throws(() => publishFreezePair(input), /injected owned-lock/);
      assert.equal(injected, true);
      assert.deepEqual(fs.readFileSync(planFile), before);
      assert.equal(fs.statSync(planFile).mode & 0o777, 0o640);
      assert.deepEqual(fs.readdirSync(directory).sort(), inventory);
      assert.deepEqual(publishFreezePair(input), { status: "committed" });
    });
  });
}

for (const stage of ["open", "fsync", "close"]) {
  test(`R2 released-lock directory ${stage} failure reports committed without racing the next owner`, () => {
    withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
      const directory = path.join(root, "package"), planFile = path.join(directory, "plan.json"), manifestFile = path.join(directory, "freeze-manifest.json");
      const lockFile = `${manifestFile}.lock`;
      const frozen = buildCalibrationFreeze({ plan, modelResolutions: models, artifacts, rootDir: root,
        frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity });
      let released = false, directoryDescriptor, injected = false;
      const failOnce = operation => {
        if (released && !injected && stage === operation) { injected = true; throw new Error(`injected released-lock ${stage} failure`); }
      };
      const fsOps = tracingFs([], {
        unlinkSync(file) {
          fs.unlinkSync(file);
          if (file === lockFile) { released = true; fs.writeFileSync(lockFile, "next owner\n", { flag: "wx" }); }
        },
        openSync(file, ...args) { if (file === directory) failOnce("open"); const descriptor = fs.openSync(file, ...args); if (released && file === directory) directoryDescriptor = descriptor; return descriptor; },
        fsyncSync(descriptor) { if (descriptor === directoryDescriptor) failOnce("fsync"); fs.fsyncSync(descriptor); },
        closeSync(descriptor) { fs.closeSync(descriptor); if (descriptor === directoryDescriptor) failOnce("close"); },
      });
      const result = publishFreezePair({ ...frozen, planFile, manifestFile, fsOps, validatePrepared: () => true, validatePublished: () => true });
      assert.equal(injected, true);
      assert.equal(result.status, "committed-with-cleanup-error");
      assert.deepEqual(result.cleanupErrors, [{ operation: "sync-lock-directory", message: `injected released-lock ${stage} failure` }]);
      assert.deepEqual(fs.readFileSync(planFile), Buffer.from(canonicalJson(frozen.plan)));
      assert.deepEqual(fs.readFileSync(manifestFile), Buffer.from(canonicalJson(frozen.manifest)));
      assert.equal(fs.readFileSync(lockFile, "utf8"), "next owner\n");
      assert.equal(fs.readdirSync(directory).some(file => file.endsWith(".tmp")), false);
    });
  });
}

test("R2 actual CLI distinguishes committed cleanup failure from rollback", async () => {
  const f = await cliFixture();
  try {
    const draft = structuredClone(f.plan);
    draft.status = "calibration-draft"; delete draft.freeze;
    draft.targets.forEach(target => { target.model_id = null; });
    fs.writeFileSync(path.join(f.packageDir, "plan.json"), canonicalJson(draft));
    fs.unlinkSync(path.join(f.packageDir, "freeze-manifest.json"));
    fs.appendFileSync(path.join(f.root, "mock-fetch.mjs"), `
if (process.env.TASK7_CLEANUP_FAILURE === "yes") {
  const unlink = fs.unlinkSync, open = fs.openSync;
  let released = false;
  fs.unlinkSync = function(file, ...args) { const result = unlink.call(fs, file, ...args); if (String(file).endsWith("freeze-manifest.json.lock")) released = true; return result; };
  fs.openSync = function(file, ...args) { if (released && file === ${JSON.stringify(f.packageDir)}) { released = false; throw new Error("injected CLI released-lock sync failure"); } return open.call(fs, file, ...args); };
}
`);
    const result = f.spawn("freeze", ["--write", "--private-required", "--candidate", f.candidateFile], { TASK7_CLEANUP_FAILURE: "yes" });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /FREEZE_COMMITTED_CLEANUP_ERROR/);
    assert.match(result.stderr, /--check --private-required/);
    assert.match(result.stderr, /Do not retry publication|do not retry publication/);
    assert.doesNotMatch(result.stdout, /Wrote .* hashes/);
    f.assertFrozen();
    assert.equal(f.spawn("freeze", ["--check", "--private-required"]).status, 0);
    assert.equal(f.calls(), 0);
  } finally { f.cleanup(); }
});

test("R2 unlink that releases ownership then throws never rolls back a committed pair", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    const directory = path.join(root, "package"), planFile = path.join(directory, "plan.json"), manifestFile = path.join(directory, "freeze-manifest.json");
    const lockFile = `${manifestFile}.lock`;
    const frozen = buildCalibrationFreeze({ plan, modelResolutions: models, artifacts, rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity });
    let released = false;
    const fsOps = tracingFs([], {
      unlinkSync(file) {
        fs.unlinkSync(file);
        if (file === lockFile) {
          released = true;
          fs.writeFileSync(lockFile, "subsequent owner\n", { flag: "wx" });
          throw new Error("injected unlink completed then failed");
        }
      },
      renameSync(source, destination) {
        assert.equal(released, false, "must not restore a plan after losing ownership");
        fs.renameSync(source, destination);
      },
    });
    const result = publishFreezePair({ ...frozen, planFile, manifestFile, fsOps, validatePrepared: () => true, validatePublished: () => true });
    assert.equal(result.status, "committed-with-cleanup-error");
    assert.deepEqual(result.cleanupErrors, [{ operation: "release-lock", message: "injected unlink completed then failed" }]);
    assert.deepEqual(fs.readFileSync(planFile), Buffer.from(canonicalJson(frozen.plan)));
    assert.deepEqual(fs.readFileSync(manifestFile), Buffer.from(canonicalJson(frozen.manifest)));
    assert.equal(fs.readFileSync(lockFile, "utf8"), "subsequent owner\n");
  });
});

for (const stage of ["prepared", "manifest-sync", "published", "draft-drift"]) {
  test(`publication ${stage} failure preserves exact draft bytes, mode and inventory`, () => {
    withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
      const directory = path.join(root, "package"), planFile = path.join(directory, "plan.json"), manifestFile = path.join(directory, "freeze-manifest.json");
      fs.chmodSync(planFile, 0o640);
      const frozen = buildCalibrationFreeze({ plan, modelResolutions: models, artifacts, rootDir: root,
        frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity });
      const before = fs.readFileSync(planFile), mode = fs.statSync(planFile).mode & 0o777, inventory = fs.readdirSync(directory).sort();
      let installed = false, injected = false;
      const fsOps = tracingFs([], {
        linkSync(source, destination) { fs.linkSync(source, destination); installed = true; },
        openSync(file, ...args) {
          if (stage === "manifest-sync" && installed && file === directory && !injected) {
            injected = true; throw new Error("synthetic manifest-sync failure");
          }
          return fs.openSync(file, ...args);
        },
      });
      assert.throws(() => publishFreezePair({ ...frozen, planFile, manifestFile, fsOps,
        validatePrepared: () => {
          if (stage === "prepared") throw new Error("synthetic prepared failure");
          if (stage === "draft-drift") fs.appendFileSync(planFile, "\n");
        },
        validatePublished: () => { if (stage === "published") throw new Error("synthetic published failure"); },
      }), /synthetic|draft changed/);
      if (stage === "draft-drift") assert.deepEqual(fs.readFileSync(planFile), Buffer.concat([before, Buffer.from("\n")]));
      else assert.deepEqual(fs.readFileSync(planFile), before);
      assert.equal(fs.statSync(planFile).mode & 0o777, mode);
      assert.deepEqual(fs.readdirSync(directory).sort(), inventory);
      assert.equal(fs.existsSync(manifestFile), false);
    });
  });
}

test("prepared content overrides cannot conceal symlinked source files", () => {
  withFreezeFixture(({ root, frozenPlan, artifacts, runtimeIdentity }) => {
    const file = path.join(root, "package/README.md");
    const outside = path.join(root, "external.txt");
    fs.writeFileSync(outside, "synthetic external source\n");
    fs.unlinkSync(file); fs.symlinkSync(outside, file);
    assert.throws(() => buildFreezeManifest({ plan: frozenPlan, artifacts, rootDir: root,
      frozenAt: frozenPlan.freeze.frozen_at, runtimeIdentity,
      contentOverrides: new Map([["package/README.md", "fixture documentation\n"]]) }), /symbolic link/);
  });
});

test("revision and freeze bind model/cost, every runtime, schema, Stable and canonical tests", async () => {
  const f = await cliFixture();
  try {
    const artifacts = collectFreezeArtifacts({ repositoryRoot: f.root, privateRequired: true });
    const revisionBefore = f.runner.buildRunnerRevision();
    for (const relative of ["model-resolutions.json", "cost-estimate.json", "contracts.json", "continuity/evidence-ledger.json",
      "runtime/record.mjs", "runtime/provider-usage.mjs", "runtime/check-gate.mjs", "private/prompts/calibration.jsonl", "private/contexts/calibration-metrics.json"]) {
      const file = path.join(f.packageDir, relative);
      const bytes = fs.readFileSync(file);
      assert.ok(artifacts.some(row => row.path === `${PACKAGE_PATH}/${relative}`), relative);
      fs.appendFileSync(file, "\n");
      assert.notEqual(f.runner.buildRunnerRevision(), revisionBefore, `unbound revision: ${relative}`);
      fs.writeFileSync(file, bytes);
    }
    for (const file of ["docai-http/tools/tests/calibration4-evidence-helpers.mjs", "docai-http/tools/tests/openapi-comparison-v3-calibration4-cli.test.mjs",
      "docai-http/fixtures/conformance/v1.0.0/source/complete-openapi.yaml"]) {
      const absolute = path.join(f.root, file), bytes = fs.readFileSync(absolute);
      fs.appendFileSync(absolute, "\n");
      assert.notEqual(f.runner.buildRunnerRevision(), revisionBefore, `unbound revision: ${file}`);
      fs.writeFileSync(absolute, bytes);
    }
    assert.equal(f.calls(), 0);
  } finally { f.cleanup(); }
});

test("canonical ledger, contract, model/rate and native-policy drift cannot retain a valid seal", async () => {
  const f = await cliFixture();
  try {
    for (const relative of ["contracts.json", "continuity/tasks.json", "continuity/evidence-ledger.json", "model-resolutions.json", "cost-estimate.json"]) {
      const file = path.join(f.packageDir, relative), bytes = fs.readFileSync(file);
      const changed = JSON.parse(bytes); changed.synthetic_drift = true;
      fs.writeFileSync(file, canonicalJson(changed));
      assert.throws(() => f.assertFrozen(), /SHA-256 mismatch/, relative);
      fs.writeFileSync(file, bytes);
    }
    const file = path.join(f.packageDir, "runtime/record.mjs"), bytes = fs.readFileSync(file);
    fs.appendFileSync(file, "\n// synthetic native policy drift\n");
    assert.throws(() => f.assertFrozen(), /SHA-256 mismatch/);
    fs.writeFileSync(file, bytes);
    f.assertFrozen();
    assert.equal(f.calls(), 0);
  } finally { f.cleanup(); }
});

test("offline preparation requires an explicit time, never an inherited production default", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    // This synthetic anchor commits November10; current UTC cannot reuse it.
    assert.throws(() => buildCalibrationFreeze({ plan, modelResolutions: models, artifacts, rootDir: root,
      planArtifactPath: "package/plan.json", runtimeIdentity }), /explicit frozenAt/);
  });
});

test("draft CLI publishes once using the reviewed synthetic anchor time", async () => {
  const f = await cliFixture();
  try {
    const draft = structuredClone(f.plan);
    draft.status = "calibration-draft"; delete draft.freeze;
    draft.targets.forEach(target => { target.model_id = null; });
    fs.writeFileSync(path.join(f.packageDir, "plan.json"), canonicalJson(draft));
    fs.unlinkSync(path.join(f.packageDir, "freeze-manifest.json"));
    const authority = fs.readFileSync(path.join(f.packageDir, "runtime/freeze-authority.mjs"));
    const result = f.spawn("freeze", ["--write", "--private-required", "--candidate", f.candidateFile]);
    assert.equal(result.status, 0, result.stderr);
    f.assertFrozen();
    const files = ["plan.json", "freeze-manifest.json"].map(name => fs.readFileSync(path.join(f.packageDir, name)));
    assert.equal(f.spawn("freeze", ["--write", "--private-required"]).status, 0);
    assert.deepEqual(["plan.json", "freeze-manifest.json"].map(name => fs.readFileSync(path.join(f.packageDir, name))), files);
    assert.equal(f.calls(), 0);
    assert.deepEqual(fs.readFileSync(path.join(f.packageDir, "runtime/freeze-authority.mjs")), authority);
  } finally { f.cleanup(); }
});

test("sealed fixture public CLI tolerates only absent private inputs; private-required refuses them", async () => {
  const f = await cliFixture();
  try {
    for (const relative of ["private/prompts/calibration.jsonl", "private/contexts/calibration-metrics.json"]) fs.unlinkSync(path.join(f.packageDir, relative));
    const publicCheck = f.spawn("freeze", ["--check"]);
    assert.equal(publicCheck.status, 0, publicCheck.stderr);
    const privateCheck = f.spawn("freeze", ["--check", "--private-required"]);
    assert.notEqual(privateCheck.status, 0);
    assert.match(privateCheck.stderr, /required private|private freeze artifact/);
    assert.equal(f.calls(), 0);
  } finally { f.cleanup(); }
});

test("only designated dynamic stores are excluded; arbitrary private inputs remain sealed", async () => {
  const f = await cliFixture();
  try {
    const before = collectFreezeArtifacts({ repositoryRoot: f.root, privateRequired: true });
    for (const store of ["runs", "checkpoints", "adjudication"]) {
      const directory = path.join(f.packageDir, "private", store);
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(directory, "synthetic.json"), "not freeze input", { mode: 0o600 });
    }
    assert.deepEqual(collectFreezeArtifacts({ repositoryRoot: f.root, privateRequired: true }), before);
    f.assertFrozen();
    const extra = path.join(f.packageDir, "private/prompts/extra.txt");
    fs.writeFileSync(extra, "synthetic extra prompt\n", { mode: 0o600 });
    assert.throws(() => f.assertFrozen(), /incomplete freeze boundary/);
    assert.ok(collectFreezeArtifacts({ repositoryRoot: f.root }).some(row => row.path.endsWith("/private/prompts/extra.txt")));
    fs.unlinkSync(extra);
    for (const relative of ["private/prompts/calibration.jsonl", "private/contexts/calibration-metrics.json"]) {
      const file = path.join(f.packageDir, relative), bytes = fs.readFileSync(file);
      fs.appendFileSync(file, "\n");
      assert.throws(() => f.assertFrozen(), /canonical|valid JSON|SHA-256 mismatch/);
      fs.writeFileSync(file, bytes);
    }
    assert.equal(fs.statSync(extra.replace("/prompts/extra.txt", "/runs/synthetic.json")).mode & 0o777, 0o600);
    assert.equal(f.calls(), 0);
  } finally { f.cleanup(); }
});

test("builds a frozen plan with exact models and an independently sealed manifest", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    const draftBefore = structuredClone(plan);
    const frozen = buildCalibrationFreeze({
      plan,
      modelResolutions: models,
      artifacts,
      rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z",
      planArtifactPath: "package/plan.json",
      runtimeIdentity,
    });

    assert.deepEqual(plan, draftBefore);
    assert.equal(frozen.plan.status, "calibration-frozen");
    assert.deepEqual(frozen.plan.targets.map((target) => target.model_id), EXPECTED_MODEL_IDS);
    assert.equal(frozen.plan.freeze.manifest, "freeze-manifest.json");
    assert.match(frozen.plan.freeze.artifact_set_sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(frozen.plan.freeze.required_artifact_classes, REQUIRED_ARTIFACT_CLASSES);
    assert.equal(frozen.manifest.runtime_environment.ruby.executable, runtimeIdentity.executable);
    assert.equal(frozen.manifest.artifacts.some((artifact) => artifact.path === "package/freeze-manifest.json"), false);
  });
});

test("rejects malformed structured text, likely secrets, unsafe paths, symlinks, duplicates, and wrong classes", () => {
  withFreezeFixture(({ root, frozenPlan, artifacts, runtimeIdentity }) => {
    const malformedJson = path.join(root, "package", "input.json");
    fs.writeFileSync(malformedJson, "{not-json}\n");
    assert.throws(() => manifestFor(), /valid JSON/);
    fs.writeFileSync(malformedJson, canonicalJson({ ok: true }));

    const malformedJsonl = path.join(root, "package", "rows.jsonl");
    fs.writeFileSync(malformedJsonl, "{not-json}\n");
    assert.throws(() => manifestFor(), /valid JSON.*line 1/);
    fs.writeFileSync(malformedJsonl, `${JSON.stringify({ ok: true })}\n`);

    const documentation = path.join(root, "package", "README.md");
    fs.writeFileSync(documentation, `OPENAI_API_KEY=${"sk-proj-"}${"abcdefghijklmnopqrstuvwxyz"}\n`);
    assert.throws(() => manifestFor(), /possible secret/);
    fs.writeFileSync(documentation, "fixture documentation\n");

    const unsafe = structuredClone(artifacts);
    unsafe[0].path = "../escape.txt";
    assert.throws(() => manifestFor(unsafe), /canonical relative path|escapes root/);

    const duplicate = structuredClone(artifacts);
    duplicate.push(structuredClone(duplicate[0]));
    assert.throws(() => manifestFor(duplicate), /duplicate freeze artifact path/);

    const wrongClass = structuredClone(artifacts);
    wrongClass[0].class = "invented-class";
    assert.throws(() => manifestFor(wrongClass), /unknown freeze artifact class/);

    const target = path.join(root, "target.txt");
    fs.writeFileSync(target, "target\n");
    const symlink = path.join(root, "package", "README.md");
    fs.unlinkSync(symlink);
    fs.symlinkSync(target, symlink);
    assert.throws(() => manifestFor(), /symbolic link|regular file/);

    function manifestFor(candidate = artifacts) {
      return buildFreezeManifest({
        plan: frozenPlan,
        artifacts: candidate,
        rootDir: root,
        frozenAt: frozenPlan.freeze.frozen_at,
        runtimeIdentity,
      });
    }
  });
});

test("rejects noncanonical manifest order and incomplete artifact coverage", () => {
  withFreezeFixture(({ root, frozenPlan, artifacts, runtimeIdentity }) => {
    const manifest = buildFreezeManifest({
      plan: frozenPlan,
      artifacts,
      rootDir: root,
      frozenAt: frozenPlan.freeze.frozen_at,
      contentOverrides: new Map([["package/plan.json", canonicalJson(frozenPlan)]]),
      runtimeIdentity,
    });
    manifest.artifacts.reverse();
    writeFixtureFreeze(root, frozenPlan, manifest);
    assert.throws(
      () => validateFrozenPackage({ packageDir: path.join(root, "package"), repositoryRoot: root, expectedArtifacts: artifacts, runtimeIdentity }),
      /canonical class\/path order/,
    );

    manifest.artifacts.reverse();
    manifest.artifacts.pop();
    manifest.artifact_count -= 1;
    writeFixtureFreeze(root, frozenPlan, manifest);
    assert.throws(
      () => validateFrozenPackage({ packageDir: path.join(root, "package"), repositoryRoot: root, expectedArtifacts: artifacts, runtimeIdentity }),
      /incomplete freeze boundary|missing freeze artifact|missing required artifact class/,
    );
  });
});

test("public validation tolerates absent frozen private inputs while private-required rejects them", () => {
  withFreezeFixture(({ root, frozenPlan, artifacts, runtimeIdentity }) => {
    const manifest = buildFreezeManifest({
      plan: frozenPlan,
      artifacts,
      rootDir: root,
      frozenAt: frozenPlan.freeze.frozen_at,
      contentOverrides: new Map([["package/plan.json", canonicalJson(frozenPlan)]]),
      runtimeIdentity,
    });
    writeFixtureFreeze(root, frozenPlan, manifest);
    fs.unlinkSync(path.join(root, "package", "private", "prompts.jsonl"));

    assert.doesNotThrow(() => validateFrozenPackage({
      packageDir: path.join(root, "package"), repositoryRoot: root, expectedArtifacts: artifacts, runtimeIdentity,
    }));
    assert.throws(() => validateFrozenPackage({
      packageDir: path.join(root, "package"), repositoryRoot: root, expectedArtifacts: artifacts, privateRequired: true, runtimeIdentity,
    }), /private freeze artifact is missing/);
  });
});

test("rejects an in-memory plan and manifest identity rewrite despite a recomputed plan artifact hash", () => {
  withFreezeFixture(({ root, frozenPlan, artifacts, runtimeIdentity }) => {
    const manifest = buildFreezeManifest({
      plan: frozenPlan,
      artifacts,
      rootDir: root,
      frozenAt: frozenPlan.freeze.frozen_at,
      contentOverrides: new Map([["package/plan.json", canonicalJson(frozenPlan)]]),
      runtimeIdentity,
    });
    const rewrittenPlan = structuredClone(frozenPlan);
    const rewrittenManifest = structuredClone(manifest);
    rewrittenPlan.freeze.frozen_at = "2026-11-11T00:00:00Z";
    rewrittenManifest.frozen_at = rewrittenPlan.freeze.frozen_at;
    rewrittenManifest.artifacts.find((artifact) => artifact.path === "package/plan.json").sha256 = sha256(canonicalJson(rewrittenPlan));

    assert.throws(() => validateFrozenPackage({
      packageDir: path.join(root, "package"),
      repositoryRoot: root,
      expectedArtifacts: artifacts,
      planOverride: rewrittenPlan,
      manifestOverride: rewrittenManifest,
      contentOverrides: new Map([["package/plan.json", canonicalJson(rewrittenPlan)]]),
      runtimeIdentity,
    }), /trust anchor|identity commitment|manifest.*authority|authority.*manifest/);
  });
});

test("publishes manifest first, durably, and rolls back a plan-install failure", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    const planFile = path.join(root, "package", "plan.json");
    const manifestFile = path.join(root, "package", "freeze-manifest.json");
    const frozen = buildCalibrationFreeze({
      plan, modelResolutions: models, artifacts, rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity,
    });
    const originalPlanBytes = fs.readFileSync(planFile);
    const events = [];
    const fsOps = tracingFs(events);

    publishFreezePair({
      planFile, manifestFile, plan: frozen.plan, manifest: frozen.manifest, fsOps,
      validatePrepared: () => true,
      validatePublished: () => true,
    });
    const links = events.filter(([operation]) => operation === "link");
    const renames = events.filter(([operation]) => operation === "rename");
    assert.equal(links[0][2], manifestFile);
    assert.equal(renames[0][2], planFile);
    assert.ok(events.some(([operation]) => operation === "fsync"));
    assert.equal(JSON.parse(fs.readFileSync(planFile, "utf8")).status, "calibration-frozen");

    fs.rmSync(manifestFile);
    fs.writeFileSync(planFile, originalPlanBytes);
    const failingFs = tracingFs([], {
      renameSync(source, destination) {
        if (destination === planFile) throw new Error("injected plan install failure");
        return fs.renameSync(source, destination);
      },
    });
    assert.throws(() => publishFreezePair({
      planFile, manifestFile, plan: frozen.plan, manifest: frozen.manifest, fsOps: failingFs,
      validatePrepared: () => true,
      validatePublished: () => true,
    }), /injected plan install failure/);
    assert.deepEqual(fs.readFileSync(planFile), originalPlanBytes);
    assert.equal(fs.existsSync(manifestFile), false);
  });
});

for (const failureStage of ["open", "fsync", "close"]) {
  test(`post-plan-rename directory ${failureStage} failure restores the draft and permits retry`, () => {
    withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
      const directory = path.join(root, "package");
      const planFile = path.join(directory, "plan.json");
      const manifestFile = path.join(directory, "freeze-manifest.json");
      const draftBytes = fs.readFileSync(planFile);
      const originalFiles = fs.readdirSync(directory).sort();
      const frozen = buildCalibrationFreeze({
        plan, modelResolutions: models, artifacts, rootDir: root,
        frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity,
      });
      let renamed = false;
      let injected = false;
      let publishedChecks = 0;
      const descriptors = new Map();
      function failOnce(stage) {
        if (renamed && !injected && failureStage === stage) {
          injected = true;
          throw new Error(`injected post-plan-rename directory ${stage} failure`);
        }
      }
      const fsOps = tracingFs([], {
        renameSync(source, destination) {
          fs.renameSync(source, destination);
          if (destination === planFile) renamed = true;
        },
        openSync(file, ...args) {
          if (file === directory) failOnce("open");
          const descriptor = fs.openSync(file, ...args);
          descriptors.set(descriptor, file);
          return descriptor;
        },
        fsyncSync(descriptor) {
          if (descriptors.get(descriptor) === directory) failOnce("fsync");
          fs.fsyncSync(descriptor);
        },
        closeSync(descriptor) {
          const file = descriptors.get(descriptor);
          fs.closeSync(descriptor);
          descriptors.delete(descriptor);
          if (file === directory) failOnce("close");
        },
      });
      const publication = {
        planFile, manifestFile, plan: frozen.plan, manifest: frozen.manifest, fsOps,
        validatePrepared: () => true,
        validatePublished: () => { publishedChecks += 1; },
      };
      assert.throws(() => publishFreezePair(publication), new RegExp(`injected post-plan-rename directory ${failureStage} failure`));
      assert.equal(injected, true);
      assert.deepEqual(fs.readFileSync(planFile), draftBytes);
      assert.equal(fs.existsSync(manifestFile), false);
      assert.equal(fs.existsSync(`${manifestFile}.lock`), false);
      assert.deepEqual(fs.readdirSync(directory).sort(), originalFiles);
      assert.equal(descriptors.size, 0);
      assert.equal(publishedChecks, 0);

      publishFreezePair(publication);
      assert.deepEqual(fs.readFileSync(planFile), Buffer.from(canonicalJson(frozen.plan)));
      assert.deepEqual(fs.readFileSync(manifestFile), Buffer.from(canonicalJson(frozen.manifest)));
      assert.equal(fs.existsSync(`${manifestFile}.lock`), false);
      assert.deepEqual(fs.readdirSync(directory).sort(), [...originalFiles, "freeze-manifest.json"].sort());
      assert.equal(descriptors.size, 0);
      assert.equal(publishedChecks, 1);
    });
  });
}

test("publication refuses an identity whose exclusive lock is already held", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    const planFile = path.join(root, "package", "plan.json");
    const manifestFile = path.join(root, "package", "freeze-manifest.json");
    const lockFile = `${manifestFile}.lock`;
    const originalPlanBytes = fs.readFileSync(planFile);
    const frozen = buildCalibrationFreeze({
      plan, modelResolutions: models, artifacts, rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity,
    });
    fs.writeFileSync(lockFile, "held\n", { flag: "wx", mode: 0o600 });

    assert.throws(() => publishFreezePair({
      planFile, manifestFile, plan: frozen.plan, manifest: frozen.manifest,
      validatePrepared: () => true,
      validatePublished: () => true,
    }), /exclusive freeze publication lock|already in progress/);
    assert.deepEqual(fs.readFileSync(planFile), originalPlanBytes);
    assert.equal(fs.existsSync(manifestFile), false);
    assert.equal(fs.readFileSync(lockFile, "utf8"), "held\n");
  });
});

test("lock-file fsync failure closes and removes the owned publication lock", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    const planFile = path.join(root, "package", "plan.json");
    const manifestFile = path.join(root, "package", "freeze-manifest.json");
    const lockFile = `${manifestFile}.lock`;
    const originalPlanBytes = fs.readFileSync(planFile);
    const frozen = buildCalibrationFreeze({
      plan, modelResolutions: models, artifacts, rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity,
    });
    let lockDescriptor;
    let lockClosed = false;
    const failingFs = tracingFs([], {
      openSync(file, ...args) {
        const descriptor = fs.openSync(file, ...args);
        if (file === lockFile) lockDescriptor = descriptor;
        return descriptor;
      },
      fsyncSync(descriptor) {
        if (descriptor === lockDescriptor) throw new Error("injected lock-file fsync failure");
        return fs.fsyncSync(descriptor);
      },
      closeSync(descriptor) {
        if (descriptor === lockDescriptor) lockClosed = true;
        return fs.closeSync(descriptor);
      },
    });

    let failure;
    try {
      publishFreezePair({
        planFile, manifestFile, plan: frozen.plan, manifest: frozen.manifest, fsOps: failingFs,
        validatePrepared: () => true,
        validatePublished: () => true,
      });
    } catch (error) {
      failure = error;
    }
    const observed = {
      lockClosed,
      lockExists: fs.existsSync(lockFile),
      planBytes: fs.readFileSync(planFile),
      manifestExists: fs.existsSync(manifestFile),
    };
    if (!lockClosed && Number.isInteger(lockDescriptor)) fs.closeSync(lockDescriptor);
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);

    assert.match(failure?.message ?? "", /injected lock-file fsync failure/);
    assert.equal(observed.lockClosed, true);
    assert.equal(observed.lockExists, false);
    assert.deepEqual(observed.planBytes, originalPlanBytes);
    assert.equal(observed.manifestExists, false);
  });
});

test("initial lock-directory sync failure removes the owned lock and durably syncs its removal", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    const packageDirectory = path.join(root, "package");
    const planFile = path.join(packageDirectory, "plan.json");
    const manifestFile = path.join(packageDirectory, "freeze-manifest.json");
    const lockFile = `${manifestFile}.lock`;
    const originalPlanBytes = fs.readFileSync(planFile);
    const frozen = buildCalibrationFreeze({
      plan, modelResolutions: models, artifacts, rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity,
    });
    let lockDescriptor;
    let lockClosed = false;
    let directoryFsyncs = 0;
    const directoryDescriptors = new Set();
    const failingFs = tracingFs([], {
      openSync(file, ...args) {
        const descriptor = fs.openSync(file, ...args);
        if (file === lockFile) lockDescriptor = descriptor;
        if (file === packageDirectory) directoryDescriptors.add(descriptor);
        return descriptor;
      },
      fsyncSync(descriptor) {
        if (directoryDescriptors.has(descriptor)) {
          directoryFsyncs += 1;
          if (directoryFsyncs === 1) throw new Error("injected lock-directory sync failure");
        }
        return fs.fsyncSync(descriptor);
      },
      closeSync(descriptor) {
        if (descriptor === lockDescriptor) lockClosed = true;
        directoryDescriptors.delete(descriptor);
        return fs.closeSync(descriptor);
      },
    });

    let failure;
    try {
      publishFreezePair({
        planFile, manifestFile, plan: frozen.plan, manifest: frozen.manifest, fsOps: failingFs,
        validatePrepared: () => true,
        validatePublished: () => true,
      });
    } catch (error) {
      failure = error;
    }
    const observed = {
      lockClosed,
      lockExists: fs.existsSync(lockFile),
      directoryFsyncs,
      planBytes: fs.readFileSync(planFile),
      manifestExists: fs.existsSync(manifestFile),
    };
    if (!lockClosed && Number.isInteger(lockDescriptor)) fs.closeSync(lockDescriptor);
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);

    assert.match(failure?.message ?? "", /injected lock-directory sync failure/);
    assert.equal(observed.lockClosed, true);
    assert.equal(observed.lockExists, false);
    assert.equal(observed.directoryFsyncs, 2);
    assert.deepEqual(observed.planBytes, originalPlanBytes);
    assert.equal(observed.manifestExists, false);
  });
});

test("publication cannot replace a competing manifest injected at installation", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    const planFile = path.join(root, "package", "plan.json");
    const manifestFile = path.join(root, "package", "freeze-manifest.json");
    const originalPlanBytes = fs.readFileSync(planFile);
    const competingManifestBytes = Buffer.from(canonicalJson({ publisher: "competing" }), "utf8");
    const frozen = buildCalibrationFreeze({
      plan, modelResolutions: models, artifacts, rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity,
    });
    let injected = false;
    const racingFs = tracingFs([], {
      linkSync(source, destination) {
        if (destination === manifestFile && !injected) {
          fs.writeFileSync(manifestFile, competingManifestBytes, { flag: "wx", mode: 0o600 });
          injected = true;
        }
        return fs.linkSync(source, destination);
      },
    });

    assert.throws(() => publishFreezePair({
      planFile, manifestFile, plan: frozen.plan, manifest: frozen.manifest, fsOps: racingFs,
      validatePrepared: () => true,
      validatePublished: () => true,
    }), /EEXIST|refuses to replace existing manifest/);
    assert.equal(injected, true);
    assert.deepEqual(fs.readFileSync(planFile), originalPlanBytes);
    assert.deepEqual(fs.readFileSync(manifestFile), competingManifestBytes);
    assert.equal(fs.existsSync(`${manifestFile}.lock`), false);
  });
});

test("refuses to replace or rebaseline an existing frozen identity", () => {
  withFreezeFixture(({ root, plan, artifacts, models, runtimeIdentity }) => {
    const frozen = buildCalibrationFreeze({
      plan, modelResolutions: models, artifacts, rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity,
    });
    writeFixtureFreeze(root, frozen.plan, frozen.manifest);
    assert.throws(() => publishFreezePair({
      planFile: path.join(root, "package", "plan.json"),
      manifestFile: path.join(root, "package", "freeze-manifest.json"),
      plan: frozen.plan,
      manifest: frozen.manifest,
      validatePrepared: () => true,
      validatePublished: () => true,
    }), /immutable|already frozen|refuses to replace/);

    const downgraded = structuredClone(plan);
    fs.writeFileSync(path.join(root, "package", "plan.json"), canonicalJson(downgraded));
    assert.throws(() => buildCalibrationFreeze({
      plan: downgraded, modelResolutions: models, artifacts, rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z", planArtifactPath: "package/plan.json", runtimeIdentity,
    }), /retained freeze identity|immutable/);
  });
});

test("checked-in package distinguishes prepared draft from a published freeze", () => {
  const plan = readPlan();
  if (plan.status === "calibration-draft") {
    assert.deepEqual(plan.targets.map(target => target.model_id), [null, null, null]);
    assert.equal(fs.existsSync(path.join(PACKAGE_DIR, "freeze-manifest.json")), false);
    assert.throws(() => validateProductionFreeze({ privateRequired: true }), /draft freeze is disabled/);
    return;
  }
  assert.equal(plan.status, "calibration-frozen");
  assert.deepEqual(plan.targets.map((target) => target.model_id), EXPECTED_MODEL_IDS);
  assert.doesNotThrow(() => validatePlan(plan, { requireFrozen: true }));
  assert.doesNotThrow(() => validateProductionFreeze({ privateRequired: false }));
  assert.doesNotThrow(() => validateProductionFreeze({ privateRequired: true }));
});

function withFreezeFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-calibration4-freeze-"));
  try {
    const runtimeIdentity = {
      executable: "/fixture/ruby",
      ruby_description: "ruby fixture",
      psych_version: "9.9.9",
    };
    const plan = draftPlan();
    const models = modelResolutions();
    const files = [
      ["package/README.md", "package-documentation", "public", "fixture documentation\n"],
      ["package/plan.json", "calibration-inputs", "public", canonicalJson(plan)],
      ["package/input.json", "calibration-inputs", "public", canonicalJson({ ok: true })],
      ["package/rows.jsonl", "calibration-inputs", "public", `${JSON.stringify({ ok: true })}\n`],
      ["package/private/prompts.jsonl", "private-calibration-inputs", "private", `${JSON.stringify({ prompt: "fixture" })}\n`],
      ["package/runtime/main.mjs", "runtime", "public", "export const fixture = true;\n"],
      ["tests/freeze.test.mjs", "calibration-tests", "public", "// fixture test\n"],
      ["stable/source.yaml", "authoritative-stable-sources", "public", "openapi: 3.1.0\n"],
      ["stable/projection.md", "authoritative-stable-projections", "public", "# Fixture\n"],
      ["package/model-resolutions.json", "model-resolutions", "public", canonicalJson(models)],
      ["package/cost-estimate.json", "cost-estimate", "public", canonicalJson({ fixture: true })],
    ];
    files.forEach(([logicalPath, , , content]) => {
      const file = path.join(root, logicalPath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    });
    const artifacts = files.map(([logicalPath, artifactClass, visibility]) => ({
      class: artifactClass,
      path: logicalPath,
      visibility,
    }));
    const frozen = buildCalibrationFreeze({
      plan,
      modelResolutions: models,
      artifacts,
      rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z",
      planArtifactPath: "package/plan.json",
      runtimeIdentity,
    });
    const frozenPlan = frozen.plan;
    synthetic.pin(frozen.manifest);
    fs.copyFileSync(synthetic.authorityFile, path.join(root, "package/runtime/freeze-authority.mjs"));
    run({ root, plan, frozenPlan, artifacts, models, runtimeIdentity });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function draftPlan() {
  return {
    benchmark_id: "docai-http-openapi-comparison-v3",
    plan_version: "3.0.0-calibration.4",
    status: "calibration-draft",
    conditions: ["openapi-raw", "openapi-sliced", "openapi-enriched", "docai-selected"],
    targets: [
      { id: "openai-frontier", provider: "openai", model_id: null },
      { id: "anthropic-balanced", provider: "anthropic", model_id: null },
      { id: "google-stable-agentic", provider: "google", model_id: null },
    ],
    calibration: {
      api_id: "complete-commerce",
      task_ids: ["upload-document-request", "complete-checkout-workflow"],
      repetitions: [1],
      planned_requests: 24,
      maximum_attempts_per_work_step: 100,
      gate: { minimum_automated_decisions: 23, maximum_exceptional_runs: 1 },
    },
    future_primary_design: {
      api_count: 3, tasks_per_api: 6, target_count: 3, repetitions: 3,
      condition_count: 4, planned_requests: 648, batch_count: 9, requests_per_batch: 72,
    },
  };
}

function modelResolutions() {
  return {
    targets: [
      { target_id: "openai-frontier", resolved_model: EXPECTED_MODEL_IDS[0] },
      { target_id: "anthropic-balanced", resolved_model: EXPECTED_MODEL_IDS[1] },
      { target_id: "google-stable-agentic", resolved_model: EXPECTED_MODEL_IDS[2] },
    ],
  };
}

function writeFixtureFreeze(root, plan, manifest) {
  synthetic.pin(manifest);
  fs.copyFileSync(synthetic.authorityFile, path.join(root, "package/runtime/freeze-authority.mjs"));
  fs.writeFileSync(path.join(root, "package", "plan.json"), canonicalJson(plan));
  fs.writeFileSync(path.join(root, "package", "freeze-manifest.json"), canonicalJson(manifest));
}

function tracingFs(events, overrides = {}) {
  return new Proxy(fs, {
    get(target, property) {
      if (Object.hasOwn(overrides, property)) return overrides[property];
      const value = target[property];
      if (typeof value !== "function") return value;
      return (...args) => {
        if (["linkSync", "renameSync", "fsyncSync", "openSync", "writeFileSync", "unlinkSync"].includes(property)) {
          events.push([property.replace(/Sync$/, ""), ...args]);
        }
        return value.apply(target, args);
      };
    },
  });
}

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(file);
    return entry.isFile() ? [file] : [];
  }).sort(compareCodeUnits);
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
