import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadDocumentSet, validateDocumentSet } from "../lib/document-set.mjs";
import { restampDocumentSet } from "../restamp-document-set.mjs";

const SET_DIGEST = "sha256:813b7cf8b838a5e3ba2fa494405bbf061bd1c6c0f693077d7349fd4c4d45dd2b";
const SET_ID = "b32:qe5xz6fyhcs6horpuskeaw57ay";
const PROJECTION_DIGEST = "sha256:17b223a4bf668cc9e2fcef034fb8c83e2655055de8736737619b76a4a1d666d0";
const PROJECTION_ID = "b32:c6zchjf7m2gmtyx454bu7ogihy";
const ALTERNATE_ID = "b32:aaaaaaaaaaaaaaaaaaaaaaaaaa";
const MANIFEST_SOURCE = "{\"projection\":\"v1\"}\n";
const MANIFEST_DIGEST = "sha256:070ac8cb2c8c4b0052fb169a30c76075402ab4a071052ff722a6ce073424fee0";
const MANIFEST_ID = "b32:a4fmrszmrrfqaux3c2ndbr3aou";
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
  rootIdentity,
  childMetadata,
  childIdentity,
  childPath = "CONVENTIONS.md"
} = {}) {
  const root = rootDir ?? temporaryDirectory(t);
  fs.mkdirSync(root, { recursive: true });
  write(root, "INDEX.md", documentSource({ root: true, identityOverrides: rootIdentity }));
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

function runRestamp(...arguments_) {
  return spawnSync(process.execPath, [restampPath, ...arguments_], { encoding: "utf8" });
}

function withLineEnding(source, lineEnding) {
  return Buffer.from(source.replaceAll("\n", lineEnding), "utf8");
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

for (const identityMismatch of [
  { rootIdentity: { setId: ALTERNATE_ID }, childIdentity: { setId: ALTERNATE_ID } },
  {
    rootIdentity: { projectionId: ALTERNATE_ID },
    childIdentity: { projectionId: ALTERNATE_ID }
  }
]) {
  test("DM-ID-002 rejects a root short ID not derived from its full digest", (t) => {
    const root = createSet(t, identityMismatch);
    assert.ok(ruleIds(taskScoped(root)).includes("DM-ID-002"));
  });
}

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

test("restamp requires an explicit root even when a manifest is supplied", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const manifestPath = path.join(publication, "projection-input-manifest.json");
  fs.writeFileSync(manifestPath, MANIFEST_SOURCE);
  const result = runRestamp("--projection-manifest", manifestPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit document-set root/i);
});

test("restamp requires --projection-manifest and never auto-discovers it", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const before = fs.readFileSync(path.join(root, "INDEX.md"));

  const result = runRestamp(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--projection-manifest/);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

test("restamp rejects a missing projection manifest without writing", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const before = fs.readFileSync(path.join(root, "INDEX.md"));
  const result = runRestamp(
    "--write",
    "--projection-manifest",
    path.join(publication, "source", "missing.json"),
    root
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /projection manifest cannot be read/i);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

test("restamp rejects an invalid UTF-8 projection manifest without writing", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, Buffer.from([0xc3, 0x28]));
  const before = fs.readFileSync(path.join(root, "INDEX.md"));

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valid UTF-8/i);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

test("restamp rejects a projection manifest inside the closed root", (t) => {
  const root = createSet(t);
  const manifestPath = path.join(root, "projection-input-manifest.json");
  fs.writeFileSync(manifestPath, MANIFEST_SOURCE);
  const before = fs.readFileSync(path.join(root, "INDEX.md"));

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the document-set root/i);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

test("restamp rejects an external lexical alias that resolves inside the root", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const alias = path.join(publication, "outside-alias");
  fs.symlinkSync(root, alias, "dir");
  const manifestPath = path.join(alias, "CONVENTIONS.md");
  const before = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the document-set root/i);
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes);
  }
});

