import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentSet, validateDocumentSet } from "../lib/document-set.mjs";
import { runFixtureCorpus } from "../lib/fixture-runner.mjs";
import { parseOpeningMetadata } from "../lib/metadata.mjs";
import { validateSentenceLine } from "../lib/sentence.mjs";

const corpusPath = fileURLToPath(new URL("../../fixtures/core/v0.17.1/", import.meta.url));

const metadataAndSentenceCaseIds = [
  "metadata-canonical-extensions-and-escapes",
  "metadata-coverage-invalid",
  "metadata-duplicate-extension-key",
  "metadata-duplicate-standard-key",
  "metadata-extension-disallowed-punctuation",
  "metadata-extension-empty-suffix",
  "metadata-extension-uppercase",
  "metadata-format-version-invalid",
  "metadata-knowledge-invalid",
  "metadata-missing-standard-key",
  "metadata-perspective-empty",
  "metadata-perspective-leading-space",
  "metadata-perspective-trailing-space",
  "metadata-profile-invalid",
  "metadata-standard-key-order-invalid",
  "metadata-trailing-backslash",
  "metadata-unknown-escape",
  "metadata-unknown-non-extension-key",
  "sentence-adjacent-japanese-valid",
  "sentence-literal-inline-terminator-valid",
  "sentence-three-terminators-invalid",
  "sentence-two-lines-invalid",
  "sentence-unterminated-invalid"
];

const identityCaseIds = [
  "identity-closed-root-extra-file",
  "identity-format-version-mixed",
  "identity-perspective-mixed",
  "identity-profile-mixed",
  "identity-projection-id-mixed",
  "identity-projection-short-id-invalid",
  "identity-set-id-mixed",
  "identity-set-short-id-invalid",
  "identity-task-scoped-stale-digest",
  "identity-task-scoped-stale-digest-whole-set-invalid",
  "identity-trailer-malformed-projection-digest",
  "identity-trailer-missing",
  "identity-whole-set-valid"
];

const sourceCaseIds = [
  "sources-direct-columns-invalid",
  "sources-direct-duplicate-id-invalid",
  "sources-direct-known-revision-none-valid",
  "sources-direct-unknown-api-valid",
  "sources-revision-sha-invalid",
  "sources-shard-bounds-invalid",
  "sources-sharded-cycle-valid",
  "sources-sharded-duplicate-row-invalid",
  "sources-sharded-missing-row-invalid",
  "sources-sharded-overlap-valid",
  "sources-source-refs-missing-invalid",
  "sources-unknown-conventions-repeat-missing-invalid",
  "sources-unknown-marker-missing-invalid"
];

function fixtureSource(fixturePath) {
  const source = fs.readFileSync(fixturePath, "utf8");
  return source.endsWith("\n") ? source.slice(0, -1) : source;
}

function validateCase(fixturePath, fixtureCase) {
  if (fixtureCase.kind === "document-set") {
    return validateDocumentSet(loadDocumentSet(fixturePath), { wholeSet: true });
  }
  if (fixtureCase.kind === "task-scoped-document-set") {
    return validateDocumentSet(loadDocumentSet(fixturePath), { wholeSet: false });
  }
  if (fixtureCase.kind === "metadata-line") {
    return parseOpeningMetadata({
      text: fixtureSource(fixturePath),
      file: fixtureCase.path,
      line: 1
    });
  }
  if (fixtureCase.kind === "sentence-line") {
    return validateSentenceLine({
      text: fixtureSource(fixturePath),
      file: fixtureCase.path,
      line: 1
    }, 1, 2);
  }
  throw new Error(`Unsupported focused fixture kind: ${fixtureCase.kind}`);
}

test("executes the Task 9 metadata and sentence focused corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    metadataAndSentenceCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of metadataAndSentenceCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);
});

test("executes the Task 9 identity focused corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    identityCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of identityCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);
});

test("executes the Task 9 Sources focused corpus and fixes retrieval facts", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    sourceCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of sourceCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const directCase = byId.get("sources-direct-known-revision-none-valid");
  const direct = validateCase(path.join(corpusPath, directCase.path), directCase);
  assert.equal(direct.facts.core.sources.form, "direct");
  assert.deepEqual(direct.facts.core.sources.rows.map((row) => row.id), ["api-a", "notes-z"]);
  assert.deepEqual(direct.facts.core.sourceResolutions["CONVENTIONS.md"], {
    requestedIds: ["api-a"],
    resolvedIds: ["api-a"],
    loadedPaths: ["INDEX.md"]
  });

  const cycleCase = byId.get("sources-sharded-cycle-valid");
  const cycle = validateCase(path.join(corpusPath, cycleCase.path), cycleCase);
  assert.equal(cycle.facts.core.sources.form, "sharded");
  assert.deepEqual(cycle.facts.core.sourceResolutions["CONVENTIONS.md"], {
    requestedIds: ["a"],
    resolvedIds: ["a", "z"],
    loadedPaths: ["indexes/sources-a.md", "indexes/sources-z.md"]
  });
  assert.deepEqual(cycle.facts.core.sourceResolutions["INDEX.md"].loadedPaths, [
    "indexes/sources-a.md",
    "indexes/sources-z.md"
  ]);

  const overlapCase = byId.get("sources-sharded-overlap-valid");
  const overlap = validateCase(path.join(corpusPath, overlapCase.path), overlapCase);
  assert.deepEqual(overlap.facts.core.sourceResolutions["CONVENTIONS.md"], {
    requestedIds: ["b"],
    resolvedIds: ["a", "b", "c"],
    loadedPaths: ["indexes/sources-a-c.md", "indexes/sources-b.md"]
  });
});
