import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../lib/complete-example-adapters.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { auditCompleteChannelContributorClosure } from "../lib/complete-channel-contributor-audit.mjs";

import { candidate, profiles, copyCandidate, replace, check, regroup, mutateSource }
  from "./helpers/complete-contributor-fixture.mjs";

const storefrontRefs = "storefront-asyncapi-3.1.0, storefront-behavior";

for (const file of ["CONVENTIONS.md", "channels/orders.md"]) {
  for (const refs of [
    "storefront-asyncapi-3.1.0",
    "storefront-behavior",
    "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior",
    "all"
  ]) {
    // Removing exact contributor comparison would accept these ordinary-valid pairs.
    test(`storefront contributors reject ${file} source_refs=${refs}`, (t) => {
      const directory = copyCandidate(t);
      for (const profile of profiles) replace(directory, `${profile}/${file}`,
        `source_refs: ${storefrontRefs}`, `source_refs: ${refs}`);
      const result = check(directory, 1);
      assert.ok(result.stderr.includes(file));
    });
  }
}

test("storefront contributors accept the unchanged candidate", (t) => check(copyCandidate(t), 0));

test("storefront contributors preserve pair mismatch diagnostics", (t) => {
  const directory = copyCandidate(t);
  replace(directory, "compact/channels/orders.md", `source_refs: ${storefrontRefs}`,
    "source_refs: storefront-asyncapi-3.1.0");
  check(directory, 1, /DM-PROFILE-001/, false);
});

function helperInput() {
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, "source/projection-input-manifest.json")));
  const sources = new Map(manifest.sources.map((entry) => [entry.sourceId,
    JSON.parse(fs.readFileSync(path.join(candidate, "source", entry.location)))]));
  const documentSet = loadDocumentSet(path.join(candidate, "full"));
  const options = loadTrustedCompleteExampleAdapterOptions(candidate, [documentSet]);
  const result = validateCompleteDocumentSet(documentSet, options);
  assert.deepEqual(result.diagnostics, []);
  return { sources, sourceIds: manifest.sources.map((entry) => entry.sourceId), documentSet,
    coreFacts: result.facts.core };
}

function audit(input) {
  return auditCompleteChannelContributorClosure(input.sources, input.sourceIds, input.documentSet, input.coreFacts);
}

test("storefront contributors are independent of registry and declaration order", () => {
  const input = helperInput();
  input.sources = new Map([...input.sources].reverse());
  input.sourceIds.reverse();
  input.coreFacts.operations.rows.reverse();
  assert.deepEqual(audit(input), []);
});

for (const [label, mutate, diagnostic] of [
  ["missing registry ID", (input) => input.sourceIds.pop(), /registry/],
  ["duplicate registry ID", (input) => input.sourceIds.push(input.sourceIds[0]), /registry/],
  ["unknown registry ID", (input) => input.sourceIds[0] = "unrelated", /registry/],
  ["missing source", (input) => input.sources.delete("storefront-behavior"), /registry/],
  ["missing contexts registry", (input) => delete input.sources.get("complete-contexts").operations, /inventory/],
  ["duplicate source owner", (input) => input.sources.get("complete-contexts").operations.sendCreateOrder = {}, /duplicate/],
  ["missing behavior registry", (input) => delete input.sources.get("storefront-behavior").operationBehavior, /behavior/],
  ["missing behavior owner", (input) => delete input.sources.get("storefront-behavior").operationBehavior.sendCreateOrder, /ownership/],
  ["missing operation facts", (input) => delete input.coreFacts.operations, /validated/],
  ["missing storefront row", (input) => input.coreFacts.operations.rows = input.coreFacts.operations.rows
    .filter((row) => row.operation !== "sendCreateOrder"), /ownership/],
  ["duplicate storefront row", (input) => input.coreFacts.operations.rows.push(input.coreFacts.operations.rows
    .find((row) => row.operation === "sendCreateOrder")), /ownership/],
  ["definition path mismatch", (input) => input.coreFacts.operationDefinitions.byName.sendCreateOrder.path
    = "channels/unrouted.md", /ownership/],
  ["unknown colocated operation", (input) => {
    input.coreFacts.operations.rows.push({ operation: "unknown", channelPath: "channels/orders.md" });
    input.coreFacts.operationDefinitions.byName.unknown = { path: "channels/orders.md" };
  }, /unknown/],
  ["duplicate colocated row", (input) => input.coreFacts.operations.rows.push({
    operation: "a-operation", channelPath: "channels/orders.md"
  }, { operation: "a-operation", channelPath: "channels/orders.md" }), /inconsistent/]
]) {
  test(`storefront contributors reject ${label} without throwing`, () => {
    const input = helperInput();
    mutate(input);
    const issues = audit(input);
    assert.ok(issues.length > 0);
    assert.match(issues.join("\n"), /source_refs.*contributors/);
    assert.match(issues.join("\n"), diagnostic);
  });
}

