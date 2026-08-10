import test from "node:test";
import assert from "node:assert/strict";
import { validateSentenceLine } from "../lib/sentence.mjs";

function accepted(line, min = 1, max = 2) {
  const result = validateSentenceLine(line, min, max);
  assert.deepEqual(result.diagnostics, []);
  return result.value;
}

function rejected(line, min = 1, max = 2) {
  const result = validateSentenceLine(line, min, max);
  assert.equal(result.value, null);
  assert.equal(result.diagnostics.length, 1);
  return result.diagnostics[0];
}

test("counts each canonical sentence terminator literally", () => {
  for (const terminator of [".", "!", "?", "。", "！", "？"]) {
    assert.equal(accepted(`message${terminator}`, 1, 1).count, 1, terminator);
  }
});

test("counts adjacent Japanese sentences without requiring spaces", () => {
  assert.equal(accepted("送信します。応答を待ちます。", 2, 2).count, 2);
});

test("counts terminators inside URLs literally", () => {
  assert.equal(accepted("See https://example.test.", 2, 2).count, 2);
});

test("counts terminators inside abbreviations literally", () => {
  assert.equal(accepted("Use e.g. this.", 3, 3).count, 3);
});

test("counts terminators inside inline code literally", () => {
  assert.equal(accepted("Use `ready?` now.", 2, 2).count, 2);
});

test("rejects a line whose final character is not a terminator", () => {
  const diagnostic = rejected("No terminator");
  assert.equal(diagnostic.ruleId, "DM-PARSE-004");
  assert.match(diagnostic.message, /final character/);
});

test("rejects counts outside the required range", () => {
  assert.match(rejected("One. Two. Three.").message, /between 1 and 2/);
});

test("rejects empty and multi-line prose", () => {
  assert.match(rejected("").message, /non-empty/);
  assert.match(rejected("One.\nTwo.").message, /source line/);
});

test("preserves the supplied source location in sentence diagnostics", () => {
  const diagnostic = rejected({ text: "No terminator", file: "channels/orders.md", line: 23 });
  assert.equal(diagnostic.file, "channels/orders.md");
  assert.equal(diagnostic.line, 23);
});
