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