// Regroup real candidate operations, routing rows and manifest placement together.
// The expected refs are supplied by each test, never by the production derivation.
test("storefront contributors follow renamed and split storefront owners", (t) => {
  const directory = copyCandidate(t);
  regroup(directory, { receiveOrderCreated: "channels/incoming.md", sendCreateOrder: "channels/outgoing.md" }, {
    "channels/incoming.md": storefrontRefs, "channels/outgoing.md": storefrontRefs
  });
  check(directory, 0);
});

const representationNames = ["r-csv-operation", "r-json-original-operation", "r-json-reuse-operation",
  "r-raw-operation", "r-tagged-operation", "r-untagged-operation"];
for (const [label, moveRepresentations, refs, status] of [
  ["context union", false, "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior", 0],
  ["missing context source", false, storefrontRefs, 1],
  ["unrelated representation source", false, "all", 1],
  ["all four sources", true, "all", 0],
  ["full registry spelled as list", true,
    "complete-contexts, complete-representations, storefront-asyncapi-3.1.0, storefront-behavior", 1],
  ["missing representation source", true, "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior", 1]
]) {
  test(`storefront contributors ${status ? "reject" : "accept"} ${label} in regrouped owners`, (t) => {
    const directory = copyCandidate(t);
    const moves = { "a-operation": "channels/orders.md" };
    if (moveRepresentations) for (const name of representationNames) moves[name] = "channels/orders.md";
    regroup(directory, moves, { "channels/orders.md": refs });
    check(directory, status);
  });
}

for (const omit of [false, true]) {
  test(`storefront contributors ${omit ? "reject missing" : "retain"} routing-only Task source after revision`, (t) => {
    const directory = copyCandidate(t);
    mutateSource(directory, "storefront-behavior.json", (source) => {
      source.operationBehavior.sendCreateOrder.task = "submit a synthetic order";
    });
    for (const profile of profiles) {
      replace(directory, `${profile}/INDEX.md`, "submit an order", "submit a synthetic order");
      replace(directory, `${profile}/indexes/operations-broad.md`, "submit an order", "submit a synthetic order");
      if (omit) replace(directory, `${profile}/channels/orders.md`, `source_refs: ${storefrontRefs}`,
        "source_refs: storefront-asyncapi-3.1.0");
      assert.equal(fs.readFileSync(path.join(directory, profile, "channels/orders.md"), "utf8")
        .split("\n").slice(1).join("\n"), fs.readFileSync(path.join(candidate, profile, "channels/orders.md"), "utf8")
        .split("\n").slice(1).join("\n"), "Task source edit changes no channel body");
    }
    check(directory, omit ? 1 : 0);
  });
}

test("storefront context links do not import the referenced Workflow body contributors", (t) => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront-behavior.json", (source) => {
    source.operationBehavior.receiveOrderCreated.supplementalContexts = ["alpha-delivery"];
  });
  for (const profile of profiles) {
    const relative = `${profile}/indexes/operations-broad.md`;
    const text = fs.readFileSync(path.join(directory, relative), "utf8");
    const row = text.split("\n").find((line) => line.startsWith("| RECEIVE | orders.events |"));
    const cells = row.split("|");
    cells[8] = " workflows/alpha-delivery.md ";
    replace(directory, relative, row, cells.join("|"));
    replace(directory, `${profile}/channels/orders.md`, "### Related\n\nnone\n\n## SEND",
      "### Related\n\nworkflows/alpha-delivery.md\n\n## SEND");
  }
  check(directory, 0);
});

test("storefront contributors defer to primary malformed-source diagnostic", (t) => {
  const directory = copyCandidate(t);
  mutateSource(directory, "complete-contexts.json", (source) => { delete source.operations; });
  const result = check(directory, 1, /malformed source operation inventory/);
  assert.doesNotMatch(result.stderr, /source_refs.*contributors|TypeError/);
});
