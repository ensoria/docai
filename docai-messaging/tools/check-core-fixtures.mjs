#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCoreFixtureCase } from "./lib/core-fixture-validator.mjs";
import {
  auditCoreReleaseCoverage,
  auditFixtureOneInvalidity,
  findRulesPath,
  runFixtureCorpus
} from "./lib/fixture-runner.mjs";

const defaultCorpusPath = fileURLToPath(
  new URL("../fixtures/core/v0.17.1/", import.meta.url)
);

function fail(lines) {
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exitCode = 1;
}

function checkCoreFixtures(corpusPath) {
  const manifestPath = path.join(corpusPath, "cases.json");
  const coveragePath = path.join(corpusPath, "COVERAGE.md");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const catalog = JSON.parse(fs.readFileSync(findRulesPath(corpusPath), "utf8"));
  const coverageText = fs.readFileSync(coveragePath, "utf8");
  const corpus = runFixtureCorpus(corpusPath, validateCoreFixtureCase);
  const oneInvalidity = auditFixtureOneInvalidity({
    manifestCases: manifest.cases,
    corpusCases: corpus.cases
  });
  const releaseCoverage = auditCoreReleaseCoverage({
    catalogRuleIds: catalog.rules
      .filter((entry) => entry.scope === "core")
      .map((entry) => entry.rule_id),
    manifestCases: manifest.cases,
    coverageText
  });
  const invalidCount = manifest.cases.filter((entry) => entry.expected === "invalid").length;
  const errors = [
    ...(corpus.failed === 0 ? [] : [corpus.report]),
    ...oneInvalidity.errors,
    ...releaseCoverage.ruleErrors,
    ...releaseCoverage.coverageErrors
  ];
  if (errors.length > 0) {
    fail(errors);
    return;
  }

  process.stdout.write(
    `Core fixture check passed: ${manifest.cases.length} cases, ${invalidCount} invalid, `
      + `one-invalidity ${oneInvalidity.audited}/${invalidCount}, `
      + `${releaseCoverage.unusedCatalogRules.length} unused rules, `
      + `${releaseCoverage.coverageErrors.length} coverage gaps.\n`
  );
}

const arguments_ = process.argv.slice(2);
if (arguments_.length > 1) {
  fail(["Usage: node docai-messaging/tools/check-core-fixtures.mjs [corpus-path]"]);
} else {
  try {
    checkCoreFixtures(path.resolve(arguments_[0] ?? defaultCorpusPath));
  } catch (error) {
    fail([error instanceof Error ? error.stack ?? error.message : String(error)]);
  }
}
