import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadDocumentSet } from "./document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "./complete-example-adapters.mjs";
import { validateCompleteProfilePair } from "./validators/complete-profiles.mjs";
import { runFixtureCorpus, auditFixtureOneInvalidity } from "./fixture-runner.mjs";
import { validateCompleteFixtureRecipe } from "./complete-fixture-validator.mjs";
import { validateCompleteSourceFixture } from "./complete-source-fixture-validator.mjs";
import { COMPLETE_REQUIREMENTS, CONDITIONAL_REQUIREMENTS, containedPath, readCorpusJson, requireValue, validateCorpusManifest } from "./complete-corpus-contract.mjs";

function filesUnder(root, relative) {
  const dir = containedPath(root, relative);
  return fs.readdirSync(dir).flatMap(name => {
    const child = `${relative}/${name}`, file = containedPath(root, child);
    return fs.statSync(file).isDirectory() ? filesUnder(root, child) : [child];
  });
}
function verifyBase(root, manifest) {
  const actual = ["full", "compact", "source"].flatMap(dir => filesUnder(root, dir)).sort();
  const expected = Object.keys(manifest.base_files).sort();
  requireValue(JSON.stringify(actual) === JSON.stringify(expected), "base membership differs from pinned files");
  for (const name of actual) {
    const digest = createHash("sha256").update(fs.readFileSync(containedPath(root, name))).digest("hex");
    requireValue(digest === manifest.base_files[name], `base hash differs: ${name}`);
  }
  const full = loadDocumentSet(path.join(root, "full")), compact = loadDocumentSet(path.join(root, "compact"));
  const result = validateCompleteProfilePair(full, compact, loadTrustedCompleteExampleAdapterOptions(root, [full, compact]));
  requireValue(result.diagnostics.length === 0, `base whole-set validation failed: ${result.diagnostics.map(d => d.ruleId).join(",")}`);
  requireValue(result.facts.completeProfilePair.projection.docaiMessaging === manifest.docai_messaging, "base version differs");
}
export function runCompleteFixtureCorpus(corpusDir, { requireComplete = false } = {}) {
  const root = path.resolve(corpusDir);
  const manifest = readCorpusJson(containedPath(root, "cases.json"));
  const catalog = new Set(JSON.parse(fs.readFileSync(new URL("../../fixtures/rules.json", import.meta.url), "utf8"))
    .rules.map(entry => entry.rule_id));
  validateCorpusManifest(manifest, catalog);
  verifyBase(root, manifest);
  const failures = new Map(), modes = new Map();
  const corpus = runFixtureCorpus(root, (_file, entry) => {
    try {
      const result = entry.kind === "complete-source-scenario"
        ? validateCompleteSourceFixture(root, entry) : validateCompleteFixtureRecipe(root, entry);
      modes.set(entry.id, result.mode);
      return result;
    } catch (error) {
      failures.set(entry.id, error.message);
      return { diagnostics: [] };
    }
  }, { catalog });
  const results = corpus.cases.map(result => ({ ...result,
    passed: result.passed && !failures.has(result.id), error: failures.get(result.id), mode: modes.get(result.id) }));
  const oneInvalidity = auditFixtureOneInvalidity({ manifestCases: manifest.cases,
    corpusCases: results.filter(result => !failures.has(result.id)) });
  const successes = new Set(results.filter(result => result.passed).map(result => result.id));
  const rows = manifest.requirements.map(row => {
    const missing = row.facets.filter(facet => !["valid", "invalid"].every(expected => manifest.cases.some(entry =>
      successes.has(entry.id) && entry.expected === expected
      && entry.facets.some(ref => ref.requirement === row.id && ref.facet === facet))));
    return { id: row.id, covered: row.facets_complete && missing.length === 0, missing };
  });
  const coverage = { open: rows.filter(row => COMPLETE_REQUIREMENTS.includes(row.id) && !row.covered),
    conditional: rows.filter(row => CONDITIONAL_REQUIREMENTS.includes(row.id)), rows };
  const ruleCoverage = Object.fromEntries([...catalog].map(rule => [rule, {
    valid: manifest.cases.filter(entry => entry.expected === "valid" && entry.rule_ids.includes(rule) && successes.has(entry.id)).map(entry => entry.id),
    invalid: manifest.cases.filter(entry => entry.expected === "invalid" && entry.expected_rule_ids.includes(rule) && successes.has(entry.id)).map(entry => entry.id)
  }]));
  const failed = results.filter(result => !result.passed).length;
  const coverageComplete = failed === 0 && oneInvalidity.passed && coverage.open.length === 0;
  const report = results.map(result => `${result.passed ? "PASS" : "FAIL"} ${result.id} mode=${result.mode ?? "setup-failed"} rules=${result.rules}${result.error ? ` ${result.error}` : ""}`)
    .concat(oneInvalidity.errors, `${results.length - failed} passed, ${failed} failed; ${coverage.open.length} open complete requirements; ${coverage.conditional.length} conditional release obligations; ${coverageComplete ? "declared corpus coverage satisfied; " : ""}not publication-ready`).join("\n");
  return { cases: results, passed: results.length - failed, failed, coverage, ruleCoverage, coverageComplete,
    publicationReady: false, report,
    exitCode: failed > 0 || !oneInvalidity.passed || (requireComplete && !coverageComplete) ? 1 : 0 };
}