test("restamp rejects an outside hard link to a root document", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "outside-hard-link.md");
  fs.linkSync(path.join(root, "CONVENTIONS.md"), manifestPath);
  const before = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /same physical file|hard link/i);
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes);
  }
});

test("a BOM before opening metadata stays visible and restamp never strips it", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const indexPath = path.join(root, "INDEX.md");
  const before = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    fs.readFileSync(indexPath)
  ]);
  fs.writeFileSync(indexPath, before);

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /opening metadata/i);
  assert.deepEqual(fs.readFileSync(indexPath), before);
});

for (const [name, lineEnding] of [["CRLF", "\r\n"], ["lone CR", "\r"]]) {
  test(`restamp handles ${name} trailer boundaries without normalizing bytes`, (t) => {
    const publication = temporaryDirectory(t, "docai-messaging-restamp-");
    const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
    const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
    write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
    const sources = new Map([
      ["INDEX.md", withLineEnding(documentSource({ root: true }), lineEnding)],
      ["CONVENTIONS.md", withLineEnding(documentSource(), lineEnding)]
    ]);
    for (const [relativePath, bytes] of sources) fs.writeFileSync(path.join(root, relativePath), bytes);

    const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

    assert.equal(result.status, 0, result.stderr);
    for (const [relativePath, before] of sources) {
      const after = fs.readFileSync(path.join(root, relativePath));
      const trailerStart = before.indexOf(Buffer.from("> docai-identity:", "ascii"));
      assert.deepEqual(after.subarray(0, trailerStart), before.subarray(0, trailerStart));
      assert.deepEqual(after.subarray(after.length - lineEnding.length), Buffer.from(lineEnding, "ascii"));
      if (lineEnding === "\r") assert.equal(after.includes(0x0a), false);
    }
    assert.deepEqual(validateDocumentSet(loadDocumentSet(root), { wholeSet: true }).diagnostics, []);
  });
}

test("restamp defaults to a non-mutating dry-run", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const indexPath = path.join(root, "INDEX.md");
  const childPath = path.join(root, "CONVENTIONS.md");
  const before = [fs.readFileSync(indexPath), fs.readFileSync(childPath)];

  const dryRun = runRestamp("--projection-manifest", manifestPath, root);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /restamp required: yes/);
  assert.deepEqual(fs.readFileSync(indexPath), before[0]);
  assert.deepEqual(fs.readFileSync(childPath), before[1]);
});

test("restamp --write hashes exact manifest bytes before stamping set identity", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const indexPath = path.join(root, "INDEX.md");
  const childPath = path.join(root, "CONVENTIONS.md");
  const before = [fs.readFileSync(indexPath), fs.readFileSync(childPath)];

  const writeRun = runRestamp("--write", "--projection-manifest", manifestPath, root);
  assert.equal(writeRun.status, 0, writeRun.stderr);
  assert.match(writeRun.stdout, /restamp required: yes/);
  assert.notDeepEqual(fs.readFileSync(indexPath), before[0]);
  assert.notDeepEqual(fs.readFileSync(childPath), before[1]);
  assert.match(fs.readFileSync(indexPath, "utf8"), new RegExp(
    `projection_id: ${MANIFEST_ID} \\| set_digest: sha256:[0-9a-f]{64} \\| projection_digest: ${MANIFEST_DIGEST}`
  ));
  assert.match(fs.readFileSync(childPath, "utf8"), new RegExp(`projection_id: ${MANIFEST_ID}$`, "m"));
  assert.deepEqual(validateDocumentSet(loadDocumentSet(root), { wholeSet: true }).diagnostics, []);
});

