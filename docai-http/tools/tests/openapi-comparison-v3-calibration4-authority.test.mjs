import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { cliFixture } from "./calibration4-cli-helpers.mjs";
import { pinFixtureAuthority } from "./calibration4-freeze-helpers.mjs";

const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

function reseal(f, mutateManifest = () => {}) {
  const planFile = path.join(f.packageDir, "plan.json"), manifestFile = path.join(f.packageDir, "freeze-manifest.json");
  const plan = JSON.parse(fs.readFileSync(planFile)), manifest = JSON.parse(fs.readFileSync(manifestFile));
  const planPath = path.relative(f.root, planFile).split(path.sep).join("/");
  for (const artifact of manifest.artifacts) artifact.sha256 = hash(fs.readFileSync(path.join(f.root, artifact.path)));
  mutateManifest(manifest);
  plan.freeze.artifact_set_sha256 = hash(json({ runtime_environment: manifest.runtime_environment,
    artifacts: manifest.artifacts.filter(artifact => artifact.path !== planPath) }));
  fs.writeFileSync(planFile, json(plan));
  manifest.artifacts.find(artifact => artifact.path === planPath).sha256 = hash(json(plan));
  fs.writeFileSync(manifestFile, json(manifest));
}

for (const relative of ["README.md", "continuity/evidence-ledger.json"]) {
  test(`A1 unchanged authority rejects same-ID/time resealed ${relative}`, async () => {
    const f = await cliFixture();
    try {
      const checker = fs.readFileSync(path.join(f.packageDir, "runtime/freeze.mjs"));
      const original = JSON.parse(fs.readFileSync(path.join(f.packageDir, "plan.json")));
      const file = path.join(f.packageDir, relative);
      if (relative.endsWith(".json")) { const value = JSON.parse(fs.readFileSync(file)); value.synthetic_authority_probe = true; fs.writeFileSync(file, json(value)); }
      else fs.appendFileSync(file, "\nSynthetic reseal probe.\n");
      reseal(f);
      const changed = JSON.parse(fs.readFileSync(path.join(f.packageDir, "plan.json")));
      assert.equal(changed.plan_version, original.plan_version);
      assert.equal(changed.freeze.frozen_at, original.freeze.frozen_at);
      assert.deepEqual(fs.readFileSync(path.join(f.packageDir, "runtime/freeze.mjs")), checker);
      assert.throws(() => f.assertFrozen(), /manifest.*authority|authority.*manifest/i);
      const result = f.spawn("freeze", ["--check", "--private-required"]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /manifest.*authority|authority.*manifest/i);
      assert.equal(f.calls(), 0);
    } finally { f.cleanup(); }
  });
}

test("A1 unchanged authority authenticates every payload class and the full verifier", async () => {
  const f = await cliFixture();
  try {
    const planFile = path.join(f.packageDir, "plan.json"), manifestFile = path.join(f.packageDir, "freeze-manifest.json");
    const plan = fs.readFileSync(planFile), manifestBytes = fs.readFileSync(manifestFile);
    const manifest = JSON.parse(manifestBytes);
    const representatives = [...new Map(manifest.artifacts.map(artifact => [artifact.class, artifact])).values()];
    representatives.push(manifest.artifacts.find(artifact => artifact.path.endsWith("/runtime/freeze.mjs")));
    for (const artifact of representatives) {
      const file = path.join(f.root, artifact.path), original = fs.readFileSync(file);
      if (file.endsWith(".json")) { const value = JSON.parse(original); value.synthetic_authority_probe = true; fs.writeFileSync(file, json(value)); }
      else if (file.endsWith(".jsonl")) { const rows = original.toString().trimEnd().split("\n").map(JSON.parse); rows[0].synthetic_authority_probe = true; fs.writeFileSync(file, rows.map(JSON.stringify).join("\n") + "\n"); }
      else fs.appendFileSync(file, "\n// synthetic authority probe\n");
      reseal(f);
      assert.throws(() => f.assertFrozen(), /manifest.*authority|authority.*manifest/i, artifact.path);
      fs.writeFileSync(file, original); fs.writeFileSync(planFile, plan); fs.writeFileSync(manifestFile, manifestBytes);
    }
    f.assertFrozen();
  } finally { f.cleanup(); }
});

