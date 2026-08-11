import nodeTest from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { auditRuleTestCorrespondence } from "../lib/fixture-runner.mjs";
import { scanMarkdown } from "../lib/markdown.mjs";
import { parsePipeTable } from "../lib/tables.mjs";
import { parseDocsPath } from "../lib/paths.mjs";
import { validateSentenceLine } from "../lib/sentence.mjs";

const catalogPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
const parserRuleTestNames = [];

function test(name, ...arguments_) {
  parserRuleTestNames.push(String(name));
  return nodeTest(name, ...arguments_);
}

for (const [ruleId, description, emitRuleId] of [
  ["DM-PARSE-001", "an unclosed Markdown fence", () => scanMarkdown("```\nunclosed").diagnostics[0].ruleId],
  ["DM-PARSE-002", "an invalid pipe table", () => parsePipeTable(["not a row", "|---|"]).diagnostics[0].ruleId],
  ["DM-PARSE-003", "an invalid document path", () => parseDocsPath("../not-a-profile.md").diagnostics[0].ruleId],
  ["DM-PARSE-004", "an unterminated sentence", () => validateSentenceLine("unterminated", 1, 2).diagnostics[0].ruleId]
]) {
  test(`${ruleId} catalogs ${description}`, () => {
    const emitted = emitRuleId();

    assert.equal(emitted, ruleId);
    assert.equal(cataloged.has(emitted), true);
  });
}

test("DM-PARSE-001 through DM-PARSE-004 maintain rule correspondence", () => {
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: parserRuleTestNames,
    rulePrefixes: ["DM-PARSE"]
  });

  assert.deepEqual(result, { passed: true, errors: [] });
});
