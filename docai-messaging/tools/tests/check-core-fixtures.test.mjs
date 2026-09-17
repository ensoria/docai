import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const checkerPath = fileURLToPath(new URL("../check-core-fixtures.mjs", import.meta.url));
const sourceCorpusPath = fileURLToPath(
  new URL("../../fixtures/core/v0.17.1/", import.meta.url)
);
const sourceRulesPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));

function runChecker(arguments_ = []) {
  return spawnSync(process.execPath, [checkerPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
}

function copyCandidate(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-core-checker-"));
  const fixturesPath = path.join(temporaryRoot, "fixtures");
  const candidatePath = path.join(fixturesPath, "core", "v0.17.1");
  fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
  fs.cpSync(sourceCorpusPath, candidatePath, { recursive: true });
  fs.copyFileSync(sourceRulesPath, path.join(fixturesPath, "rules.json"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  return candidatePath;
}

function replaceExactlyOnce(filePath, from, to) {
  const source = fs.readFileSync(filePath, "utf8");
  assert.equal(source.split(from).length - 1, 1, `${from} must occur exactly once`);
  fs.writeFileSync(filePath, source.replace(from, to));
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

test("checks the default Core corpus without modifying it", () => {
  const result = runChecker();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    "Core fixture check passed: 264 cases, 193 invalid, one-invalidity 193/193, 0 unused rules, 0 coverage gaps.\n"
  );
});

test("checks an optional candidate corpus path without modifying it", (t) => {
  const candidatePath = copyCandidate(t);
  const before = directorySnapshot(candidatePath);
  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

const mutationCases = [
  {
    name: "metadata",
    relativePath: "focused/valid/metadata-canonical-extensions-and-escapes.md",
    from: "profile: full",
    to: "profile: invalid",
    ruleId: "DM-META-001"
  },
  {
    name: "digest",
    relativePath: "focused/valid/identity-whole-set/INDEX.md",
    from: "set_digest: sha256:8fa5a006d03b4a53ba9991515bfe95f504c1106ecd5b24cded915f590b2bb9bb",
    to: "set_digest: sha256:8fa5a006d03b4a53ba9991515bfe95f504c1106ecd5b24cded915f590b2bb9ba",
    ruleId: "DM-ID-003"
  },
  {
    name: "INDEX row",
    relativePath: "focused/valid/operations-flat-routing-valid/INDEX.md",
    from: "| SEND | orders.commands |",
    to: "| INVALID | orders.commands |",
    ruleId: "DM-IDX-004"
  },
  {
    name: "marker propagation",
    relativePath: "focused/valid/sources-direct-unknown-api-valid/CONVENTIONS.md",
    from: "**unknown**: API contract version for source api-a requires AsyncAPI info.version at api-a.json\n",
    to: "",
    ruleId: "DM-SRC-003"
  }
];

for (const mutation of mutationCases) {
  test(`rejects a copied corpus with one ${mutation.name} mutation without rewriting it`, (t) => {
    const candidatePath = copyCandidate(t);
    replaceExactlyOnce(
      path.join(candidatePath, mutation.relativePath),
      mutation.from,
      mutation.to
    );
    const before = directorySnapshot(candidatePath);
    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`FAIL .* rules=.*${mutation.ruleId}`));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects an incomplete coverage row without rewriting the candidate", (t) => {
  const candidatePath = copyCandidate(t);
  const coveragePath = path.join(candidatePath, "COVERAGE.md");
  const source = fs.readFileSync(coveragePath, "utf8");
  const mutated = source.replace(
    /(\| `R8-CORE-049`[^\n]+\| )`covered`( \|)/,
    "$1`partial`$2"
  );
  assert.notEqual(mutated, source);
  fs.writeFileSync(coveragePath, mutated);
  const fixturesPath = path.resolve(candidatePath, "../..");
  const before = directorySnapshot(fixturesPath);
  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /incomplete-coverage-row:R8-CORE-049:partial/);
  assert.deepEqual(directorySnapshot(fixturesPath), before);
});

test("rejects an unused Core catalog rule without rewriting the candidate", (t) => {
  const candidatePath = copyCandidate(t);
  const fixturesPath = path.resolve(candidatePath, "../..");
  const rulesPath = path.join(fixturesPath, "rules.json");
  const catalog = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  catalog.rules.push({
    rule_id: "DM-TEMP-999",
    readme_section: "test-only",
    description: "Deliberately unused checker self-test rule.",
    scope: "core"
  });
  fs.writeFileSync(rulesPath, `${JSON.stringify(catalog, null, 2)}\n`);
  const before = directorySnapshot(fixturesPath);
  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /unused-catalog-rule:DM-TEMP-999/);
  assert.deepEqual(directorySnapshot(fixturesPath), before);
});
