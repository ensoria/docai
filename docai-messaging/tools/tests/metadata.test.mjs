import test from "node:test";
import assert from "node:assert/strict";
import { parseOpeningMetadata } from "../lib/metadata.mjs";

const stamp = "> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all";

function parsed(line = stamp) {
  const result = parseOpeningMetadata(line);
  assert.deepEqual(result.diagnostics, []);
  return result.value;
}

function rejected(line) {
  const result = parseOpeningMetadata(line);
  assert.equal(result.value, null);
  assert.equal(result.diagnostics.length, 1);
  return result.diagnostics[0];
}

test("requires all six standard metadata keys in their canonical order", () => {
  const line = stamp.replace(
    "profile: full | perspective: storefront",
    "perspective: storefront | profile: full"
  );
  assert.equal(rejected(line).ruleId, "DM-META-001");
});

test("identifies a missing standard metadata key", () => {
  const line = stamp.replace(" | source_refs: all", "");
  const diagnostic = rejected(line);
  assert.equal(diagnostic.ruleId, "DM-META-001");
  assert.match(diagnostic.message, /required metadata key 'source_refs'/);
});

test("treats a pipe after an odd backslash run as metadata value data", () => {
  const line = stamp.replace("perspective: storefront", String.raw`perspective: left\\\|right`);
  assert.equal(parsed(line).perspective, String.raw`left\|right`);
});

test("treats a pipe after an even backslash run as a metadata separator", () => {
  const line = `${stamp.replace("source_refs: all", String.raw`source_refs: all\\`)} | x-note: yes`;
  const value = parsed(line);
  assert.equal(value.source_refs, "all\\");
  assert.equal(value["x-note"], "yes");
});

test("decodes an escaped pipe in a metadata value", () => {
  const line = stamp.replace("perspective: storefront", String.raw`perspective: store\|front`);
  assert.equal(parsed(line).perspective, "store|front");
});

test("decodes an escaped backslash in a metadata value", () => {
  const line = stamp.replace("perspective: storefront", String.raw`perspective: store\\front`);
  assert.equal(parsed(line).perspective, String.raw`store\front`);
});

test("rejects an unknown metadata escape", () => {
  const line = stamp.replace("perspective: storefront", String.raw`perspective: store\qfront`);
  assert.match(rejected(line).message, /escape/);
});

test("rejects a trailing metadata backslash", () => {
  const line = stamp.replace("source_refs: all", "source_refs: all\\");
  assert.match(rejected(line).message, /backslash/);
});

test("rejects a duplicate metadata key", () => {
  const diagnostic = rejected(`${stamp} | profile: compact`);
  assert.equal(diagnostic.ruleId, "DM-META-004");
});

test("identifies a duplicate metadata extension key", () => {
  const diagnostic = rejected(`${stamp} | x-note: first | x-note: second`);
  assert.equal(diagnostic.ruleId, "DM-META-004");
  assert.match(diagnostic.message, /extension key 'x-note'/);
});

test("accepts lowercase metadata extension keys after the standard keys", () => {
  const value = parsed(`${stamp} | x-a: first | x-route.v2_name: second`);
  assert.equal(value["x-a"], "first");
  assert.equal(value["x-route.v2_name"], "second");
});

test("rejects invalid metadata extension key spellings", () => {
  for (const key of ["x-", "x-Upper", "x-_leading", "x-bad+key"]) {
    assert.equal(rejected(`${stamp} | ${key}: value`).ruleId, "DM-META-001", key);
  }
});

test("rejects an unknown standard key for a pre-1.0 declaration", () => {
  assert.equal(rejected(`${stamp} | future: value`).ruleId, "DM-META-001");
});

test("preserves the supplied source location in metadata diagnostics", () => {
  const diagnostic = rejected({ text: `${stamp} | profile: compact`, file: "channels/orders.md", line: 17 });
  assert.equal(diagnostic.file, "channels/orders.md");
  assert.equal(diagnostic.line, 17);
});
