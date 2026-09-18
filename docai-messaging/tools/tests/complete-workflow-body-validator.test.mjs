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
const workflowBodyRuleTestNames = [];

function test(name, ...arguments_) {
  workflowBodyRuleTestNames.push(String(name));
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
  root.content = root.content.replace("## Workflows\n\nnone", `## Workflows\n\n${body}`);
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

function routeWorkflow(documentSet, name, details) {
  replaceWorkflowSection(documentSet, [
    "| Name | Summary | Details |",
    "|---|---|---|",
    `| ${name} | Submit and confirm an order | ${details} |`
  ].join("\n"));
}

function setCompleteness(documentSet, relativePath, coverage, knowledge) {
  const file = documentSet.files.find((entry) => entry.path === relativePath);
  assert.notEqual(file, undefined);
  file.content = file.content.replace(
    /coverage: [^ |]+ \| knowledge: [^ |]+/,
    `coverage: ${coverage} | knowledge: ${knowledge}`
  );
  file.bytes = Buffer.from(file.content, "utf8");
  file.metadata = { ...file.metadata, coverage, knowledge };
}

function canonicalWorkflowBody() {
  return [
    "# Order submission and acceptance",
    "",
    "Submit an order and confirm that it is accepted.",
    "",
    "## Preconditions",
    "",
    "- The order details are valid",
    "",
    "## Steps",
    "",
    "1. SEND orders.commands (sendCreateOrder) -- retain the order identifier",
    "2. On reply acceptance -- mark the order as accepted",
    "",
    "## State Transitions",
    "",
    "| From | Trigger | To |",
    "|---|---|---|",
    "| order.ready | SEND orders.commands (sendCreateOrder) | order.accepted |",
    "",
    "## Failure and Recovery",
    "",
    "- On timeout, retry with the retained order identifier"
  ].join("\n");
}

test("DM-WF-004 through DM-WF-006 accept a canonical expanded workflow", () => {
  const documentSet = cloneDocumentSet();
  routeWorkflow(documentSet, "Order submission", "workflows/order-submission.md");
  addDocument(documentSet, "workflows/order-submission.md", canonicalWorkflowBody());

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.complete.workflowDefinitions, [{
    path: "workflows/order-submission.md",
    title: "Order submission and acceptance",
    introduction: "Submit an order and confirm that it is accepted.",
    deviations: [],
    sections: {
      Preconditions: {
        state: "expanded",
        deviations: [],
        items: ["The order details are valid"]
      },
      Steps: {
        state: "expanded",
        deviations: [],
        steps: [
          "SEND orders.commands (sendCreateOrder) -- retain the order identifier",
          "On reply acceptance -- mark the order as accepted"
        ]
      },
      "State Transitions": {
        state: "expanded",
        deviations: [],
        rows: [{
          from: "order.ready",
          trigger: "SEND orders.commands (sendCreateOrder)",
          to: "order.accepted"
        }]
      },
      "Failure and Recovery": {
        state: "expanded",
        deviations: [],
        items: ["On timeout, retry with the retained order identifier"]
      }
    }
  }]);
});

test("DM-WF-004 rejects invalid workflow title introduction and fixed section structure", () => {
  const cases = [
    {
      name: "prose before title",
      body: `Unexpected wrapper prose.\n\n${canonicalWorkflowBody()}`
    },
    {
      name: "missing title",
      body: canonicalWorkflowBody().replace("# Order submission and acceptance\n\n", "")
    },
    {
      name: "missing introduction",
      body: canonicalWorkflowBody().replace(
        "Submit an order and confirm that it is accepted.\n\n",
        ""
      )
    },
    {
      name: "unterminated introduction",
      body: canonicalWorkflowBody().replace(
        "Submit an order and confirm that it is accepted.",
        "Submit an order and confirm that it is accepted"
      )
    },
    {
      name: "multi-line introduction",
      body: canonicalWorkflowBody().replace(
        "Submit an order and confirm that it is accepted.",
        "Submit an order.\nConfirm that it is accepted."
      )
    },
    {
      name: "three-sentence introduction",
      body: canonicalWorkflowBody().replace(
        "Submit an order and confirm that it is accepted.",
        "Submit an order. Await a reply. Confirm acceptance."
      )
    },
    {
      name: "reordered sections",
      body: canonicalWorkflowBody()
        .replace("## Preconditions", "## Temporary")
        .replace("## Steps", "## Preconditions")
        .replace("## Temporary", "## Steps")
    },
    {
      name: "unexpected level-two section",
      body: canonicalWorkflowBody().replace(
        "## Failure and Recovery",
        "## Notes\n\nnone\n\n## Failure and Recovery"
      )
    }
  ];

  for (const fixture of cases) {
    const documentSet = cloneDocumentSet();
    routeWorkflow(documentSet, "Order submission", "workflows/order-submission.md");
    addDocument(documentSet, "workflows/order-submission.md", fixture.body);

    const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
    const primaryRuleIds = [...new Set(result.diagnostics
      .filter((entry) => entry.severity === "error" && !entry.cascade)
      .map((entry) => entry.ruleId))];

    assert.deepEqual(primaryRuleIds, ["DM-WF-004"], fixture.name);
  }
});

