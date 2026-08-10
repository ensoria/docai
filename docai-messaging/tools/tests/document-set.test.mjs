import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadDocumentSet, validateDocumentSet } from "../lib/document-set.mjs";

const SET_DIGEST = "sha256:813b7cf8b838a5e3ba2fa494405bbf061bd1c6c0f693077d7349fd4c4d45dd2b";
const SET_ID = "b32:qe5xz6fyhcs6horpuskeaw57ay";
const PROJECTION_DIGEST = "sha256:17b223a4bf668cc9e2fcef034fb8c83e2655055de8736737619b76a4a1d666d0";
const PROJECTION_ID = "b32:c6zchjf7m2gmtyx454bu7ogihy";
const ALTERNATE_ID = "b32:aaaaaaaaaaaaaaaaaaaaaaaaaa";
const restampPath = fileURLToPath(new URL("../restamp-document-set.mjs", import.meta.url));
const catalogPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));

function temporaryDirectory(t, prefix = "docai-messaging-set-") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function metadata(overrides = {}) {
  const values = {
    "docai-messaging": "0.17.1",
    profile: "full",
    perspective: "storefront",
    coverage: "complete",
    knowledge: "complete",
    source_refs: "all",
    ...overrides
  };
  return `> docai-messaging: ${values["docai-messaging"]} | profile: ${values.profile} | perspective: ${values.perspective} | coverage: ${values.coverage} | knowledge: ${values.knowledge} | source_refs: ${values.source_refs}`;
}

function identity({
  root = false,
  setId = SET_ID,
  projectionId = PROJECTION_ID,
  setDigest = SET_DIGEST,
  projectionDigest = PROJECTION_DIGEST
} = {}) {
  const short = `> docai-identity: set_id: ${setId} | projection_id: ${projectionId}`;
  return root ? `${short} | set_digest: ${setDigest} | projection_digest: ${projectionDigest}` : short;
}

function documentSource({ root = false, metadataOverrides, identityOverrides, body } = {}) {
  return [
    metadata(metadataOverrides),
    "",
    body ?? (root ? "# Messaging Index" : "# Conventions"),
    "",
    identity({ root, ...identityOverrides }),
    ""
  ].join("\n");
}

function write(root, relativePath, content) {
  const absolutePath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function createSet(t, {
  rootDir,
  childMetadata,
  childIdentity,
  childPath = "CONVENTIONS.md"
} = {}) {
  const root = rootDir ?? temporaryDirectory(t);
  fs.mkdirSync(root, { recursive: true });
  write(root, "INDEX.md", documentSource({ root: true }));
  write(root, childPath, documentSource({
    metadataOverrides: childMetadata,
    identityOverrides: childIdentity
  }));
  return root;
}

function ruleIds(result) {
  return result.diagnostics.map((entry) => entry.ruleId);
}

function taskScoped(root) {
  return validateDocumentSet(loadDocumentSet(root), { wholeSet: false });
}

test("accepts source and evidence siblings outside a closed document-set root", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-publication-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  write(publication, "source/input.json", "{}\n");
  write(publication, "evidence/report.txt", "outside the set\n");

  const loaded = loadDocumentSet(root);

  assert.deepEqual(loaded.paths, ["CONVENTIONS.md", "INDEX.md"]);
  assert.deepEqual(loaded.diagnostics, []);
});

