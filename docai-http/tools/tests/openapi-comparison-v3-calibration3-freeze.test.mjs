import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_ARTIFACT_CLASSES,
  buildCalibrationFreeze,
  buildFreezeManifest,
  collectFreezeArtifacts,
  collectRubyRuntimeIdentity,
  publishFreezePair,
  validateFrozenPackage,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/freeze.mjs";
import { PACKAGE_DIR, readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/paths.mjs";
import { validatePlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-plan.mjs";
import { cliFixture } from "./calibration3-cli-helpers.mjs";

test("transitive helpers are manifest-bound and tampering is rejected", async () => {
  for (const helper of ["calibration3-stop-helpers.mjs", "calibration3-cli-helpers.mjs"]) {
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
      const helper = path.join(tests, "calibration3-stop-helpers.mjs");
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

test("collects the complete calibration.3 package, test, Stable, and private freeze boundary", () => {
  const artifacts = collectFreezeArtifacts({ repositoryRoot: REPOSITORY_ROOT, privateRequired: true });
  const paths = artifacts.map((artifact) => artifact.path);
  const packageFiles = filesBelow(PACKAGE_DIR)
    .map((file) => path.relative(REPOSITORY_ROOT, file).split(path.sep).join("/"))
    .filter((file) => file !== MANIFEST_PATH);
  const calibrationTests = fs.readdirSync(TEST_DIR)
    .filter((file) => /^openapi-comparison-v3-calibration3-.*\.test\.mjs$/.test(file))
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
  for (const helper of ["calibration3-stop-helpers.mjs", "calibration3-cli-helpers.mjs"]) {
    assert.ok(paths.includes(`docai-http/tools/tests/${helper}`), `unbound transitive helper: ${helper}`);
  }

  const runtimeFiles = filesBelow(path.join(PACKAGE_DIR, "runtime"))
    .map((file) => path.relative(REPOSITORY_ROOT, file).split(path.sep).join("/"));
  assert.deepEqual(runtimeFiles.filter((file) => !paths.includes(file)), []);
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
    }), /trust anchor|identity commitment/);
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

test("checked-in frozen package validates in public and private-required modes", () => {
  const plan = readPlan();
  assert.equal(plan.status, "calibration-frozen");
  assert.deepEqual(plan.targets.map((target) => target.model_id), EXPECTED_MODEL_IDS);
  assert.doesNotThrow(() => validatePlan(plan, { requireFrozen: true }));
  assert.doesNotThrow(() => validateFrozenPackage({ privateRequired: false }));
  assert.doesNotThrow(() => validateFrozenPackage({ privateRequired: true }));
});

function withFreezeFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-calibration3-freeze-"));
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
    const frozenPlan = buildCalibrationFreeze({
      plan,
      modelResolutions: models,
      artifacts,
      rootDir: root,
      frozenAt: "2026-11-10T00:00:00Z",
      planArtifactPath: "package/plan.json",
      runtimeIdentity,
    }).plan;
    run({ root, plan, frozenPlan, artifacts, models, runtimeIdentity });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function draftPlan() {
  return {
    benchmark_id: "docai-http-openapi-comparison-v3",
    plan_version: "3.0.0-calibration.3",
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
