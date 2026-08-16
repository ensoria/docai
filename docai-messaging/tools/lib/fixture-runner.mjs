import fs from "node:fs";
import path from "node:path";

function errorDiagnostics(diagnostics) {
  return diagnostics.filter((entry) => entry.severity === "error");
}

function primaryErrorDiagnostics(diagnostics) {
  return errorDiagnostics(diagnostics).filter((entry) => !entry.cascade);
}

function findRulesPath(corpusDir) {
  let directory = path.resolve(corpusDir);
  while (true) {
    const candidate = path.join(directory, "rules.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`rules.json not found for fixture corpus: ${corpusDir}`);
    directory = parent;
  }
}

function loadCatalog(corpusDir) {
  const catalog = JSON.parse(fs.readFileSync(findRulesPath(corpusDir), "utf8"));
  return new Set(catalog.rules.map((entry) => entry.rule_id));
}

function unknownRuleIds(ruleIds, catalog, kind) {
  return [...new Set(ruleIds.filter((ruleId) => !catalog.has(ruleId)))].map(
    (ruleId) => `unknown-${kind}:${ruleId}`
  );
}

function testRuleIds(testName, rulePrefixes) {
  const matches = String(testName).match(/\bDM-[A-Z]+-[0-9]{3}\b/g) ?? [];
  return [...new Set(matches.filter((ruleId) => (
    rulePrefixes.some((prefix) => ruleId.startsWith(`${prefix}-`))
  )))];
}

export function auditRuleTestCorrespondence({ catalogRuleIds, testNames, rulePrefixes }) {
  const scopedCatalogIds = catalogRuleIds.filter((ruleId) => (
    rulePrefixes.some((prefix) => ruleId.startsWith(`${prefix}-`))
  ));
  const catalogCounts = new Map();
  for (const ruleId of scopedCatalogIds) {
    catalogCounts.set(ruleId, (catalogCounts.get(ruleId) ?? 0) + 1);
  }
  const catalog = new Set(scopedCatalogIds);
  const used = new Set();
  const missingTestRules = [];
  const unknownTestRules = new Set();
  for (const testName of testNames) {
    const ruleIds = testRuleIds(testName, rulePrefixes);
    if (ruleIds.length === 0) missingTestRules.push(String(testName));
    for (const ruleId of ruleIds) {
      used.add(ruleId);
      if (!catalog.has(ruleId)) unknownTestRules.add(ruleId);
    }
  }
  const duplicateCatalogRules = [...catalogCounts]
    .filter(([, count]) => count > 1)
    .map(([ruleId]) => ruleId)
    .sort();
  const unusedCatalogRules = [...catalog]
    .filter((ruleId) => !used.has(ruleId))
    .sort();
  const errors = [
    ...duplicateCatalogRules.map((ruleId) => `duplicate-catalog-rule:${ruleId}`),
    ...missingTestRules.sort().map((testName) => `missing-test-rule:${testName}`),
    ...[...unknownTestRules].sort().map((ruleId) => `unknown-test-rule:${ruleId}`),
    ...unusedCatalogRules.map((ruleId) => `unused-catalog-rule:${ruleId}`)
  ];
  return { passed: errors.length === 0, errors };
}

export function auditFixtureOneInvalidity({ manifestCases, corpusCases }) {
  const invalidCases = manifestCases.filter((entry) => entry.expected === "invalid");
  const resultsById = new Map(corpusCases.map((entry) => [entry.id, entry]));
  const errors = [];

  for (const testCase of invalidCases) {
    const expectedRuleIds = Array.isArray(testCase.expected_rule_ids)
      ? testCase.expected_rule_ids
      : [];
    if (expectedRuleIds.length !== 1) {
      errors.push(
        `expected-primary-concern-count:${testCase.id}:${expectedRuleIds.length}:${expectedRuleIds.join(",") || "none"}`
      );
      continue;
    }

    const result = resultsById.get(testCase.id);
    const primaryRuleIds = [...new Set(primaryErrorDiagnostics(result?.diagnostics ?? [])
      .map((entry) => entry.ruleId))].sort();
    if (primaryRuleIds.length !== 1) {
      errors.push(
        `primary-concern-count:${testCase.id}:${primaryRuleIds.length}:${primaryRuleIds.join(",") || "none"}`
      );
      continue;
    }
    if (primaryRuleIds[0] !== expectedRuleIds[0]) {
      errors.push(
        `primary-concern-mismatch:${testCase.id}:expected=${expectedRuleIds[0]}:actual=${primaryRuleIds[0]}`
      );
    }
  }

  return { passed: errors.length === 0, audited: invalidCases.length, errors };
}

function caseResult(testCase, diagnostics, catalog) {
  const errors = errorDiagnostics(diagnostics);
  const primaryErrors = primaryErrorDiagnostics(diagnostics);
  const cascadeErrors = errors.filter((entry) => entry.cascade);
  const ruleIds = primaryErrors.map((entry) => entry.ruleId);
  const cascadeRuleIds = cascadeErrors.map((entry) => entry.ruleId);
  const actual = errors.length === 0 ? "valid" : "invalid";
  const expectedRuleIds = testCase.expected_rule_ids;
  const hasExpectedRules = expectedRuleIds.every((ruleId) => ruleIds.includes(ruleId));
  const hasUnexpectedPrimaryError = primaryErrors.some(
    (entry) => !expectedRuleIds.includes(entry.ruleId)
  );
  const catalogErrors = [
    ...unknownRuleIds(expectedRuleIds, catalog, "expected"),
    ...unknownRuleIds(diagnostics.map((entry) => entry.ruleId), catalog, "emitted")
  ];
  const passed = testCase.expected === "valid"
    ? errors.length === 0 && catalogErrors.length === 0
    : actual === "invalid" && hasExpectedRules && !hasUnexpectedPrimaryError && catalogErrors.length === 0;
  const rules = ruleIds.length === 0 ? "none" : ruleIds.join(",");
  const cascades = cascadeRuleIds.length === 0 ? "none" : cascadeRuleIds.join(",");

  return {
    id: testCase.id,
    expected: testCase.expected,
    actual,
    passed,
    rules,
    cascades,
    catalogErrors,
    diagnostics
  };
}

export function runFixtureCorpus(corpusDir, validator) {
  const manifestPath = path.join(corpusDir, "cases.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const catalog = loadCatalog(corpusDir);
  const cases = manifest.cases.map((testCase) => {
    const fixturePath = path.join(corpusDir, testCase.path);
    const { diagnostics = [] } = validator(fixturePath, testCase);
    return caseResult(testCase, diagnostics, catalog);
  });
  const passed = cases.filter((entry) => entry.passed).length;
  const failed = cases.length - passed;
  const reportLines = cases.map((entry) => (
    `${entry.passed ? "PASS" : "FAIL"} ${entry.id} expected=${entry.expected} actual=${entry.actual} rules=${entry.rules}${entry.cascades === "none" ? "" : ` cascades=${entry.cascades}`}${entry.catalogErrors.length === 0 ? "" : ` catalog=${entry.catalogErrors.join(",")}`}`
  ));
  reportLines.push(`${passed} passed, ${failed} failed`);

  return {
    passed,
    failed,
    cases,
    diagnostics: cases.flatMap((entry) => entry.diagnostics),
    report: reportLines.join("\n"),
    exitCode: failed > 0 ? 1 : 0
  };
}
