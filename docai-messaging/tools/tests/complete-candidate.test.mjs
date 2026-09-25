import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveTrustedCompleteExampleAdapters } from "../lib/complete-example-adapters.mjs";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { validateCompleteProfilePair } from "../lib/validators/complete-profiles.mjs";

const candidatePath = fileURLToPath(new URL(
  "../../fixtures/complete-candidates/v0.17.1/",
  import.meta.url
));
const candidateManifest = JSON.parse(fs.readFileSync(
  path.join(candidatePath, "source", "projection-input-manifest.json"),
  "utf8"
));
const candidateExampleAdapters = resolveTrustedCompleteExampleAdapters(candidateManifest);

function validateCandidateDocumentSet(documentSet, options = {}) {
  return validateCompleteDocumentSet(documentSet, {
    ...options,
    exampleAdapters: candidateExampleAdapters
  });
}

const CSV_MEDIA_TYPE = "text/csv;charset=utf-8";

function replaceRawWithCsv(documentSet, example) {
  const channel = documentSet.files.find((entry) => (
    entry.path === "channels/representations.md"
  ));
  assert.notEqual(channel, undefined);
  const raw = [
    "**media_type**: application/octet-stream",
    "",
    "Opaque receipt bytes are limited to 2 MiB and carry a SHA-256 integrity digest."
  ].join("\n");
  const csv = [
    `**media_type**: ${CSV_MEDIA_TYPE}`,
    "",
    "**payload_nullable**: no",
    "",
    "```csv",
    example,
    "```",
    "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| event_id | string | yes | no | Synthetic event identifier |",
    "| status | string | yes | no | Lifecycle status |"
  ].join("\n");
  assert.equal(channel.content.split(raw).length - 1, 1);
  channel.content = channel.content.replace(raw, csv);
  channel.bytes = Buffer.from(channel.content, "utf8");
  channel.identityLine += csv.split("\n").length - raw.split("\n").length;
}

test("validates an adapter-defined structured non-JSON example only with an explicit adapter", () => {
  const withoutAdapter = loadDocumentSet(path.join(candidatePath, "full"));
  replaceRawWithCsv(withoutAdapter, "event_id,status\n\"evt_03\",\"created\"");
  const rejected = validateCompleteDocumentSet(withoutAdapter, { wholeSet: false });
  assert.equal(rejected.diagnostics.some((entry) => entry.ruleId === "DM-MSG-004"), true);

  const withAdapter = loadDocumentSet(path.join(candidatePath, "full"));
  replaceRawWithCsv(withAdapter, "event_id,status\n\"evt_03\",\"created\"");
  const accepted = validateCompleteDocumentSet(withAdapter, {
    wholeSet: false,
    exampleAdapters: candidateExampleAdapters
  });
  assert.deepEqual(accepted.diagnostics, []);
});

test("compares full and compact adapter-defined examples by decoded value", () => {
  const full = loadDocumentSet(path.join(candidatePath, "full"));
  const compact = loadDocumentSet(path.join(candidatePath, "compact"));
  replaceRawWithCsv(full, "event_id,status\n\"evt_03\",\"created\"");
  replaceRawWithCsv(compact, "event_id,status\nevt_03,created");

  const result = validateCompleteProfilePair(full, compact, {
    wholeSet: false,
    exampleAdapters: candidateExampleAdapters
  });

  assert.deepEqual(result.diagnostics, []);
});

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
  assert.deepEqual(source.referenceMaterials["middle-operations"], {
    instructionAuthority: "none",
    info: "markdown",
    rawContent: [
      "\uFEFF# Middle operations notes\r\n",
      "\r\n",
      "Use only synthetic identifiers when recording examples.\r\n",
      "A literal ```` run remains data.\r\n",
      "Cafe\u0301 stays decomposed.\r\n",
      "\r\n"
    ].join("")
  });
});

