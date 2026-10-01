import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { restampDocumentSet } from "../restamp-document-set.mjs";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const checkerPath = fileURLToPath(new URL("../check-complete-fixtures.mjs", import.meta.url));
const sourceCandidatePath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/focused/valid/operations-profile-path-parity-valid/",
  import.meta.url
));
const sourceManifestPath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/source/projection-input-manifest.json",
  import.meta.url
));
const defaultCandidatePath = fileURLToPath(new URL(
  "../../fixtures/complete-candidates/v0.17.1/",
  import.meta.url
));

function runChecker(arguments_ = []) {
  return spawnSync(process.execPath, [checkerPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
}

function directorySnapshot(directory, relative = "") {
  const snapshot = {};
  for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
    const entryPath = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      Object.assign(snapshot, directorySnapshot(directory, entryPath));
    } else {
      snapshot[entryPath] = fs.readFileSync(path.join(directory, entryPath));
    }
  }
  return snapshot;
}

function restampCandidate(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-checker-"));
  const candidatePath = path.join(temporaryRoot, "candidate");
  const manifestPath = path.join(temporaryRoot, "projection-input-manifest.json");
  fs.cpSync(sourceCandidatePath, candidatePath, { recursive: true });
  fs.copyFileSync(sourceManifestPath, manifestPath);
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  return { candidatePath, manifestPath };
}

function replaceExactlyOnce(filePath, from, to) {
  const source = fs.readFileSync(filePath, "utf8");
  assert.equal(source.split(from).length - 1, 1, `${from} must occur exactly once`);
  fs.writeFileSync(filePath, source.replace(from, to));
}

function copyVersionedCandidate(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-source-"));
  const candidatePath = path.join(temporaryRoot, "candidate");
  fs.cpSync(defaultCandidatePath, candidatePath, { recursive: true });
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  return candidatePath;
}

function rebindAndRestamp(candidatePath, sourceName) {
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const source = manifest.sources.find((entry) => entry.location === sourceName);
  assert.notEqual(source, undefined);
  source.sha256 = `sha256:${createHash("sha256")
    .update(fs.readFileSync(path.join(candidatePath, "source", sourceName)))
    .digest("hex")}`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
}

test("rejects candidate source bytes outside the manifest digest even when profiles agree", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  replaceExactlyOnce(
    path.join(candidatePath, "source", "complete-contexts.json"),
    "Publish the payload-free alpha control signal.",
    "Publish an altered payload-free alpha control signal."
  );
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /complete-contexts.*source digest/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects a restamped versioned candidate with a different generator identity", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.generator.id = "different-projector";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /generator identity/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [label, file, from, to, mismatch] of [
  ["primary Message identity", "complete-contexts.json", '"message": "a-message"',
    '"message": "a-renamed-message"', /a-operation.*Message/i],
  ["expanded Workflow precondition", "complete-contexts.json",
    "Caller-local alpha event data is validated", "Caller-local alpha event data is not validated",
    /alpha-delivery.*Preconditions/i],
  ["variant field meaning", "complete-representations.json",
    '"description": "Archival reason"', '"description": "Altered archival reason"',
    /r-untagged-operation.*variant/i],
  ["known absence", "complete-contexts.json",
    '"failureHandling": "none"', '"failureHandling": "unknown"',
    /failure handling/i],
  ["storefront operation summary", "storefront.asyncapi.json",
    '"summary": "Submit an order and receive its acceptance reply."',
    '"summary": "Submit a changed order and receive its acceptance reply."',
    /sendCreateOrder.*Summary/i]
]) {
  test(`rejects a restamped pair that disagrees with source ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", file), from, to);
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, mismatch);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("checks one whole-set complete full and compact pair without modifying it", (t) => {
  const { candidatePath } = restampCandidate(t);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    "Complete fixture check passed: 7 paths, full/compact pair equivalent.\n"
  );
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("checks the versioned complete candidate by default without modifying it", () => {
  const before = fs.existsSync(defaultCandidatePath)
    ? directorySnapshot(defaultCandidatePath)
    : null;

  const result = runChecker();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.match(
    result.stdout,
    /^Complete fixture check passed: \d+ paths, full\/compact pair equivalent\.\n$/
  );
  assert.notEqual(before, null, "the versioned complete candidate exists");
  assert.deepEqual(directorySnapshot(defaultCandidatePath), before);
});

test("rejects a restamped complete pair with a compact contract mismatch", (t) => {
  const { candidatePath, manifestPath } = restampCandidate(t);
  replaceExactlyOnce(
    path.join(candidatePath, "compact", "channels", "alpha.md"),
    "Documents the selected messaging operation.",
    "Documents a different selected messaging operation."
  );
  restampDocumentSet(path.join(candidatePath, "compact"), manifestPath, { write: true });
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /DM-PROFILE-003 compact\/channels\/alpha\.md:1 /);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects an invalid complete-checker argument count", () => {
  const result = runChecker(["first", "second"]);

  assert.equal(result.status, 1, result.stdout);
  assert.equal(
    result.stderr,
    "Usage: node docai-messaging/tools/check-complete-fixtures.mjs [candidate-root]\n"
  );
});

test("rejects a candidate root without both profile roots", (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-checker-"));
  fs.mkdirSync(path.join(temporaryRoot, "full"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const result = runChecker([temporaryRoot]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Complete candidate requires full and compact document-set roots/);
});
