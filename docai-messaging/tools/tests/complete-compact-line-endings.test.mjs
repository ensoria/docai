import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateCompleteFieldDefaults } from "../lib/validators/complete-field-defaults.mjs";
import { validateCompleteSameAs } from "../lib/validators/complete-same-as.mjs";
import { restampDocumentSet } from "../restamp-document-set.mjs";
import { scanUtf8Lines } from "../lib/identity.mjs";

const candidate = fileURLToPath(new URL("../../fixtures/complete-candidates/v0.17.1/", import.meta.url));
const checker = fileURLToPath(new URL("../check-complete-fixtures.mjs", import.meta.url));
const example = '{"n":9007199254740993,"text":"Cafe\u0301\\r\\nvalue"}';
const fullTable = ["| Field | Type | Required | Nullable | Constraints / Meaning |",
  "|---|---|---|---|---|", "| n | int | yes | no | Exact number |",
  "| text | string | yes | no | Decomposed Unicode |"].join("\n");
const compactTable = ["**field_defaults**: Required=yes | Nullable=no", "",
  "| Field | Type | Constraints / Meaning |", "|---|---|---|",
  "| n | int | Exact number |", "| text | string | Decomposed Unicode |"].join("\n");
const reference = "**same_as**: Operation first Message original Payload application/json";
const representation = (table) => ["**media_type**: application/json", "",
  "**payload_nullable**: no", "", "```json", example, "```", "", table].join("\n");
const endings = { LF: "\n", CRLF: "\r\n", CR: "\r", mixed: null };
function withEndings(text, name) {
  let index = 0;
  // Never join a CR terminator immediately to LF: that would erase a blank line.
  return text.replace(/\n/g, () => endings[name] ?? ["\r\n", "\n", "\r\n", "\r"][index++ % 4]);
}
function input(mode, ending, mutate = (text) => text) {
  const source = mutate(["## SEND events (first)", "", "### Message original", "", "#### Payload", "",
    "**payload_required**: yes", "", representation(mode === "same-as" ? fullTable : compactTable),
    "", "## SEND events (second)", "", "### Message reused", "", "#### Payload", "",
    "**payload_required**: yes", "", mode === "defaults" ? representation(fullTable) : reference,
    "", "> docai-identity: fixture-trailer", ""].join("\n"));
  const content = withEndings(source, ending);
  return { files: [{ path: "channels/logical-lines.md", content, bytes: Buffer.from(content),
    identityLine: source.split("\n").findIndex((line) => line.startsWith("> docai-identity:")) + 1,
    metadata: { profile: "compact", "x-retrieval-unit": "channel-file" } }] };
}

for (const ending of Object.keys(endings)) {
  test(`compact logical lines ${ending}: leaves files without defaults untouched`, () => {
    const set = input("same-as", ending);
    const result = validateCompleteFieldDefaults(set);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.expandedDocumentSet.files[0], set.files[0]);
  });
  for (const mode of ["same-as", "defaults", "combined"]) {
    test(`compact logical lines ${ending}: expands ${mode} without mutating input`, () => {
      const set = input(mode, ending);
      const before = structuredClone(set);
      const defaults = validateCompleteFieldDefaults(set);
      const result = validateCompleteSameAs(defaults.expandedDocumentSet);
      assert.deepEqual(defaults.diagnostics, []);
      assert.deepEqual(result.diagnostics, []);
      const view = result.expandedDocumentSet.files[0];
      assert.equal(view.content.split(fullTable).length - 1, 2);
      assert.equal(view.content.split(example).length - 1, 2);
      assert.doesNotMatch(view.content, /\*\*(?:same_as|field_defaults)\*\*/);
      assert.equal(view.content.includes("\r"), false);
      assert.deepEqual(view.bytes, set.files[0].bytes);
      assert.equal(set.files[0].content, before.files[0].content);
      assert.deepEqual(set.files[0].bytes, Buffer.from(before.files[0].bytes));
      assert.equal(set.files[0].identityLine, before.files[0].identityLine);
      assert.equal(view.content.split("\n")[view.identityLine - 1], "> docai-identity: fixture-trailer");
      assert.deepEqual(set.files[0].metadata, before.files[0].metadata);
    });
  }
  for (const [label, mutate, expected] of [
    ["missing owner", (text) => text.replace(reference, reference.replace("first", "absent")), /earlier expanded/],
    ["forward target", (text) => {
      const at = text.indexOf("## SEND events (second)");
      const trailer = text.indexOf("> docai-identity:");
      return text.slice(at, trailer) + text.slice(0, at) + text.slice(trailer);
    }, /earlier expanded/],
    ["unknown target", (text) => text.replace("**payload_nullable**: no", "**payload_nullable**: unknown"), /complete structured/],
    ["adjacent content", (text) => text.replace(reference, `${reference}\n\nextra representation content`), /adjacent representation/]
  ]) {
    test(`compact logical lines ${ending}: rejects ${label}`, () => {
      const set = input("combined", ending, mutate);
      const defaults = validateCompleteFieldDefaults(set);
      assert.deepEqual(defaults.diagnostics, []);
      const result = validateCompleteSameAs(defaults.expandedDocumentSet);
      assert.ok(result.diagnostics.length > 0);
      assert.ok(result.diagnostics.every((entry) => entry.ruleId === "DM-PROFILE-005"));
      assert.ok(result.diagnostics.some((entry) => expected.test(entry.message)), JSON.stringify(result.diagnostics));
    });
  }
}

test("compact logical lines: same-as works without an optional identityLine coordinate", () => {
  const set = input("same-as", "LF");
  const file = set.files[0];
  delete file.identityLine;
  file.content = file.content.slice(0, file.content.indexOf("> docai-identity:"));
  file.bytes = Buffer.from(file.content);
  const result = validateCompleteSameAs(set);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.expandedDocumentSet.files[0].content.split(fullTable).length - 1, 2);
});

function snapshot(root, prefix = "") {
  return Object.fromEntries(fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory() ? Object.entries(snapshot(root, relative))
      : [[relative, fs.readFileSync(path.join(root, relative))]];
  }));
}
function withoutTrailer(bytes) {
  const line = scanUtf8Lines(bytes).lines.findLast((entry) => entry.end > entry.start);
  return Buffer.concat([bytes.subarray(0, line.start), bytes.subarray(line.end)]);
}
for (const ending of Object.keys(endings)) {
  test(`compact logical lines ${ending}: restamps and checks the complete candidate read-only`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-compact-lines-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.cpSync(candidate, root, { recursive: true });
    const compact = path.join(root, "compact");
    const file = path.join(compact, "channels", "representations.md");
    fs.writeFileSync(file, withEndings(fs.readFileSync(file, "utf8"), ending));
    const manifest = path.join(root, "source", "projection-input-manifest.json");
    const before = snapshot(root);
    restampDocumentSet(compact, manifest, { write: true });
    const after = snapshot(root);
    assert.deepEqual(Object.keys(after), Object.keys(before));
    for (const [name, bytes] of Object.entries(before)) {
      assert.deepEqual(name.startsWith("compact/") ? withoutTrailer(after[name]) : after[name],
        name.startsWith("compact/") ? withoutTrailer(bytes) : bytes, name);
    }
    assert.equal(restampDocumentSet(compact, manifest).changed, false);
    const checked = spawnSync(process.execPath, [checker, root], { encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
    assert.deepEqual(snapshot(root), after);
  });
}