test("binds the advanced representation source into the projection manifest", () => {
  const sourcePath = path.join(candidatePath, "source", "complete-representations.json");
  assert.equal(fs.existsSync(sourcePath), true, "the advanced representation source exists");

  const sourceBytes = fs.readFileSync(sourcePath);
  const source = JSON.parse(sourceBytes.toString("utf8"));
  const manifest = JSON.parse(fs.readFileSync(
    path.join(candidatePath, "source", "projection-input-manifest.json"),
    "utf8"
  ));
  const manifestSource = manifest.sources.find((entry) => (
    entry.sourceId === "complete-representations"
  ));

  assert.deepEqual(manifestSource, {
    location: "complete-representations.json",
    revision: "fixture-1",
    sha256: `sha256:${createHash("sha256").update(sourceBytes).digest("hex")}`,
    sourceId: "complete-representations",
    specification: "none",
    type: "behavior-configuration"
  });
  assert.deepEqual(source.representations.map((entry) => ({
    operation: entry.operation,
    action: entry.action,
    channel: entry.channel,
    message: entry.message,
    form: entry.form,
    mediaType: entry.mediaType
  })), [
    {
      operation: "r-csv-operation",
      action: "SEND",
      channel: "representations.csv",
      message: "csv-message",
      form: "adapter-defined-structured",
      mediaType: "text/csv;charset=utf-8"
    },
    {
      operation: "r-json-original-operation",
      action: "SEND",
      channel: "representations.json-original",
      message: "json-original-message",
      form: "structured-json",
      mediaType: "application/json"
    },
    {
      operation: "r-json-reuse-operation",
      action: "SEND",
      channel: "representations.json-reuse",
      message: "json-reuse-message",
      form: "structured-json",
      mediaType: "application/json"
    },
    {
      operation: "r-raw-operation",
      action: "SEND",
      channel: "representations.raw",
      message: "raw-message",
      form: "opaque-raw",
      mediaType: "application/octet-stream"
    },
    {
      operation: "r-tagged-operation",
      action: "SEND",
      channel: "representations.tagged",
      message: "tagged-message",
      form: "tagged-variants",
      mediaType: "application/json"
    },
    {
      operation: "r-untagged-operation",
      action: "RECEIVE",
      channel: "representations.untagged",
      message: "untagged-message",
      form: "untagged-variants",
      mediaType: "application/json"
    }
  ]);
  assert.deepEqual(manifest.adapters.find((entry) => (
    entry.class === "payload-wire" && entry.target === CSV_MEDIA_TYPE
  )), {
    class: "payload-wire",
    ruleVersion: "complete-fixture-csv-1.0.0",
    target: CSV_MEDIA_TYPE
  });
  const csv = source.representations.find((entry) => entry.operation === "r-csv-operation");
  assert.deepEqual({
    schemaFormat: csv.schemaFormat,
    schema: csv.schema,
    wireAdapter: csv.wireAdapter,
    example: csv.example
  }, {
    schemaFormat: "application/vnd.aai.asyncapi+json;version=3.1.0",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["event_id", "status"],
      properties: {
        event_id: {
          type: "string",
          description: "Synthetic event identifier"
        },
        status: {
          type: "string",
          description: "Lifecycle status"
        }
      }
    },
    wireAdapter: {
      ruleVersion: "complete-fixture-csv-1.0.0",
      fenceInfo: "csv",
      decodedValueModel: "one object from one unique header row and one data row"
    },
    example: {
      event_id: "evt_03",
      status: "created"
    }
  });
});

test("candidate source defines two equal JSON representations for compact reuse", () => {
  const source = JSON.parse(fs.readFileSync(
    path.join(candidatePath, "source", "complete-representations.json"),
    "utf8"
  ));
  const reusable = source.representations.filter((entry) => (
    entry.operation === "r-json-original-operation"
      || entry.operation === "r-json-reuse-operation"
  ));

  assert.deepEqual(reusable, [
    {
      operation: "r-json-original-operation",
      action: "SEND",
      channel: "representations.json-original",
      message: "json-original-message",
      form: "structured-json",
      mediaType: "application/json",
      payloadRequired: "yes",
      payloadNullable: "no",
      schemaFormat: "application/vnd.aai.asyncapi+json;version=3.1.0",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["event_id", "status"],
        properties: {
          event_id: {
            type: "string",
            description: "Synthetic event identifier"
          },
          status: {
            type: "string",
            description: "Lifecycle status"
          }
        }
      },
      example: { event_id: "evt_04", status: "created" }
    },
    {
      operation: "r-json-reuse-operation",
      action: "SEND",
      channel: "representations.json-reuse",
      message: "json-reuse-message",
      form: "structured-json",
      mediaType: "application/json",
      payloadRequired: "yes",
      payloadNullable: "no",
      schemaFormat: "application/vnd.aai.asyncapi+json;version=3.1.0",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["event_id", "status"],
        properties: {
          event_id: {
            type: "string",
            description: "Synthetic event identifier"
          },
          status: {
            type: "string",
            description: "Lifecycle status"
          }
        }
      },
      example: { event_id: "evt_04", status: "created" }
    }
  ]);
});

