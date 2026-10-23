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
// Independent publication decisions, not extracted from the projected catalogs.
const placement = {
  sourceShards: [
    { details: "indexes/sources-contexts-behavior.md", members: [
      "complete-contexts", "complete-representations", "storefront-behavior"
    ] },
    { details: "indexes/sources-asyncapi.md", members: ["storefront-asyncapi-3.1.0"] }
  ],
  operationShards: [
    { details: "indexes/operations-broad.md", members: [
      "a-operation", "receiveOrderCreated", "sendCreateOrder", "r-csv-operation",
      "r-json-original-operation", "r-json-reuse-operation", "r-raw-operation",
      "r-tagged-operation", "r-untagged-operation", "z-operation"
    ] },
    { details: "indexes/operations-middle.md", members: ["m-operation"] }
  ]
};

function copyCandidate(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "docai-catalog-placement-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.cpSync(candidate, directory, { recursive: true });
  const manifestFile = path.join(directory, "source/projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  manifest.publicationPolicy.catalogPlacement = structuredClone(placement);
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

function checkCandidate(input, status) {
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
    assert.match(result.stderr, /Complete catalog placement: full:/);
    assert.match(result.stderr, /Complete catalog placement: compact:/);
  }
  assert.doesNotMatch(result.stderr, /TypeError|SyntaxError/);
  assert.deepEqual(snapshot(directory), before, "checker must be read-only");
}

function replaceOnce(file, from, to) {
  const text = fs.readFileSync(file, "utf8");
  assert.equal(text.split(from).length - 1, 1);
  fs.writeFileSync(file, text.replace(from, to));
}

test("catalog placement accepts the independently declared current allocation", (t) => {
  checkCandidate(copyCandidate(t), 0);
});

for (const [label, mutate] of [
  ["missing block", (policy) => { delete policy.catalogPlacement; }],
  ["null block", (policy) => { policy.catalogPlacement = null; }],
  ["array block", (policy) => { policy.catalogPlacement = []; }],
  ["unknown group", (policy) => { policy.catalogPlacement.workflowShards = []; }],
  ["swapped kinds", (policy) => {
    const value = policy.catalogPlacement;
    [value.sourceShards, value.operationShards] = [value.operationShards, value.sourceShards];
  }]
]) {
  test(`catalog placement rejects ${label}`, (t) => {
    const input = copyCandidate(t);
    mutate(input.manifest.publicationPolicy);
    checkCandidate(input, 1);
  });
}

for (const kind of ["sourceShards", "operationShards"]) {
  for (const [label, mutate] of [
    ["missing group", (policy) => { delete policy[kind]; }],
    ["null group", (policy) => { policy[kind] = null; }],
    ["object group", (policy) => { policy[kind] = {}; }],
    ["empty group", (policy) => { policy[kind] = []; }],
    ["missing shard", (policy) => { policy[kind].pop(); }],
    ["duplicate path", (policy) => { policy[kind][1].details = policy[kind][0].details; }],
    ["missing path", (policy) => { delete policy[kind][0].details; }],
    ["null path", (policy) => { policy[kind][0].details = null; }],
    ["traversal path", (policy) => { policy[kind][0].details = "../outside.md"; }],
    ["null entry", (policy) => { policy[kind][0] = null; }],
    ["unknown entry field", (policy) => { policy[kind][0].fallback = true; }],
    ["missing members", (policy) => { delete policy[kind][0].members; }],
    ["null members", (policy) => { policy[kind][0].members = null; }],
    ["string members", (policy) => { policy[kind][0].members = "all"; }],
    ["empty members", (policy) => { policy[kind][0].members = []; }],
    ["duplicate member", (policy) => { policy[kind][0].members.push(policy[kind][0].members[0]); }],
    ["member in two shards", (policy) => { policy[kind][1].members.push(policy[kind][0].members[0]); }],
    ["non-string member", (policy) => { policy[kind][0].members[0] = 1; }],
    ["empty member", (policy) => { policy[kind][0].members[0] = ""; }],
    ["padded member", (policy) => { policy[kind][0].members[0] += " "; }],
    ["multiline member", (policy) => { policy[kind][0].members[0] += "\nnext"; }],
    ["missing member", (policy) => { policy[kind][0].members.pop(); }],
    ["unknown member", (policy) => { policy[kind][0].members.push("not-declared"); }],
    ["swapped memberships", (policy) => {
      [policy[kind][0].members, policy[kind][1].members] = [policy[kind][1].members, policy[kind][0].members];
    }]
  ]) {
    test(`catalog placement ${kind} rejects ${label}`, (t) => {
      const input = copyCandidate(t);
      mutate(input.manifest.publicationPolicy.catalogPlacement);
      checkCandidate(input, 1);
    });
  }

  test(`catalog placement ${kind} ignores declaration and member order`, (t) => {
    const input = copyCandidate(t);
    const entries = input.manifest.publicationPolicy.catalogPlacement[kind];
    entries.reverse();
    entries.forEach((entry) => entry.members.reverse());
    checkCandidate(input, 0);
  });

  for (const { details } of placement[kind]) {
    for (const matching of [false, true]) {
      test(`catalog placement ${kind} ${details} ${matching ? "accepts matching" : "rejects output-only"} relocation`, (t) => {
        const input = copyCandidate(t);
        const revised = details.replace(".md", "-relocated.md");
        for (const profile of ["full", "compact"]) {
          const root = path.join(input.directory, profile);
          fs.renameSync(path.join(root, details), path.join(root, revised));
          replaceOnce(path.join(root, "INDEX.md"), details, revised);
        }
        input.manifest.publicationPolicy.catalogSummaries[kind]
          .find((entry) => entry.details === details).details = revised;
        if (matching) input.manifest.publicationPolicy.catalogPlacement[kind]
          .find((entry) => entry.details === details).details = revised;
        checkCandidate(input, matching ? 0 : 1);
      });
    }
    test(`catalog placement ${kind} ${details} rejects policy-only relocation`, (t) => {
      const input = copyCandidate(t);
      input.manifest.publicationPolicy.catalogPlacement[kind]
        .find((entry) => entry.details === details).details = details.replace(".md", "-relocated.md");
      checkCandidate(input, 1);
    });
  }

  for (const matching of [false, true]) {
    test(`catalog placement ${kind} ${matching ? "accepts matching" : "rejects output-only"} membership swap`, (t) => {
      const input = copyCandidate(t);
      const [left, right] = placement[kind].map((entry) => entry.details);
      for (const profile of ["full", "compact"]) {
        const root = path.join(input.directory, profile);
        const a = fs.readFileSync(path.join(root, left));
        const b = fs.readFileSync(path.join(root, right));
        fs.writeFileSync(path.join(root, left), b);
        fs.writeFileSync(path.join(root, right), a);
        const index = path.join(root, "INDEX.md");
        const content = fs.readFileSync(index, "utf8");
        fs.writeFileSync(index, content.replaceAll(left, "SWAP").replaceAll(right, left).replaceAll("SWAP", right));
      }
      for (const entry of input.manifest.publicationPolicy.catalogSummaries[kind]) {
        entry.details = entry.details === left ? right : left;
      }
      if (matching) {
        const entries = input.manifest.publicationPolicy.catalogPlacement[kind];
        [entries[0].members, entries[1].members] = [entries[1].members, entries[0].members];
      }
      checkCandidate(input, matching ? 0 : 1);
    });
  }
}