test("restamp identity depends on manifest bytes but not its external path", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const firstManifest = path.join(publication, "source", "projection-input-manifest.json");
  const secondManifest = path.join(publication, "evidence", "same-bytes.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  write(publication, "evidence/same-bytes.json", MANIFEST_SOURCE);
  const writeRun = runRestamp("--write", "--projection-manifest", firstManifest, root);
  assert.equal(writeRun.status, 0, writeRun.stderr);

  const cleanDryRun = runRestamp("--projection-manifest", secondManifest, root);
  assert.equal(cleanDryRun.status, 0, cleanDryRun.stderr);
  assert.match(cleanDryRun.stdout, /restamp required: no/);
});

test("restamp rejects a manifest path rebound after its descriptor is read", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  const reboundPath = path.join(publication, "source", "rebound.json");
  const openedPath = path.join(publication, "source", "opened.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  write(publication, "source/rebound.json", "{\"projection\":\"rebound\"}\n");
  const before = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);
  let rebound = false;

  assert.throws(() => restampDocumentSet(root, manifestPath, {
    write: true,
    statPath(candidate) {
      if (!rebound && candidate === manifestPath) {
        fs.renameSync(manifestPath, openedPath);
        fs.renameSync(reboundPath, manifestPath);
        rebound = true;
      }
      return fs.statSync(candidate);
    }
  }), /manifest path.*changed|same opened file/i);

  assert.equal(rebound, true);
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes);
  }
});

test("restamp preserves complete file modes despite restrictive stage creation", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const documentPaths = [path.join(root, "INDEX.md"), path.join(root, "CONVENTIONS.md")];
  fs.chmodSync(documentPaths[0], 0o6777);
  fs.chmodSync(documentPaths[1], 0o1776);
  const expectedModes = new Map(documentPaths.map((filePath) => [
    path.basename(filePath),
    fs.statSync(filePath).mode & 0o7777
  ]));
  let stageOpens = 0;

  restampDocumentSet(root, manifestPath, {
    write: true,
    openFile(filePath, flags, mode) {
      stageOpens += 1;
      return fs.openSync(filePath, flags, mode & 0o700);
    }
  });

  assert.equal(stageOpens, documentPaths.length);
  for (const filePath of documentPaths) {
    assert.equal(fs.statSync(filePath).mode & 0o7777, expectedModes.get(path.basename(filePath)));
  }
});

test("restamp rolls back earlier replacements when a later atomic replacement fails", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const before = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);
  let replacements = 0;

  assert.throws(() => restampDocumentSet(root, manifestPath, {
    write: true,
    replaceFile(from, to) {
      replacements += 1;
      if (replacements === 2) throw new Error("injected replacement failure");
      fs.renameSync(from, to);
    }
  }), /injected replacement failure/);

  assert.equal(replacements, 2);
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes);
  }
  assert.deepEqual(fs.readdirSync(root).sort(), ["CONVENTIONS.md", "INDEX.md"]);

  const recovered = restampDocumentSet(root, manifestPath, { write: true });
  assert.equal(recovered.changed, true);
  assert.deepEqual(validateDocumentSet(loadDocumentSet(root), { wholeSet: true }).diagnostics, []);
  assert.equal(restampDocumentSet(root, manifestPath).changed, false);
});

test("restamp retains and reports a backup when rollback restore fails", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const originals = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);
  let replacements = 0;
  let retainedBackup = null;
  let restoreTarget = null;
  let failure;

  try {
    restampDocumentSet(root, manifestPath, {
      write: true,
      replaceFile(from, to) {
        replacements += 1;
        if (replacements === 2) throw new Error("injected commit failure");
        fs.renameSync(from, to);
      },
      restoreFile(from, to) {
        retainedBackup = from;
        restoreTarget = to;
        throw new Error("injected restore failure");
      }
    });
  } catch (error) {
    failure = error;
  }

  assert.ok(failure instanceof AggregateError);
  assert.notEqual(retainedBackup, null);
  assert.equal(failure.message.includes(retainedBackup), true);
  assert.equal(fs.existsSync(retainedBackup), true);
  assert.deepEqual(fs.readFileSync(retainedBackup), originals.get(path.basename(restoreTarget)));
});