test("A1 authenticates raw manifest bytes, final plan, metadata and membership", async () => {
  const f = await cliFixture();
  try {
    const planFile = path.join(f.packageDir, "plan.json"), manifestFile = path.join(f.packageDir, "freeze-manifest.json");
    const planBytes = fs.readFileSync(planFile), manifestBytes = fs.readFileSync(manifestFile);
    for (const mutation of [
      manifest => { manifest.artifacts.pop(); manifest.artifact_count -= 1; },
      manifest => { manifest.runtime_environment.ruby.psych_version = "changed"; },
      manifest => { manifest.frozen_at = "2026-11-11T00:00:00Z"; },
      manifest => { manifest.artifacts[0].visibility = "private"; },
    ]) {
      reseal(f, mutation);
      assert.throws(() => f.assertFrozen(), /manifest.*authority/i);
      fs.writeFileSync(planFile, planBytes); fs.writeFileSync(manifestFile, manifestBytes);
    }
    fs.writeFileSync(manifestFile, manifestBytes.toString().replace(/\n$/, "\r\n"));
    assert.throws(() => f.assertFrozen(), /manifest.*authority/i);
    fs.writeFileSync(manifestFile, manifestBytes);
    const plan = JSON.parse(planBytes); plan.freeze.frozen_at = "2026-11-11T00:00:00Z";
    fs.writeFileSync(planFile, json(plan));
    assert.throws(() => f.assertFrozen(), /timestamp|frozen_at|final plan|SHA-256 mismatch/);
  } finally { f.cleanup(); }
});

test("A1 root is the sole exact exclusion, raw revision input, and not a self-authentication claim", async () => {
  const f = await cliFixture();
  try {
    const rootFile = path.join(f.packageDir, "runtime/freeze-authority.mjs");
    const rootBytes = fs.readFileSync(rootFile), manifestFile = path.join(f.packageDir, "freeze-manifest.json"), manifestBytes = fs.readFileSync(manifestFile);
    const closure = f.freeze.collectFreezeArtifacts({ repositoryRoot: f.root });
    assert.equal(closure.some(row => row.path.endsWith("/runtime/freeze-authority.mjs")), false);
    assert.equal(closure.some(row => row.path.endsWith("/runtime/freeze.mjs")), true);
    const revision = f.runner.buildRunnerRevision();
    const revisionHash = crypto.createHash("sha256");
    const revisionFiles = [...closure.filter(row => row.class !== "package-documentation").map(row => row.path),
      path.relative(f.root, rootFile).split(path.sep).join("/")].sort();
    for (const file of revisionFiles) revisionHash.update(file).update("\0").update(fs.readFileSync(path.join(f.root, file))).update("\0");
    assert.equal(revision, `sha256:${revisionHash.digest("hex")}`);
    await pinFixtureAuthority(f.packageDir, null);
    assert.notEqual(f.runner.buildRunnerRevision(), revision);
    assert.throws(() => f.assertFrozen(), /draft freeze is disabled/);
    await pinFixtureAuthority(f.packageDir, JSON.parse(manifestBytes));
    assert.equal(f.runner.buildRunnerRevision(), revision);
    assert.deepEqual(fs.readFileSync(rootFile), rootBytes);
    const extra = path.join(f.packageDir, "runtime/other-authority.mjs");
    fs.writeFileSync(extra, "export const unrelated = true;\n");
    assert.ok(f.freeze.collectFreezeArtifacts({ repositoryRoot: f.root }).some(row => row.path.endsWith("/runtime/other-authority.mjs")));
    assert.throws(() => f.assertFrozen(), /incomplete freeze boundary/);
    fs.unlinkSync(extra);
    const readme = path.join(f.packageDir, "README.md");
    fs.appendFileSync(readme, "\nReplacement-root trust-boundary probe.\n");
    reseal(f);
    assert.throws(() => f.assertFrozen(), /manifest.*authority/i);
    // Replacing the independently trusted root is explicitly outside the claim.
    await pinFixtureAuthority(f.packageDir, JSON.parse(fs.readFileSync(manifestFile)));
    f.assertFrozen();
    assert.notEqual(f.runner.buildRunnerRevision(), revision);
  } finally { f.cleanup(); }
});

