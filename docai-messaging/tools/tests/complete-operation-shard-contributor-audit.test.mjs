import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { candidate, profiles, copyCandidate, replace, check, regroup, mutateSource, snapshot }
  from "./helpers/complete-contributor-fixture.mjs";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../lib/complete-example-adapters.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { auditCompleteOperationShardContributorClosure } from "../lib/complete-operation-shard-contributor-audit.mjs";
import { restampDocumentSet } from "../restamp-document-set.mjs";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("../check-complete-fixtures.mjs", import.meta.url));

function rejectsMalformedRouting(directory, diagnostic) {
  const before = snapshot(directory);
  for (const profile of profiles) {
    assert.throws(() => restampDocumentSet(path.join(directory, profile),
      path.join(directory, "source/projection-input-manifest.json"), { write: true }), diagnostic);
    assert.deepEqual(snapshot(directory), before, "failed writer is read-only");
  }
  // These intentionally invalid sets cannot be freshly stamped. The CLI must
  // retain the ordinary routing diagnostic (possibly alongside stale identity).
  const result = spawnSync(process.execPath, [checker, directory], { encoding: "utf8" });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, diagnostic);
  assert.doesNotMatch(result.stderr, /source_refs.*contributors|TypeError|SyntaxError/);
  assert.deepEqual(snapshot(directory), before, "ordinary-invalid checker is read-only");
}

const allOperations = ["a-operation", "m-operation", "z-operation", "receiveOrderCreated", "sendCreateOrder",
  "r-csv-operation", "r-json-original-operation", "r-json-reuse-operation", "r-raw-operation",
  "r-tagged-operation", "r-untagged-operation"];
const representationOperations = allOperations.filter((name) => name.startsWith("r-"));
const storefrontOperations = ["receiveOrderCreated", "sendCreateOrder"];

// Test-only allocator. Authored memberships/refs are inputs, not derived by the
// contributor code under test. Routing bounds follow these fixture's ASCII cells.
function allocate(directory, groups) {
  const manifestPath = path.join(directory, "source/projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const oldPaths = manifest.publicationPolicy.catalogPlacement.operationShards.map((entry) => entry.details);
  assert.deepEqual(groups.flatMap((group) => group.members).sort(), [...allOperations].sort());
  for (const profile of profiles) {
    const root = path.join(directory, profile);
    const originals = oldPaths.map((file) => fs.readFileSync(path.join(root, file), "utf8"));
    const rows = new Map(originals.flatMap((text) => text.split("\n")
      .filter((line) => /^\| (SEND|RECEIVE) \|/.test(line))
      .map((line) => {
        const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
        return [cells[2], cells];
      })));
    const header = originals[0].split("\n").find((line) => line.startsWith("| Action |"));
    const separator = originals[0].split("\n").find((line) => line.startsWith("|---"));
    const trailer = originals[0].slice(originals[0].lastIndexOf("> docai-identity:"));
    const routes = [];
    for (const [index, group] of groups.entries()) {
      const selected = group.members.map((name) => rows.get(name));
      assert.ok(selected.every(Boolean));
      const byChannel = new Map();
      for (const row of selected) {
        const operation = row[2];
        // Channel Details are authored separately by the channel placement policy.
        const channel = manifest.publicationPolicy.channelPlacement.find((entry) => entry.members.includes(operation)).details;
        if (!byChannel.has(channel)) byChannel.set(channel, []);
        byChannel.get(channel).push(row);
      }
      const sections = [...byChannel].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([channel, entries]) => `### ${channel}\n\n${header}\n${separator}\n`
          + entries.sort((a, b) => a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0)
            .map((row) => `| ${row.join(" | ")} |`).join("\n"));
      const metadata = originals[0].split("\n")[0].replace(/source_refs: .*$/, `source_refs: ${group.refs}`);
      fs.writeFileSync(path.join(root, group.details), `${metadata}\n\n# Messaging Operation Index\n\n## Operations\n\n`
        + sections.join("\n\n") + `\n\n${trailer}`);
      const range = (values) => { const sorted = [...values].sort(); return [sorted[0], sorted.at(-1)]; };
      const tasks = [...new Set(selected.map((row) => row[4]))].sort().join("; ");
      const actions = ["SEND", "RECEIVE"].filter((action) => selected.some((row) => row[0] === action)).join("; ");
      routes.push(`| ${[tasks, actions, ...range(selected.map((row) => row[1])),
        ...range(selected.map((row) => row[2])), ...range(selected.flatMap((row) => row[3].split("; "))),
        `Authored shard ${index + 1}`, group.details].join(" | ")} |`);
    }
    for (const old of oldPaths) if (!groups.some((group) => group.details === old)) fs.rmSync(path.join(root, old));
    const indexPath = path.join(root, "INDEX.md");
    const index = fs.readFileSync(indexPath, "utf8");
    const beginning = index.slice(0, index.indexOf("## Operation Shards"));
    const ending = index.slice(index.indexOf("## Workflows"));
    fs.writeFileSync(indexPath, beginning + "## Operation Shards\n\n"
      + "| Tasks | Actions | First channel | Last channel | First operation | Last operation | First message | Last message | Summary | Details |\n"
      + "|---|---|---|---|---|---|---|---|---|---|\n" + routes.join("\n") + "\n\n" + ending);
  }
  manifest.publicationPolicy.catalogPlacement.operationShards = groups.map(({ details, members }) => ({ details, members }));
  manifest.publicationPolicy.catalogSummaries.operationShards = groups.map(({ details }, index) => ({
    details, summary: `Authored shard ${index + 1}`
  }));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
}

