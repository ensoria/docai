import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodeTest from "node:test";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { auditRuleTestCorrespondence } from "../lib/fixture-runner.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { validateCompleteConventionRetrieval } from "../lib/validators/complete-conventions.mjs";

const corpusPath = fileURLToPath(
  new URL("../../fixtures/core/v0.17.1/valid/full/", import.meta.url)
);
const catalogPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));
const conventionRetrievalRuleTestNames = [];

function test(name, ...arguments_) {
  conventionRetrievalRuleTestNames.push(String(name));
  return nodeTest(name, ...arguments_);
}

const conventionSections = [
  "Environments",
  "Protocols and Bindings",
  "Authentication",
  "Connection and Session",
  "Serialization",
  "Message Envelope",
  "Delivery Semantics",
  "Idempotency and Deduplication",
  "Ordering",
  "Error Handling",
  "Request-Reply",
  "Schema Evolution",
  "Data Representation",
  "Empty and Omitted Values",
  "Rate Limits and Quotas"
];

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
    `${title} coordinates the relevant messaging operations.`,
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

function configureSelectiveWorkflowRouting(documentSet) {
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  assert.notEqual(root, undefined);
  const operationHeader = "| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |";
  const operationSeparator = "|---|---|---|---|---|---|---|---|";
  root.content = root.content
    .replace(operationHeader, `${operationHeader.slice(0, -1)}| Conventions |`)
    .replace(operationSeparator, `${operationSeparator.slice(0, -1)}|---|`)
    .split("\n")
    .map((line) => {
      if (line.includes("| receiveOrderCreated |")) {
        return line.replace(/ \| none \| none \|$/, " | none | none | all |");
      }
      if (line.includes("| sendCreateOrder |")) {
        return line.replace(
          / \| none \| none \|$/,
          " | workflows/required.md | workflows/supplemental.md | Data Representation |"
        );
      }
      return line;
    })
    .join("\n")
    .replace("## Workflows\n\nnone", [
      "## Workflows\n",
      "| Name | Summary | Details |",
      "|---|---|---|",
      "| Required order flow | Required sequencing | workflows/required.md |",
      "| Supplemental order guide | Optional operator guidance | workflows/supplemental.md |"
    ].join("\n"));
  root.bytes = Buffer.from(root.content, "utf8");
  root.identityLine = root.content.split("\n")
    .findIndex((line) => line.startsWith("> docai-identity:")) + 1;
  addDocument(documentSet, "workflows/required.md", workflowBody("Required order flow"));
  addDocument(
    documentSet,
    "workflows/supplemental.md",
    workflowBody("Supplemental order guide")
  );
}

function configureInvalidConventionSelector(documentSet) {
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  assert.notEqual(root, undefined);
  const operationHeader = "| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |";
  const operationSeparator = "|---|---|---|---|---|---|---|---|";
  root.content = root.content
    .replace(operationHeader, `${operationHeader.slice(0, -1)}| Conventions |`)
    .replace(operationSeparator, `${operationSeparator.slice(0, -1)}|---|`)
    .split("\n")
    .map((line) => {
      if (line.includes("| receiveOrderCreated |")) return line.replace(/\|$/, "| all |");
      if (line.includes("| sendCreateOrder |")) {
        return line.replace(/\|$/, "| Unknown Convention |");
      }
      return line;
    })
    .join("\n");
  root.bytes = Buffer.from(root.content, "utf8");
}

test("DM-CONV-005 exposes whole-file operation convention retrieval when the selector is absent", () => {
  const documentSet = loadDocumentSet(corpusPath);

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.complete.conventionRetrieval, {
    operations: [
      {
        operation: "receiveOrderCreated",
        selector: "all",
        requiredWorkflowPaths: [],
        trusted: { wholeFile: true, sections: conventionSections },
        untrusted: { wholeFile: true, sections: conventionSections },
        supplementalWorkflows: []
      },
      {
        operation: "sendCreateOrder",
        selector: "all",
        requiredWorkflowPaths: [],
        trusted: { wholeFile: true, sections: conventionSections },
        untrusted: { wholeFile: true, sections: conventionSections },
        supplementalWorkflows: []
      }
    ],
    directWorkflows: []
  });
});