test("compact candidate composes one-line JSON field defaults and same_as", () => {
  const full = loadDocumentSet(path.join(candidatePath, "full"));
  const compact = loadDocumentSet(path.join(candidatePath, "compact"));
  const compactResult = validateCandidateDocumentSet(compact);
  const pairResult = validateCompleteProfilePair(full, compact, {
    exampleAdapters: candidateExampleAdapters
  });
  const fullChannel = full.files.find((entry) => entry.path === "channels/representations.md");
  const compactChannel = compact.files.find((entry) => (
    entry.path === "channels/representations.md"
  ));

  assert.deepEqual(compactResult.diagnostics, []);
  assert.deepEqual(pairResult.diagnostics, []);
  assert.notEqual(fullChannel, undefined);
  assert.notEqual(compactChannel, undefined);
  assert.equal(fullChannel.content.includes([
    "```json",
    "{",
    "  \"event_id\": \"evt_04\",",
    "  \"status\": \"created\"",
    "}",
    "```",
    "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| event_id | string | yes | no | Synthetic event identifier |",
    "| status | string | yes | no | Lifecycle status |"
  ].join("\n")), true);
  assert.equal(compactChannel.content.includes([
    "```json",
    "{\"status\":\"created\",\"event_id\":\"evt_04\"}",
    "```",
    "",
    "**field_defaults**: Required=yes | Nullable=no",
    "",
    "| Field | Type | Constraints / Meaning |",
    "|---|---|---|",
    "| event_id | string | Synthetic event identifier |",
    "| status | string | Lifecycle status |"
  ].join("\n")), true);
  assert.equal(compactChannel.content.includes(
    "**same_as**: Operation r-json-original-operation Message json-original-message "
      + "Payload application/json"
  ), true);
  assert.deepEqual(compactResult.facts.complete.fieldDefaults.map((entry) => ({
    path: entry.path,
    columns: entry.columns,
    logicalHeader: entry.logicalHeader
  })), [{
    path: "channels/representations.md",
    columns: [
      { column: "Required", value: "yes" },
      { column: "Nullable", value: "no" }
    ],
    logicalHeader: ["Field", "Type", "Required", "Nullable", "Constraints / Meaning"]
  }]);
  assert.deepEqual(compactResult.facts.complete.sameAs.map((entry) => ({
    path: entry.path,
    reference: entry.reference,
    target: {
      operation: entry.target.operation,
      message: entry.target.message,
      reply: entry.target.reply,
      mediaType: entry.target.mediaType
    }
  })), [{
    path: "channels/representations.md",
    reference: {
      operation: "r-json-reuse-operation",
      message: "json-reuse-message",
      reply: false,
      mediaType: "application/json"
    },
    target: {
      operation: "r-json-original-operation",
      message: "json-original-message",
      reply: false,
      mediaType: "application/json"
    }
  }]);
});

for (const profile of ["full", "compact"]) {
  test(`${profile} candidate uses selective convention retrieval with workflow fallbacks`, () => {
    const result = validateCandidateDocumentSet(
      loadDocumentSet(path.join(candidatePath, profile))
    );

    assert.deepEqual(result.diagnostics, []);
    const retrieval = Object.fromEntries(
      result.facts.complete.conventionRetrieval.operations.map((entry) => [
        entry.operation,
        entry
      ])
    );
    assert.deepEqual(retrieval["r-json-original-operation"], {
      operation: "r-json-original-operation",
      selector: ["Data Representation"],
      requiredWorkflowPaths: [],
      trusted: { wholeFile: false, sections: ["Data Representation"] },
      untrusted: {
        wholeFile: true,
        sections: [
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
        ]
      },
      supplementalWorkflows: []
    });
    assert.deepEqual({
      selector: retrieval["a-operation"].selector,
      requiredWorkflowPaths: retrieval["a-operation"].requiredWorkflowPaths,
      trusted: retrieval["a-operation"].trusted,
      supplementalWorkflows: retrieval["a-operation"].supplementalWorkflows.map((entry) => ({
        path: entry.path,
        reason: entry.reason,
        wholeFile: entry.wholeFile
      }))
    }, {
      selector: "none",
      requiredWorkflowPaths: ["workflows/alpha-delivery.md"],
      trusted: { wholeFile: false, sections: [] },
      supplementalWorkflows: [
        {
          path: "workflows/alpha-observability.md",
          reason: "supplemental-workflow",
          wholeFile: true
        },
        {
          path: "workflows/state-none.md",
          reason: "supplemental-workflow",
          wholeFile: true
        },
        {
          path: "workflows/state-unknown.md",
          reason: "supplemental-workflow",
          wholeFile: true
        },
        {
          path: "workflows/state-unsupported.md",
          reason: "supplemental-workflow",
          wholeFile: true
        }
      ]
    });
    assert.deepEqual(
      result.facts.complete.conventionRetrieval.directWorkflows.map((entry) => entry.path),
      [
        "workflows/alpha-delivery.md",
        "workflows/alpha-observability.md",
        "workflows/state-none.md",
        "workflows/state-unknown.md",
        "workflows/state-unsupported.md"
      ]
    );
  });
}

