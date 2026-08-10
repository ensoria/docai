import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runFixtureCorpus } from "../lib/fixture-runner.mjs";

const rules = [
  {
    rule_id: "DM-META-004",
    readme_section: "§3 File Structure",
    description: "Opening metadata keys must not be duplicated.",
    scope: "core"
  },
  {
    rule_id: "DM-ID-001",
    readme_section: "§3 File Structure",
    description: "Every document-set file ends with the required identity trailer.",
    scope: "core"
  }
];

function createTemporaryCorpus(t, testCase, catalog = rules) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-messaging-runner-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "focused", "invalid"), { recursive: true });
  fs.writeFileSync(path.join(root, testCase.path), "invalid fixture\n");
  fs.writeFileSync(path.join(root, "cases.json"), JSON.stringify({
    docai_messaging: "0.17.1",
    scope: "compatibility-core",
    cases: [testCase]
  }));
  fs.writeFileSync(path.join(root, "rules.json"), JSON.stringify({ rules: catalog }));
  return root;
}

test("fails when an invalid case does not emit its expected rule", (t) => {
  const corpus = createTemporaryCorpus(t, {
    id: "metadata-duplicate-standard-key",
    kind: "focused-document",
    path: "focused/invalid/metadata-duplicate-standard-key.md",
    expected: "invalid",
    expected_rule_ids: ["DM-META-004"]
  });
  const result = runFixtureCorpus(corpus, () => ({ diagnostics: [] }));
  assert.equal(result.failed, 1);
});

test("reports cascade errors without treating them as unexpected primary errors", (t) => {
  const corpus = createTemporaryCorpus(t, {
    id: "metadata-duplicate-standard-key",
    kind: "focused-document",
    path: "focused/invalid/metadata-duplicate-standard-key.md",
    expected: "invalid",
    expected_rule_ids: ["DM-META-004"]
  });
  const result = runFixtureCorpus(corpus, () => ({
    diagnostics: [
      { ruleId: "DM-META-004", severity: "error", cascade: false },
      { ruleId: "DM-ID-001", severity: "error", cascade: true }
    ]
  }));
  assert.equal(result.failed, 0);
  assert.match(result.report, /cascades=DM-ID-001/);
});

test("fails when an expected rule is absent from the catalog", (t) => {
  const corpus = createTemporaryCorpus(t, {
    id: "metadata-unknown-expected-rule",
    kind: "focused-document",
    path: "focused/invalid/metadata-unknown-expected-rule.md",
    expected: "invalid",
    expected_rule_ids: ["DM-META-999"]
  });
  const result = runFixtureCorpus(corpus, () => ({ diagnostics: [] }));
  assert.equal(result.failed, 1);
  assert.match(result.report, /catalog=unknown-expected:DM-META-999/);
});

test("fails when a validator emits a rule absent from the catalog", (t) => {
  const corpus = createTemporaryCorpus(t, {
    id: "metadata-unknown-emitted-rule",
    kind: "focused-document",
    path: "focused/invalid/metadata-unknown-emitted-rule.md",
    expected: "invalid",
    expected_rule_ids: ["DM-META-004"]
  });
  const result = runFixtureCorpus(corpus, () => ({
    diagnostics: [{ ruleId: "DM-META-999", severity: "error", cascade: false }]
  }));
  assert.equal(result.failed, 1);
  assert.match(result.report, /catalog=unknown-emitted:DM-META-999/);
});

test("fails a valid case when the validator emits an error", (t) => {
  const corpus = createTemporaryCorpus(t, {
    id: "valid-case-with-error",
    kind: "focused-document",
    path: "focused/invalid/valid-case-with-error.md",
    expected: "valid",
    expected_rule_ids: []
  });
  const result = runFixtureCorpus(corpus, () => ({
    diagnostics: [{ ruleId: "DM-META-004", severity: "error", cascade: false }]
  }));
  assert.equal(result.failed, 1);
});

test("fails an invalid case with an unexpected primary error", (t) => {
  const corpus = createTemporaryCorpus(t, {
    id: "metadata-unexpected-primary-error",
    kind: "focused-document",
    path: "focused/invalid/metadata-unexpected-primary-error.md",
    expected: "invalid",
    expected_rule_ids: ["DM-META-004"]
  });
  const result = runFixtureCorpus(corpus, () => ({
    diagnostics: [{ ruleId: "DM-ID-001", severity: "error", cascade: false }]
  }));
  assert.equal(result.failed, 1);
});

test("returns a failing exit code and summary when a case fails", (t) => {
  const corpus = createTemporaryCorpus(t, {
    id: "metadata-missing-rule",
    kind: "focused-document",
    path: "focused/invalid/metadata-missing-rule.md",
    expected: "invalid",
    expected_rule_ids: ["DM-META-004"]
  });
  const result = runFixtureCorpus(corpus, () => ({ diagnostics: [] }));
  assert.equal(result.exitCode, 1);
  assert.match(result.report, /0 passed, 1 failed$/);
});
