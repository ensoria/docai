import test from "node:test";
import assert from "node:assert/strict";
import { parsePipeTable } from "../lib/tables.mjs";

function parsed(lines) {
  const result = parsePipeTable(lines);
  assert.deepEqual(result.diagnostics, []);
  return result.value;
}

function rejected(lines) {
  const result = parsePipeTable(lines);
  assert.equal(result.value, null);
  assert.equal(result.diagnostics.length, 1);
  return result.diagnostics[0];
}

test("requires a leading boundary pipe", () => {
  const diagnostic = rejected(["A | B |", "|---|---|"]);
  assert.equal(diagnostic.ruleId, "DM-PARSE-002");
  assert.match(diagnostic.message, /leading/);
});

test("requires a trailing boundary pipe", () => {
  assert.match(rejected(["| A | B", "|---|---|"]).message, /trailing/);
});

test("requires an exact separator row", () => {
  assert.match(rejected(["| A | B |", "| -- | --- |"]).message, /separator/);
});

test("rejects a boundary-only zero-column table", () => {
  const diagnostic = rejected(["|", "|"]);
  assert.equal(diagnostic.ruleId, "DM-PARSE-002");
  assert.match(diagnostic.message, /separator/);
});

test("requires every table row to have the separator column count", () => {
  assert.match(rejected(["| A | B |", "|---|---|", "| one |"]).message, /column/);
});

test("keeps a pipe after an odd backslash run inside its cell", () => {
  const table = parsed([
    "| A | B |",
    "|---|---|",
    String.raw`| left\\\|right | tail |`
  ]);
  assert.deepEqual(table.rows[0], [String.raw`left\\|right`, "tail"]);
});

test("splits on a pipe after an even backslash run", () => {
  const table = parsed([
    "| A | B | C |",
    "|---|---|---|",
    String.raw`| left\\|right | tail |`
  ]);
  assert.deepEqual(table.rows[0], [String.raw`left\\`, "right", "tail"]);
});

test("trims only leading and trailing ASCII spaces from cells", () => {
  const table = parsed(["  |  A\t | \u00a0B\u00a0 |  ", "|---|---|"]);
  assert.deepEqual(table.header, ["A\t", "\u00a0B\u00a0"]);
});

test("decodes only table-level escaped pipes", () => {
  const table = parsed([
    "| A | B | C |",
    "|---|---|---|",
    "| one\\|two | &amp; | **bold** and `code` |"
  ]);
  assert.deepEqual(table.rows[0], ["one|two", "&amp;", "**bold** and `code`"]);
});

test("preserves table source line numbers in values and diagnostics", () => {
  const lines = [
    { text: "| A |", file: "INDEX.md", line: 8 },
    { text: "|---|", file: "INDEX.md", line: 9 }
  ];
  assert.equal(parsed(lines).startLine, 8);
  const diagnostic = rejected([lines[0], { text: "not a row", file: "INDEX.md", line: 9 }]);
  assert.equal(diagnostic.file, "INDEX.md");
  assert.equal(diagnostic.line, 9);
});
