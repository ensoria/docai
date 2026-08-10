import test from "node:test";
import assert from "node:assert/strict";
import { scanMarkdown } from "../lib/markdown.mjs";

test("records source-line heading and fenced-block boundaries", () => {
  const source = [
    "# Contract",
    "intro",
    "```json",
    "# payload data, not a heading",
    "{}",
    "```",
    "## SEND orders (send-orders)"
  ].join("\n");
  const result = scanMarkdown({ text: source, file: "channels/orders.md" });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.value.headings, [
    { level: 1, text: "Contract", line: 1 },
    { level: 2, text: "SEND orders (send-orders)", line: 7 }
  ]);
  assert.deepEqual(result.value.fences, [
    { delimiterLength: 3, info: "json", startLine: 3, endLine: 6 }
  ]);
  assert.equal(result.value.lines[3].inFence, true);
  assert.equal(result.value.lines[6].inFence, false);
});

test("reports an unclosed fence at its source location", () => {
  const result = scanMarkdown({ text: "before\n````text\ninside", file: "references/example.md" });
  assert.equal(result.value, null);
  assert.deepEqual(result.diagnostics[0], {
    ruleId: "DM-PARSE-MARKDOWN",
    file: "references/example.md",
    line: 2,
    message: "Fenced block opened on this line is not closed.",
    severity: "error",
    cascade: false
  });
});
