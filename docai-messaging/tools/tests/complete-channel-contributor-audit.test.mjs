import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { candidate, profiles, copyCandidate, replace, check, regroup, mutateSource }
  from "./helpers/complete-contributor-fixture.mjs";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../lib/complete-example-adapters.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { auditCompleteChannelContributorClosure } from "../lib/complete-channel-contributor-audit.mjs";

function preciseCandidate(t) {
  const directory = copyCandidate(t);
  // Isolate each negative: other context-only files must not mask its result.
  for (const profile of profiles) for (const name of ["alpha", "middle", "zeta"]) {
    const relative = `${profile}/channels/${name}.md`;
    const text = fs.readFileSync(path.join(directory, relative), "utf8");
    if (text.split("\n")[0].includes("source_refs: all")) {
      replace(directory, relative, "source_refs: all", "source_refs: complete-contexts");
    }
  }
  return directory;
}

test("channel contributors follow a relocated synthetic-only owner", (t) => {
  const directory = preciseCandidate(t);
  regroup(directory, { "a-operation": "channels/signal.md" }, { "channels/signal.md": "complete-contexts" });
  check(directory, 0);
});

test("channel contributors union synthetic owners within a valid channel subsection", (t) => {
  const directory = preciseCandidate(t);
  regroup(directory, { "z-operation": "channels/alpha.md" }, {
    "channels/alpha.md": "complete-contexts"
  });
  check(directory, 0);
});

test("channel contributors accept split representations with original and reuse kept together", (t) => {
  const directory = preciseCandidate(t);
  regroup(directory, { "r-json-original-operation": "channels/json.md", "r-json-reuse-operation": "channels/json.md" }, {
    "channels/json.md": "complete-representations", "channels/representations.md": "complete-representations"
  });
  check(directory, 0);
});

for (const [refs, status] of [
  ["complete-contexts, complete-representations", 0],
  ["complete-representations", 1], ["complete-contexts", 1], ["all", 1]
]) {
  test(`channel contributors ${status ? "reject" : "accept"} synthetic-only mixed refs=${refs}`, (t) => {
    const directory = preciseCandidate(t);
    regroup(directory, { "z-operation": "channels/representations.md" }, { "channels/representations.md": refs });
    const result = check(directory, status);
    if (status) assert.ok(result.stderr.includes("channels/representations.md"));
  });
}

test("channel contributors do not import CONVENTIONS body sources into representation owners", (t) => {
  const directory = preciseCandidate(t);
  // The routing selector names Data Representation, whose definition is in the
  // separately retrieved CONVENTIONS file. It does not add that file's sources.
  const text = fs.readFileSync(path.join(directory, "full/indexes/operations-broad.md"), "utf8");
  assert.match(text, /r-csv-operation.*Data Representation/);
  check(directory, 0);
});

test("channel contributors accept reordered source operation declarations", (t) => {
  const directory = preciseCandidate(t);
  mutateSource(directory, "complete-contexts.json", (source) => {
    source.operations = Object.fromEntries(Object.entries(source.operations).reverse());
  });
  mutateSource(directory, "complete-representations.json", (source) => source.representations.reverse());
  mutateSource(directory, "storefront.asyncapi.json", (source) => {
    source.operations = Object.fromEntries(Object.entries(source.operations).reverse());
  });
  check(directory, 0);
});

function helperInput() {
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, "source/projection-input-manifest.json")));
  const sources = new Map(manifest.sources.map((entry) => [entry.sourceId,
    JSON.parse(fs.readFileSync(path.join(candidate, "source", entry.location)))]));
  const set = loadDocumentSet(path.join(candidate, "full"));
  const options = loadTrustedCompleteExampleAdapterOptions(candidate, [set]);
  const result = validateCompleteDocumentSet(set, options);
  assert.deepEqual(result.diagnostics, []);
  return { sources, ids: manifest.sources.map((entry) => entry.sourceId), set, core: result.facts.core };
}

for (const [label, mutate] of [
  ["missing synthetic routing", (input) => input.core.operations.rows = input.core.operations.rows
    .filter((row) => row.operation !== "a-operation")],
  ["duplicate synthetic routing", (input) => input.core.operations.rows.push(input.core.operations.rows
    .find((row) => row.operation === "a-operation"))],
  ["missing synthetic definition", (input) => delete input.core.operationDefinitions.byName["z-operation"]],
  ["synthetic definition path mismatch", (input) => input.core.operationDefinitions.byName["z-operation"].path
    = "channels/alpha.md"],
  ["output-only channel", (input) => input.set.files.push({ path: "channels/unowned.md", metadata: { source_refs: "all" } })],
  ["missing channel file", (input) => input.set.files = input.set.files.filter((file) => file.path !== "channels/zeta.md")],
  ["duplicate channel file", (input) => input.set.files.push(input.set.files.find((file) => file.path === "channels/zeta.md"))],
  ["unknown synthetic owner", (input) => {
    input.core.operations.rows.push({ operation: "unowned", channelPath: "channels/alpha.md" });
    input.core.operationDefinitions.byName.unowned = { path: "channels/alpha.md" };
  }]
]) {
  test(`channel contributors reject ${label} without throwing`, () => {
    const input = helperInput();
    mutate(input);
    const issues = auditCompleteChannelContributorClosure(input.sources, input.ids, input.set, input.core);
    assert.ok(issues.length > 0);
    assert.match(issues.join("\n"), /source_refs.*contributors.*ownership/);
  });
}

test("channel contributors preserve primary pair diagnostics for a one-profile synthetic ref change", (t) => {
  const directory = preciseCandidate(t);
  replace(directory, "compact/channels/zeta.md", "source_refs: complete-contexts", "source_refs: all");
  const result = check(directory, 1, /DM-PROFILE-001/, false);
  assert.doesNotMatch(result.stderr, /source_refs.*contributors/);
});

test("channel contributors defer unowned output file rejection to the primary source inventory rule", (t) => {
  const directory = preciseCandidate(t);
  for (const profile of profiles) {
    fs.copyFileSync(path.join(directory, profile, "channels/zeta.md"), path.join(directory, profile, "channels/unowned.md"));
  }
  const result = check(directory, 1, /operation inventory channel coverage/);
  assert.doesNotMatch(result.stderr, /source_refs.*contributors|TypeError/);
});

for (const [file, expected] of [
  ["channels/alpha.md", "complete-contexts"],
  ["channels/middle.md", "complete-contexts"],
  ["channels/zeta.md", "complete-contexts"],
  ["channels/representations.md", "complete-representations"]
]) {
  for (const refs of ["storefront-behavior", "complete-contexts, complete-representations",
    "storefront-asyncapi-3.1.0", "all"]) {
    test(`channel contributors reject ${file} source_refs=${refs}`, (t) => {
      const directory = preciseCandidate(t);
      for (const profile of profiles) replace(directory, `${profile}/${file}`,
        `source_refs: ${expected}`, `source_refs: ${refs}`);
      const result = check(directory, 1);
      assert.ok(result.stderr.includes(file), result.stderr);
      assert.match(result.stderr, /full:.*source_refs.*contributors/);
      assert.match(result.stderr, /compact:.*source_refs.*contributors/);
    });
  }
}
