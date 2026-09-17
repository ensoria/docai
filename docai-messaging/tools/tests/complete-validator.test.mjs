import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import nodeTest from "node:test";
import { fileURLToPath } from "node:url";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { auditRuleTestCorrespondence } from "../lib/fixture-runner.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";

const corpusPath = fileURLToPath(
  new URL("../../fixtures/core/v0.17.1/valid/full/", import.meta.url)
);
const catalogPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));
const workflowRuleTestNames = [];

function test(name, ...arguments_) {
  workflowRuleTestNames.push(String(name));
  return nodeTest(name, ...arguments_);
}

function cloneDocumentSet() {
  const source = loadDocumentSet(corpusPath);
  return {
    ...source,
    files: source.files.map((file) => ({
      ...file,
      bytes: Buffer.from(file.bytes),
      metadata: file.metadata === null ? null : { ...file.metadata },
      identity: file.identity === null ? null : { ...file.identity }
    })),
    paths: [...source.paths],
    diagnostics: [...source.diagnostics]
  };
}

function replaceWorkflowSection(documentSet, body) {
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  assert.notEqual(root, undefined);
  const original = "## Workflows\n\nnone";
  assert.equal(root.content.split(original).length - 1, 1);
  root.content = root.content.replace(original, `## Workflows\n\n${body}`);
  root.bytes = Buffer.from(root.content, "utf8");
  root.identityLine = root.content.split("\n")
    .findIndex((line) => line.startsWith("> docai-identity:")) + 1;
}

function addDocument(documentSet, relativePath, body) {
  const template = documentSet.files.find((file) => file.path === "CONVENTIONS.md");
  assert.notEqual(template, undefined);
  const opening = template.content.split("\n", 1)[0];
  const trailer = template.content.split("\n")
    .find((line) => line.startsWith("> docai-identity:"));
  assert.notEqual(trailer, undefined);
  const content = `${opening}\n\n${body}\n\n${trailer}\n`;
  documentSet.files.push({
    path: relativePath,
    absolutePath: path.join(documentSet.rootDir, relativePath),
    bytes: Buffer.from(content, "utf8"),
    content,
    metadata: { ...template.metadata },
    metadataLine: 1,
    identity: { ...template.identity },
    identityLine: content.split("\n")
      .findIndex((line) => line.startsWith("> docai-identity:")) + 1
  });
  documentSet.files.sort((left, right) => Buffer.compare(
    Buffer.from(left.path, "ascii"),
    Buffer.from(right.path, "ascii")
  ));
  documentSet.paths = documentSet.files.map((file) => file.path);
}

function workflowBody(title) {
  return [
    `# ${title}`,
    "",
    `${title} coordinates the required messaging operations.`,
    "",
    "## Preconditions",
    "",
    "none",
    "",
    "## Steps",
    "",
    "none",
    "",
    "## State Transitions",
    "",
    "none",
    "",
    "## Failure and Recovery",
    "",
    "none"
  ].join("\n");
}

function directWorkflowTable(rows) {
  return [
    "| Name | Summary | Details |",
    "|---|---|---|",
    ...rows.map(({ name, summary, details }) => `| ${name} | ${summary} | ${details} |`)
  ].join("\n");
}

function workflowShardTable(rows) {
  return [
    "### Workflow Shards",
    "",
    "| First name | Last name | Summary | Details |",
    "|---|---|---|---|",
    ...rows.map(({ first, last, summary, details }) => (
      `| ${first} | ${last} | ${summary} | ${details} |`
    ))
  ].join("\n");
}

function workflowIndexBody(rows) {
  return [
    "# Messaging Workflow Index",
    "",
    "## Workflows",
    "",
    directWorkflowTable(rows)
  ].join("\n");
}

test("DM-WF-001 accepts the canonical none state when no workflow files exist", () => {
  const result = validateCompleteDocumentSet(cloneDocumentSet(), { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.complete.workflows, {
    form: "none",
    rows: [],
    shards: []
  });
});

test("DM-WF-001 and DM-WF-002 accept direct workflow routing and expose exact retrieval", () => {
  const documentSet = cloneDocumentSet();
  replaceWorkflowSection(documentSet, directWorkflowTable([
    {
      name: "Order cancellation",
      summary: "Cancel an order and recover failures",
      details: "workflows/order-cancellation.md"
    }
  ]));
  addDocument(
    documentSet,
    "workflows/order-cancellation.md",
    workflowBody("Order cancellation flow")
  );

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.facts.complete.workflows.form, "direct");
  assert.deepEqual(
    result.facts.complete.workflowRetrieval.exact["Order cancellation"],
    {
      selector: { name: "Order cancellation" },
      loadedIndexPaths: ["INDEX.md"],
      falsePositiveIndexPaths: [],
      matchedWorkflowNames: ["Order cancellation"],
      loadedWorkflowPaths: ["workflows/order-cancellation.md"]
    }
  );
});

test("DM-WF-002 rejects duplicate normalized workflow names", () => {
  const documentSet = cloneDocumentSet();
  replaceWorkflowSection(documentSet, directWorkflowTable([
    {
      name: "Order cancellation",
      summary: "Cancel an order",
      details: "workflows/cancel.md"
    },
    {
      name: "Order cancellation",
      summary: "Recover a cancellation",
      details: "workflows/recover.md"
    }
  ]));
  addDocument(documentSet, "workflows/cancel.md", workflowBody("Cancel"));
  addDocument(documentSet, "workflows/recover.md", workflowBody("Recover"));

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
  const primary = result.diagnostics.filter((entry) => (
    entry.severity === "error" && !entry.cascade
  ));

  assert.deepEqual(primary.map((entry) => entry.ruleId), ["DM-WF-002"]);
});

