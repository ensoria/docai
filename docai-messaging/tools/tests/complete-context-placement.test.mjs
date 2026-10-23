import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
// Independent source-owner to publication-path choices, not emitted-row snapshots.
const placement = {
  workflows: [
    { id: "alpha-delivery", details: "workflows/alpha-delivery.md" },
    { id: "alpha-observability", details: "workflows/alpha-observability.md" },
    { id: "state-none", details: "workflows/state-none.md" },
    { id: "state-unknown", details: "workflows/state-unknown.md" },
    { id: "state-unsupported", details: "workflows/state-unsupported.md" }
  ],
  referenceMaterials: [{ id: "middle-operations", details: "references/middle-operations.md" }]
};

function copyCandidate(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "docai-context-placement-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.cpSync(candidate, directory, { recursive: true });
  const manifestFile = path.join(directory, "source/projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  manifest.publicationPolicy.contextPlacement = structuredClone(placement);
  return { directory, manifestFile, manifest };
}

function snapshot(directory, relative = "") {
  return Object.fromEntries(fs.readdirSync(path.join(directory, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.join(relative, entry.name);
      return entry.isDirectory() ? Object.entries(snapshot(directory, name))
        : [[name, fs.readFileSync(path.join(directory, name))]];
    }));
}

function checkCandidate(input, status, pattern = /contextPlacement/) {
  const { directory, manifestFile, manifest } = input;
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
  if (status !== 0) assert.match(result.stderr, pattern);
  assert.doesNotMatch(result.stderr, /TypeError|SyntaxError/);
  assert.deepEqual(snapshot(directory), before);
}

function relocate(input, group, id, declared) {
  const entry = input.manifest.publicationPolicy.contextPlacement[group].find((entry) => entry.id === id);
  const from = entry.details;
  const to = `${group === "workflows" ? "workflows" : "references"}/relocated-${id}.md`;
  for (const profile of ["full", "compact"]) {
    const root = path.join(input.directory, profile);
    fs.renameSync(path.join(root, from), path.join(root, to));
    const update = (directory) => {
      for (const child of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, child.name);
        if (child.isDirectory()) update(file);
        else {
          const text = fs.readFileSync(file, "utf8");
          if (text.includes(from)) {
            const updated = text.replaceAll(from, to).replace(
              /(?:workflows|references)\/[A-Za-z0-9._/-]+\.md(?:, (?:workflows|references)\/[A-Za-z0-9._/-]+\.md)+/g,
              (list) => list.split(", ").sort().join(", ")
            );
            fs.writeFileSync(file, updated);
          }
        }
      }
    };
    update(root);
  }
  if (declared) entry.details = to;
  return to;
}

test("context placement accepts independently authored owner paths", (t) => {
  checkCandidate(copyCandidate(t), 0);
});

for (const [label, mutate] of [
  ["missing block", (policy) => { delete policy.contextPlacement; }],
  ["null block", (policy) => { policy.contextPlacement = null; }],
  ["array block", (policy) => { policy.contextPlacement = []; }],
  ["unknown group", (policy) => { policy.contextPlacement.channels = []; }]
]) {
  test(`context placement rejects ${label}`, (t) => {
    const input = copyCandidate(t);
    mutate(input.manifest.publicationPolicy);
    checkCandidate(input, 1);
  });
}

for (const group of ["workflows", "referenceMaterials"]) {
  for (const [label, mutate] of [
    ["missing group", (policy) => { delete policy[group]; }],
    ["object group", (policy) => { policy[group] = {}; }],
    ["empty group", (policy) => { policy[group] = []; }],
    ["null entry", (policy) => { policy[group][0] = null; }],
    ["missing owner", (policy) => { delete policy[group][0].id; }],
    ["empty owner", (policy) => { policy[group][0].id = ""; }],
    ["non-string owner", (policy) => { policy[group][0].id = 1; }],
    ["unknown owner", (policy) => { policy[group][0].id = "not-declared"; }],
    ["duplicate owner", (policy) => { policy[group].push({ ...policy[group][0], details: policy[group][0].details.replace(".md", "-other.md") }); }],
    ["duplicate path", (policy) => { policy[group].push({ ...policy[group][0], id: "other" }); }],
    ["missing path", (policy) => { delete policy[group][0].details; }],
    ["non-string path", (policy) => { policy[group][0].details = []; }],
    ["traversal path", (policy) => { policy[group][0].details = "../outside.md"; }],
    ["wrong kind path", (policy) => { policy[group][0].details = group === "workflows" ? "references/other.md" : "workflows/other.md"; }],
    ["wrong extension", (policy) => { policy[group][0].details = policy[group][0].details.replace(".md", ".txt"); }],
    ["unknown entry field", (policy) => { policy[group][0].fallback = true; }]
  ]) {
    test(`context placement ${group} rejects ${label}`, (t) => {
      const input = copyCandidate(t);
      mutate(input.manifest.publicationPolicy.contextPlacement);
      checkCandidate(input, 1);
    });
  }
  for (const { id } of placement[group]) {
    test(`context placement ${id} rejects policy-only relocation`, (t) => {
      const input = copyCandidate(t);
      input.manifest.publicationPolicy.contextPlacement[group].find((entry) => entry.id === id)
        .details = `${group === "workflows" ? "workflows" : "references"}/other-${id}.md`;
      checkCandidate(input, 1);
    });
    for (const declared of [false, true]) {
      test(`context placement ${id} ${declared ? "accepts matching" : "rejects output-only"} relocation`, (t) => {
        const input = copyCandidate(t);
        relocate(input, group, id, declared);
        checkCandidate(input, declared ? 0 : 1);
      });
    }
  }
}

