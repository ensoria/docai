import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentSet, validateDocumentSet } from "../lib/document-set.mjs";
import { validateSourceShardProvenanceExpectations } from "../lib/validators/core-sources.mjs";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const evidenceRoot = path.join(
  repositoryRoot,
  "docai-messaging/fixtures/core/v0.17.1/evaluations/source-shards"
);
const inputPath = path.join(evidenceRoot, "measurement-input.json");
const evidencePath = path.join(evidenceRoot, "retrieval-runs.json");
const builderPath = path.join(
  repositoryRoot,
  "docai-messaging/tools/build-source-shard-token-evidence.py"
);

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function replaceRootProjection(temporaryEvidenceRoot, evidence, runName, projectionId, projectionDigest) {
  const recordedRun = evidence.tasks[0].runs[runName];
  const rootPath = path.join(temporaryEvidenceRoot, recordedRun.documentSet, "INDEX.md");
  let root = fs.readFileSync(rootPath, "utf8");
  root = root
    .replace(recordedRun.identity.projectionId, projectionId)
    .replace(recordedRun.identity.projectionDigest, projectionDigest);
  fs.writeFileSync(rootPath, root);
  recordedRun.identity.projectionId = projectionId;
  recordedRun.identity.projectionDigest = projectionDigest;
  const rootDocument = recordedRun.loadedDocuments.find(({ path: documentPath }) => documentPath === "INDEX.md");
  rootDocument.bytes = Buffer.byteLength(root);
  rootDocument.sha256 = sha256(root);
}

function sourceRows(validation) {
  return validation.facts.core.sources.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    specification: row.specification,
    api: row.api,
    contractVersion: row.contractVersion,
    location: row.location,
    revision: row.revision
  }));
}