test("DM-WF-002 orders workflow names by Unicode scalar value instead of UTF-16", () => {
  const documentSet = cloneDocumentSet();
  replaceWorkflowSection(documentSet, directWorkflowTable([
    { name: "\uE000", summary: "Private-use workflow", details: "workflows/private.md" },
    { name: "\u{10000}", summary: "Supplementary-plane workflow", details: "workflows/supplementary.md" }
  ]));
  addDocument(documentSet, "workflows/private.md", workflowBody("Private-use flow"));
  addDocument(documentSet, "workflows/supplementary.md", workflowBody("Supplementary flow"));

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.facts.complete.workflows.rows.map((row) => row.name),
    ["\uE000", "\u{10000}"]
  );
});

test("DM-WF-003 resolves overlapping workflow shards and records false positives", () => {
  const documentSet = cloneDocumentSet();
  replaceWorkflowSection(documentSet, workflowShardTable([
    {
      first: "Alpha",
      last: "November",
      summary: "Early workflows",
      details: "indexes/workflows-early.md"
    },
    {
      first: "Mike",
      last: "Zulu",
      summary: "Late workflows",
      details: "indexes/workflows-late.md"
    }
  ]));
  addDocument(documentSet, "indexes/workflows-early.md", workflowIndexBody([
    { name: "Alpha", summary: "Alpha flow", details: "workflows/alpha.md" },
    { name: "November", summary: "November flow", details: "workflows/november.md" }
  ]));
  addDocument(documentSet, "indexes/workflows-late.md", workflowIndexBody([
    { name: "Mike", summary: "Mike flow", details: "workflows/mike.md" },
    { name: "Zulu", summary: "Zulu flow", details: "workflows/zulu.md" }
  ]));
  for (const name of ["alpha", "november", "mike", "zulu"]) {
    addDocument(documentSet, `workflows/${name}.md`, workflowBody(`${name} flow`));
  }

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.facts.complete.workflows.form, "sharded");
  assert.deepEqual(result.facts.complete.workflowRetrieval.exact.Mike, {
    selector: { name: "Mike" },
    loadedIndexPaths: ["indexes/workflows-early.md", "indexes/workflows-late.md"],
    falsePositiveIndexPaths: ["indexes/workflows-early.md"],
    matchedWorkflowNames: ["Mike"],
    loadedWorkflowPaths: ["workflows/mike.md"]
  });
  assert.deepEqual(
    result.facts.complete.workflowRetrieval.semanticFallback.loadedIndexPaths,
    ["indexes/workflows-early.md", "indexes/workflows-late.md"]
  );
});

test("DM-WF-003 rejects a workflow shard whose declared bounds are not exact", () => {
  const documentSet = cloneDocumentSet();
  replaceWorkflowSection(documentSet, workflowShardTable([
    {
      first: "Alpha",
      last: "Zulu",
      summary: "All workflows",
      details: "indexes/workflows-all.md"
    }
  ]));
  addDocument(documentSet, "indexes/workflows-all.md", workflowIndexBody([
    { name: "Mike", summary: "Mike flow", details: "workflows/mike.md" }
  ]));
  addDocument(documentSet, "workflows/mike.md", workflowBody("Mike flow"));

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
  const primary = result.diagnostics.filter((entry) => (
    entry.severity === "error" && !entry.cascade
  ));

  assert.deepEqual(primary.map((entry) => entry.ruleId), ["DM-WF-003"]);
});

test("DM-WF-003 rejects an unlisted workflow-index shard beside direct routing", () => {
  const documentSet = cloneDocumentSet();
  replaceWorkflowSection(documentSet, directWorkflowTable([
    { name: "Alpha", summary: "Alpha flow", details: "workflows/alpha.md" }
  ]));
  addDocument(documentSet, "workflows/alpha.md", workflowBody("Alpha flow"));
  addDocument(documentSet, "indexes/workflows-unlisted.md", workflowIndexBody([
    { name: "Zulu", summary: "Zulu flow", details: "workflows/zulu.md" }
  ]));

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
  const primary = result.diagnostics.filter((entry) => (
    entry.severity === "error" && !entry.cascade
  ));

  assert.deepEqual(primary.map((entry) => entry.ruleId), ["DM-WF-003"]);
});

test("DM-WF-003 rejects a duplicate shard route without duplicate workflow diagnostics", () => {
  const documentSet = cloneDocumentSet();
  replaceWorkflowSection(documentSet, workflowShardTable([
    {
      first: "Alpha",
      last: "Alpha",
      summary: "Alpha workflows",
      details: "indexes/workflows-alpha.md"
    },
    {
      first: "Alpha",
      last: "Alpha",
      summary: "Duplicate route",
      details: "indexes/workflows-alpha.md"
    }
  ]));
  addDocument(documentSet, "indexes/workflows-alpha.md", workflowIndexBody([
    { name: "Alpha", summary: "Alpha flow", details: "workflows/alpha.md" }
  ]));
  addDocument(documentSet, "workflows/alpha.md", workflowBody("Alpha flow"));

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
  const primaryRuleIds = [...new Set(result.diagnostics
    .filter((entry) => entry.severity === "error" && !entry.cascade)
    .map((entry) => entry.ruleId))];

  assert.deepEqual(primaryRuleIds, ["DM-WF-003"]);
});

test("DM-WF-001 through DM-WF-003 maintain complete-scope rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const workflowRules = catalog.rules.filter((entry) => entry.rule_id.startsWith("DM-WF-"));

  assert.deepEqual(workflowRules.map((entry) => entry.scope), [
    "complete",
    "complete",
    "complete"
  ]);
  assert.deepEqual(auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: workflowRuleTestNames,
    rulePrefixes: ["DM-WF"]
  }), { passed: true, errors: [] });
});