test("context placement ignores declaration order", (t) => {
  const input = copyCandidate(t);
  input.manifest.publicationPolicy.contextPlacement.workflows.reverse();
  checkCandidate(input, 0);
});

test("context placement rejects paths swapped between source owners", (t) => {
  const input = copyCandidate(t);
  const entries = input.manifest.publicationPolicy.contextPlacement.workflows;
  [entries[0].details, entries[1].details] = [entries[1].details, entries[0].details];
  checkCandidate(input, 1, /Workflow labels/);
});

for (const [group, id] of [["workflows", "alpha-delivery"], ["referenceMaterials", "middle-operations"]]) {
  test(`storefront source selection ${group === "workflows" ? "resolves relocated Workflow" : "preserves relocated Reference consumer boundary"}: ${id}`, (t) => {
    const input = copyCandidate(t);
    const target = relocate(input, group, id, true);
    const sourceFile = path.join(input.directory, "source/storefront-behavior.json");
    const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
    source.operationBehavior.receiveOrderCreated.supplementalContexts = [id];
    fs.writeFileSync(sourceFile, JSON.stringify(source));
    input.manifest.sources.find((entry) => entry.location === "storefront-behavior.json").sha256
      = `sha256:${createHash("sha256").update(fs.readFileSync(sourceFile)).digest("hex")}`;
    for (const profile of ["full", "compact"]) {
      const root = path.join(input.directory, profile);
      const catalogFile = path.join(root, "indexes/operations-broad.md");
      const catalog = fs.readFileSync(catalogFile, "utf8");
      const row = catalog.split("\n").find((line) => line.startsWith("| RECEIVE | orders.events |"));
      assert.ok(row);
      const cells = row.split("|");
      cells[8] = ` ${target} `;
      fs.writeFileSync(catalogFile, catalog.replace(row, cells.join("|")));
      const channelFile = path.join(root, "channels/orders.md");
      const text = fs.readFileSync(channelFile, "utf8").replace(
        "source_refs: storefront-asyncapi-3.1.0, storefront-behavior", "source_refs: all"
      );
      const at = text.indexOf("## RECEIVE orders.events (receiveOrderCreated)");
      assert.ok(at > 0);
      const next = text.indexOf("\n## ", at + 1);
      const end = next < 0 ? text.indexOf("> docai-identity:") : next;
      const body = text.slice(at, end);
      const related = group === "workflows" ? target : "none";
      assert.ok(body.includes("### Related\n\nnone"));
      fs.writeFileSync(channelFile, text.slice(0, at) + body.replace("### Related\n\nnone",
        `### Related\n\n${related}`) + text.slice(end));
    }
    checkCandidate(input, group === "workflows" ? 0 : 1, /Reference Material/);
  });
}

for (const [group, id, from, to, pattern] of [
  ["workflows", "alpha-delivery", "Alpha delivery across operation boundaries", "Unsourced alpha delivery", /Workflow labels/],
  ["workflows", "state-unknown", "Validate an unresolved workflow after every required fact is supplied.",
    "Validate another unresolved workflow after every required fact is supplied.", /state-unknown/],
  ["referenceMaterials", "middle-operations", "Use only synthetic identifiers when recording examples.",
    "Use unsourced identifiers when recording examples.", /Reference Material/]
]) {
  // Reference content is a raw fenced block; mutate an actual source-derived line, not its wrapper.
  test(`relocated ${id} still rejects changed source content`, (t) => {
    const input = copyCandidate(t);
    const target = relocate(input, group, id, true);
    for (const profile of ["full", "compact"]) {
      const file = path.join(input.directory, profile, target);
      const text = fs.readFileSync(file, "utf8");
      const changed = text.replace(from, to);
      assert.notEqual(changed, text, "mutation must reach source-derived content");
      fs.writeFileSync(file, changed);
    }
    checkCandidate(input, 1, pattern);
  });
}
