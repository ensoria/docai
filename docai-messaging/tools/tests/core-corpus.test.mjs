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

function fixtureSource(fixturePath) {
  const source = fs.readFileSync(fixturePath, "utf8");
  return source.endsWith("\n") ? source.slice(0, -1) : source;
}

function validateCase(fixturePath, fixtureCase) {
  if (fixtureCase.kind === "document-set") {
    return validateDocumentSet(loadDocumentSet(fixturePath), { wholeSet: true });
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