test("DM-ID-004 rejects an unrelated file inside the closed root", (t) => {
  const root = createSet(t);
  write(root, "notes.txt", "not a document-set file\n");
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

test("DM-ID-004 rejects a symbolic link inside the closed root", (t) => {
  const root = createSet(t);
  fs.mkdirSync(path.join(root, "channels"));
  fs.symlinkSync(path.join(root, "CONVENTIONS.md"), path.join(root, "channels", "linked.md"));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

test("DM-ID-004 rejects invalid UTF-8 inside the closed root", (t) => {
  const root = createSet(t);
  write(root, "channels/bad.md", Buffer.from([0xc3, 0x28]));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

test("DM-ID-004 rejects an empty directory inside the closed root", (t) => {
  const root = createSet(t);
  fs.mkdirSync(path.join(root, "channels"));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

test("DM-ID-001 rejects a document with no identity trailer", (t) => {
  const root = createSet(t);
  write(root, "CONVENTIONS.md", `${metadata()}\n\n# Conventions\n`);
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-001"));
});

test("DM-ID-001 rejects non-empty content after an identity trailer", (t) => {
  const root = createSet(t);
  write(root, "CONVENTIONS.md", `${documentSource()}unexpected\n`);
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-001"));
});

for (const mismatch of [
  ["DM-ID-005", { childMetadata: { "docai-messaging": "0.17.2" } }],
  ["DM-ID-006", { childMetadata: { profile: "compact" } }],
  ["DM-ID-007", { childMetadata: { perspective: "Storefront" } }],
  ["DM-ID-008", { childIdentity: { setId: ALTERNATE_ID } }],
  ["DM-ID-009", { childIdentity: { projectionId: ALTERNATE_ID } }]
]) {
  test(`${mismatch[0]} rejects its mixed-set identity mismatch`, (t) => {
    const root = createSet(t, mismatch[1]);
    assert.ok(ruleIds(taskScoped(root)).includes(mismatch[0]));
  });
}

test("permits coverage, knowledge, and source_refs to vary by file", (t) => {
  const root = createSet(t, {
    childMetadata: {
      coverage: "requires-source",
      knowledge: "requires-input",
      source_refs: "source-a, source-z"
    }
  });
  assert.deepEqual(taskScoped(root).diagnostics, []);
});

test("task-scoped validation checks handles without recomputing the whole set", (t) => {
  const root = createSet(t);
  const documentSet = loadDocumentSet(root);

  assert.equal(ruleIds(validateDocumentSet(documentSet, { wholeSet: false })).includes("DM-ID-003"), false);
  assert.equal(ruleIds(validateDocumentSet(documentSet, { wholeSet: true })).includes("DM-ID-003"), true);
});

test("loaders and validators never repair an invalid document set", (t) => {
  const root = createSet(t, { childIdentity: { setId: ALTERNATE_ID } });
  const before = fs.readFileSync(path.join(root, "CONVENTIONS.md"));
  validateDocumentSet(loadDocumentSet(root), { wholeSet: true });
  assert.deepEqual(fs.readFileSync(path.join(root, "CONVENTIONS.md")), before);
});

test("catalogs every Task 4 identity diagnostic", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const taskRuleIds = Array.from({ length: 9 }, (_, index) => `DM-ID-${String(index + 1).padStart(3, "0")}`);
  assert.deepEqual(taskRuleIds.filter((ruleId) => !cataloged.has(ruleId)), []);
});

test("restamp requires an explicit root even in dry-run mode", () => {
  const result = spawnSync(process.execPath, [restampPath], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit document-set root/i);
});

test("restamp is dry-run by default and writes only with --write", (t) => {
  const root = createSet(t);
  const indexPath = path.join(root, "INDEX.md");
  const childPath = path.join(root, "CONVENTIONS.md");
  const before = [fs.readFileSync(indexPath), fs.readFileSync(childPath)];

  const dryRun = spawnSync(process.execPath, [restampPath, root], { encoding: "utf8" });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /restamp required: yes/);
  assert.deepEqual(fs.readFileSync(indexPath), before[0]);
  assert.deepEqual(fs.readFileSync(childPath), before[1]);

  const writeRun = spawnSync(process.execPath, [restampPath, "--write", root], { encoding: "utf8" });
  assert.equal(writeRun.status, 0, writeRun.stderr);
  assert.match(writeRun.stdout, /restamp required: yes/);
  assert.notDeepEqual(fs.readFileSync(indexPath), before[0]);
  assert.notDeepEqual(fs.readFileSync(childPath), before[1]);
  assert.deepEqual(validateDocumentSet(loadDocumentSet(root), { wholeSet: true }).diagnostics, []);

  const cleanDryRun = spawnSync(process.execPath, [restampPath, root], { encoding: "utf8" });
  assert.equal(cleanDryRun.status, 0, cleanDryRun.stderr);
  assert.match(cleanDryRun.stdout, /restamp required: no/);
});