test("covers source-shard token measurement with exact transitive and false-positive loads", () => {
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const projectionInput = JSON.parse(fs.readFileSync(
    path.join(evidenceRoot, input.projectionManifest),
    "utf8"
  ));
  const task = input.tasks[0];
  const shardedRun = task.runs.sharded;
  const directRun = task.runs.direct;
  const shardedSet = loadDocumentSet(path.join(evidenceRoot, shardedRun.documentSet));
  const directSet = loadDocumentSet(path.join(evidenceRoot, directRun.documentSet));
  const sharded = validateDocumentSet(shardedSet, { wholeSet: true });
  const direct = validateDocumentSet(directSet, { wholeSet: true });

  assert.deepEqual(sharded.diagnostics, []);
  assert.deepEqual(direct.diagnostics, []);
  assert.equal(sharded.facts.core.sources.form, "sharded");
  assert.equal(direct.facts.core.sources.form, "direct");
  assert.deepEqual(sourceRows(sharded), sourceRows(direct));
  assert.deepEqual(projectionInput.catalog, sourceRows(direct));
  assert.deepEqual(sourceRows(sharded).map((row) => row.id), [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"
  ]);

  const shardedRoot = shardedSet.files.find((file) => file.path === "INDEX.md");
  const directRoot = directSet.files.find((file) => file.path === "INDEX.md");
  assert.equal(shardedRoot.identity.projection_id, directRoot.identity.projection_id);
  assert.notEqual(shardedRoot.identity.set_id, directRoot.identity.set_id);

  const expectedFixedPoint = {
    requestedIds: ["b"],
    resolvedIds: ["a", "b", "c", "z"],
    loadedPaths: [
      "indexes/sources-a-c.md",
      "indexes/sources-b.md",
      "indexes/sources-z.md"
    ]
  };
  assert.deepEqual(sharded.facts.core.sourceResolutions[task.selectionInput.documentPath], expectedFixedPoint);
  assert.deepEqual(shardedRun.fixedPoint, expectedFixedPoint);
  assert.deepEqual(shardedRun.matchingSourceShards, [
    "indexes/sources-a-c.md",
    "indexes/sources-b.md"
  ]);
  assert.deepEqual(shardedRun.falsePositiveSourceShards, ["indexes/sources-a-c.md"]);
  assert.deepEqual(shardedRun.transitiveSourceShards, ["indexes/sources-z.md"]);
  assert.deepEqual(shardedRun.unloadedSourceShards, ["indexes/sources-d-y.md"]);
  assert.deepEqual(shardedRun.loadedSourceShards, expectedFixedPoint.loadedPaths);
  assert.equal(shardedRun.loadAllFallback, false);
  assert.deepEqual(directRun.loadedSourceShards, []);

  const provenance = validateSourceShardProvenanceExpectations(
    shardedSet,
    sharded.facts.core,
    {
      selectedFile: task.selectionInput.documentPath,
      requireContributorCycle: true,
      catalogCellContributions: task.catalogCellContributions
    },
    { file: "measurement-input.json" }
  );
  assert.deepEqual(provenance.diagnostics, []);
  assert.deepEqual(
    provenance.facts.sourceShardProvenanceExpectations.catalogCellContributions,
    [{
      providerSourceId: "z",
      targetSourceId: "b",
      column: "Location",
      value: "sources/b-authoritative-messaging-contract-reference.json",
      targetShardPath: "indexes/sources-b.md",
      providerShardPath: "indexes/sources-z.md"
    }]
  );

  assert.equal(input.schemaVersion, "1.0.0");
  assert.equal(input.docaiMessaging, "0.17.1");
  assert.deepEqual(input.tokenizer, {
    library: "tiktoken",
    version: "0.13.0",
    encoding: "o200k_base"
  });
  assert.equal(input.claim.scope, "exact source b resolution");
  assert.equal(input.claim.cacheOrBilledTokenSavings, false);

  assert.equal(evidence.schemaVersion, input.schemaVersion);
  assert.deepEqual(evidence.tokenizer, input.tokenizer);
  assert.equal(evidence.tasks.length, 1);
  const measuredTask = evidence.tasks[0];
  assert.equal(measuredTask.id, task.id);
  assert.deepEqual(
    measuredTask.runs.sharded.loadedDocuments.map((document) => document.path),
    shardedRun.loadedDocumentPaths
  );
  assert.deepEqual(
    measuredTask.runs.direct.loadedDocuments.map((document) => document.path),
    directRun.loadedDocumentPaths
  );
  assert.equal(measuredTask.runs.sharded.totalTaskInputTokens < measuredTask.runs.direct.totalTaskInputTokens, true);
  assert.equal(measuredTask.runs.sharded.totalTaskInputTokens <= input.tokenBudget, true);
  assert.equal(measuredTask.runs.direct.totalTaskInputTokens <= input.tokenBudget, true);
  assert.equal(evidence.claim.shardedLowerThanDirect, true);
  assert.equal(evidence.claim.cacheOrBilledTokenSavings, false);
  assert.equal(evidence.aggregates.sharded.p50, measuredTask.runs.sharded.totalTaskInputTokens);
  assert.equal(evidence.aggregates.sharded.p95, measuredTask.runs.sharded.totalTaskInputTokens);
  assert.equal(evidence.aggregates.sharded.maximum, measuredTask.runs.sharded.totalTaskInputTokens);

  const validation = spawnSync(
    "python3",
    [builderPath, "--validate", inputPath],
    { cwd: repositoryRoot, encoding: "utf8" }
  );
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
});

test("rejects recorded source-shard evidence whose projection identity is stale", (t) => {
  const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), "docai-source-shard-evidence-"));
  t.after(() => fs.rmSync(temporaryParent, { recursive: true, force: true }));
  const temporaryEvidenceRoot = path.join(temporaryParent, "source-shards");
  fs.cpSync(evidenceRoot, temporaryEvidenceRoot, { recursive: true });
  const temporaryEvidencePath = path.join(temporaryEvidenceRoot, "retrieval-runs.json");
  const evidence = JSON.parse(fs.readFileSync(temporaryEvidencePath, "utf8"));
  evidence.tasks[0].runs.sharded.identity.projectionId = "b32:aaaaaaaaaaaaaaaaaaaaaaaaaa";
  fs.writeFileSync(temporaryEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const validation = spawnSync(
    "python3",
    [builderPath, "--validate", path.join(temporaryEvidenceRoot, "measurement-input.json")],
    { cwd: repositoryRoot, encoding: "utf8" }
  );
  assert.notEqual(validation.status, 0);
  assert.match(validation.stderr, /recorded document-set identity is stale/);
});