test("candidate source cases reject forbidden direct context targets", () => {
  const source = JSON.parse(fs.readFileSync(
    path.join(candidatePath, "source", "complete-contexts.json"),
    "utf8"
  ));
  assert.deepEqual(source.contextTargetCases, [
    {
      id: "reference-required-forbidden",
      operation: "m-operation",
      requiredContext: "references/middle-operations.md",
      supplementalContext: "none",
      expectedRule: "DM-IDX-005"
    },
    {
      id: "channel-supplemental-forbidden",
      operation: "m-operation",
      requiredContext: "none",
      supplementalContext: "channels/middle.md",
      expectedRule: "DM-IDX-005"
    }
  ]);

  const originalRow = "| SEND | m.events | m-operation | m-message | middle task | Handles the middle event range | none | references/middle-operations.md | none |";
  for (const fixture of source.contextTargetCases) {
    const documentSet = loadDocumentSet(path.join(candidatePath, "full"));
    const operationIndex = documentSet.files.find((entry) => (
      entry.path === "indexes/operations-middle.md"
    ));
    assert.notEqual(operationIndex, undefined);
    const replacementRow = `| SEND | m.events | m-operation | m-message | middle task | Handles the middle event range | ${fixture.requiredContext} | ${fixture.supplementalContext} | none |`;
    assert.equal(operationIndex.content.includes(originalRow), true);
    operationIndex.content = operationIndex.content.replace(originalRow, replacementRow);
    operationIndex.bytes = Buffer.from(operationIndex.content, "utf8");

    const result = validateCandidateDocumentSet(documentSet, { wholeSet: false });
    assert.equal(
      result.diagnostics.some((entry) => (
        entry.severity === "error" && entry.ruleId === fixture.expectedRule
      )),
      true,
      fixture.id
    );
  }
});