test("DM-WF-005 accepts canonical workflow deviations and incomplete section states", () => {
  const documentSet = cloneDocumentSet();
  routeWorkflow(documentSet, "Order submission", "workflows/order-submission.md");
  addDocument(documentSet, "workflows/order-submission.md", [
    "# Order submission and acceptance",
    "",
    "Submit an order and confirm that it is accepted.",
    "",
    "**deviation**: Authentication uses a workflow-scoped service token",
    "**deviation**: Retry policy is supplied by the order coordinator",
    "",
    "## Preconditions",
    "",
    "**deviation**: No additional precondition is required",
    "none",
    "",
    "## Steps",
    "",
    "unknown",
    "**unknown**: workflow steps require the authoritative coordination plan",
    "",
    "## State Transitions",
    "",
    "**unsupported**: replaces workflow State Transitions: conditional transition graph at source plan",
    "",
    "## Failure and Recovery",
    "",
    "**deviation**: Retry preserves the original order identifier",
    "- On timeout, retry with the retained order identifier"
  ].join("\n"));
  setCompleteness(documentSet, "INDEX.md", "requires-source", "requires-input");
  setCompleteness(
    documentSet,
    "workflows/order-submission.md",
    "requires-source",
    "requires-input"
  );

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.complete.workflowDefinitions[0].deviations, [
    "Authentication uses a workflow-scoped service token",
    "Retry policy is supplied by the order coordinator"
  ]);
  assert.deepEqual(result.facts.complete.workflowDefinitions[0].sections, {
    Preconditions: {
      state: "none",
      deviations: ["No additional precondition is required"]
    },
    Steps: {
      state: "unknown",
      deviations: [],
      reason: "workflow steps require the authoritative coordination plan"
    },
    "State Transitions": {
      state: "unsupported",
      deviations: [],
      reason: "conditional transition graph at source plan"
    },
    "Failure and Recovery": {
      state: "expanded",
      deviations: ["Retry preserves the original order identifier"],
      items: ["On timeout, retry with the retained order identifier"]
    }
  });
});

test("DM-WF-005 rejects invalid deviation placement ordering and section core states", () => {
  const body = canonicalWorkflowBody();
  const cases = [
    {
      name: "unsorted whole-workflow deviations",
      body: body.replace(
        "Submit an order and confirm that it is accepted.\n\n## Preconditions",
        [
          "Submit an order and confirm that it is accepted.",
          "",
          "**deviation**: Zulu convention changes",
          "**deviation**: Alpha convention changes",
          "",
          "## Preconditions"
        ].join("\n")
      )
    },
    {
      name: "empty section-local deviation",
      body: body.replace(
        "## Preconditions\n\n- The order details are valid",
        "## Preconditions\n\n**deviation**: \n- The order details are valid"
      )
    },
    {
      name: "deviation after the core state",
      body: body.replace(
        "## Preconditions\n\n- The order details are valid",
        "## Preconditions\n\nnone\n**deviation**: late suppression"
      )
    },
    {
      name: "unknown without its marker",
      body: body.replace(
        "## Preconditions\n\n- The order details are valid",
        "## Preconditions\n\nunknown"
      )
    },
    {
      name: "replacement with the wrong workflow unit",
      body: body.replace(
        "## Preconditions\n\n- The order details are valid",
        "## Preconditions\n\n**unsupported**: replaces workflow Steps: source condition"
      )
    },
    {
      name: "none mixed with expanded content",
      body: body.replace(
        "## Preconditions\n\n- The order details are valid",
        "## Preconditions\n\nnone\n- The order details are valid"
      )
    },
    {
      name: "missing core state",
      body: body.replace("## Preconditions\n\n- The order details are valid\n\n", "## Preconditions\n\n")
    }
  ];

  for (const fixture of cases) {
    const documentSet = cloneDocumentSet();
    routeWorkflow(documentSet, "Order submission", "workflows/order-submission.md");
    addDocument(documentSet, "workflows/order-submission.md", fixture.body);

    const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
    const workflowRuleIds = [...new Set(result.diagnostics
      .filter((entry) => entry.severity === "error" && entry.ruleId.startsWith("DM-WF-"))
      .map((entry) => entry.ruleId))];

    assert.deepEqual(workflowRuleIds, ["DM-WF-005"], fixture.name);
  }
});