function selectedShard(directory, members, refs, remainderRefs) {
  allocate(directory, [
    { details: "indexes/selected.md", members, refs },
    { details: "indexes/remainder.md", members: allOperations.filter((name) => !members.includes(name)), refs: remainderRefs }
  ]);
}

function preciseCandidate(t) {
  const directory = copyCandidate(t);
  for (const profile of profiles) {
    const relative = `${profile}/indexes/operations-middle.md`;
    if (fs.readFileSync(path.join(directory, relative), "utf8").split("\n")[0].endsWith("source_refs: all")) {
      replace(directory, relative, "source_refs: all", "source_refs: complete-contexts");
    }
  }
  return directory;
}

for (const [label, members, expected, remainderRefs, invalid] of [
  ["representation-only", representationOperations, "complete-representations",
    "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior", ["complete-contexts", "complete-contexts, complete-representations", "all"]],
  ["storefront-only", storefrontOperations, "storefront-asyncapi-3.1.0, storefront-behavior",
    "complete-contexts, complete-representations", ["storefront-asyncapi-3.1.0", "storefront-behavior", "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior", "all"]],
  ["synthetic mixed", ["a-operation", ...representationOperations], "complete-contexts, complete-representations",
    "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior",
    ["complete-contexts", "complete-representations", "complete-contexts, complete-representations, storefront-behavior", "all"]],
  ["context and storefront", ["a-operation", ...storefrontOperations], "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior",
    "complete-contexts, complete-representations", ["complete-contexts, storefront-asyncapi-3.1.0", "storefront-asyncapi-3.1.0, storefront-behavior", "all"]]
]) {
  for (const refs of [expected, ...invalid]) {
    test(`operation shard contributors ${label} ${refs === expected ? "accept" : "reject"} refs=${refs}`, (t) => {
      const directory = preciseCandidate(t);
      selectedShard(directory, members, refs, remainderRefs);
      check(directory, refs === expected ? 0 : 1, /selected\.md.*source_refs.*contributors/i);
    });
  }
}

for (const [refs, status] of [["all", 0], ["complete-contexts, complete-representations, storefront-asyncapi-3.1.0, storefront-behavior", 1],
  ["complete-contexts, complete-representations, storefront-asyncapi-3.1.0", 1]]) {
  test(`operation shard contributors all four sources refs=${refs}`, (t) => {
    const directory = preciseCandidate(t);
    for (const profile of profiles) replace(directory, `${profile}/indexes/operations-broad.md`,
      "source_refs: all", `source_refs: ${refs}`);
    check(directory, status, /operations-broad\.md.*source_refs.*contributors/i);
  });
}

test("operation shard contributors preserve rejection of a shared channel split across shards", (t) => {
  const directory = preciseCandidate(t);
  const manifestPath = path.join(directory, "source/projection-input-manifest.json");
  const originalManifest = fs.readFileSync(manifestPath);
  regroup(directory, { "z-operation": "channels/representations.md" }, {
    "channels/representations.md": "complete-contexts, complete-representations"
  });
  selectedShard(directory, representationOperations, "complete-representations",
    "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior");
  // Keep the already-bound projection manifest: this intentionally malformed
  // structure fails ordinary routing before publication/source policy is read.
  fs.writeFileSync(manifestPath, originalManifest);
  rejectsMalformedRouting(directory, /DM-IDX-003/);
});

test("operation shard contributors accept split and renamed context shards without context body propagation", (t) => {
  const directory = preciseCandidate(t);
  allocate(directory, [
    { details: "indexes/first.md", members: ["a-operation"], refs: "complete-contexts" },
    { details: "indexes/second.md", members: ["m-operation", "z-operation"], refs: "complete-contexts" },
    { details: "indexes/third.md", members: [...representationOperations, ...storefrontOperations],
      refs: "complete-representations, storefront-asyncapi-3.1.0, storefront-behavior" }
  ]);
  check(directory, 0);
});