for (const profile of ["full", "compact"]) {
  test(`${profile} candidate materializes tagged untagged raw and adapter-defined representations`, () => {
    const documentSet = loadDocumentSet(path.join(candidatePath, profile));
    const result = validateCandidateDocumentSet(documentSet);
    const channel = documentSet.files.find((entry) => (
      entry.path === "channels/representations.md"
    ));

    assert.deepEqual(result.diagnostics, []);
    assert.notEqual(channel, undefined);
    assert.deepEqual(
      Object.fromEntries([
        "r-csv-operation",
        "r-raw-operation",
        "r-tagged-operation",
        "r-untagged-operation"
      ].map((operation) => [
        operation,
        result.facts.core.messageDefinitions.byOperation[operation].map((entry) => ({
          direction: entry.direction,
          message: entry.name,
          path: entry.path,
          reply: entry.reply
        }))
      ])),
      {
        "r-csv-operation": [{
          direction: "SEND",
          message: "csv-message",
          path: "channels/representations.md",
          reply: false
        }],
        "r-raw-operation": [{
          direction: "SEND",
          message: "raw-message",
          path: "channels/representations.md",
          reply: false
        }],
        "r-tagged-operation": [{
          direction: "SEND",
          message: "tagged-message",
          path: "channels/representations.md",
          reply: false
        }],
        "r-untagged-operation": [{
          direction: "RECEIVE",
          message: "untagged-message",
          path: "channels/representations.md",
          reply: false
        }]
      }
    );
    assert.equal(channel.content.includes([
      "**variant**: kind = \"created\"",
      "",
      "```json",
      "{\"kind\":\"created\",\"id\":\"evt_01\"}",
      "```",
      "",
      "| Field | Type | Required | Nullable | Constraints / Meaning |",
      "|---|---|---|---|---|",
      "| kind | string | yes | no | `const=\"created\"`; Variant discriminator |",
      "| id | string | yes | no | Synthetic event identifier |"
    ].join("\n")), true);
    assert.equal(channel.content.includes([
      "**variant**: archived",
      "",
      "```json",
      "{\"reason\":\"expired\"}",
      "```",
      "",
      "| Field | Type | Presence | Nullable | Meaning |",
      "|---|---|---|---|---|",
      "| reason | string | always | no | Archival reason |"
    ].join("\n")), true);
    assert.equal(channel.content.includes([
      "**media_type**: application/octet-stream",
      "",
      "Opaque receipt bytes are limited to 2 MiB and carry a SHA-256 integrity digest."
    ].join("\n")), true);
    const csvExample = profile === "full"
      ? '"evt_03","created"'
      : "evt_03,created";
    assert.equal(channel.content.includes([
      `**media_type**: ${CSV_MEDIA_TYPE}`,
      "",
      "**payload_nullable**: no",
      "",
      "```csv",
      "event_id,status",
      csvExample,
      "```",
      "",
      "| Field | Type | Required | Nullable | Constraints / Meaning |",
      "|---|---|---|---|---|",
      "| event_id | string | yes | no | Synthetic event identifier |",
      "| status | string | yes | no | Lifecycle status |"
    ].join("\n")), true);
  });

  test(`${profile} candidate materializes required and supplemental contexts`, () => {
    const result = validateCandidateDocumentSet(
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
          supplemental: [
            "workflows/alpha-observability.md",
            "workflows/state-none.md",
            "workflows/state-unknown.md",
            "workflows/state-unsupported.md"
          ]
        },
        "r-csv-operation": { required: [], supplemental: [] },
        "r-json-original-operation": { required: [], supplemental: [] },
        "r-json-reuse-operation": { required: [], supplemental: [] },
        "r-raw-operation": { required: [], supplemental: [] },
        "r-tagged-operation": { required: [], supplemental: [] },
        "r-untagged-operation": { required: [], supplemental: [] },
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
        { name: "Alpha observability", path: "workflows/alpha-observability.md" },
        { name: "State none", path: "workflows/state-none.md" },
        { name: "State unknown", path: "workflows/state-unknown.md" },
        { name: "State unsupported", path: "workflows/state-unsupported.md" }
      ]
    );
    assert.deepEqual(
      result.facts.complete.workflowDefinitions
        .filter((workflow) => workflow.path.startsWith("workflows/alpha-"))
        .map((workflow) => ({
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
      delimiterLength: 5,
      content: [
        "# Middle operations notes\n",
        "\n",
        "Use only synthetic identifiers when recording examples.\n",
        "A literal ```` run remains data.\n",
        "Cafe\u0301 stays decomposed.\n",
        "\n"
      ].join(""),
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

  test(`${profile} candidate materializes every workflow section state in separate cases`, () => {
    const documentSet = loadDocumentSet(path.join(candidatePath, profile));
    const result = validateCandidateDocumentSet(documentSet);

    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(
      Object.fromEntries(result.facts.complete.workflowDefinitions.map((workflow) => [
        workflow.path,
        Object.fromEntries(Object.entries(workflow.sections).map(([heading, section]) => [
          heading,
          section.state
        ]))
      ])),
      {
        "workflows/alpha-delivery.md": {
          Preconditions: "expanded",
          Steps: "expanded",
          "State Transitions": "expanded",
          "Failure and Recovery": "expanded"
        },
        "workflows/alpha-observability.md": {
          Preconditions: "expanded",
          Steps: "expanded",
          "State Transitions": "expanded",
          "Failure and Recovery": "expanded"
        },
        "workflows/state-none.md": {
          Preconditions: "none",
          Steps: "none",
          "State Transitions": "none",
          "Failure and Recovery": "none"
        },
        "workflows/state-unknown.md": {
          Preconditions: "unknown",
          Steps: "unknown",
          "State Transitions": "unknown",
          "Failure and Recovery": "unknown"
        },
        "workflows/state-unsupported.md": {
          Preconditions: "unsupported",
          Steps: "unsupported",
          "State Transitions": "unsupported",
          "Failure and Recovery": "unsupported"
        }
      }
    );
    assert.deepEqual(
      Object.fromEntries([
        "INDEX.md",
        "workflows/state-none.md",
        "workflows/state-unknown.md",
        "workflows/state-unsupported.md"
      ].map((filePath) => {
        const file = documentSet.files.find((entry) => entry.path === filePath);
        return [filePath, {
          coverage: file?.metadata.coverage,
          knowledge: file?.metadata.knowledge
        }];
      })),
      {
        "INDEX.md": { coverage: "requires-source", knowledge: "requires-input" },
        "workflows/state-none.md": { coverage: "complete", knowledge: "complete" },
        "workflows/state-unknown.md": {
          coverage: "complete",
          knowledge: "requires-input"
        },
        "workflows/state-unsupported.md": {
          coverage: "requires-source",
          knowledge: "complete"
        }
      }
    );
  });

  test(`${profile} candidate exposes overlapping source and operation shard retrieval`, () => {
    const result = validateCandidateDocumentSet(
      loadDocumentSet(path.join(candidatePath, profile))
    );

    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.facts.core.sources.form, "sharded");
    assert.deepEqual(
      result.facts.core.sources.shards.map((shard) => ({
        firstId: shard.firstId,
        lastId: shard.lastId,
        path: shard.path
      })),
      [
        {
          firstId: "complete-contexts",
          lastId: "storefront-behavior",
          path: "indexes/sources-contexts-behavior.md"
        },
        {
          firstId: "storefront-asyncapi-3.1.0",
          lastId: "storefront-asyncapi-3.1.0",
          path: "indexes/sources-asyncapi.md"
        }
      ]
    );
    assert.deepEqual(
      result.facts.core.sourceResolutions["indexes/sources-asyncapi.md"],
      {
        requestedIds: ["storefront-asyncapi-3.1.0"],
        resolvedIds: [
          "complete-contexts",
          "complete-representations",
          "storefront-asyncapi-3.1.0",
          "storefront-behavior"
        ],
        loadedPaths: [
          "indexes/sources-asyncapi.md",
          "indexes/sources-contexts-behavior.md"
        ]
      }
    );
    assert.deepEqual(
      result.facts.core.sourceResolutions["indexes/sources-contexts-behavior.md"],
      {
        requestedIds: [
          "complete-contexts",
          "complete-representations",
          "storefront-behavior"
        ],
        resolvedIds: [
          "complete-contexts",
          "complete-representations",
          "storefront-behavior"
        ],
        loadedPaths: ["indexes/sources-contexts-behavior.md"]
      }
    );
    assert.deepEqual(result.facts.core.sourceResolutions["INDEX.md"], {
      requestedIds: [
        "complete-contexts",
        "complete-representations",
        "storefront-asyncapi-3.1.0",
        "storefront-behavior"
      ],
      resolvedIds: [
        "complete-contexts",
        "complete-representations",
        "storefront-asyncapi-3.1.0",
        "storefront-behavior"
      ],
      loadedPaths: [
        "indexes/sources-asyncapi.md",
        "indexes/sources-contexts-behavior.md"
      ]
    });

    const exactMiddle = result.facts.core.operationRetrieval.exact.operation["m-operation"];
    assert.deepEqual({
      loadedIndexPaths: exactMiddle.loadedIndexPaths,
      falsePositiveIndexPaths: exactMiddle.falsePositiveIndexPaths,
      matchedOperationNames: exactMiddle.matchedOperationNames,
      loadedSourceIndexPaths: exactMiddle.loadedSourceIndexPaths
    }, {
      loadedIndexPaths: [
        "indexes/operations-broad.md",
        "indexes/operations-middle.md"
      ],
      falsePositiveIndexPaths: ["indexes/operations-broad.md"],
      matchedOperationNames: ["m-operation"],
      loadedSourceIndexPaths: [
        "indexes/sources-asyncapi.md",
        "indexes/sources-contexts-behavior.md"
      ]
    });
    assert.deepEqual({
      loadedIndexPaths: result.facts.core.operationRetrieval.semanticFallback.loadedIndexPaths,
      matchedOperationNames:
        result.facts.core.operationRetrieval.semanticFallback.matchedOperationNames,
      loadedSourceIndexPaths:
        result.facts.core.operationRetrieval.semanticFallback.loadedSourceIndexPaths
    }, {
      loadedIndexPaths: [
        "indexes/operations-broad.md",
        "indexes/operations-middle.md"
      ],
      matchedOperationNames: [
        "a-operation",
        "m-operation",
        "r-csv-operation",
        "r-json-original-operation",
        "r-json-reuse-operation",
        "r-raw-operation",
        "r-tagged-operation",
        "r-untagged-operation",
        "z-operation"
      ],
      loadedSourceIndexPaths: [
        "indexes/sources-asyncapi.md",
        "indexes/sources-contexts-behavior.md"
      ]
    });
    assert.equal(result.facts.complete.workflows.form, "direct");
  });
}