test("A1 malformed or substituted root paths fail closed without another authority source", async () => {
  const f = await cliFixture();
  try {
    const rootFile = path.join(f.packageDir, "runtime/freeze-authority.mjs"), original = fs.readFileSync(rootFile);
    const source = original.toString(), record = JSON.parse(source.slice("export const FREEZE_AUTHORITY = ".length, -2));
    for (const changed of [{ ...record, version: "2" }, { ...record, manifest_sha256: "A".repeat(64) },
      { ...record, manifest_sha256: "" }, { ...record, manifest_sha256: ["a".repeat(64)] },
      { ...record, extra: true }, { ...record, benchmark_id: "other" }]) {
      fs.writeFileSync(rootFile, `export const FREEZE_AUTHORITY = ${JSON.stringify(changed, null, 2)};\n`);
      assert.throws(() => f.assertFrozen(), /authority/);
      assert.throws(() => f.freeze.collectFreezeArtifacts({ repositoryRoot: f.root }), /authority/);
    }
    fs.writeFileSync(rootFile, source + "export const unmeasured = true;\n");
    assert.throws(() => f.freeze.collectFreezeArtifacts({ repositoryRoot: f.root }), /authority/);
    fs.unlinkSync(rootFile);
    const alternate = path.join(f.root, "alternate-authority.mjs"); fs.writeFileSync(alternate, original);
    fs.symlinkSync(alternate, rootFile);
    assert.throws(() => f.assertFrozen(), /symbolic link|regular file/);
    assert.throws(() => f.freeze.collectFreezeArtifacts({ repositoryRoot: f.root }), /symbolic link|regular file/);
    fs.unlinkSync(rootFile);
    assert.throws(() => f.freeze.collectFreezeArtifacts({ repositoryRoot: f.root }), /ENOENT|missing/);
    fs.writeFileSync(rootFile, original);
    f.assertFrozen();
  } finally { f.cleanup(); }
});

test("A1 prepared overrides cannot replace authority, payload bytes or fixed manifest path", async () => {
  const f = await cliFixture();
  try {
    const manifestFile = path.join(f.packageDir, "freeze-manifest.json"), manifest = JSON.parse(fs.readFileSync(manifestFile));
    for (const option of ["authority", "authorityFile", "manifestBytes", "manifestSha256"]) {
      assert.throws(() => f.freeze.validateFrozenPackage({ [option]: manifest }), /authority.*overridden/);
    }
    const artifact = manifest.artifacts.find(row => row.path.endsWith("/README.md"));
    assert.throws(() => f.freeze.validateFrozenPackage({ contentOverrides: new Map([[artifact.path, fs.readFileSync(path.join(f.root, artifact.path))]]) }), /only.*final plan/);
    fs.appendFileSync(manifestFile, "\n");
    assert.throws(() => f.freeze.validateFrozenPackage({ manifestOverride: manifest }), /override.*on-disk/);
    fs.unlinkSync(manifestFile);
    fs.symlinkSync(f.candidateFile, manifestFile);
    assert.throws(() => f.freeze.validateFrozenPackage({ manifestOverride: manifest }), /symbolic link/);
  } finally { f.cleanup(); }
});

test("A1 prepared manifest values cannot execute serialization or choose a different final plan", async () => {
  const f = await cliFixture();
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(f.packageDir, "freeze-manifest.json")));
    let calls = 0;
    const forged = { ...manifest, toJSON() { calls += 1; return manifest; } };
    assert.throws(() => f.freeze.validateFrozenPackage({ manifestOverride: forged }), /plain JSON/);
    assert.equal(calls, 0);
  } finally { f.cleanup(); }
});

