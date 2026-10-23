import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { restampDocumentSet } from "../restamp-document-set.mjs";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../lib/complete-example-adapters.mjs";
import { validateCompleteProfilePair } from "../lib/validators/complete-profiles.mjs";

const candidate = fileURLToPath(new URL("../../fixtures/complete-candidates/v0.17.1/", import.meta.url));
const checker = fileURLToPath(new URL("../check-complete-fixtures.mjs", import.meta.url));
// Authored independently of projected file names and routing facts.
const placement = [
  { details: "channels/alpha.md", members: ["a-operation"] },
  { details: "channels/middle.md", members: ["m-operation"] },
  { details: "channels/orders.md", members: ["receiveOrderCreated", "sendCreateOrder"] },
  { details: "channels/representations.md", members: [
    "r-csv-operation", "r-json-original-operation", "r-json-reuse-operation", "r-raw-operation",
    "r-tagged-operation", "r-untagged-operation"
  ] },
  { details: "channels/zeta.md", members: ["z-operation"] }
];

function copyCandidate(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "docai-channel-placement-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.cpSync(candidate, directory, { recursive: true });
  const manifestFile = path.join(directory, "source/projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  manifest.publicationPolicy.channelPlacement = structuredClone(placement);
  return { directory, manifest, manifestFile };
}

function snapshot(directory, relative = "") {
  return Object.fromEntries(fs.readdirSync(path.join(directory, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.join(relative, entry.name);
      return entry.isDirectory() ? Object.entries(snapshot(directory, name))
        : [[name, fs.readFileSync(path.join(directory, name))]];
    }));
}

function checkCandidate(input, status, diagnostic = "Complete channel placement:") {
  const { directory, manifest, manifestFile } = input;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(directory, profile), manifestFile, { write: true });
  }
  const sets = ["full", "compact"].map((profile) => loadDocumentSet(path.join(directory, profile)));
  const options = loadTrustedCompleteExampleAdapterOptions(directory, sets);
  assert.deepEqual(validateCompleteProfilePair(...sets, options).diagnostics, []);
  const before = snapshot(directory);
  const result = spawnSync(process.execPath, [checker, directory], { encoding: "utf8" });
  assert.equal(result.status, status, result.stderr || result.stdout);
  if (status !== 0) {
    assert.ok(result.stderr.includes(diagnostic), result.stderr);
    if (diagnostic === "Complete channel placement:") {
      assert.match(result.stderr, /Complete channel placement: full:/);
      assert.match(result.stderr, /Complete channel placement: compact:/);
    }
  }
  assert.doesNotMatch(result.stderr, /TypeError|SyntaxError/);
  assert.deepEqual(snapshot(directory), before);
}

function relocate(input, details, declared) {
  const revised = details.replace(".md", "-relocated.md");
  for (const profile of ["full", "compact"]) {
    const root = path.join(input.directory, profile);
    fs.renameSync(path.join(root, details), path.join(root, revised));
    let changes = 0;
    for (const name of ["operations-broad.md", "operations-middle.md"]) {
      const file = path.join(root, "indexes", name);
      const text = fs.readFileSync(file, "utf8");
      if (text.includes(`### ${details}`)) {
        changes += 1;
        fs.writeFileSync(file, text.replace(`### ${details}`, `### ${revised}`));
      }
    }
    assert.equal(changes, 1);
  }
  if (declared) input.manifest.publicationPolicy.channelPlacement
    .find((entry) => entry.details === details).details = revised;
  return revised;
}

test("channel placement accepts the independent current policy", (t) => {
  checkCandidate(copyCandidate(t), 0);
});

for (const [label, mutate] of [
  ["missing policy", (policy) => { delete policy.channelPlacement; }],
  ["null policy", (policy) => { policy.channelPlacement = null; }],
  ["object policy", (policy) => { policy.channelPlacement = {}; }],
  ["string policy", (policy) => { policy.channelPlacement = "none"; }],
  ["empty policy", (policy) => { policy.channelPlacement = []; }],
  ["missing file", (policy) => { policy.channelPlacement.pop(); }],
  ["extra file", (policy) => { policy.channelPlacement.push({ details: "channels/extra.md", members: ["extra"] }); }],
  ["duplicate file", (policy) => { policy.channelPlacement.push(structuredClone(policy.channelPlacement[0])); }],
  ["null entry", (policy) => { policy.channelPlacement[0] = null; }],
  ["unknown field", (policy) => { policy.channelPlacement[0].fallback = true; }],
  ["missing details", (policy) => { delete policy.channelPlacement[0].details; }],
  ["non-string details", (policy) => { policy.channelPlacement[0].details = 1; }],
  ["traversal path", (policy) => { policy.channelPlacement[0].details = "channels/../alpha.md"; }],
  ["wrong directory", (policy) => { policy.channelPlacement[0].details = "workflows/alpha.md"; }],
  ["wrong extension", (policy) => { policy.channelPlacement[0].details = "channels/alpha.txt"; }],
  ["missing members", (policy) => { delete policy.channelPlacement[0].members; }],
  ["null members", (policy) => { policy.channelPlacement[0].members = null; }],
  ["string members", (policy) => { policy.channelPlacement[0].members = "all"; }],
  ["empty members", (policy) => { policy.channelPlacement[0].members = []; }],
  ["non-string member", (policy) => { policy.channelPlacement[0].members[0] = null; }],
  ["empty member", (policy) => { policy.channelPlacement[0].members[0] = ""; }],
  ["padded member", (policy) => { policy.channelPlacement[0].members[0] += " "; }],
  ["multiline member", (policy) => { policy.channelPlacement[0].members[0] += "\nnext"; }],
  ["duplicate member", (policy) => { policy.channelPlacement[0].members.push("a-operation"); }],
  ["member in two files", (policy) => { policy.channelPlacement[1].members.push("a-operation"); }],
  ["unknown member", (policy) => { policy.channelPlacement[0].members.push("not-declared"); }],
  ["swapped memberships", (policy) => {
    [policy.channelPlacement[0].members, policy.channelPlacement[1].members]
      = [policy.channelPlacement[1].members, policy.channelPlacement[0].members];
  }]
]) {
  test(`channel placement rejects ${label}`, (t) => {
    const input = copyCandidate(t);
    mutate(input.manifest.publicationPolicy);
    checkCandidate(input, 1);
  });
}

