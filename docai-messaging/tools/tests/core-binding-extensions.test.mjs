import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { validateCoreDocumentSet } from "../lib/validators/core.mjs";
import { check, copyCandidate, profiles } from "./helpers/complete-contributor-fixture.mjs";

const baseline = loadDocumentSet(fileURLToPath(new URL("../../fixtures/core/v0.17.1/valid/full/", import.meta.url)));
const extension = "**x-z**: note\n\n**x-a**: second note\n**x-a**: second note";
const scopes = [
  ["operation", "### Operation Bindings", "Operation Bindings", "DM-OP-004"],
  ["channel", "### Channel", "channel Bindings", "DM-OP-004"],
  ["message", "#### Bindings", "message Bindings OrderCreated", "DM-MSG-002"],
  ["reply channel", "#### Channel", "reply channel Bindings", "DM-REPLY-002"],
  ["reply message", "##### Bindings", "reply message Bindings OrderAccepted", "DM-MSG-002"]
];
function diagnostics(scope, body, { collapsed = false } = {}) {
  const set = structuredClone(baseline);
  const file = set.files.find((entry) => entry.path === "channels/orders.md");
  const [, heading] = scope;
  const channel = scope[0].endsWith("channel");
  const original = channel ? `${heading}\n\n- Parameters: none\n- Bindings: none` : `${heading}\n\nnone`;
  assert.ok(file.content.includes(original), scope[0]);
  const replacement = channel
    ? `${heading}\n\n- Parameters: none\n${collapsed ? "- Bindings: none" : `${"#".repeat(heading.indexOf(" ") + 1)} Bindings\n\n${body}`}`
    : `${heading}\n\n${body}`;
  file.content = file.content.replace(original, collapsed ? `${replacement}\n\n${body}` : replacement);
  for (const entry of set.files) {
    if (entry === file || entry.path === "INDEX.md") {
      if (body.includes("**unknown**:")) {
        entry.metadata.knowledge = "requires-input";
        entry.content = entry.content.replace("knowledge: complete", "knowledge: requires-input");
      }
      if (body.includes("**unsupported**:")) {
        entry.metadata.coverage = "requires-source";
        entry.content = entry.content.replace("coverage: complete", "coverage: requires-source");
      }
    }
    entry.bytes = Buffer.from(entry.content);
    entry.identityLine = entry.content.split("\n").findIndex((line) => line.startsWith("> docai-identity:")) + 1;
  }
  return validateCoreDocumentSet(set).diagnostics;
}

test("binding extension baseline is valid", () => assert.deepEqual(validateCoreDocumentSet(baseline).diagnostics, []));
for (const scope of scopes) {
  const [name, , unit, rule] = scope;
  for (const [state, body] of [
    ["none", "none"],
    ["unknown", "unknown\n**unknown**: binding facts unavailable"],
    ["replacement", `**unsupported**: replaces ${unit}: custom protocol`]
  ]) {
    test(`${name}: trailing extensions preserve ${state}`, () => {
      assert.deepEqual(diagnostics(scope, body), [], "core state itself is valid");
      assert.deepEqual(diagnostics(scope, `${body}\n\n${extension}`), []);
    });
  }
  test(`${name}: leading deviations and trailing extensions retain scope`, () => {
    assert.deepEqual(diagnostics(scope, `**deviation**: a note\nnone\n${extension}`), []);
  });
  test(`${name}: ordered contiguous table extensions remain valid`, () => {
    assert.deepEqual(diagnostics(scope, "| Protocol | Property | Value / Rule |\n|---|---|---|\n| test | key | value |\n**x-a**: note\n**x-z**: note"), []);
  });
  for (const [placement, tail] of [
    ["reversed", "\n**x-z**: note\n**x-a**: note"],
    ["nonadjacent", "\n\n**x-a**: note"]
  ]) {
    test(`${name}: ASCII-space-prefixed table rejects ${placement} extension tail`, () => {
      const body = " | Protocol | Property | Value / Rule | \n |---|---|---| \n | test | key | value | " + tail;
      assert.ok(diagnostics(scope, body).some((entry) => entry.ruleId === rule));
    });
  }
  if (!["message", "reply message"].includes(name)) {
    test(`${name}: ASCII-space-prefixed table retains ordered adjacent extension tail`, () => {
      assert.deepEqual(diagnostics(scope, " | Protocol | Property | Value / Rule | \n |---|---|---| \n | test | key | value | \n**x-a**: note\n**x-z**: note"), []);
    });
  }
  for (const [nameSuffix, body] of [
    ["early extension", "**x-a**: note\nnone"],
    ["missing core", "**x-a**: note"],
    ["split unknown", "unknown\n**x-a**: note\n**unknown**: missing facts"],
    ["nonadjacent unknown", "unknown\n\n**unknown**: missing facts\n**x-a**: note"],
    ["wrong replacement", "**unsupported**: replaces other Bindings: custom protocol\n**x-a**: note"],
    ["additional core", "none\n**x-a**: note\nnone"],
    ["empty marker", "none\n**x-a**: "],
    ["unordered table markers", "| Protocol | Property | Value / Rule |\n|---|---|---|\n| test | key | value |\n**x-z**: note\n**x-a**: note"],
    ["nonadjacent table marker", "| Protocol | Property | Value / Rule |\n|---|---|---|\n| test | key | value |\n\n**x-a**: note"]
  ]) {
    test(`${name}: rejects ${nameSuffix}`, () => {
      assert.ok(diagnostics(scope, body).some((entry) => entry.ruleId === rule), JSON.stringify(diagnostics(scope, body)));
    });
  }
  if (name.endsWith("channel")) {
    test(`${name}: collapsed Bindings allow trailing extensions`, () => {
      assert.deepEqual(diagnostics(scope, extension, { collapsed: true }), []);
    });
    test(`${name}: collapsed Bindings reject core after extension`, () => {
      const result = diagnostics(scope, "**x-a**: note\nnone", { collapsed: true });
      assert.ok(result.some((entry) => entry.ruleId === rule), JSON.stringify(result));
    });
  }
}

for (const replyChannel of [false, true]) test(`Complete profiles: fresh identities, ordinary validation and read-only source gate (reply Channel extension=${replyChannel})`, (t) => {
  const directory = copyCandidate(t);
  for (const profile of profiles) {
    const file = path.join(directory, profile, "channels/orders.md");
    const original = fs.readFileSync(file, "utf8");
    let matches = 0;
    const changed = original.replace(/(?:^#{3,5} (?:Operation )?Bindings\n\nnone|^- Bindings: none)$/gm, (match) => {
      matches += 1;
      return `${match}\n\n${extension}`;
    });
    assert.equal(matches, 8, `${profile}: all primary and reply binding scopes`);
    const reply = "#### Channel\n\n- Parameters: none\n- Bindings: none";
    assert.equal(changed.split(`${reply}\n\n${extension}`).length - 1, 1);
    fs.writeFileSync(file, replyChannel ? changed : changed.replace(`${reply}\n\n${extension}`, reply));
  }
  // The finite source comparator still requires the canonical Reply Channel text.
  // Both variants pass fresh stamping and ordinary full/compact validation first.
  check(directory, replyChannel ? 1 : 0, /Reply Channel differs from authoritative source/);
});
