import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

function errorDiagnostics(diagnostics) {
  return diagnostics.filter((entry) => entry.severity === "error");
}

function primaryErrorDiagnostics(diagnostics) {
  return errorDiagnostics(diagnostics).filter((entry) => !entry.cascade);
}

export function findRulesPath(corpusDir) {
  let directory = path.resolve(corpusDir);
  while (true) {
    const candidate = path.join(directory, "rules.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`rules.json not found for fixture corpus: ${corpusDir}`);
    directory = parent;
  }
}

export function loadFixtureRuleCatalog(corpusDir) {
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

export function auditCoreReleaseCoverage({ catalogRuleIds, manifestCases, coverageText }) {
  const catalogCounts = new Map();
  for (const ruleId of catalogRuleIds) {
    catalogCounts.set(ruleId, (catalogCounts.get(ruleId) ?? 0) + 1);
  }
  const catalog = new Set(catalogRuleIds);
  const manifestRuleIds = manifestCases.flatMap((entry) => entry.expected_rule_ids ?? []);
  const coverageRowMatches = [...coverageText.matchAll(
    /^\| `R8-CORE-([0-9]{3})` \|.*\| `(covered|partial|pending)` \|$/gm
  )];
  const coverageRuleIds = coverageRowMatches.flatMap(
    (match) => match[0].match(/\bDM-[A-Z]+-[0-9]{3}\b/g) ?? []
  );
  const referencedRuleIds = new Set([...manifestRuleIds, ...coverageRuleIds]);
  const duplicateCatalogRules = [...catalogCounts]
    .filter(([, count]) => count > 1)
    .map(([ruleId]) => ruleId)
    .sort();
  const unknownRuleReferences = [...referencedRuleIds]
    .filter((ruleId) => !catalog.has(ruleId))
    .sort();
  const unusedCatalogRules = [...catalog]
    .filter((ruleId) => !referencedRuleIds.has(ruleId))
    .sort();

  const coverageRows = coverageRowMatches.map(
    (match) => ({ number: Number(match[1]), status: match[2] })
  );
  const coverageErrors = [];
  if (coverageRows.length === 0) {
    coverageErrors.push("missing-coverage-rows");
  } else {
    const rowCounts = new Map();
    for (const row of coverageRows) {
      rowCounts.set(row.number, (rowCounts.get(row.number) ?? 0) + 1);
    }
    const rowNumbers = new Set(rowCounts.keys());
    const maximum = Math.max(...rowNumbers);
    for (let number = 1; number <= maximum; number += 1) {
      if (!rowNumbers.has(number)) {
        coverageErrors.push(`missing-coverage-row:R8-CORE-${String(number).padStart(3, "0")}`);
      }
    }
    for (const [number, count] of rowCounts) {
      if (count > 1) {
        coverageErrors.push(
          `duplicate-coverage-row:R8-CORE-${String(number).padStart(3, "0")}`
        );
      }
    }
    for (const row of coverageRows) {
      if (row.status !== "covered") {
        coverageErrors.push(
          `incomplete-coverage-row:R8-CORE-${String(row.number).padStart(3, "0")}:${row.status}`
        );
      }
    }
  }

  const ruleErrors = [
    ...duplicateCatalogRules.map((ruleId) => `duplicate-catalog-rule:${ruleId}`),
    ...unknownRuleReferences.map((ruleId) => `unknown-rule-reference:${ruleId}`),
    ...unusedCatalogRules.map((ruleId) => `unused-catalog-rule:${ruleId}`)
  ];
  return {
    passed: ruleErrors.length === 0 && coverageErrors.length === 0,
    unusedCatalogRules,
    ruleErrors,
    coverageErrors
  };
}

export function auditCorePublicationMetadata({
  publication,
  projectionManifest,
  projectionManifestBytes
}) {
  const errors = [];
  const scope = publication?.publicationScope ?? {};
  const manifestBinding = publication?.projectionManifest ?? {};
  const expectedScope = {
    identity: projectionManifest?.publicationPolicy?.id,
    version: projectionManifest?.publicationPolicy?.version,
    compatibilityScope: "compatibility-core",
    docaiMessagingVersion: projectionManifest?.docaiMessaging,
    profiles: ["full"]
  };
  for (const [field, expected] of Object.entries(expectedScope)) {
    const actual = scope[field];
    const matches = Array.isArray(expected)
      ? JSON.stringify(actual) === JSON.stringify(expected)
      : actual === expected;
    if (!matches) {
      errors.push(
        `publication-scope-${field.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-mismatch:`
          + `expected=${Array.isArray(expected) ? expected.join(",") : expected}:`
          + `actual=${Array.isArray(actual) ? actual.join(",") : actual ?? "missing"}`
      );
    }
  }

  const expectedManifestPath = "source/projection-input-manifest.json";
  if (manifestBinding.path !== expectedManifestPath) {
    errors.push(
      `publication-manifest-path-mismatch:expected=${expectedManifestPath}:`
        + `actual=${manifestBinding.path ?? "missing"}`
    );
  }
  const expectedManifestSha256 = `sha256:${createHash("sha256")
    .update(projectionManifestBytes)
    .digest("hex")}`;
  if (manifestBinding.sha256 !== expectedManifestSha256) {
    errors.push(
      `publication-manifest-digest-mismatch:expected=${expectedManifestSha256}:`
        + `actual=${manifestBinding.sha256 ?? "missing"}`
    );
  }

  const expectedMappings = Array.isArray(projectionManifest?.adapters)
    ? projectionManifest.adapters
    : [];
  const actualMappings = Array.isArray(publication?.adapterMappings)
    ? publication.adapterMappings
    : [];
  const keyFor = (entry) => `${entry?.class ?? "missing"}:${entry?.target ?? "missing"}`;
  const actualByKey = new Map();
  for (const mapping of actualMappings) {
    const key = keyFor(mapping);
    if (actualByKey.has(key)) {
      errors.push(`duplicate-publication-adapter-mapping:${key}`);
    } else {
      actualByKey.set(key, mapping);
    }
  }
  const expectedKeys = new Set(expectedMappings.map(keyFor));
  for (const expected of expectedMappings) {
    const key = keyFor(expected);
    const actual = actualByKey.get(key);
    if (actual === undefined) {
      errors.push(`missing-publication-adapter-mapping:${key}`);
    } else if (actual.ruleVersion !== expected.ruleVersion) {
      errors.push(
        `adapter-mapping-version-mismatch:${key}:expected=${expected.ruleVersion}:`
          + `actual=${actual.ruleVersion ?? "missing"}`
      );
    }
  }
  for (const key of actualByKey.keys()) {
    if (!expectedKeys.has(key)) {
      errors.push(`unexpected-publication-adapter-mapping:${key}`);
    }
  }

  return { passed: errors.length === 0, errors };
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
  const catalog = loadFixtureRuleCatalog(corpusDir);
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