test("operation shard contributors accept source registry and declaration order changes", (t) => {
  const directory = preciseCandidate(t);
  mutateSource(directory, "complete-contexts.json", (source) => {
    source.operations = Object.fromEntries(Object.entries(source.operations).reverse());
  });
  const file = path.join(directory, "source/projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(file));
  manifest.sources.reverse();
  manifest.publicationPolicy.catalogPlacement.operationShards.reverse();
  manifest.publicationPolicy.catalogPlacement.operationShards.forEach((entry) => entry.members.reverse());
  fs.writeFileSync(file, JSON.stringify(manifest));
  check(directory, 0);
});

function helperInput() {
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, "source/projection-input-manifest.json")));
  const sources = new Map(manifest.sources.map((entry) => [entry.sourceId,
    JSON.parse(fs.readFileSync(path.join(candidate, "source", entry.location)))]));
  const set = loadDocumentSet(path.join(candidate, "full"));
  const result = validateCompleteDocumentSet(set, loadTrustedCompleteExampleAdapterOptions(candidate, [set]));
  assert.deepEqual(result.diagnostics, []);
  const middle = set.files.find((file) => file.path === "indexes/operations-middle.md");
  middle.metadata.source_refs = "complete-contexts";
  return { sources, ids: manifest.sources.map((entry) => entry.sourceId), set, core: result.facts.core };
}

for (const [label, mutate] of [
  ["unknown row owner", (input) => input.core.operations.rows[0].operation = "unowned"],
  ["duplicate row", (input) => input.core.operations.rows.push(input.core.operations.rows[0])],
  ["missing row", (input) => input.core.operations.rows.pop()],
  ["unknown index path", (input) => input.core.operations.rows[0].indexPath = "indexes/unowned.md"],
  ["empty shard", (input) => input.core.operations.rows.forEach((row) => row.indexPath = "indexes/operations-broad.md")],
  ["missing route", (input) => input.core.operations.shards.pop()],
  ["duplicate route", (input) => input.core.operations.shards.push(input.core.operations.shards[0])],
  ["missing file", (input) => input.set.files = input.set.files.filter((file) => file.path !== "indexes/operations-middle.md")],
  ["duplicate file", (input) => input.set.files.push(input.set.files.find((file) => file.path === "indexes/operations-middle.md"))],
  ["extra file", (input) => input.set.files.push({ path: "indexes/extra.md", content: "# Messaging Operation Index\n\n## Operations\n" })]
]) {
  test(`operation shard contributors reject ${label} ownership`, () => {
    const input = helperInput();
    mutate(input);
    assert.match(auditCompleteOperationShardContributorClosure(input.sources, input.ids, input.set, input.core).join("\n"),
      /source_refs.*contributors.*ownership/);
  });
}

test("operation shard contributors leave flat routing to its existing owners", () => {
  const input = helperInput();
  const paths = input.core.operations.shards.map((entry) => entry.path);
  input.set.files = input.set.files.filter((file) => !paths.includes(file.path));
  input.core.operations.shards = [];
  input.core.operations.rows.forEach((row) => row.indexPath = "INDEX.md");
  assert.deepEqual(auditCompleteOperationShardContributorClosure(input.sources, input.ids, input.set, input.core), []);
});

test("operation shard contributors retain primary pair mismatch diagnostics", (t) => {
  const directory = preciseCandidate(t);
  replace(directory, "compact/indexes/operations-middle.md", "source_refs: complete-contexts", "source_refs: all");
  const result = check(directory, 1, /DM-PROFILE-001/, false);
  assert.doesNotMatch(result.stderr, /source_refs.*contributors/);
});

for (const label of ["duplicate", "missing", "extra"]) {
  test(`operation shard contributors defer ${label} shard to primary routing diagnostics`, (t) => {
    const directory = preciseCandidate(t);
    for (const profile of profiles) {
      const root = path.join(directory, profile);
      const index = path.join(root, "INDEX.md");
      const text = fs.readFileSync(index, "utf8");
      const row = text.split("\n").find((line) => line.includes("| indexes/operations-middle.md |"));
      if (label === "duplicate") fs.writeFileSync(index, text.replace(row, `${row}\n${row}`));
      if (label === "missing") fs.rmSync(path.join(root, "indexes/operations-middle.md"));
      if (label === "extra") fs.copyFileSync(path.join(root, "indexes/operations-middle.md"), path.join(root, "indexes/extra.md"));
    }
    rejectsMalformedRouting(directory, /DM-IDX-/);
  });
}

for (const refs of ["complete-contexts, complete-representations", "storefront-behavior", "all"]) {
  test(`operation shard contributors reject context-only refs=${refs}`, (t) => {
    const directory = preciseCandidate(t);
    for (const profile of profiles) replace(directory, `${profile}/indexes/operations-middle.md`,
      "source_refs: complete-contexts", `source_refs: ${refs}`);
    const result = check(directory, 1, /operations-middle\.md.*source_refs.*contributors/i);
    assert.match(result.stderr, /full:.*source_refs.*contributors/);
    assert.match(result.stderr, /compact:.*source_refs.*contributors/);
  });
}