test("DM-CONV-005 preserves required-workflow closure and falls back for supplemental and direct workflows", () => {
  const documentSet = cloneDocumentSet();
  configureSelectiveWorkflowRouting(documentSet);

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.complete.conventionRetrieval.operations[1], {
    operation: "sendCreateOrder",
    selector: ["Data Representation"],
    requiredWorkflowPaths: ["workflows/required.md"],
    trusted: { wholeFile: false, sections: ["Data Representation"] },
    untrusted: { wholeFile: true, sections: conventionSections },
    supplementalWorkflows: [{
      path: "workflows/supplemental.md",
      fallback: true,
      reason: "supplemental-workflow",
      wholeFile: true,
      sections: conventionSections
    }]
  });
  assert.deepEqual(result.facts.complete.conventionRetrieval.directWorkflows, [
    {
      path: "workflows/required.md",
      reason: "direct-workflow",
      wholeFile: true,
      sections: conventionSections
    },
    {
      path: "workflows/supplemental.md",
      reason: "direct-workflow",
      wholeFile: true,
      sections: conventionSections
    }
  ]);
});

test("DM-CONV-005 requires Error Handling for a selected operation that references a common failure shape", () => {
  const result = validateCompleteConventionRetrieval({
    operations: {
      rows: [{
        operation: "submit-order",
        conventions: "none",
        requiredContexts: [],
        supplementalContexts: [],
        indexPath: "INDEX.md",
        line: 17
      }]
    },
    failureShapes: {
      commonReferences: [{ label: "dead-letter", operation: "submit-order" }]
    }
  }, { rows: [] });

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-CONV-005"]);
  assert.deepEqual(result.facts.conventionRetrieval.operations[0].trusted, {
    wholeFile: false,
    sections: []
  });

  const closed = validateCompleteConventionRetrieval({
    operations: {
      rows: [{
        operation: "submit-order",
        conventions: ["Error Handling"],
        requiredContexts: [],
        supplementalContexts: [],
        indexPath: "INDEX.md",
        line: 17
      }]
    },
    failureShapes: {
      commonReferences: [{ label: "dead-letter", operation: "submit-order" }]
    }
  }, { rows: [] });
  assert.deepEqual(closed.diagnostics, []);
});

test("DM-CONV-005 keeps none metadata-only and excludes Reference Material from workflow fallback", () => {
  const result = validateCompleteConventionRetrieval({
    operations: {
      rows: [{
        operation: "inspect-order",
        conventions: "none",
        requiredContexts: [],
        supplementalContexts: ["references/guide.md", "workflows/guide.md"]
      }]
    },
    failureShapes: { commonReferences: [] }
  }, { rows: [] });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.conventionRetrieval.operations[0], {
    operation: "inspect-order",
    selector: "none",
    requiredWorkflowPaths: [],
    trusted: { wholeFile: false, sections: [] },
    untrusted: { wholeFile: true, sections: conventionSections },
    supplementalWorkflows: [{
      path: "workflows/guide.md",
      fallback: true,
      reason: "supplemental-workflow",
      wholeFile: true,
      sections: conventionSections
    }]
  });
});

test("DM-CONV-005 defers retrieval facts when Core convention routing is invalid", () => {
  const documentSet = cloneDocumentSet();
  configureInvalidConventionSelector(documentSet);
  let result;

  assert.doesNotThrow(() => {
    result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
  });
  assert.equal(result.diagnostics.some((entry) => entry.ruleId === "DM-IDX-004"), true);
  assert.equal(result.diagnostics.some((entry) => entry.ruleId === "DM-CONV-005"), false);
  assert.equal(result.facts.complete.conventionRetrieval, null);
});

test("DM-CONV-005 maintains complete-scope rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const conventionRetrievalRules = catalog.rules.filter((entry) => (
    entry.rule_id === "DM-CONV-005"
  ));

  assert.deepEqual(conventionRetrievalRules.map((entry) => entry.rule_id), ["DM-CONV-005"]);
  assert.deepEqual(conventionRetrievalRules.map((entry) => entry.scope), ["complete"]);
  assert.deepEqual(auditRuleTestCorrespondence({
    catalogRuleIds: conventionRetrievalRules.map((entry) => entry.rule_id),
    testNames: conventionRetrievalRuleTestNames,
    rulePrefixes: ["DM-CONV"]
  }), { passed: true, errors: [] });
});
