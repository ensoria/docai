import test from "node:test";
import assert from "node:assert/strict";
import { parseDocsPath } from "../lib/paths.mjs";

function parsed(value) {
  const result = parseDocsPath(value);
  assert.deepEqual(result.diagnostics, []);
  return result.value;
}

function rejected(value) {
  const result = parseDocsPath(value);
  assert.equal(result.value, null);
  assert.equal(result.diagnostics.length, 1);
  return result.diagnostics[0];
}

test("parses a docs-root-relative path without normalization", () => {
  assert.deepEqual(parsed("channels/orders.v2.md"), {
    path: "channels/orders.v2.md",
    kind: "docs-root-relative",
    sentinelCollision: false
  });
});

test("parses an INDEX profile link as a relative directory path", () => {
  assert.deepEqual(parsed("../../compact/"), {
    path: "../../compact/",
    kind: "profile-link",
    sentinelCollision: false
  });
});

test("reports the exact context-path none sentinel collision", () => {
  assert.equal(parsed("none").sentinelCollision, true);
  assert.equal(parsed("workflows/none.md").sentinelCollision, false);
});

test("rejects dot and dot-dot segments outside a profile-link prefix", () => {
  for (const value of ["./INDEX.md", "channels/../INDEX.md", "../compact/../full/"]) {
    assert.match(rejected(value).message, /segment/);
  }
});

test("rejects backslash path separators", () => {
  assert.match(rejected(String.raw`channels\orders.md`).message, /backslash/);
});

test("rejects path queries and fragments", () => {
  for (const value of ["channels/orders.md?view=full", "channels/orders.md#reply"]) {
    assert.match(rejected(value).message, /query|fragment/);
  }
});

test("rejects absolute and empty-segment paths", () => {
  for (const value of ["/INDEX.md", "channels//orders.md", "../"]) {
    assert.equal(rejected(value).ruleId, "DM-PARSE-003");
  }
});

test("preserves the supplied source location in path diagnostics", () => {
  const diagnostic = rejected({ text: "../bad.md", file: "INDEX.md", line: 4 });
  assert.equal(diagnostic.file, "INDEX.md");
  assert.equal(diagnostic.line, 4);
});