test("A1 publication uses fixed output paths and cannot choose an authority override", async () => {
  const f = await cliFixture();
  try {
    const pair = JSON.parse(fs.readFileSync(f.candidateFile));
    const draft = structuredClone(pair.plan); draft.status = "calibration-draft"; delete draft.freeze;
    draft.targets.forEach(target => { target.model_id = null; });
    fs.writeFileSync(path.join(f.packageDir, "plan.json"), json(draft));
    fs.unlinkSync(path.join(f.packageDir, "freeze-manifest.json"));
    const input = { ...pair, planFile: path.join(f.packageDir, "plan.json"), manifestFile: path.join(f.packageDir, "alternate.json"),
      validatePrepared: () => true, validatePublished: () => true };
    assert.throws(() => f.freeze.publishFreezePair(input), /fixed.*path|path.*fixed/);
    assert.throws(() => f.freeze.publishFreezePair({ ...input, authority: pair.manifest }), /authority.*overridden/);
    const artifacts = f.freeze.collectFreezeArtifacts({ repositoryRoot: f.root });
    artifacts.push({ class: "runtime", path: f.freeze.collectFreezeAuthority({ repositoryRoot: f.root }).path, visibility: "public" });
    assert.throws(() => f.freeze.buildFreezeManifest({ plan: pair.plan, artifacts, rootDir: f.root,
      frozenAt: pair.plan.freeze.frozen_at }), /authority.*not.*payload/);
  } finally { f.cleanup(); }
});

test("A1 prepare then pin is acyclic, source drift rolls back, publisher never rewrites root", async () => {
  const f = await cliFixture();
  try {
    const planFile = path.join(f.packageDir, "plan.json"), manifestFile = path.join(f.packageDir, "freeze-manifest.json"), authorityFile = path.join(f.packageDir, "runtime/freeze-authority.mjs");
    const plan = JSON.parse(fs.readFileSync(planFile));
    const frozenAt = plan.freeze.frozen_at;
    plan.status = "calibration-draft"; delete plan.freeze; plan.targets.forEach(target => { target.model_id = null; });
    fs.writeFileSync(planFile, json(plan)); fs.unlinkSync(manifestFile);
    await pinFixtureAuthority(f.packageDir, null);
    const rootBefore = fs.readFileSync(authorityFile), draft = fs.readFileSync(planFile);
    const input = { plan, modelResolutions: f.models, artifacts: f.freeze.collectFreezeArtifacts({ repositoryRoot: f.root }), rootDir: f.root,
      frozenAt, planArtifactPath: path.relative(f.root, planFile).split(path.sep).join("/") };
    const pair = f.freeze.buildCalibrationFreeze(input);
    assert.deepEqual(fs.readFileSync(authorityFile), rootBefore);
    assert.equal(fs.existsSync(manifestFile), false);
    assert.throws(() => f.freeze.publishFreezePair({ ...pair, planFile, manifestFile }), /draft freeze is disabled/);
    await pinFixtureAuthority(f.packageDir, pair.manifest);
    const pinnedRoot = fs.readFileSync(authorityFile);
    assert.deepEqual(f.freeze.buildCalibrationFreeze(input), pair, "pinning must not change candidate bytes");
    const publication = { ...pair, planFile, manifestFile,
      validatePrepared: () => f.freeze.validateFrozenPackage({ planOverride: pair.plan, manifestOverride: pair.manifest,
        contentOverrides: new Map([[input.planArtifactPath, json(pair.plan)]]), privateRequired: true }),
      validatePublished: f.assertFrozen };
    const readme = path.join(f.packageDir, "README.md"), before = fs.readFileSync(readme);
    fs.appendFileSync(readme, "\nSynthetic source drift.\n");
    assert.throws(() => f.freeze.publishFreezePair(publication), /SHA-256 mismatch/);
    assert.deepEqual(fs.readFileSync(planFile), draft);
    assert.equal(fs.existsSync(manifestFile), false);
    assert.deepEqual(fs.readFileSync(authorityFile), pinnedRoot);
    fs.writeFileSync(readme, before);
    assert.deepEqual(f.freeze.publishFreezePair(publication), { status: "committed" });
    assert.deepEqual(fs.readFileSync(authorityFile), pinnedRoot);
    f.assertFrozen(); assert.equal(f.calls(), 0);
  } finally { f.cleanup(); }
});