test("DM-WF-006 rejects invalid expanded lists steps transitions and operation references", () => {
  const body = canonicalWorkflowBody();
  const cases = [
    {
      name: "precondition continuation line",
      body: body.replace(
        "- The order details are valid",
        "- The order details are valid\ncontinued prose"
      )
    },
    {
      name: "nested precondition item",
      body: body.replace(
        "- The order details are valid",
        "- The order details are valid\n  - nested detail"
      )
    },
    {
      name: "precondition heading",
      body: body.replace(
        "- The order details are valid",
        "### Nested heading\n- The order details are valid"
      )
    },
    {
      name: "precondition table",
      body: body.replace(
        "- The order details are valid",
        "| Condition |\n|---|\n| valid |"
      )
    },
    {
      name: "precondition fence",
      body: body.replace(
        "- The order details are valid",
        "```text\nnot a list\n```"
      )
    },
    {
      name: "unnumbered step",
      body: body.replace(
        "1. SEND orders.commands (sendCreateOrder) -- retain the order identifier",
        "- SEND orders.commands (sendCreateOrder) -- retain the order identifier"
      )
    },
    {
      name: "unknown operation reference in a step",
      body: body.replace("sendCreateOrder", "missingOperation")
    },
    {
      name: "wrong state-transition columns",
      body: body.replace("| From | Trigger | To |", "| Source | Trigger | Target |")
    },
    {
      name: "empty state-transition table",
      body: body.replace(
        "| order.ready | SEND orders.commands (sendCreateOrder) | order.accepted |\n",
        ""
      )
    },
    {
      name: "empty state-transition cell",
      body: body.replace(
        "| order.ready | SEND orders.commands (sendCreateOrder) | order.accepted |",
        "| order.ready | SEND orders.commands (sendCreateOrder) | |"
      )
    },
    {
      name: "content after state-transition table",
      body: body.replace(
        "| order.ready | SEND orders.commands (sendCreateOrder) | order.accepted |",
        "| order.ready | SEND orders.commands (sendCreateOrder) | order.accepted |\ntrailing prose"
      )
    }
  ];

  for (const fixture of cases) {
    const documentSet = cloneDocumentSet();
    routeWorkflow(documentSet, "Order submission", "workflows/order-submission.md");
    addDocument(documentSet, "workflows/order-submission.md", fixture.body);

    const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
    const workflowRuleIds = [...new Set(result.diagnostics
      .filter((entry) => entry.severity === "error" && entry.ruleId.startsWith("DM-WF-"))
      .map((entry) => entry.ruleId))];

    assert.deepEqual(workflowRuleIds, ["DM-WF-006"], fixture.name);
  }
});

test("DM-WF-004 through DM-WF-006 maintain complete-scope rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const workflowBodyRules = catalog.rules.filter((entry) => (
    ["DM-WF-004", "DM-WF-005", "DM-WF-006"].includes(entry.rule_id)
  ));

  assert.deepEqual(workflowBodyRules.map((entry) => entry.rule_id), [
    "DM-WF-004",
    "DM-WF-005",
    "DM-WF-006"
  ]);
  assert.deepEqual(workflowBodyRules.map((entry) => entry.scope), [
    "complete",
    "complete",
    "complete"
  ]);
  assert.deepEqual(auditRuleTestCorrespondence({
    catalogRuleIds: workflowBodyRules.map((entry) => entry.rule_id),
    testNames: workflowBodyRuleTestNames,
    rulePrefixes: ["DM-WF"]
  }), { passed: true, errors: [] });
});
