import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { scanMarkdown } from "../lib/markdown.mjs";
import { parsePipeTable } from "../lib/tables.mjs";
import { parseDocsPath } from "../lib/paths.mjs";
import { validateSentenceLine } from "../lib/sentence.mjs";

const catalogPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));

test("catalogs each numeric context-free parser diagnostic", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const emitted = [
    scanMarkdown("```\nunclosed").diagnostics[0].ruleId,
    parsePipeTable(["not a row", "|---|"]).diagnostics[0].ruleId,
    parseDocsPath("../not-a-profile.md").diagnostics[0].ruleId,
    validateSentenceLine("unterminated", 1, 2).diagnostics[0].ruleId
  ];

  assert.deepEqual(emitted, ["DM-PARSE-001", "DM-PARSE-002", "DM-PARSE-003", "DM-PARSE-004"]);
  assert.deepEqual(emitted.filter((ruleId) => !cataloged.has(ruleId)), []);
});
