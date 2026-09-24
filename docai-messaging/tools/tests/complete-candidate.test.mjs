import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";

const candidatePath = fileURLToPath(new URL(
  "../../fixtures/complete-candidates/v0.17.1/",
  import.meta.url
));

test("binds the complete context source scenario into the projection manifest", () => {
  const sourcePath = path.join(candidatePath, "source", "complete-contexts.json");
  assert.equal(fs.existsSync(sourcePath), true, "the complete context source scenario exists");

  const sourceBytes = fs.readFileSync(sourcePath);
  const source = JSON.parse(sourceBytes.toString("utf8"));
  const manifest = JSON.parse(fs.readFileSync(
    path.join(candidatePath, "source", "projection-input-manifest.json"),
    "utf8"
  ));
  const manifestSource = manifest.sources.find((entry) => (
    entry.sourceId === "complete-contexts"
  ));

  assert.deepEqual(manifestSource, {
    location: "complete-contexts.json",
    revision: "fixture-1",
    sha256: `sha256:${createHash("sha256").update(sourceBytes).digest("hex")}`,
    sourceId: "complete-contexts",
    specification: "none",
    type: "behavior-configuration"
  });
  assert.equal(source.sourceId, "complete-contexts");
  assert.equal(source.revision, "fixture-1");
});

for (const profile of ["full", "compact"]) {
  test(`${profile} candidate materializes required and supplemental contexts`, () => {
    const result = validateCompleteDocumentSet(
      loadDocumentSet(path.join(candidatePath, profile))
    );

    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(
      Object.fromEntries(result.facts.core.operations.rows.map((row) => [
        row.operation,
        {
          required: row.requiredContexts,
          supplemental: row.supplementalContexts
        }
      ])),
      {
        "a-operation": {
          required: ["workflows/alpha-delivery.md"],
          supplemental: ["workflows/alpha-observability.md"]
        },
        "z-operation": { required: [], supplemental: [] },
        "m-operation": {
          required: [],
          supplemental: ["references/middle-operations.md"]
        }
      }
    );
    assert.deepEqual(
      result.facts.complete.workflows.rows.map(({ name, path: workflowPath }) => ({
        name,
        path: workflowPath
      })),
      [
        { name: "Alpha delivery", path: "workflows/alpha-delivery.md" },
        { name: "Alpha observability", path: "workflows/alpha-observability.md" }
      ]
    );
    assert.deepEqual(
      result.facts.complete.workflowDefinitions.map((workflow) => ({
        path: workflow.path,
        title: workflow.title,
        steps: workflow.sections.Steps.steps,
        transitions: workflow.sections["State Transitions"].rows
      })),
      [
        {
          path: "workflows/alpha-delivery.md",
          title: "Alpha delivery across operation boundaries",
          steps: [
            "SEND a.events (a-operation) -- retain the alpha event identifier",
            "SEND m.events (m-operation) -- record the correlated middle event"
          ],
          transitions: [
            {
              from: "alpha.ready",
              trigger: "SEND a.events (a-operation)",
              to: "alpha.sent"
            },
            {
              from: "alpha.sent",
              trigger: "SEND m.events (m-operation)",
              to: "middle.recorded"
            }
          ]
        },
        {
          path: "workflows/alpha-observability.md",
          title: "Alpha observability guidance",
          steps: ["SEND a.events (a-operation) -- record the synthetic trace identifier"],
          transitions: [{
            from: "trace.pending",
            trigger: "SEND a.events (a-operation)",
            to: "trace.recorded"
          }]
        }
      ]
    );
    assert.deepEqual(result.facts.complete.referenceMaterials, [{
      path: "references/middle-operations.md",
      info: "markdown",
      delimiterLength: 4,
      content: "# Middle operations notes\n\nUse only synthetic identifiers when recording examples.\n",
      consumerOperations: ["m-operation"]
    }]);

    const zetaRetrieval = result.facts.complete.conventionRetrieval.operations.find((entry) => (
      entry.operation === "z-operation"
    ));
    assert.deepEqual({
      requiredWorkflowPaths: zetaRetrieval.requiredWorkflowPaths,
      supplementalWorkflows: zetaRetrieval.supplementalWorkflows
    }, {
      requiredWorkflowPaths: [],
      supplementalWorkflows: []
    });
  });
}