test("channel placement ignores declaration and member order", (t) => {
  const input = copyCandidate(t);
  input.manifest.publicationPolicy.channelPlacement.reverse().forEach((entry) => entry.members.reverse());
  checkCandidate(input, 0);
});

for (const { details } of placement) {
  test(`channel placement ${details} rejects policy-only relocation`, (t) => {
    const input = copyCandidate(t);
    input.manifest.publicationPolicy.channelPlacement.find((entry) => entry.details === details)
      .details = details.replace(".md", "-relocated.md");
    checkCandidate(input, 1);
  });
  for (const declared of [false, true]) {
    test(`channel placement ${details} ${declared ? "accepts matching" : "rejects output-only"} relocation`, (t) => {
      const input = copyCandidate(t);
      relocate(input, details, declared);
      checkCandidate(input, declared ? 0 : 1);
    });
  }
}

for (const declared of [false, true]) {
  test(`channel placement ${declared ? "accepts matching" : "rejects output-only"} regrouping with representations`, (t) => {
    const input = copyCandidate(t);
    for (const profile of ["full", "compact"]) {
      const root = path.join(input.directory, profile);
      const from = path.join(root, "channels/zeta.md");
      const to = path.join(root, "channels/representations.md");
      const body = fs.readFileSync(from, "utf8");
      const operation = body.slice(body.indexOf("## RECEIVE"), body.lastIndexOf("> docai-identity:")).trimEnd();
      const text = fs.readFileSync(to, "utf8");
      fs.writeFileSync(to, text.replace("source_refs: complete-representations", "source_refs: all")
        .replace("> docai-identity:", `${operation}\n\n> docai-identity:`));
      fs.rmSync(from);
      const index = path.join(root, "indexes/operations-broad.md");
      const catalog = fs.readFileSync(index, "utf8");
      const at = catalog.indexOf("### channels/zeta.md");
      assert.ok(at > 0);
      const row = catalog.slice(at).split("\n").find((line) => line.startsWith("| RECEIVE | z.events |"));
      assert.ok(row);
      fs.writeFileSync(index, `${catalog.slice(0, at).trimEnd()}\n${row}\n\n${catalog.slice(catalog.lastIndexOf("> docai-identity:"))}`);
    }
    if (declared) {
      input.manifest.publicationPolicy.channelPlacement = input.manifest.publicationPolicy.channelPlacement
        .filter((entry) => entry.details !== "channels/zeta.md");
      input.manifest.publicationPolicy.channelPlacement
        .find((entry) => entry.details === "channels/representations.md").members.push("z-operation");
    }
    checkCandidate(input, declared ? 0 : 1);
  });
}

const expandedReuse = [
  "**media_type**: application/json", "", "**payload_nullable**: no", "", "```json",
  '{"status":"created","event_id":"evt_04"}', "```", "",
  "| Field | Type | Required | Nullable | Constraints / Meaning |", "|---|---|---|---|---|",
  "| $ | object | yes | no | Additional properties are forbidden. |",
  "| event_id | string | yes | no | Synthetic event identifier |",
  "| status | string | yes | no | Lifecycle status |"
].join("\n");
for (const [label, mutate, diagnostic] of [
  ["lost reuse and retrieval metadata", (text) => text.replace(" | x-retrieval-unit: channel-file", "")
    .replace("**same_as**: Operation r-json-original-operation Message json-original-message Payload application/json",
      expandedReuse), "same_as representative"],
  ["multiline target example", (text) => text.replace('{"status":"created","event_id":"evt_04"}',
    '{\n  "status":"created",\n  "event_id":"evt_04"\n}'), "one-line JSON"],
  ["changed raw source contract", (text) => text.replace("Opaque receipt bytes are limited to 2 MiB",
    "Opaque receipt bytes are limited to 3 MiB"), "r-raw-operation representation raw contract"]
]) {
  test(`relocated representations still reject ${label}`, (t) => {
    const input = copyCandidate(t);
    const revised = relocate(input, "channels/representations.md", true);
    for (const profile of label === "changed raw source contract" ? ["full", "compact"] : ["compact"]) {
      const file = path.join(input.directory, profile, revised);
      const text = fs.readFileSync(file, "utf8");
      const changed = mutate(text);
      assert.notEqual(changed, text, "mutation must affect the intended content");
      fs.writeFileSync(file, changed);
    }
    checkCandidate(input, 1, diagnostic);
  });
}