for (const runNames of [["sharded"], ["sharded", "direct"]]) {
  const scope = runNames.length === 1 ? "mismatched roots" : "roots stale against the manifest";
  test(`rejects source-shard evidence with ${scope}`, (t) => {
    const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), "docai-source-shard-root-"));
    t.after(() => fs.rmSync(temporaryParent, { recursive: true, force: true }));
    const temporaryEvidenceRoot = path.join(temporaryParent, "source-shards");
    fs.cpSync(evidenceRoot, temporaryEvidenceRoot, { recursive: true });
    const temporaryEvidencePath = path.join(temporaryEvidenceRoot, "retrieval-runs.json");
    const evidence = JSON.parse(fs.readFileSync(temporaryEvidencePath, "utf8"));
    for (const runName of runNames) {
      replaceRootProjection(
        temporaryEvidenceRoot,
        evidence,
        runName,
        "b32:aaaaaaaaaaaaaaaaaaaaaaaaaa",
        `sha256:${"0".repeat(64)}`
      );
    }
    fs.writeFileSync(temporaryEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

    const validation = spawnSync(
      "python3",
      [builderPath, "--validate", path.join(temporaryEvidenceRoot, "measurement-input.json")],
      { cwd: repositoryRoot, encoding: "utf8" }
    );
    assert.notEqual(validation.status, 0);
    assert.match(validation.stderr, /projection identity/);
  });
}

test("rejects a recorded task contribution that disagrees with authoritative input", (t) => {
  const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), "docai-source-shard-contribution-"));
  t.after(() => fs.rmSync(temporaryParent, { recursive: true, force: true }));
  const temporaryEvidenceRoot = path.join(temporaryParent, "source-shards");
  fs.cpSync(evidenceRoot, temporaryEvidenceRoot, { recursive: true });
  const temporaryInputPath = path.join(temporaryEvidenceRoot, "measurement-input.json");
  const temporaryEvidencePath = path.join(temporaryEvidenceRoot, "retrieval-runs.json");
  const input = JSON.parse(fs.readFileSync(temporaryInputPath, "utf8"));
  const evidence = JSON.parse(fs.readFileSync(temporaryEvidencePath, "utf8"));
  const replacement = "sources/not-authoritative.json";
  input.tasks[0].catalogCellContributions[0].value = replacement;
  evidence.tasks[0].catalogCellContributions[0].value = replacement;
  const inputBytes = `${JSON.stringify(input, null, 2)}\n`;
  fs.writeFileSync(temporaryInputPath, inputBytes);
  evidence.measurementInput.sha256 = sha256(inputBytes);
  fs.writeFileSync(temporaryEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const validation = spawnSync(
    "python3",
    [builderPath, "--validate", temporaryInputPath],
    { cwd: repositoryRoot, encoding: "utf8" }
  );
  assert.notEqual(validation.status, 0);
  assert.match(validation.stderr, /contributions disagree with authoritative inputs/);
});

for (const [name, relativePath] of [
  ["authoritative source bytes", "source-inputs/authoritative-sources.json"],
  ["projection configuration bytes", "source-inputs/projection-config.json"]
]) {
  test(`rejects ${name} that disagree with the projection manifest`, (t) => {
    const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), "docai-source-shard-input-"));
    t.after(() => fs.rmSync(temporaryParent, { recursive: true, force: true }));
    const temporaryEvidenceRoot = path.join(temporaryParent, "source-shards");
    fs.cpSync(evidenceRoot, temporaryEvidenceRoot, { recursive: true });
    const inputToMutate = path.join(temporaryEvidenceRoot, relativePath);
    fs.mkdirSync(path.dirname(inputToMutate), { recursive: true });
    if (!fs.existsSync(inputToMutate)) fs.writeFileSync(inputToMutate, "{}\n");
    fs.appendFileSync(inputToMutate, "\n");

    const validation = spawnSync(
      "python3",
      [builderPath, "--validate", path.join(temporaryEvidenceRoot, "measurement-input.json")],
      { cwd: repositoryRoot, encoding: "utf8" }
    );
    assert.notEqual(validation.status, 0);
    assert.match(validation.stderr, /projection input digest is stale/);
  });
}

test("validates source-shard evidence with the declared minimum Python 3.9", (t) => {
  const version = spawnSync("python3.9", ["--version"], { encoding: "utf8" });
  if (version.error?.code === "ENOENT") {
    t.skip("python3.9 is not installed");
    return;
  }
  assert.equal(version.status, 0, version.stderr || version.stdout);

  const validation = spawnSync(
    "python3.9",
    [builderPath, "--validate", inputPath],
    { cwd: repositoryRoot, encoding: "utf8" }
  );
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
});
