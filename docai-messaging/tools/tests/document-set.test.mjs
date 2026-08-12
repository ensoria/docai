import nodeTest from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadDocumentSet, validateDocumentSet } from "../lib/document-set.mjs";
import { auditRuleTestCorrespondence } from "../lib/fixture-runner.mjs";
import * as coreValidator from "../lib/validators/core.mjs";
import * as coreRouting from "../lib/validators/core-routing.mjs";
import { restampDocumentSet } from "../restamp-document-set.mjs";

const SET_DIGEST = "sha256:813b7cf8b838a5e3ba2fa494405bbf061bd1c6c0f693077d7349fd4c4d45dd2b";
const SET_ID = "b32:qe5xz6fyhcs6horpuskeaw57ay";
const PROJECTION_DIGEST = "sha256:17b223a4bf668cc9e2fcef034fb8c83e2655055de8736737619b76a4a1d666d0";
const PROJECTION_ID = "b32:c6zchjf7m2gmtyx454bu7ogihy";
const ALTERNATE_ID = "b32:aaaaaaaaaaaaaaaaaaaaaaaaaa";
const MANIFEST_SOURCE = "{\"projection\":\"v1\"}\n";
const MANIFEST_DIGEST = "sha256:070ac8cb2c8c4b0052fb169a30c76075402ab4a071052ff722a6ce073424fee0";
const MANIFEST_ID = "b32:a4fmrszmrrfqaux3c2ndbr3aou";
const restampPath = fileURLToPath(new URL("../restamp-document-set.mjs", import.meta.url));
const catalogPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));
const task5RuleTestNames = [];
const task6RuleTestNames = [];
const task7RuleTestNames = [];

const CONVENTION_HEADINGS = [
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

function task5Test(name, ...arguments_) {
  task5RuleTestNames.push(String(name));
  return nodeTest(name, ...arguments_);
}

function task6Test(name, ...arguments_) {
  task6RuleTestNames.push(String(name));
  return nodeTest(name, ...arguments_);
}

function task7Test(name, ...arguments_) {
  task7RuleTestNames.push(String(name));
  return nodeTest(name, ...arguments_);
}

function temporaryDirectory(t, prefix = "docai-messaging-set-") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function metadata(overrides = {}) {
  const values = {
    "docai-messaging": "0.17.1",
    profile: "full",
    perspective: "storefront",
    coverage: "complete",
    knowledge: "complete",
    source_refs: "all",
    ...overrides
  };
  return `> docai-messaging: ${values["docai-messaging"]} | profile: ${values.profile} | perspective: ${values.perspective} | coverage: ${values.coverage} | knowledge: ${values.knowledge} | source_refs: ${values.source_refs}`;
}

function identity({
  root = false,
  setId = SET_ID,
  projectionId = PROJECTION_ID,
  setDigest = SET_DIGEST,
  projectionDigest = PROJECTION_DIGEST
} = {}) {
  const short = `> docai-identity: set_id: ${setId} | projection_id: ${projectionId}`;
  return root ? `${short} | set_digest: ${setDigest} | projection_digest: ${projectionDigest}` : short;
}

function directSources(rows = [
  ["source-a", "pass-through", "none", "none", "none", "source.json", "none"]
], markers = []) {
  return [
    "| ID | Kind | Specification | API | Contract version | Location | Revision |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    ...markers
  ].join("\n");
}

function sourceShardRoutes(rows) {
  return [
    "### Source Shards",
    "",
    "| First ID | Last ID | Kinds | Summary | Details |",
    "|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function sourceShardBody(rows, markers = []) {
  return [
    "# Messaging Source Index",
    "",
    "## Sources",
    "",
    directSources(rows, markers)
  ].join("\n");
}

function operationTable(rows, columns = [
  "Action",
  "Channel",
  "Operation",
  "Message",
  "Task",
  "Summary",
  "Required context",
  "Supplemental context"
]) {
  return [
    `| ${columns.join(" | ")} |`,
    `|${columns.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function flatOperations(groups) {
  return groups.map((group) => [
    `### ${group.path}`,
    "",
    operationTable(group.rows, group.columns)
  ].join("\n")).join("\n\n");
}

function operationShardRoutes(rows) {
  return [
    "| Tasks | Actions | First channel | Last channel | First operation | Last operation | First message | Last message | Summary | Details |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function operationShardBody(groups) {
  return [
    "# Messaging Operation Index",
    "",
    "## Operations",
    "",
    flatOperations(groups)
  ].join("\n");
}

function unprojectedMarker({ dimension, sourceId, identity: operationIdentity, reason }) {
  const prefix = dimension === "unsupported"
    ? "**unsupported**: localized: source operation"
    : "**unknown**: source operation";
  return `${prefix} ${sourceId} ${Buffer.byteLength(operationIdentity, "utf8")}:${operationIdentity}: ${reason}`;
}

function unprojectedShardRoutes(rows) {
  return [
    "### Unprojected Operation Shards",
    "",
    "| Source refs | Summary | Details |",
    "|---|---|---|",
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function unprojectedShardBody(markers) {
  return [
    "# Messaging Unprojected Operation Index",
    "",
    "## Unprojected Operations",
    "",
    ...markers
  ].join("\n");
}

function operationBody(row, overrides = {}) {
  const [action, channel, operation, messageCell] = row;
  const routedMessages = messageCell.split("; ");
  const primaryMessage = routedMessages.find((entry) => !entry.startsWith("reply:")) ?? "message";
  const replyMessages = routedMessages
    .filter((entry) => entry.startsWith("reply:"))
    .map((entry) => entry.slice("reply:".length));
  const behavior = overrides.behavior ?? [
    "- side_effects: none",
    "- idempotency: none",
    "- preconditions: none",
    "- authorization: none",
    "- delivery: none",
    "- ordering: none"
  ];
  const messages = overrides.messages ?? [
    overrides.messageHeading ?? `### Message ${primaryMessage}`,
    "",
    "#### Headers",
    "",
    "none",
    "",
    "#### Bindings",
    "",
    "none",
    "",
    "#### Payload",
    "",
    "none"
  ];
  return [
    overrides.prelude,
    overrides.heading ?? `## ${action} ${channel} (${operation})`,
    "",
    overrides.deprecated,
    overrides.purpose ?? "Documents the selected messaging operation.",
    "",
    "### Behavior",
    "",
    ...behavior,
    "",
    "### Operation Bindings",
    "",
    ...(overrides.operationBindings ?? ["none"]),
    "",
    "### Channel",
    "",
    ...(overrides.channel ?? ["- Parameters: none", "- Bindings: none"]),
    "",
    ...messages,
    "",
    "### Reply",
    "",
    ...(overrides.reply ?? (replyMessages.length === 1
      ? expandedReply(replyMessages[0])
      : ["none"])),
    "",
    "### Failure Handling",
    "",
    ...(overrides.failureHandling ?? ["none"]),
    "",
    "### Related",
    "",
    "none"
  ].filter((entry) => entry !== undefined).join("\n");
}

function messageSection(name, {
  level = 3,
  selection,
  content
} = {}) {
  const heading = "#".repeat(level);
  const subsection = "#".repeat(level + 1);
  return [
    `${heading} Message ${name}`,
    "",
    selection,
    ...(content ?? [
      `${subsection} Headers`,
      "",
      "none",
      "",
      `${subsection} Bindings`,
      "",
      "none",
      "",
      `${subsection} Payload`,
      "",
      "none"
    ])
  ].filter((entry) => entry !== undefined);
}

function payloadMessage(name, payload, { level = 3, selection } = {}) {
  const subsection = "#".repeat(level + 1);
  return messageSection(name, {
    level,
    selection,
    content: [
      `${subsection} Headers`, "", "none",
      "", `${subsection} Bindings`, "", "none",
      "", `${subsection} Payload`, "", ...payload
    ]
  });
}

function jsonPayload({
  direction = "SEND",
  marker,
  mediaType = "application/json",
  nullable = "no",
  example = '{"id":"ord_01"}',
  rows = ["| id | string | yes | no | Order identifier |"],
  beforeRepresentation = [],
  afterRepresentation = []
} = {}) {
  const send = direction === "SEND";
  return [
    marker ?? (send ? "**payload_required**: yes" : "**payload_presence**: always"),
    "",
    ...beforeRepresentation,
    ...(beforeRepresentation.length === 0 ? [] : [""]),
    `**media_type**: ${mediaType}`, "",
    `**payload_nullable**: ${nullable}`, "",
    "```json", example, "```", "",
    send
      ? "| Field | Type | Required | Nullable | Constraints / Meaning |"
      : "| Field | Type | Presence | Nullable | Meaning |",
    "|---|---|---|---|---|",
    ...rows,
    ...afterRepresentation
  ];
}

function expandedReply(name = "create-order-reply", {
  channel = "orders.replies",
  correlation = "the `correlation_id` header equals the request `message_id` header",
  timeout = "30 seconds -- report the request as unresolved",
  keyMarkers = [],
  channelContent = ["- Parameters: none", "- Bindings: none"],
  messages
} = {}) {
  return [
    `- channel: ${channel}`,
    `- correlation: ${correlation}`,
    `- timeout: ${timeout}`,
    ...keyMarkers,
    "",
    "#### Channel",
    "",
    ...channelContent,
    "",
    ...(messages ?? messageSection(name, { level: 4 }))
  ];
}

function failureShape(label, { replacement, content } = {}) {
  return [
    `**message_shape**: ${label}`,
    "",
    ...(replacement === undefined
      ? (content ?? [
        "- Headers: none",
        "- Bindings: none",
        "#### Payload",
        "",
        "none"
      ])
      : [`**unsupported**: replaces failure shape ${replacement}: encoded failure shape source.json#/failures`])
  ];
}

function failureTable(rows = [[
  "publish-timeout",
  "broker timeout",
  "The broker does not confirm the publish before the deadline",
  "Report the outcome as unresolved and resend with the same message ID"
]]) {
  return [
    "| Failure | Signal | Condition | Action |",
    "|---|---|---|---|",
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ];
}

function channelBody(rows) {
  return rows.map((row) => operationBody(row)).join("\n\n");
}

function minimalRootBody({
  profileLink,
  sourcesContent = directSources(),
  operationHeading = "## Operations",
  operationContent = "none",
  workflowsContent = "none",
  unprojectedContent
} = {}) {
  const lines = [];
  if (profileLink !== undefined) lines.push(profileLink, "");
  lines.push(
    "# Messaging Index",
    "",
    "## Sources",
    "",
    sourcesContent,
    "",
    operationHeading,
    "",
    operationContent,
    "",
    "## Workflows",
    "",
    workflowsContent
  );
  if (unprojectedContent !== undefined) {
    lines.push("", "## Unprojected Operations", "", unprojectedContent);
  }
  return lines.join("\n");
}

function conventionsBody(sectionContents = {}) {
  return [
    "# Messaging Conventions",
    ...CONVENTION_HEADINGS.flatMap((heading) => [
      "",
      `## ${heading}`,
      "",
      ...(sectionContents[heading] ?? ["none"])
    ])
  ].join("\n");
}

function documentSource({ root = false, metadataOverrides, identityOverrides, body } = {}) {
  return [
    metadata(metadataOverrides),
    "",
    body ?? (root ? minimalRootBody() : conventionsBody()),
    "",
    identity({ root, ...identityOverrides }),
    ""
  ].join("\n");
}

function write(root, relativePath, content) {
  const absolutePath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function createSet(t, {
  rootDir,
  rootIdentity,
  childMetadata,
  childIdentity,
  childPath = "CONVENTIONS.md"
} = {}) {
  const root = rootDir ?? temporaryDirectory(t);
  fs.mkdirSync(root, { recursive: true });
  write(root, "INDEX.md", documentSource({ root: true, identityOverrides: rootIdentity }));
  write(root, childPath, documentSource({
    metadataOverrides: childMetadata,
    identityOverrides: childIdentity
  }));
  return root;
}

function writeSourceShard(root, relativePath, {
  rows,
  sourceRefs,
  knowledge = "complete",
  markers = [],
  body
}) {
  write(root, relativePath, documentSource({
    metadataOverrides: { source_refs: sourceRefs, knowledge },
    body: body ?? sourceShardBody(rows, markers)
  }));
}

function writeDocument(root, relativePath, {
  sourceRefs = "all",
  body = "# Placeholder"
} = {}) {
  write(root, relativePath, documentSource({
    metadataOverrides: { source_refs: sourceRefs },
    body
  }));
}

function writeOperationShard(root, relativePath, {
  groups,
  sourceRefs = "all",
  body
}) {
  writeDocument(root, relativePath, {
    sourceRefs,
    body: body ?? operationShardBody(groups)
  });
}

function writeUnprojectedShard(root, relativePath, {
  markers,
  sourceRefs,
  coverage = markers.some((entry) => entry.startsWith("**unsupported**:"))
    ? "requires-source"
    : "complete",
  knowledge = markers.some((entry) => entry.startsWith("**unknown**:"))
    ? "requires-input"
    : "complete",
  body
}) {
  write(root, relativePath, documentSource({
    metadataOverrides: { source_refs: sourceRefs, coverage, knowledge },
    body: body ?? unprojectedShardBody(markers)
  }));
}

const BASIC_OPERATION_ROW = [
  "SEND",
  "orders.commands",
  "create-order",
  "create-order",
  "create order",
  "Creates an order command",
  "none",
  "none"
];

const ALPHA_OPERATION_ROW = [
  "SEND",
  "a.events",
  "a-operation",
  "a-message",
  "alpha task",
  "Handles the alpha event range",
  "none",
  "none"
];
const MIDDLE_OPERATION_ROW = [
  "SEND",
  "m.events",
  "m-operation",
  "m-message; reply:m-reply",
  "middle task",
  "Handles the middle event and its reply",
  "none",
  "none"
];
const ZETA_OPERATION_ROW = [
  "RECEIVE",
  "z.events",
  "z-operation",
  "z-message",
  "zeta task",
  "Handles the zeta event range",
  "none",
  "none"
];
const OVERLAPPING_OPERATION_ROUTES = [
  [
    "alpha task; zeta task",
    "SEND; RECEIVE",
    "a.events",
    "z.events",
    "a-operation",
    "z-operation",
    "a-message",
    "z-message",
    "Broad operation range",
    "indexes/operations-broad.md"
  ],
  [
    "middle task",
    "SEND",
    "m.events",
    "m.events",
    "m-operation",
    "m-operation",
    "m-message",
    "reply:m-reply",
    "Middle operation range",
    "indexes/operations-middle.md"
  ]
];

function createFlatOperationSet(t, {
  rows = [BASIC_OPERATION_ROW],
  columns,
  channelPath = "channels/orders.md",
  writeChannel = true,
  channelBody: channelBodyOverride,
  channelSourceRefs = "all",
  sourcesContent,
  childMetadata
} = {}) {
  const root = createSet(t, { childMetadata });
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent,
      operationContent: flatOperations([{ path: channelPath, rows, columns }])
    })
  }));
  if (writeChannel) {
    writeDocument(root, channelPath, {
      sourceRefs: channelSourceRefs,
      body: channelBodyOverride ?? channelBody(rows)
    });
  }
  return root;
}

function createShardedOperationSet(t, {
  routes = OVERLAPPING_OPERATION_ROUTES,
  broadRows = [ALPHA_OPERATION_ROW, ZETA_OPERATION_ROW],
  middleRows = [MIDDLE_OPERATION_ROW],
  writeBroad = true,
  writeMiddle = true,
  broadBody,
  middleBody
} = {}) {
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  const sourcesContent = directSources([
    ["source-a", "pass-through", "none", "none", "none", "a.md", "none"],
    ["source-q", "configuration", "none", "none", "none", "q.json", "none"],
    ["source-z", "pass-through", "none", "none", "none", "z.md", "none"]
  ]);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent,
      operationHeading: "## Operation Shards",
      operationContent: operationShardRoutes(routes)
    })
  }));
  if (writeBroad) {
    writeOperationShard(root, "indexes/operations-broad.md", {
      sourceRefs: "source-q",
      groups: [
        { path: "channels/alpha.md", rows: broadRows.slice(0, 1) },
        { path: "channels/zeta.md", rows: broadRows.slice(1) }
      ],
      body: broadBody
    });
  }
  if (writeMiddle) {
    writeOperationShard(root, "indexes/operations-middle.md", {
      sourceRefs: "source-q",
      groups: [{ path: "channels/middle.md", rows: middleRows }],
      body: middleBody
    });
  }
  writeDocument(root, "channels/alpha.md", {
    sourceRefs: "source-a",
    body: operationBody(ALPHA_OPERATION_ROW)
  });
  writeDocument(root, "channels/zeta.md", {
    sourceRefs: "source-a",
    body: operationBody(ZETA_OPERATION_ROW)
  });
  writeDocument(root, "channels/middle.md", {
    sourceRefs: "source-z",
    body: operationBody(MIDDLE_OPERATION_ROW)
  });
  return root;
}

function ruleIds(result) {
  return result.diagnostics.map((entry) => entry.ruleId);
}

function taskScoped(root) {
  return validateDocumentSet(loadDocumentSet(root), { wholeSet: false });
}

function runRestamp(...arguments_) {
  return spawnSync(process.execPath, [restampPath, ...arguments_], { encoding: "utf8" });
}

function withLineEnding(source, lineEnding) {
  return Buffer.from(source.replaceAll("\n", lineEnding), "utf8");
}

task5Test("accepts the DM-IDX-001 flat root INDEX with empty Operations and Workflows", (t) => {
  const root = createSet(t);
  assert.deepEqual(taskScoped(root).diagnostics, []);
});

task5Test("accepts the DM-IDX-002 optional compact profile link in a full root INDEX", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({ profileLink: "Compact set: ../docs-compact/" })
  }));
  assert.deepEqual(taskScoped(root).diagnostics, []);
});

task5Test("accepts the DM-IDX-001 Operation Shards root structure", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      operationHeading: "## Operation Shards",
      operationContent: [
        "| Tasks | Actions | First channel | Last channel | First operation | Last operation | First message | Last message | Summary | Details |",
        "|---|---|---|---|---|---|---|---|---|---|",
        "| orders | SEND | orders | orders | create-order | create-order | create-order | create-order | Order commands | indexes/orders.md |"
      ].join("\n")
    })
  }));
  assert.equal(ruleIds(taskScoped(root)).includes("DM-IDX-001"), false);
});

task5Test("accepts the DM-IDX-001 optional final Unprojected Operations section structure", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { coverage: "requires-source" },
    body: minimalRootBody({
      unprojectedContent: "**unsupported**: localized: source operation source-a 8:legacy-1: unsupported source feature at source.json"
    })
  }));
  assert.equal(ruleIds(taskScoped(root)).includes("DM-IDX-001"), false);
});

for (const [name, body] of [
  ["wrong title", minimalRootBody().replace("# Messaging Index", "# Message Index")],
  ["a level-three heading before the title", `### x-Notes\n\n${minimalRootBody()}`],
  ["prose between the title and Sources", minimalRootBody().replace(
    "# Messaging Index\n\n## Sources",
    "# Messaging Index\n\nUnexpected root prose.\n\n## Sources"
  )],
  ["missing Sources", minimalRootBody().replace(/## Sources[\s\S]*?(?=## Operations)/, "")],
  ["missing operation routing", minimalRootBody().replace(/\n\n## Operations\n\nnone/, "")],
  ["reordered sections", minimalRootBody()
    .replace("## Operations\n\nnone\n\n## Workflows\n\nnone", "## Workflows\n\nnone\n\n## Operations\n\nnone")],
  ["both operation forms", minimalRootBody().replace(
    "## Operations\n\nnone",
    "## Operations\n\nnone\n\n## Operation Shards\n\nnone"
  )],
  ["missing Workflows", minimalRootBody().replace(/\n\n## Workflows[\s\S]*$/, "")],
  ["Unprojected Operations before Workflows", minimalRootBody({ unprojectedContent: "none" })
    .replace(
      "## Workflows\n\nnone\n\n## Unprojected Operations\n\nnone",
      "## Unprojected Operations\n\nnone\n\n## Workflows\n\nnone"
    )],
  ["unexpected root section", `${minimalRootBody()}\n\n## Notes\n\nnone`]
]) {
  task5Test(`DM-IDX-001 rejects a root INDEX with ${name}`, (t) => {
    const root = createSet(t);
    write(root, "INDEX.md", documentSource({ root: true, body }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-001"));
  });
}

for (const [name, profile, profileLink] of [
  ["an invalid compact path", "full", "Compact set: ../docs compact/"],
  ["a Full set label for the full profile", "full", "Full set: ../docs-full/"],
  ["unexpected text before the title", "full", "Read this first"],
  ["no Full set link for a compact profile", "compact", undefined],
  ["a Compact set label for a compact profile", "compact", "Compact set: ../docs-compact/"]
]) {
  task5Test(`DM-IDX-002 rejects ${name}`, (t) => {
    const root = createSet(t);
    write(root, "INDEX.md", documentSource({
      root: true,
      metadataOverrides: { profile },
      body: minimalRootBody({ profileLink })
    }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-002"));
  });
}

task5Test("accepts the DM-IDX-002 required full profile link in a compact root INDEX", (t) => {
  const root = createSet(t, { childMetadata: { profile: "compact" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { profile: "compact" },
    body: minimalRootBody({ profileLink: "Full set: ../docs-full/" })
  }));
  assert.deepEqual(taskScoped(root).diagnostics, []);
});

task5Test("DM-IDX-001 and DM-IDX-002 are cataloged for Task 5 checkpoint 1", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(["DM-IDX-001", "DM-IDX-002"].filter((ruleId) => !cataloged.has(ruleId)), []);
});

task5Test("accepts DM-SRC-001 direct Sources and exposes exact catalog facts", (t) => {
  const root = createSet(t, { childMetadata: { source_refs: "api-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: directSources([
        ["api-a", "asyncapi", "AsyncAPI 3.1.0", "urn:example:a", "1.2.0", "api-a.json", "none"],
        ["notes-z", "pass-through", "none", "none", "none", "notes.md", `sha256:${"a".repeat(64)}`]
      ])
    })
  }));

  const result = taskScoped(root);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.core.sources?.rows.map((row) => row.id), ["api-a", "notes-z"]);
  assert.deepEqual(result.facts.core.sourceResolutions?.["CONVENTIONS.md"], {
    requestedIds: ["api-a"],
    resolvedIds: ["api-a"],
    loadedPaths: ["INDEX.md"]
  });
});

task5Test("DM-SRC-001 rejects a direct Sources table with the wrong standard columns", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: directSources().replace("Contract version", "Version")
    })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-001"));
});

task5Test("DM-SRC-001 rejects an empty direct Sources catalog", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({ sourcesContent: directSources([]) })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-001"));
});

task5Test("DM-SRC-001 diagnoses a short-column Sources table without throwing", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: "| ID | Kind |\n|---|---|\n| source-a | pass-through |"
    })
  }));
  let result;
  assert.doesNotThrow(() => {
    result = taskScoped(root);
  });
  assert.ok(ruleIds(result).includes("DM-SRC-001"));
});

for (const [name, rows] of [
  ["an invalid ID", [["source/a", "pass-through", "none", "none", "none", "a.json", "none"]]],
  ["the reserved all ID", [["all", "pass-through", "none", "none", "none", "a.json", "none"]]],
  ["a duplicate ID", [
    ["source-a", "pass-through", "none", "none", "none", "a.json", "none"],
    ["source-a", "configuration", "none", "none", "none", "b.json", "none"]
  ]],
  ["non-ASCII ordering", [
    ["source-z", "pass-through", "none", "none", "none", "z.json", "none"],
    ["source-a", "pass-through", "none", "none", "none", "a.json", "none"]
  ]]
]) {
  task5Test(`DM-SRC-002 rejects direct Sources with ${name}`, (t) => {
    const root = createSet(t);
    write(root, "INDEX.md", documentSource({
      root: true,
      body: minimalRootBody({ sourcesContent: directSources(rows) })
    }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-002"));
  });
}

task5Test("accepts DM-SRC-003 source-qualified API unknown markers and root knowledge propagation", (t) => {
  const root = createSet(t);
  const markers = [
    "**unknown**: API contract version for source api-a requires AsyncAPI info.version at api-a.json",
    "**unknown**: API identity for source api-a requires authoritative logical API identity input"
  ];
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: directSources([
        ["api-a", "asyncapi", "AsyncAPI 3.1.0", "unknown", "unknown", "api-a.json", "none"]
      ], markers)
    })
  }));
  assert.equal(ruleIds(taskScoped(root)).includes("DM-SRC-003"), false);
});

task5Test("DM-SRC-003 rejects an unknown API identity without its source-qualified marker", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: directSources([
        ["api-a", "asyncapi", "AsyncAPI 3.1.0", "unknown", "1.0.0", "api-a.json", "none"]
      ])
    })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-003"));
});

task5Test("DM-SRC-003 rejects an unknown contract version marker that omits its source ID", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: directSources([
        ["api-a", "asyncapi", "AsyncAPI 3.1.0", "urn:example:a", "unknown", "api-a.json", "none"]
      ], ["**unknown**: API contract version requires AsyncAPI info.version at api-a.json"])
    })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-003"));
});

task5Test("DM-SRC-003 rejects API unknown markers when root knowledge remains complete", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: directSources([
        ["api-a", "asyncapi", "AsyncAPI 3.1.0", "urn:example:a", "unknown", "api-a.json", "none"]
      ], ["**unknown**: API contract version for source api-a requires AsyncAPI info.version at api-a.json"])
    })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-003"));
});

task5Test("DM-SRC-003 rejects prose between a Sources table and its required unknown marker", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: directSources([
        ["api-a", "asyncapi", "AsyncAPI 3.1.0", "urn:example:a", "unknown", "api-a.json", "none"]
      ], [
        "Unexpected prose.",
        "**unknown**: API contract version for source api-a requires AsyncAPI info.version at api-a.json"
      ])
    })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-003"));
});

task5Test("DM-SRC-004 rejects a malformed sha256 Revision", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: directSources([
        ["source-a", "pass-through", "none", "none", "none", "a.json", "sha256:ABC"]
      ])
    })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-004"));
});

for (const [name, sourceRefs] of [
  ["a missing catalog ID", "missing"],
  ["a duplicate ID", "source-a, source-a"],
  ["non-canonical spacing", "source-a,source-z"],
  ["non-ASCII ordering", "source-z, source-a"]
]) {
  task5Test(`DM-SRC-005 rejects source_refs with ${name}`, (t) => {
    const root = createSet(t, { childMetadata: { source_refs: sourceRefs } });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-005"));
  });
}

task5Test("accepts DM-SRC-006 sharded Sources and resolves a DM-SRC-007 transitive contributor cycle", (t) => {
  const root = createSet(t, { childMetadata: { source_refs: "a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["a", "a", "configuration", "A configuration", "indexes/sources-a.md"],
        ["z", "z", "pass-through", "Z pass-through", "indexes/sources-z.md"]
      ])
    })
  }));
  writeSourceShard(root, "indexes/sources-a.md", {
    rows: [["a", "configuration", "none", "none", "none", "a.json", "none"]],
    sourceRefs: "a, z"
  });
  writeSourceShard(root, "indexes/sources-z.md", {
    rows: [["z", "pass-through", "none", "none", "none", "z.md", "none"]],
    sourceRefs: "a, z"
  });

  const result = taskScoped(root);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.core.sources.rows.map((row) => row.id), ["a", "z"]);
  assert.deepEqual(result.facts.core.sourceResolutions["CONVENTIONS.md"], {
    requestedIds: ["a"],
    resolvedIds: ["a", "z"],
    loadedPaths: ["indexes/sources-a.md", "indexes/sources-z.md"]
  });
  assert.deepEqual(result.facts.core.sourceResolutions["INDEX.md"].loadedPaths, [
    "indexes/sources-a.md",
    "indexes/sources-z.md"
  ]);
});

task5Test("DM-SRC-007 records every overlapping-range false-positive shard load", (t) => {
  const root = createSet(t, { childMetadata: { source_refs: "b" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["a", "c", "configuration; pass-through", "A and C", "indexes/sources-a-c.md"],
        ["b", "b", "annotation", "B annotation", "indexes/sources-b.md"]
      ])
    })
  }));
  writeSourceShard(root, "indexes/sources-a-c.md", {
    rows: [
      ["a", "configuration", "none", "none", "none", "a.json", "none"],
      ["c", "pass-through", "none", "none", "none", "c.md", "none"]
    ],
    sourceRefs: "a, c"
  });
  writeSourceShard(root, "indexes/sources-b.md", {
    rows: [["b", "annotation", "none", "none", "none", "b.json", "none"]],
    sourceRefs: "b"
  });

  const resolution = taskScoped(root).facts.core.sourceResolutions?.["CONVENTIONS.md"];

  assert.deepEqual(resolution, {
    requestedIds: ["b"],
    resolvedIds: ["a", "b", "c"],
    loadedPaths: ["indexes/sources-a-c.md", "indexes/sources-b.md"]
  });
});

task5Test("accepts DM-SRC-003 localized unknown state in a source shard", (t) => {
  const root = createSet(t);
  const marker = "**unknown**: API contract version for source api-a requires AsyncAPI info.version at api-a.json";
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["api-a", "api-a", "asyncapi", "API input", "indexes/sources-api.md"]
      ])
    })
  }));
  writeSourceShard(root, "indexes/sources-api.md", {
    rows: [["api-a", "asyncapi", "AsyncAPI 3.1.0", "urn:example:a", "unknown", "api-a.json", "none"]],
    sourceRefs: "all",
    knowledge: "requires-input",
    markers: [marker]
  });
  const result = taskScoped(root);
  assert.equal(ruleIds(result).includes("DM-SRC-003"), false);
  assert.deepEqual(result.facts.core.sources.rows.map((row) => row.id), ["api-a"]);
});

task5Test("DM-SRC-003 rejects a source-shard unknown value without its localized marker", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["api-a", "api-a", "asyncapi", "API input", "indexes/sources-api.md"]
      ])
    })
  }));
  writeSourceShard(root, "indexes/sources-api.md", {
    rows: [["api-a", "asyncapi", "AsyncAPI 3.1.0", "urn:example:a", "unknown", "api-a.json", "none"]],
    sourceRefs: "all",
    knowledge: "requires-input"
  });
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-003"));
});

for (const [name, route, shard] of [
  [
    "bounds that do not match shard rows",
    ["a", "z", "configuration", "A", "indexes/sources-a.md"],
    { rows: [["a", "configuration", "none", "none", "none", "a.json", "none"]], sourceRefs: "a" }
  ],
  [
    "Kinds that do not match shard rows",
    ["a", "a", "pass-through", "A", "indexes/sources-a.md"],
    { rows: [["a", "configuration", "none", "none", "none", "a.json", "none"]], sourceRefs: "a" }
  ],
  [
    "an invalid source-index structure",
    ["a", "a", "configuration", "A", "indexes/sources-a.md"],
    {
      rows: [["a", "configuration", "none", "none", "none", "a.json", "none"]],
      sourceRefs: "a",
      body: "# Messaging Operation Index\n\n## Sources\n\nnone"
    }
  ]
]) {
  task5Test(`DM-SRC-006 rejects ${name}`, (t) => {
    const root = createSet(t);
    write(root, "INDEX.md", documentSource({
      root: true,
      body: minimalRootBody({ sourcesContent: sourceShardRoutes([route]) })
    }));
    writeSourceShard(root, route[4], shard);
    assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-006"));
  });
}

task5Test("DM-SRC-006 rejects a root route whose source shard is missing", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["a", "a", "configuration", "A", "indexes/missing.md"]
      ])
    })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-006"));
});

task5Test("accepts DM-SRC-006 source-shard Details outside the conventional indexes directory", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["a", "a", "configuration", "A", "references/sources-a.md"]
      ])
    })
  }));
  writeSourceShard(root, "references/sources-a.md", {
    rows: [["a", "configuration", "none", "none", "none", "a.json", "none"]],
    sourceRefs: "a"
  });
  assert.equal(ruleIds(taskScoped(root)).includes("DM-SRC-006"), false);
});

task5Test("DM-SRC-006 rejects an extra heading in a source-index shard", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["a", "a", "configuration", "A", "indexes/sources-a.md"]
      ])
    })
  }));
  writeSourceShard(root, "indexes/sources-a.md", {
    rows: [["a", "configuration", "none", "none", "none", "a.json", "none"]],
    sourceRefs: "a",
    body: `${sourceShardBody([
      ["a", "configuration", "none", "none", "none", "a.json", "none"]
    ])}\n\n### Notes\n\nnone`
  });
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-006"));
});

task5Test("DM-SRC-006 diagnoses a short-column Source Shards table without throwing", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: "### Source Shards\n\n| First ID | Last ID |\n|---|---|\n| a | a |"
    })
  }));
  let result;
  assert.doesNotThrow(() => {
    result = taskScoped(root);
  });
  assert.ok(ruleIds(result).includes("DM-SRC-006"));
});

task5Test("DM-SRC-005 rejects a source shard whose source_refs omits one of its own rows", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["a", "z", "configuration; pass-through", "A and Z", "indexes/sources.md"]
      ])
    })
  }));
  writeSourceShard(root, "indexes/sources.md", {
    rows: [
      ["a", "configuration", "none", "none", "none", "a.json", "none"],
      ["z", "pass-through", "none", "none", "none", "z.md", "none"]
    ],
    sourceRefs: "a"
  });
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-005"));
});

task5Test("DM-SRC-007 rejects a requested ID absent from every loaded overlapping shard", (t) => {
  const root = createSet(t, { childMetadata: { source_refs: "b" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["a", "c", "configuration; pass-through", "A and C", "indexes/sources-a-c.md"]
      ])
    })
  }));
  writeSourceShard(root, "indexes/sources-a-c.md", {
    rows: [
      ["a", "configuration", "none", "none", "none", "a.json", "none"],
      ["c", "pass-through", "none", "none", "none", "c.md", "none"]
    ],
    sourceRefs: "a, c"
  });
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-007"));
});

task5Test("DM-SRC-007 rejects a duplicate source ID across loaded shards", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: sourceShardRoutes([
        ["a", "a", "configuration", "First A", "indexes/sources-a1.md"],
        ["a", "a", "configuration", "Second A", "indexes/sources-a2.md"]
      ])
    })
  }));
  for (const shardPath of ["indexes/sources-a1.md", "indexes/sources-a2.md"]) {
    writeSourceShard(root, shardPath, {
      rows: [["a", "configuration", "none", "none", "none", `${shardPath}.json`, "none"]],
      sourceRefs: "a"
    });
  }
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-007"));
});

task5Test("DM-SRC-001 through DM-SRC-007 are cataloged for Task 5 checkpoint 2", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const expected = [
    "DM-SRC-001",
    "DM-SRC-002",
    "DM-SRC-003",
    "DM-SRC-004",
    "DM-SRC-005",
    "DM-SRC-006",
    "DM-SRC-007"
  ];
  assert.deepEqual(expected.filter((ruleId) => !cataloged.has(ruleId)), []);
});

task5Test("accepts DM-IDX-003 flat operation rows and records a DM-IDX-007 provenance-closed exact trace", (t) => {
  const sourcesContent = directSources([
    ["source-a", "pass-through", "none", "none", "none", "a.md", "none"],
    ["source-z", "configuration", "none", "none", "none", "z.json", "none"]
  ]);
  const row = [
    "SEND",
    "orders.commands",
    "create-order",
    "create-order; reply:create-order-accepted",
    "create order",
    "Creates an order and routes its acceptance reply",
    "workflows/create-order.md",
    "references/order-guide.md"
  ];
  const root = createFlatOperationSet(t, {
    rows: [row],
    sourcesContent,
    childMetadata: { source_refs: "source-a" },
    channelSourceRefs: "source-z"
  });
  writeDocument(root, "workflows/create-order.md", { sourceRefs: "source-a" });
  writeDocument(root, "references/order-guide.md", { sourceRefs: "source-z" });

  const result = taskScoped(root);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.core.operations?.rows.map((entry) => entry.operation), ["create-order"]);
  const trace = result.facts.core.operationRetrieval?.exact.operation["create-order"];
  assert.deepEqual(trace.loadedIndexPaths, ["INDEX.md"]);
  assert.deepEqual(trace.matchedOperationNames, ["create-order"]);
  assert.deepEqual(trace.loadedChannelPaths, ["channels/orders.md"]);
  assert.deepEqual(trace.requiredContextPaths, ["workflows/create-order.md"]);
  assert.deepEqual(trace.supplementalContextPaths, ["references/order-guide.md"]);
  assert.deepEqual(trace.sourceIds, ["source-a", "source-z"]);
  assert.deepEqual(trace.loadedSourceIndexPaths, ["INDEX.md"]);
});

task5Test("accepts DM-IDX-005 workflows/none.md as a context path distinct from the none sentinel", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[6] = "workflows/none.md";
  const root = createFlatOperationSet(t, { rows: [row] });
  writeDocument(root, "workflows/none.md");

  assert.deepEqual(taskScoped(root).diagnostics, []);
});

task5Test("DM-IDX-003 rejects a flat operation table with the wrong standard columns", (t) => {
  const columns = [
    "Action",
    "Channel",
    "Operation",
    "Message",
    "Task",
    "Description",
    "Required context",
    "Supplemental context"
  ];
  const root = createFlatOperationSet(t, { columns });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-003"));
});

task5Test("DM-IDX-003 rejects a flat channel route whose file is missing", (t) => {
  const root = createFlatOperationSet(t, { writeChannel: false });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-003"));
});

for (const [name, cell, value] of [
  ["an invalid Action", 0, "PUBLISH"],
  ["ASCII whitespace in Channel", 1, "orders commands"],
  ["an invalid Operation name", 2, "create/order"],
  ["an unsorted primary Message list", 3, "z-message; a-message"],
  ["a primary Message after a reply entry", 3, "reply:create-order-accepted; create-order"],
  ["a malformed reply prefix", 3, "create-order; reply:"],
  ["duplicate Task labels", 4, "create order; create order"],
  ["an empty Summary", 5, ""],
  ["a Summary that only repeats its Task", 5, "create order"]
]) {
  task5Test(`DM-IDX-004 rejects a flat operation row with ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[cell] = value;
    const root = createFlatOperationSet(t, { rows: [row] });

    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-004"));
  });
}

task5Test("DM-IDX-004 rejects a duplicate operation name across channel subsections", (t) => {
  const root = createSet(t);
  const secondRow = [...BASIC_OPERATION_ROW];
  secondRow[1] = "orders.events";
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      operationContent: flatOperations([
        { path: "channels/commands.md", rows: [BASIC_OPERATION_ROW] },
        { path: "channels/events.md", rows: [secondRow] }
      ])
    })
  }));
  writeDocument(root, "channels/commands.md");
  writeDocument(root, "channels/events.md");

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-004"));
});

for (const [name, required, supplemental, files = []] of [
  ["a non-canonical list delimiter", "workflows/a.md,workflows/b.md", "none"],
  ["non-ASCII path ordering", "workflows/z.md, workflows/a.md", "none"],
  ["a duplicate path", "workflows/a.md, workflows/a.md", "none"],
  ["Reference Material in required context", "references/guide.md", "none", ["references/guide.md"]],
  ["a channel file in supplemental context", "none", "channels/extra.md", ["channels/extra.md"]],
  ["one path in both context columns", "workflows/a.md", "workflows/a.md", ["workflows/a.md"]],
  ["a missing context file", "workflows/missing.md", "none"]
]) {
  task5Test(`DM-IDX-005 rejects ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[6] = required;
    row[7] = supplemental;
    const root = createFlatOperationSet(t, { rows: [row] });
    for (const file of files) writeDocument(root, file);

    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-005"));
  });
}

task5Test("accepts DM-IDX-006 overlapping operation shards and records DM-IDX-007 exact and fallback traces", (t) => {
  const root = createShardedOperationSet(t);

  const result = taskScoped(root);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.facts.core.operations.rows.map((entry) => entry.operation),
    ["a-operation", "z-operation", "m-operation"]
  );
  const operationTrace = result.facts.core.operationRetrieval.exact.operation["m-operation"];
  assert.deepEqual(operationTrace.loadedIndexPaths, [
    "indexes/operations-broad.md",
    "indexes/operations-middle.md"
  ]);
  assert.deepEqual(operationTrace.falsePositiveIndexPaths, ["indexes/operations-broad.md"]);
  assert.deepEqual(operationTrace.matchedOperationNames, ["m-operation"]);
  assert.deepEqual(operationTrace.sourceIds, ["source-a", "source-z"]);
  assert.equal(operationTrace.sourceIds.includes("source-q"), false);

  const replyTrace = result.facts.core.operationRetrieval.exact.message["reply:m-reply"];
  assert.deepEqual(replyTrace.loadedIndexPaths, [
    "indexes/operations-broad.md",
    "indexes/operations-middle.md"
  ]);
  assert.deepEqual(replyTrace.falsePositiveIndexPaths, ["indexes/operations-broad.md"]);
  assert.deepEqual(replyTrace.matchedOperationNames, ["m-operation"]);

  const fallback = result.facts.core.operationRetrieval.semanticFallback;
  assert.deepEqual(fallback.loadedIndexPaths, [
    "indexes/operations-broad.md",
    "indexes/operations-middle.md"
  ]);
  assert.deepEqual(fallback.matchedOperationNames, ["a-operation", "m-operation", "z-operation"]);
  assert.deepEqual(fallback.sourceIds, ["source-a", "source-z"]);
});

for (const [name, routeIndex, cellIndex, value] of [
  ["Task membership that omits a shard task", 0, 0, "alpha task"],
  ["Actions that do not equal shard actions", 0, 1, "SEND"],
  ["a First channel that does not equal the shard minimum", 0, 2, "b.events"],
  ["a First operation that does not equal the shard minimum", 0, 4, "b-operation"],
  ["reply-prefixed Message bounds that omit the reply", 1, 7, "m-message"],
  ["an empty route Summary", 1, 8, ""]
]) {
  task5Test(`DM-IDX-006 rejects ${name}`, (t) => {
    const routes = OVERLAPPING_OPERATION_ROUTES.map((row) => [...row]);
    routes[routeIndex][cellIndex] = value;
    const root = createShardedOperationSet(t, { routes });

    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
  });
}

task5Test("DM-IDX-006 rejects a missing operation-index shard", (t) => {
  const root = createShardedOperationSet(t, { writeMiddle: false });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

task5Test("DM-IDX-006 rejects an operation-index shard with the wrong structure", (t) => {
  const root = createShardedOperationSet(t, { middleBody: "# Wrong Operation Index" });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

task5Test("DM-IDX-006 rejects an empty operation-index shard", (t) => {
  const root = createShardedOperationSet(t, {
    middleBody: "# Messaging Operation Index\n\n## Operations\n\nnone"
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

task5Test("DM-IDX-006 rejects an unlisted operation-index shard", (t) => {
  const root = createShardedOperationSet(t);
  writeDocument(root, "channels/extra.md");
  writeOperationShard(root, "indexes/operations-extra.md", {
    groups: [{
      path: "channels/extra.md",
      rows: [[
        "SEND",
        "extra.events",
        "extra-operation",
        "extra-message",
        "extra task",
        "Handles an extra operation",
        "none",
        "none"
      ]]
    }]
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

task5Test("DM-IDX-004 rejects a duplicate operation name across operation-index shards", (t) => {
  const duplicate = [...MIDDLE_OPERATION_ROW];
  duplicate[2] = "a-operation";
  const root = createShardedOperationSet(t, { middleRows: [duplicate] });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-004"));
});

task5Test("DM-IDX-003 rejects one channel-file subsection split across operation-index shards", (t) => {
  const root = createShardedOperationSet(t);
  writeOperationShard(root, "indexes/operations-middle.md", {
    sourceRefs: "source-q",
    groups: [{ path: "channels/alpha.md", rows: [MIDDLE_OPERATION_ROW] }]
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-003"));
});

task5Test("DM-IDX-006 diagnoses a short-column Operation Shards table without throwing", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      operationHeading: "## Operation Shards",
      operationContent: "| Tasks | Details |\n|---|---|\n| orders | indexes/orders.md |"
    })
  }));
  let result;
  assert.doesNotThrow(() => {
    result = taskScoped(root);
  });
  assert.ok(ruleIds(result).includes("DM-IDX-006"));
});

task5Test("DM-IDX-006 rejects content after the root Operation Shards routing table", (t) => {
  const root = createShardedOperationSet(t);
  const indexPath = path.join(root, "INDEX.md");
  const content = fs.readFileSync(indexPath, "utf8").replace(
    "\n\n## Workflows",
    "\n\nUnexpected routing prose.\n\n## Workflows"
  );
  write(root, "INDEX.md", content);

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

task5Test("DM-IDX-003 through DM-IDX-007 are cataloged for Task 5 checkpoint 3", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const expected = ["DM-IDX-003", "DM-IDX-004", "DM-IDX-005", "DM-IDX-006", "DM-IDX-007"];
  assert.deepEqual(expected.filter((ruleId) => !cataloged.has(ruleId)), []);
});

task5Test("accepts DM-IDX-008 direct Unprojected Operations with length-prefixed ASCII and multibyte identities", (t) => {
  const markers = [
    unprojectedMarker({
      dimension: "unsupported",
      sourceId: "source-a",
      identity: "legacy: route",
      reason: "routing-critical selector at source.json#/operations/0"
    }),
    unprojectedMarker({
      dimension: "unknown",
      sourceId: "source-a",
      identity: "legacy: route",
      reason: "counterpart mapping requires projection configuration"
    }),
    unprojectedMarker({
      dimension: "unknown",
      sourceId: "source-z",
      identity: "操作: 二",
      reason: "operation action requires source.json#/operations/1"
    })
  ];
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { coverage: "requires-source", knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: directSources([
        ["source-a", "pass-through", "none", "none", "none", "a.json", "none"],
        ["source-z", "pass-through", "none", "none", "none", "z.json", "none"]
      ]),
      unprojectedContent: markers.join("\n")
    })
  }));

  const result = taskScoped(root);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.facts.core.unprojectedOperations.form, "direct");
  assert.deepEqual(
    result.facts.core.unprojectedOperations.groups.map((entry) => ({
      sourceId: entry.sourceId,
      identity: entry.identity,
      dimensions: entry.dimensions
    })),
    [
      { sourceId: "source-a", identity: "legacy: route", dimensions: ["unsupported", "unknown"] },
      { sourceId: "source-z", identity: "操作: 二", dimensions: ["unknown"] }
    ]
  );
  assert.deepEqual(
    result.facts.core.unprojectedRetrieval.exactBySourceId["source-a"].loadedIndexPaths,
    ["INDEX.md"]
  );
});

for (const [name, transform] of [
  ["a leading-zero identity length", (marker) => marker.replace(" 12:legacy", " 012:legacy")],
  ["a UTF-8 byte-length mismatch", (marker) => marker.replace(/ (\d+):操作/, " 2:操作")],
  ["a missing exact reason delimiter", (marker) => marker.replace(": operation action", ":operation action")]
]) {
  task5Test(`DM-IDX-008 rejects ${name}`, (t) => {
    const original = unprojectedMarker({
      dimension: "unknown",
      sourceId: "source-a",
      identity: name.includes("UTF-8") ? "操作: 二" : "legacy route",
      reason: "operation action requires source.json#/operations/0"
    });
    const root = createSet(t);
    write(root, "INDEX.md", documentSource({
      root: true,
      metadataOverrides: { knowledge: "requires-input" },
      body: minimalRootBody({ unprojectedContent: transform(original) })
    }));

    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-008"));
  });
}

task5Test("DM-IDX-008 rejects an Unprojected Operations marker for an unknown source ID", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { coverage: "requires-source" },
    body: minimalRootBody({
      unprojectedContent: unprojectedMarker({
        dimension: "unsupported",
        sourceId: "source-missing",
        identity: "legacy-operation",
        reason: "zero-message operation at missing.json#/operations/0"
      })
    })
  }));

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-008"));
});

task5Test("DM-IDX-008 rejects duplicate completeness markers for one grouping key", (t) => {
  const marker = unprojectedMarker({
    dimension: "unknown",
    sourceId: "source-a",
    identity: "legacy-operation",
    reason: "operation action requires source.json#/operations/0"
  });
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({ unprojectedContent: `${marker}\n${marker}` })
  }));

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-008"));
});

task5Test("DM-IDX-008 rejects marker completeness that is not aggregated by root metadata", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      unprojectedContent: unprojectedMarker({
        dimension: "unsupported",
        sourceId: "source-a",
        identity: "legacy-operation",
        reason: "zero-message operation at source.json#/operations/0"
      })
    })
  }));

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-008"));
});

task5Test("accepts DM-IDX-009 sharded Unprojected Operations and records DM-IDX-010 exact and fallback traces", (t) => {
  const firstMarkers = [
    unprojectedMarker({
      dimension: "unsupported",
      sourceId: "source-a",
      identity: "legacy-a",
      reason: "sensitive routing-critical value withheld at source-a.json#/operations/0"
    }),
    unprojectedMarker({
      dimension: "unknown",
      sourceId: "source-z",
      identity: "legacy-z",
      reason: "operation action requires source-z.json#/operations/0"
    })
  ];
  const secondMarkers = [unprojectedMarker({
    dimension: "unknown",
    sourceId: "source-a",
    identity: "legacy-a-2",
    reason: "counterpart mapping requires projection configuration"
  })];
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { coverage: "requires-source", knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: directSources([
        ["source-a", "pass-through", "none", "none", "none", "a.json", "none"],
        ["source-z", "pass-through", "none", "none", "none", "z.json", "none"]
      ]),
      unprojectedContent: unprojectedShardRoutes([
        ["source-a; source-z", "Legacy A and Z operations", "indexes/unprojected-a-z.md"],
        ["source-a", "Additional legacy A operations", "indexes/unprojected-a.md"]
      ])
    })
  }));
  writeUnprojectedShard(root, "indexes/unprojected-a-z.md", {
    markers: firstMarkers,
    sourceRefs: "source-a, source-z"
  });
  writeUnprojectedShard(root, "indexes/unprojected-a.md", {
    markers: secondMarkers,
    sourceRefs: "source-a"
  });

  const result = taskScoped(root);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.facts.core.unprojectedOperations.form, "sharded");
  assert.deepEqual(result.facts.core.unprojectedRetrieval.exactBySourceId["source-a"], {
    selector: { sourceId: "source-a" },
    loadedIndexPaths: ["indexes/unprojected-a-z.md", "indexes/unprojected-a.md"],
    matchedGroupingKeys: [
      "source-a\u0000legacy-a",
      "source-a\u0000legacy-a-2",
      "source-z\u0000legacy-z"
    ]
  });
  assert.deepEqual(
    result.facts.core.unprojectedRetrieval.exactBySourceId["source-z"].loadedIndexPaths,
    ["indexes/unprojected-a-z.md"]
  );
  assert.deepEqual(result.facts.core.unprojectedRetrieval.semanticFallback.loadedIndexPaths, [
    "indexes/unprojected-a-z.md",
    "indexes/unprojected-a.md"
  ]);
});

for (const [name, mutate] of [
  ["route Source refs that do not match shard markers", (routes) => { routes[0][0] = "source-z"; }],
  ["a duplicate Details path", (routes) => { routes[1][2] = routes[0][2]; }],
  ["an empty route Summary", (routes) => { routes[0][1] = ""; }]
]) {
  task5Test(`DM-IDX-009 rejects ${name}`, (t) => {
    const marker = unprojectedMarker({
      dimension: "unknown",
      sourceId: "source-a",
      identity: "legacy-a",
      reason: "operation action requires source-a.json#/operations/0"
    });
    const routes = [
      ["source-a", "First shard", "indexes/unprojected-a.md"],
      ["source-a", "Second shard", "indexes/unprojected-b.md"]
    ];
    mutate(routes);
    const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
    write(root, "INDEX.md", documentSource({
      root: true,
      metadataOverrides: { knowledge: "requires-input" },
      body: minimalRootBody({ unprojectedContent: unprojectedShardRoutes(routes) })
    }));
    writeUnprojectedShard(root, "indexes/unprojected-a.md", { markers: [marker], sourceRefs: "source-a" });
    writeUnprojectedShard(root, "indexes/unprojected-b.md", {
      markers: [marker.replace("legacy-a", "legacy-b")],
      sourceRefs: "source-a"
    });

    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-009"));
  });
}

task5Test("DM-IDX-009 rejects one grouping key split across unprojected-operation shards", (t) => {
  const marker = unprojectedMarker({
    dimension: "unknown",
    sourceId: "source-a",
    identity: "legacy-a",
    reason: "operation action requires source-a.json#/operations/0"
  });
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { coverage: "requires-source", knowledge: "requires-input" },
    body: minimalRootBody({
      unprojectedContent: unprojectedShardRoutes([
        ["source-a", "Unknown dimension", "indexes/unprojected-unknown.md"],
        ["source-a", "Unsupported dimension", "indexes/unprojected-unsupported.md"]
      ])
    })
  }));
  writeUnprojectedShard(root, "indexes/unprojected-unknown.md", { markers: [marker], sourceRefs: "source-a" });
  writeUnprojectedShard(root, "indexes/unprojected-unsupported.md", {
    markers: [marker.replace(
      "**unknown**: source operation",
      "**unsupported**: localized: source operation"
    )],
    sourceRefs: "source-a"
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-009"));
});

task5Test("DM-IDX-009 rejects a missing unprojected-operation shard", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      unprojectedContent: unprojectedShardRoutes([
        ["source-a", "Missing legacy operations", "indexes/unprojected-missing.md"]
      ])
    })
  }));

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-009"));
});

task5Test("DM-IDX-009 rejects an unlisted unprojected-operation shard", (t) => {
  const marker = unprojectedMarker({
    dimension: "unknown",
    sourceId: "source-a",
    identity: "legacy-a",
    reason: "operation action requires source-a.json#/operations/0"
  });
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      unprojectedContent: unprojectedShardRoutes([
        ["source-a", "Listed legacy operations", "indexes/unprojected-listed.md"]
      ])
    })
  }));
  writeUnprojectedShard(root, "indexes/unprojected-listed.md", { markers: [marker], sourceRefs: "source-a" });
  writeUnprojectedShard(root, "indexes/unprojected-unlisted.md", {
    markers: [marker.replace("legacy-a", "legacy-unlisted")],
    sourceRefs: "source-a"
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-009"));
});

task5Test("DM-IDX-009 rejects an unprojected-operation shard with the wrong fixed structure", (t) => {
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      unprojectedContent: unprojectedShardRoutes([
        ["source-a", "Malformed legacy operations", "indexes/unprojected-malformed.md"]
      ])
    })
  }));
  writeUnprojectedShard(root, "indexes/unprojected-malformed.md", {
    markers: [],
    sourceRefs: "source-a",
    body: "# Wrong Unprojected Operation Index"
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-009"));
});

task5Test("DM-IDX-009 rejects an empty unprojected-operation shard", (t) => {
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      unprojectedContent: unprojectedShardRoutes([
        ["source-a", "Empty legacy operations", "indexes/unprojected-empty.md"]
      ])
    })
  }));
  writeUnprojectedShard(root, "indexes/unprojected-empty.md", {
    markers: [],
    sourceRefs: "source-a"
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-009"));
});

task5Test("DM-IDX-009 rejects shard completeness metadata that does not match its markers", (t) => {
  const marker = unprojectedMarker({
    dimension: "unknown",
    sourceId: "source-a",
    identity: "legacy-a",
    reason: "operation action requires source-a.json#/operations/0"
  });
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      unprojectedContent: unprojectedShardRoutes([
        ["source-a", "Legacy operations", "indexes/unprojected-a.md"]
      ])
    })
  }));
  writeUnprojectedShard(root, "indexes/unprojected-a.md", {
    markers: [marker],
    sourceRefs: "source-a",
    knowledge: "complete"
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-009"));
});

task5Test("DM-IDX-009 rejects shard source_refs that omits a marker source ID", (t) => {
  const marker = unprojectedMarker({
    dimension: "unknown",
    sourceId: "source-a",
    identity: "legacy-a",
    reason: "operation action requires source-a.json#/operations/0"
  });
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: directSources([
        ["source-a", "pass-through", "none", "none", "none", "a.json", "none"],
        ["source-z", "configuration", "none", "none", "none", "z.json", "none"]
      ]),
      unprojectedContent: unprojectedShardRoutes([
        ["source-a", "Legacy operations", "indexes/unprojected-a.md"]
      ])
    })
  }));
  writeUnprojectedShard(root, "indexes/unprojected-a.md", {
    markers: [marker],
    sourceRefs: "source-z"
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-009"));
});

task5Test("accepts DM-IDX-009 contributor source refs beyond the marker source and routes DM-IDX-010 retrieval", (t) => {
  const marker = unprojectedMarker({
    dimension: "unknown",
    sourceId: "source-a",
    identity: "legacy-a",
    reason: "counterpart mapping requires configuration.json#/mappings/0"
  });
  const root = createSet(t, { childMetadata: { source_refs: "source-a" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { knowledge: "requires-input" },
    body: minimalRootBody({
      sourcesContent: directSources([
        ["source-a", "pass-through", "none", "none", "none", "a.json", "none"],
        ["source-z", "configuration", "none", "none", "none", "configuration.json", "none"]
      ]),
      unprojectedContent: unprojectedShardRoutes([
        ["source-a; source-z", "Legacy operation and its mapping input", "indexes/unprojected-a.md"]
      ])
    })
  }));
  writeUnprojectedShard(root, "indexes/unprojected-a.md", {
    markers: [marker],
    sourceRefs: "source-a, source-z"
  });

  const result = taskScoped(root);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.core.unprojectedRetrieval.exactBySourceId["source-z"], {
    selector: { sourceId: "source-z" },
    loadedIndexPaths: ["indexes/unprojected-a.md"],
    matchedGroupingKeys: ["source-a\u0000legacy-a"]
  });
});

task5Test("DM-IDX-009 diagnoses a short-column shard table without throwing", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      unprojectedContent: "### Unprojected Operation Shards\n\n| Source refs | Details |\n|---|---|\n| source-a | indexes/unprojected-a.md |"
    })
  }));
  let result;
  assert.doesNotThrow(() => {
    result = taskScoped(root);
  });
  assert.ok(ruleIds(result).includes("DM-IDX-009"));
});

task5Test("records DM-IDX-008 source-aware generation-failure and sensitive-withholding expectations separately", () => {
  assert.equal(typeof coreRouting.evaluateUnprojectedSourceExpectations, "function");
  const result = coreRouting.evaluateUnprojectedSourceExpectations([
    {
      sourceOperationId: "operation-1",
      sourceId: "source-a",
      operationIdentity: "safe-operation-1",
      publicationSafeLocation: "source.json#/operations/0",
      sensitiveFeatureClass: "routing-critical",
      sensitiveValue: "tenant-secret-route"
    },
    {
      sourceOperationId: "operation-2",
      sourceId: "source-a",
      operationIdentity: "safe-operation-1",
      publicationSafeLocation: "source.json#/operations/1"
    },
    {
      sourceOperationId: "operation-3",
      sourceId: "source-a",
      operationIdentity: null,
      publicationSafeLocation: "source.json#/operations/2"
    },
    {
      sourceOperationId: "operation-4",
      sourceId: "source-a",
      operationIdentity: "safe-operation-4",
      publicationSafeLocation: null
    }
  ]);

  assert.deepEqual(result, [
    {
      sourceOperationId: "operation-1",
      expectation: "generation-failure",
      reason: "grouping-key-collision"
    },
    {
      sourceOperationId: "operation-2",
      expectation: "generation-failure",
      reason: "grouping-key-collision"
    },
    {
      sourceOperationId: "operation-3",
      expectation: "generation-failure",
      reason: "publication-safe-operation-identity-unavailable"
    },
    {
      sourceOperationId: "operation-4",
      expectation: "generation-failure",
      reason: "publication-safe-source-location-unavailable"
    }
  ]);

  const nonColliding = coreRouting.evaluateUnprojectedSourceExpectations([{
    sourceOperationId: "operation-sensitive",
    sourceId: "source-a",
    operationIdentity: "safe-operation-sensitive",
    publicationSafeLocation: "source.json#/operations/3",
    sensitiveFeatureClass: "routing-critical",
    sensitiveValue: "tenant-secret-route"
  }]);
  assert.deepEqual(nonColliding, [{
    sourceOperationId: "operation-sensitive",
    expectation: "emit-unsupported",
    reason: "sensitive routing-critical value withheld at source.json#/operations/3",
    prohibitedValues: ["tenant-secret-route"]
  }]);
  assert.equal(nonColliding[0].reason.includes("tenant-secret-route"), false);

  const revealingClass = coreRouting.evaluateUnprojectedSourceExpectations([{
    sourceOperationId: "operation-revealing-class",
    sourceId: "source-a",
    operationIdentity: "safe-operation-revealing-class",
    publicationSafeLocation: "source.json#/operations/4",
    sensitiveFeatureClass: "routing-critical tenant-secret-route",
    sensitiveValue: "tenant-secret-route"
  }]);
  assert.deepEqual(revealingClass, [{
    sourceOperationId: "operation-revealing-class",
    expectation: "generation-failure",
    reason: "canonical-sensitive-feature-class-unavailable"
  }]);
  assert.equal(revealingClass[0].reason.includes("tenant-secret-route"), false);
});

task5Test("DM-IDX-008 through DM-IDX-010 are cataloged for Task 5 checkpoint 4", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const expected = ["DM-IDX-008", "DM-IDX-009", "DM-IDX-010"];
  assert.deepEqual(expected.filter((ruleId) => !cataloged.has(ruleId)), []);
});

task5Test("DM-SRC-001 through DM-SRC-007 and DM-IDX-001 through DM-IDX-010 maintain rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task5RuleTestNames,
    rulePrefixes: ["DM-SRC", "DM-IDX"]
  });

  assert.deepEqual(result, { passed: true, errors: [] });
});

task6Test("accepts DM-CONV-001 fixed headings and DM-CONV-002 none, unknown, unsupported, and expanded states", (t) => {
  const root = createSet(t, {
    childMetadata: { coverage: "requires-source", knowledge: "requires-input" }
  });
  write(root, "CONVENTIONS.md", documentSource({
    metadataOverrides: { coverage: "requires-source", knowledge: "requires-input" },
    body: conventionsBody({
      "Protocols and Bindings": [
        "unknown",
        "**unknown**: protocol versions require the broker configuration"
      ],
      Authentication: [
        "**unsupported**: replaces CONVENTIONS Authentication: delegated credentials documented at https://example.invalid/auth"
      ],
      "Connection and Session": [
        "Clients reconnect with bounded exponential backoff."
      ]
    })
  }));

  const result = taskScoped(root);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.facts.core.conventions);
  assert.deepEqual(result.facts.core.conventions.sections["Environments"], {
    line: 5,
    state: "none"
  });
  assert.deepEqual(result.facts.core.conventions.sections["Protocols and Bindings"], {
    line: 9,
    state: "unknown"
  });
  assert.equal(result.facts.core.conventions.sections.Authentication.state, "unsupported");
  assert.equal(result.facts.core.conventions.sections["Connection and Session"].state, "expanded");
});

for (const [name, body] of [
  ["wrong title", conventionsBody().replace("# Messaging Conventions", "# Conventions")],
  ["content before the title", `unexpected prose\n\n${conventionsBody()}`],
  ["prose between title and first section", conventionsBody().replace(
    "# Messaging Conventions\n\n## Environments",
    "# Messaging Conventions\n\nunexpected prose\n\n## Environments"
  )],
  ["missing fixed heading", conventionsBody().replace("\n\n## Authentication\n\nnone", "")],
  ["reordered fixed headings", conventionsBody().replace(
    "## Environments\n\nnone\n\n## Protocols and Bindings\n\nnone",
    "## Protocols and Bindings\n\nnone\n\n## Environments\n\nnone"
  )],
  ["duplicate fixed heading", `${conventionsBody()}\n\n## Environments\n\nnone`],
  ["unexpected level-two heading", `${conventionsBody()}\n\n## Notes\n\nnone`]
]) {
  task6Test(`DM-CONV-001 rejects CONVENTIONS with ${name}`, (t) => {
    const root = createSet(t);
    write(root, "CONVENTIONS.md", documentSource({ body }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-CONV-001"));
  });
}

task6Test("DM-CONV-001 rejects a document set without required CONVENTIONS.md", (t) => {
  const root = createSet(t);
  fs.unlinkSync(path.join(root, "CONVENTIONS.md"));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-CONV-001"));
});

for (const [name, sectionContent] of [
  ["an empty section", []],
  ["unknown without its marker", ["unknown"]],
  ["an empty unknown marker", ["unknown", "**unknown**:"]],
  ["a whitespace-only unknown marker", ["unknown", "**unknown**: "]],
  ["an unknown marker without the required space", ["unknown", "**unknown**:reason"]],
  ["a non-adjacent unknown marker", [
    "unknown",
    "",
    "**unknown**: protocol versions require the broker configuration"
  ]],
  ["unknown with additional content", [
    "unknown",
    "**unknown**: protocol versions require the broker configuration",
    "unexpected prose"
  ]],
  ["a replacement marker naming another heading", [
    "**unsupported**: replaces CONVENTIONS Authentication: source feature at https://example.invalid/source"
  ]],
  ["a replacement marker with additional content", [
    "**unsupported**: replaces CONVENTIONS Environments: source feature at https://example.invalid/source",
    "unexpected prose"
  ]],
  ["none mixed with expanded content", ["none", "unexpected prose"]]
]) {
  task6Test(`DM-CONV-002 rejects CONVENTIONS Environments with ${name}`, (t) => {
    const root = createSet(t);
    write(root, "CONVENTIONS.md", documentSource({
      metadataOverrides: { coverage: "requires-source", knowledge: "requires-input" },
      body: conventionsBody({ Environments: sectionContent })
    }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-CONV-002"));
  });
}

task6Test("DM-CONV-001 and DM-CONV-002 are cataloged for Task 6 checkpoint 1", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(
    ["DM-CONV-001", "DM-CONV-002"].filter((ruleId) => !cataloged.has(ruleId)),
    []
  );
});

task6Test("DM-CONV-001 and DM-CONV-002 maintain Task 6 checkpoint 1 rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task6RuleTestNames.filter((name) => name.includes("DM-CONV-")),
    rulePrefixes: ["DM-CONV"]
  });

  assert.deepEqual(result, { passed: true, errors: [] });
});

task6Test("accepts DM-OP-001 fixed operation sections in a routed channel file", (t) => {
  const root = createFlatOperationSet(t);
  const result = taskScoped(root);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.facts.core.operationDefinitions);
  assert.deepEqual(result.facts.core.operationDefinitions.byName["create-order"], {
    action: "SEND",
    channel: "orders.commands",
    deprecated: false,
    line: 3,
    name: "create-order",
    path: "channels/orders.md"
  });
});

task6Test("accepts DM-OP-001 multiple routed operations independent of file order", (t) => {
  const secondRow = [
    "SEND",
    "orders.commands",
    "update-order",
    "update-order",
    "update order",
    "Updates an existing order",
    "none",
    "none"
  ];
  const root = createFlatOperationSet(t, {
    rows: [BASIC_OPERATION_ROW, secondRow],
    channelBody: channelBody([secondRow, BASIC_OPERATION_ROW])
  });

  const result = taskScoped(root);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(Object.keys(result.facts.core.operationDefinitions.byName).sort(), [
    "create-order",
    "update-order"
  ]);
});

for (const [name, body] of [
  ["a file-level title", `# Channel Operations\n\n${operationBody(BASIC_OPERATION_ROW)}`],
  ["a prose wrapper", operationBody(BASIC_OPERATION_ROW, { prelude: "unexpected prose" })],
  ["no operation definition", "# Placeholder"],
  ["a missing required section", operationBody(BASIC_OPERATION_ROW).replace("\n\n### Related\n\nnone", "")],
  ["reordered fixed sections", operationBody(BASIC_OPERATION_ROW)
    .replace("### Behavior", "### TEMP")
    .replace("### Operation Bindings", "### Behavior")
    .replace("### TEMP", "### Operation Bindings")],
  ["a duplicate fixed section", `${operationBody(BASIC_OPERATION_ROW)}\n\n### Related\n\nnone`],
  ["an unexpected level-three section", `${operationBody(BASIC_OPERATION_ROW)}\n\n### Notes\n\nnone`],
  ["no Message section", operationBody(BASIC_OPERATION_ROW).replace("### Message create-order", "#### Message create-order")]
]) {
  task6Test(`DM-OP-001 rejects a channel file with ${name}`, (t) => {
    const root = createFlatOperationSet(t, { channelBody: body });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-OP-001"));
  });
}

task6Test("DM-OP-001 rejects an operation definition absent from its channel route", (t) => {
  const extraRow = [
    "SEND",
    "orders.commands",
    "cancel-order",
    "cancel-order",
    "cancel order",
    "Cancels an order",
    "none",
    "none"
  ];
  const root = createFlatOperationSet(t, {
    channelBody: channelBody([BASIC_OPERATION_ROW, extraRow])
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-OP-001"));
});

task6Test("accepts DM-OP-002 two-sentence purpose and summary-matched deprecation", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[5] = "(deprecated) Creates an order command through the legacy channel";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      deprecated: "**deprecated**: use submit-order and migrate producers before retirement",
      purpose: "Creates an order command. Use this operation only during migration."
    })
  });

  const result = taskScoped(root);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.facts.core.operationDefinitions.byName["create-order"].deprecated, true);
});

for (const [name, row, body] of [
  [
    "an Action that differs from its route",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW, { heading: "## RECEIVE orders.commands (create-order)" })
  ],
  [
    "an address that differs from its route",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW, { heading: "## SEND orders.events (create-order)" })
  ],
  [
    "a name that differs from its route",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW, { heading: "## SEND orders.commands (cancel-order)" })
  ],
  [
    "a malformed heading",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW, { heading: "## SEND orders.commands create-order" })
  ],
  ["an empty purpose", BASIC_OPERATION_ROW, operationBody(BASIC_OPERATION_ROW, { purpose: "" })],
  [
    "purpose without a sentence terminator",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW, { purpose: "Documents the selected messaging operation" })
  ],
  [
    "three purpose sentences",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW, { purpose: "First sentence. Second sentence. Third sentence." })
  ],
  [
    "an empty deprecation marker",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW, { deprecated: "**deprecated**:" })
  ],
  [
    "a deprecation marker after the purpose",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW).replace(
      "Documents the selected messaging operation.",
      "Documents the selected messaging operation.\n\n**deprecated**: use submit-order instead"
    )
  ],
  [
    "a deprecation marker without the INDEX summary prefix",
    BASIC_OPERATION_ROW,
    operationBody(BASIC_OPERATION_ROW, { deprecated: "**deprecated**: use submit-order instead" })
  ]
]) {
  task6Test(`DM-OP-002 rejects an operation with ${name}`, (t) => {
    const root = createFlatOperationSet(t, { rows: [row], channelBody: body });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-OP-002"));
  });
}

task6Test("accepts DM-OP-003 canonical Behavior keys and qualified delivery", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      behavior: [
        "- side_effects: creates the order",
        "- idempotency: reuse message_id when resending",
        "- preconditions: the customer exists",
        "- authorization: requires the orders:write role",
        "- delivery: at-least-once -- acknowledge after broker persistence",
        "- ordering: ordered by customer identifier"
      ]
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-OP-003"));
});

task6Test("accepts DM-OP-003 unknown Behavior values with post-key markers", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      behavior: [
        "- side_effects: unknown",
        "- idempotency: none",
        "- preconditions: none",
        "- authorization: none",
        "- delivery: unknown",
        "- ordering: none",
        "**unknown**: side_effects requires the handler specification",
        "**unknown**: delivery requires the broker acknowledgement policy"
      ]
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-OP-003"));
});

for (const [name, behavior] of [
  ["a missing canonical key", [
    "- side_effects: none", "- idempotency: none", "- preconditions: none",
    "- authorization: none", "- delivery: none"
  ]],
  ["canonical keys out of order", [
    "- idempotency: none", "- side_effects: none", "- preconditions: none",
    "- authorization: none", "- delivery: none", "- ordering: none"
  ]],
  ["a duplicate canonical key", [
    "- side_effects: none", "- idempotency: none", "- preconditions: none",
    "- authorization: none", "- delivery: none", "- ordering: none", "- ordering: none"
  ]],
  ["an empty canonical value", [
    "- side_effects:", "- idempotency: none", "- preconditions: none",
    "- authorization: none", "- delivery: none", "- ordering: none"
  ]],
  ["a non-canonical delivery token", [
    "- side_effects: none", "- idempotency: none", "- preconditions: none",
    "- authorization: none", "- delivery: best-effort", "- ordering: none"
  ]],
  ["an unqualified exactly-once claim", [
    "- side_effects: none", "- idempotency: none", "- preconditions: none",
    "- authorization: none", "- delivery: exactly-once", "- ordering: none"
  ]],
  ["a malformed delivery separator", [
    "- side_effects: none", "- idempotency: none", "- preconditions: none",
    "- authorization: none", "- delivery: at-most-once - acknowledge after publish",
    "- ordering: none"
  ]],
  ["an unknown value without its marker", [
    "- side_effects: unknown", "- idempotency: none", "- preconditions: none",
    "- authorization: none", "- delivery: none", "- ordering: none"
  ]],
  ["an unknown marker before all six keys", [
    "- side_effects: unknown", "**unknown**: side_effects requires the handler specification",
    "- idempotency: none", "- preconditions: none", "- authorization: none",
    "- delivery: none", "- ordering: none"
  ]]
]) {
  task6Test(`DM-OP-003 rejects Behavior with ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, { behavior })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-OP-003"));
  });
}

task6Test("accepts DM-OP-004 expanded bindings and matching channel parameters", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[1] = "orders.{tenant}";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      operationBindings: [
        "| Protocol | Property | Value / Rule |",
        "|---|---|---|",
        "| kafka | operation-id | `create-order` |"
      ],
      channel: [
        "#### Parameters",
        "",
        "| Name | Type | Constraints / Meaning |",
        "|---|---|---|",
        "| tenant | string | Tenant ID returned by account creation |",
        "",
        "#### Bindings",
        "",
        "| Protocol | Property | Value / Rule |",
        "|---|---|---|",
        "| kafka | topic | `orders.tenant` |"
      ]
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-OP-004"));
});

for (const [name, parameters] of [
  ["whole-subsection unknown Parameters", [
    "unknown",
    "**unknown**: parameter details require the channel configuration"
  ]],
  ["replacement Parameters", [
    "**unsupported**: replaces channel Parameters: dynamic source expression at source.json"
  ]]
]) {
  task6Test(`accepts DM-OP-004 parameterized Channel with ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[1] = "orders.{tenant}";
    const root = createFlatOperationSet(t, {
      rows: [row],
      channelBody: operationBody(row, {
        channel: ["#### Parameters", "", ...parameters, "", "#### Bindings", "", "none"]
      })
    });

    assert.ok(!ruleIds(taskScoped(root)).includes("DM-OP-004"));
  });
}

for (const [name, address] of [
  ["a non-letter parameter name", "orders.{1tenant.name}"],
  ["one row for a repeated parameter name", "orders.{tenant}.{tenant}"]
]) {
  task6Test(`accepts DM-OP-004 ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[1] = address;
    const parameterName = address.includes("1tenant.name") ? "1tenant.name" : "tenant";
    const root = createFlatOperationSet(t, {
      rows: [row],
      channelBody: operationBody(row, {
        channel: [
          "#### Parameters", "", "| Name | Type | Constraints / Meaning |",
          "|---|---|---|", `| ${parameterName} | string | Tenant selection value |`,
          "", "#### Bindings", "", "none"
        ]
      })
    });

    assert.ok(!ruleIds(taskScoped(root)).includes("DM-OP-004"));
  });
}

task6Test("accepts DM-OP-004 canonical post-table markers in Operation Bindings", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      operationBindings: [
        "| Protocol | Property | Value / Rule | x-Source |",
        "|---|---|---|---|",
        "| kafka | acknowledgements | unknown | broker-config |",
        "**unknown**: Value / Rule for acknowledgements requires the broker configuration",
        "**unsupported**: localized: retry binding omitted from operation scope at source.json#/bindings"
      ]
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-OP-004"));
});

task6Test("accepts DM-OP-004 a Parameters table with the collection-level unknown marker", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[1] = "orders.{tenant}";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      channel: [
        "#### Parameters", "", ...PARAMETER_TABLE,
        "**unknown**: additional unnamed parameter requires the channel parameter declaration",
        "", "#### Bindings", "", "none"
      ]
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-OP-004"));
});

for (const [name, operationBindings, channel] of [
  ["whole-section unknown operation bindings", [
    "unknown",
    "**unknown**: operation binding facts require the broker contract"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["replacement operation bindings", [
    "**unsupported**: replaces Operation Bindings: source extension at source.json"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["a collapsed empty Parameters before expanded Bindings", ["none"], [
    "- Parameters: none",
    "#### Bindings",
    "",
    "| Protocol | Property | Value / Rule |",
    "|---|---|---|",
    "| kafka | topic | `orders.commands` |"
  ]],
  ["an expanded Parameters before headed empty Bindings", ["none"], [
    "#### Parameters",
    "",
    "none",
    "",
    "#### Bindings",
    "",
    "none"
  ]]
]) {
  task6Test(`accepts DM-OP-004 ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, { operationBindings, channel })
    });
    assert.ok(!ruleIds(taskScoped(root)).includes("DM-OP-004"));
  });
}

const PARAMETER_TABLE = [
  "| Name | Type | Constraints / Meaning |",
  "|---|---|---|",
  "| tenant | string | Tenant ID returned by account creation |"
];

for (const [name, row, operationBindings, channel] of [
  ["a non-canonical operation-binding table header", BASIC_OPERATION_ROW, [
    "| Protocol | Name | Value / Rule |", "|---|---|---|", "| kafka | topic | orders |"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["an empty operation-binding table", BASIC_OPERATION_ROW, [
    "| Protocol | Property | Value / Rule |", "|---|---|---|"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["a split operation-binding table", BASIC_OPERATION_ROW, [
    "| Protocol | Property | Value / Rule |", "", "|---|---|---|", "| kafka | topic | orders |"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["an empty operation-binding table cell", BASIC_OPERATION_ROW, [
    "| Protocol | Property | Value / Rule |", "|---|---|---|", "| kafka | topic | |"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["whole-section unknown operation bindings without a marker", BASIC_OPERATION_ROW, [
    "unknown"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["a non-adjacent whole-section unknown marker", BASIC_OPERATION_ROW, [
    "unknown", "", "**unknown**: operation binding facts require the broker contract"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["an unknown table cell without a post-table marker", BASIC_OPERATION_ROW, [
    "| Protocol | Property | Value / Rule |", "|---|---|---|",
    "| kafka | acknowledgements | unknown |"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["a non-adjacent post-table marker", BASIC_OPERATION_ROW, [
    "| Protocol | Property | Value / Rule |", "|---|---|---|",
    "| kafka | acknowledgements | unknown |", "",
    "**unknown**: Value / Rule for acknowledgements requires the broker configuration"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["a post-table marker group in non-canonical order", BASIC_OPERATION_ROW, [
    "| Protocol | Property | Value / Rule |", "|---|---|---|",
    "| kafka | acknowledgements | unknown |",
    "**unsupported**: localized: retry binding omitted at source.json#/bindings",
    "**unknown**: Value / Rule for acknowledgements requires the broker configuration"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["a non-canonical operation-binding replacement unit", BASIC_OPERATION_ROW, [
    "**unsupported**: replaces channel Bindings: source extension at source.json"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["none mixed with expanded operation bindings", BASIC_OPERATION_ROW, [
    "none", "| Protocol | Property | Value / Rule |", "|---|---|---|", "| kafka | topic | orders |"
  ], ["- Parameters: none", "- Bindings: none"]],
  ["a missing Channel Bindings subsection", BASIC_OPERATION_ROW, ["none"], [
    "- Parameters: none"
  ]],
  ["Channel subsections in reverse order", BASIC_OPERATION_ROW, ["none"], [
    "#### Bindings", "", "none", "", "#### Parameters", "", "none"
  ]],
  ["collapsed Channel Bindings before Parameters", BASIC_OPERATION_ROW, ["none"], [
    "- Bindings: none", "- Parameters: none"
  ]],
  ["a collapsed empty subsection after expanded Parameters", [
    "SEND", "orders.{tenant}", ...BASIC_OPERATION_ROW.slice(2)
  ], ["none"], [
    "#### Parameters", "", ...PARAMETER_TABLE, "", "- Bindings: none"
  ]],
  ["a parameter absent from the static address", BASIC_OPERATION_ROW, ["none"], [
    "#### Parameters", "", ...PARAMETER_TABLE, "", "#### Bindings", "", "none"
  ]],
  ["unknown Parameters for a static address", BASIC_OPERATION_ROW, ["none"], [
    "#### Parameters", "", "unknown", "",
    "**unknown**: parameter details require the channel configuration",
    "", "#### Bindings", "", "none"
  ]],
  ["a missing address parameter row", [
    "SEND", "orders.{tenant}", ...BASIC_OPERATION_ROW.slice(2)
  ], ["none"], ["- Parameters: none", "- Bindings: none"]],
  ["a non-letter address parameter omitted from Parameters", [
    "SEND", "orders.{1tenant.name}", ...BASIC_OPERATION_ROW.slice(2)
  ], ["none"], ["- Parameters: none", "- Bindings: none"]],
  ["a duplicate address parameter row", [
    "SEND", "orders.{tenant}", ...BASIC_OPERATION_ROW.slice(2)
  ], ["none"], [
    "#### Parameters", "", ...PARAMETER_TABLE,
    "| tenant | string | Duplicate tenant parameter |",
    "", "#### Bindings", "", "none"
  ]],
  ["a non-canonical parameter table header", [
    "SEND", "orders.{tenant}", ...BASIC_OPERATION_ROW.slice(2)
  ], ["none"], [
    "#### Parameters", "", "| Parameter | Type | Constraints / Meaning |",
    "|---|---|---|", "| tenant | string | Tenant ID |", "", "#### Bindings", "", "none"
  ]],
  ["a non-canonical channel-binding table header", BASIC_OPERATION_ROW, ["none"], [
    "- Parameters: none", "#### Bindings", "", "| Protocol | Name | Value / Rule |",
    "|---|---|---|", "| kafka | topic | orders |"
  ]]
]) {
  task6Test(`DM-OP-004 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      rows: [row],
      channelBody: operationBody(row, { operationBindings, channel })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-OP-004"));
  });
}

task6Test("DM-OP-001 through DM-OP-004 are cataloged for Task 6 checkpoint 2", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(
    ["DM-OP-001", "DM-OP-002", "DM-OP-003", "DM-OP-004"]
      .filter((ruleId) => !cataloged.has(ruleId)),
    []
  );
});

task6Test("DM-OP-001 through DM-OP-004 maintain Task 6 checkpoint 2 rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task6RuleTestNames.filter((name) => name.includes("DM-OP-")),
    rulePrefixes: ["DM-OP"]
  });

  assert.deepEqual(result, { passed: true, errors: [] });
});

task6Test("accepts DM-MSG-001 SEND Required headers and nested payload fields", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "",
        "| Name | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| trace-id | string | yes | no | Correlates the command trace |",
        "", "#### Bindings", "", "none",
        "", "#### Payload", "",
        "**payload_required**: no", "",
        "**media_type**: application/json", "",
        "**payload_nullable**: no", "",
        "```json", "{\"customer\":{\"id\":\"cus_01\"}}", "```", "",
        "| Field | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| customer | object | no | no | Additional properties forbidden |",
        "| customer.id | string | yes | no | Required when customer is present and non-null |"
      ] })
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-001"));
});

task6Test("accepts DM-MSG-001 RECEIVE Presence headers and a nullable root row", (t) => {
  const row = ["RECEIVE", ...BASIC_OPERATION_ROW.slice(1)];
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "",
        "| Name | Type | Presence | Nullable | Meaning |",
        "|---|---|---|---|---|",
        "| trace-id | string | optional | no | May accompany the command |",
        "", "#### Bindings", "", "none",
        "", "#### Payload", "",
        "**payload_presence**: always", "",
        "**media_type**: application/json", "",
        "**payload_nullable**: yes", "",
        "```json", "null", "```", "",
        "| Field | Type | Presence | Nullable | Meaning |",
        "|---|---|---|---|---|",
        "| $ | object | always | yes | Decoded root value |"
      ] })
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-001"));
});

task6Test("accepts DM-MSG-001 reply tables with the operation direction reversed", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      reply: [
        "- channel: orders.replies",
        "- correlation: trace-id matches the request trace-id header",
        "- timeout: 30 seconds -- report the order as unresolved",
        "",
        "#### Channel", "", "- Parameters: none", "- Bindings: none", "",
        ...messageSection("create-order-reply", { level: 4, content: [
          "##### Headers", "",
          "| Name | Type | Presence | Nullable | Meaning |",
          "|---|---|---|---|---|",
          "| trace-id | string | always | no | Matches the request |",
          "", "##### Bindings", "", "none",
          "", "##### Payload", "", "none"
        ] })
      ]
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-001"));
});

task6Test("accepts DM-MSG-001 a RECEIVE operation reply with Required semantics", (t) => {
  const row = ["RECEIVE", ...BASIC_OPERATION_ROW.slice(1)];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: [
      "- channel: orders.replies", "- correlation: trace-id matches the request",
      "- timeout: none", "", "#### Channel", "",
      "- Parameters: none", "- Bindings: none", "",
      ...messageSection("create-order-reply", { level: 4, content: [
        "##### Headers", "",
        "| Name | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| trace-id | string | yes | no | Matches the request |",
        "", "##### Bindings", "", "none", "", "##### Payload", "", "none"
      ] })
    ] })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-001"));
});

task6Test("DM-MSG-001 rejects send-side columns in a RECEIVE payload field table", (t) => {
  const row = ["RECEIVE", ...BASIC_OPERATION_ROW.slice(1)];
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "", "none", "", "#### Bindings", "", "none",
        "", "#### Payload", "", "**payload_presence**: always", "",
        "**media_type**: application/json", "", "**payload_nullable**: no", "",
        "```json", "{\"id\":\"ord_01\"}", "```", "",
        "| Field | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| id | string | yes | no | Order identifier |"
      ] })
    })
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-001"));
});

task6Test("accepts DM-MSG-001 a normalized payload table with a final x- column", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "", "none", "", "#### Bindings", "", "none",
        "", "#### Payload", "", "**payload_required**: yes", "",
        "**media_type**: application/json", "", "**payload_nullable**: no", "",
        "```json", "{\"id\":\"ord_01\"}", "```", "",
        "  |Field | Type | Required | Nullable | Constraints / Meaning | x-Source |  ",
        "|---|---|---|---|---|---|",
        "| id | string | yes | no | Order identifier | source.json |"
      ] })
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-001"));
});

task6Test("accepts DM-MSG-001 empty receive-side Meaning cells", (t) => {
  const row = ["RECEIVE", ...BASIC_OPERATION_ROW.slice(1)];
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "",
        "| Name | Type | Presence | Nullable | Meaning |",
        "|---|---|---|---|---|",
        "| trace-id | string | optional | no | |",
        "", "#### Bindings", "", "none", "", "#### Payload", "",
        "**payload_presence**: optional", "", "**media_type**: application/json", "",
        "**payload_nullable**: no", "", "```json", "{\"id\":\"ord_01\"}", "```", "",
        "| Field | Type | Presence | Nullable | Meaning |",
        "|---|---|---|---|---|",
        "| id | string | always | no | |"
      ] })
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-001"));
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-002"));
});

task6Test("accepts DM-MSG-001 an empty Meaning cell in a receive-side reply", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: [
      "- channel: orders.replies", "- correlation: trace-id matches the request",
      "- timeout: 30 seconds -- report unresolved", "", "#### Channel", "",
      "- Parameters: none", "- Bindings: none", "",
      ...messageSection("create-order-reply", { level: 4, content: [
        "##### Headers", "",
        "| Name | Type | Presence | Nullable | Meaning |",
        "|---|---|---|---|---|",
        "| trace-id | string | always | no | |",
        "", "##### Bindings", "", "none", "", "##### Payload", "", "none"
      ] })
    ] })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-001"));
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-002"));
});

for (const [name, header, separator, row] of [
  [
    "a wrong payload-table first column",
    "| Name | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| id | string | yes | no | Order identifier |"
  ],
  [
    "an x- column before the standard payload columns",
    "| x-Source | Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|---|",
    "| source.json | id | string | yes | no | Order identifier |"
  ]
]) {
  task6Test(`DM-MSG-001 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, {
        messages: messageSection("create-order", { content: [
          "#### Headers", "", "none", "", "#### Bindings", "", "none",
          "", "#### Payload", "", "**payload_required**: yes", "",
          "**media_type**: application/json", "", "**payload_nullable**: no", "",
          "```json", "{\"id\":\"ord_01\"}", "```", "",
          header, separator, row
        ] })
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-001"));
  });
}

for (const [name, table] of [
  ["a malformed payload-table separator", [
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|--|",
    "| id | string | yes | no | Order identifier |"
  ]],
  ["an inconsistent payload-table row width", [
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| id | string | yes | no |"
  ]]
]) {
  task6Test(`DM-MSG-001 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, {
        messages: messageSection("create-order", { content: [
          "#### Headers", "", "none", "", "#### Bindings", "", "none",
          "", "#### Payload", "", "**payload_required**: yes", "",
          "**media_type**: application/json", "", "**payload_nullable**: no", "",
          "```json", "{\"id\":\"ord_01\"}", "```", "", ...table
        ] })
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-001"));
  });
}

for (const [name, action, headers] of [
  ["Presence columns in SEND headers", "SEND", [
    "| Name | Type | Presence | Nullable | Meaning |", "|---|---|---|---|---|",
    "| trace-id | string | always | no | Trace identifier |"
  ]],
  ["Required columns in RECEIVE headers", "RECEIVE", [
    "| Name | Type | Required | Nullable | Constraints / Meaning |", "|---|---|---|---|---|",
    "| trace-id | string | yes | no | Trace identifier |"
  ]],
  ["an invalid Required value", "SEND", [
    "| Name | Type | Required | Nullable | Constraints / Meaning |", "|---|---|---|---|---|",
    "| trace-id | string | always | no | Trace identifier |"
  ]],
  ["bare conditional Presence", "RECEIVE", [
    "| Name | Type | Presence | Nullable | Meaning |", "|---|---|---|---|---|",
    "| trace-id | string | conditional | no | Present for traced requests |"
  ]],
  ["the reserved none Presence value", "RECEIVE", [
    "| Name | Type | Presence | Nullable | Meaning |", "|---|---|---|---|---|",
    "| trace-id | string | none | no | Trace identifier |"
  ]],
  ["an invalid Nullable value", "SEND", [
    "| Name | Type | Required | Nullable | Constraints / Meaning |", "|---|---|---|---|---|",
    "| trace-id | string | yes | optional | Trace identifier |"
  ]]
]) {
  task6Test(`DM-MSG-001 rejects ${name}`, (t) => {
    const row = [action, ...BASIC_OPERATION_ROW.slice(1)];
    const root = createFlatOperationSet(t, {
      rows: [row],
      channelBody: operationBody(row, {
        messages: messageSection("create-order", { content: [
          "#### Headers", "", ...headers,
          "", "#### Bindings", "", "none",
          "", "#### Payload", "", "none"
        ] })
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-001"));
  });
}

task6Test("accepts DM-MSG-001 an unknown header cell with its post-table marker", (t) => {
  const root = createFlatOperationSet(t, {
    childMetadata: { knowledge: "requires-input" },
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "",
        "| Name | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| trace-id | unknown | yes | no | Trace identifier |",
        "**unknown**: Type for trace-id requires the message schema",
        "", "#### Bindings", "", "none",
        "", "#### Payload", "", "none"
      ] })
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-001"));
});

task6Test("DM-MSG-001 rejects an unknown header cell without a post-table marker", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "",
        "| Name | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| trace-id | unknown | yes | no | Trace identifier |",
        "", "#### Bindings", "", "none",
        "", "#### Payload", "", "none"
      ] })
    })
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-001"));
});

for (const [name, action, rootRow, payloadNullable] of [
  ["a SEND root row that is not Required", "SEND", "| $ | object | no | no | Closed object |", "no"],
  ["a RECEIVE root row that is not always present", "RECEIVE", "| $ | object | optional | no | Closed object |", "no"],
  ["a root row whose Nullable differs from payload_nullable", "SEND", "| $ | object | yes | yes | Closed object |", "no"]
]) {
  task6Test(`DM-MSG-001 rejects ${name}`, (t) => {
    const row = [action, ...BASIC_OPERATION_ROW.slice(1)];
    const send = action === "SEND";
    const root = createFlatOperationSet(t, {
      rows: [row],
      channelBody: operationBody(row, {
        messages: messageSection("create-order", { content: [
          "#### Headers", "", "none",
          "", "#### Bindings", "", "none",
          "", "#### Payload", "",
          send ? "**payload_required**: yes" : "**payload_presence**: always", "",
          "**media_type**: application/json", "",
          `**payload_nullable**: ${payloadNullable}`, "",
          "```json", "{}", "```", "",
          send
            ? "| Field | Type | Required | Nullable | Constraints / Meaning |"
            : "| Field | Type | Presence | Nullable | Meaning |",
          "|---|---|---|---|---|",
          rootRow
        ] })
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-001"));
  });
}

for (const [name, content] of [
  ["both leading empty subsections collapsed", [
    "- Headers: none", "- Bindings: none", "#### Payload", "", "none"
  ]],
  ["collapsed Headers before expanded Bindings", [
    "- Headers: none",
    "#### Bindings", "",
    "| Protocol | Property | Value / Rule |",
    "|---|---|---|",
    "| kafka | key | customer identifier |",
    "", "#### Payload", "", "none"
  ]],
  ["headed empty Headers before collapsed Bindings", [
    "#### Headers", "", "none",
    "", "- Bindings: none",
    "#### Payload", "", "none"
  ]],
  ["headed empty Bindings after expanded Headers", [
    "#### Headers", "",
    "| Name | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| trace-id | string | yes | no | Trace identifier |",
    "", "#### Bindings", "", "none",
    "", "#### Payload", "", "none"
  ]]
]) {
  task6Test(`accepts DM-MSG-002 ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, {
        messages: messageSection("create-order", { content })
      })
    });
    assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-002"));
  });
}

task6Test("accepts DM-MSG-002 exact primary and reply subsection replacements", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "",
        "**unsupported**: replaces message Headers create-order: encoded headers at source.json#/headers",
        "", "#### Bindings", "", "none", "", "#### Payload", "", "none"
      ] }),
      reply: [
        "- channel: orders.replies", "- correlation: trace-id matches the request",
        "- timeout: 30 seconds -- report unresolved", "", "#### Channel", "",
        "- Parameters: none", "- Bindings: none", "",
        ...messageSection("create-order-reply", { level: 4, content: [
          "- Headers: none", "##### Bindings", "",
          "**unsupported**: replaces reply message Bindings create-order-reply: encoded binding at source.json#/binding",
          "", "##### Payload", "", "none"
        ] })
      ]
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-002"));
});

for (const [name, marker] of [
  ["a wrong primary Headers replacement unit", "**unsupported**: replaces Reply: encoded headers at source.json#/headers"],
  ["a wrong primary Headers replacement name", "**unsupported**: replaces message Headers submit-order: encoded headers at source.json#/headers"]
]) {
  task6Test(`DM-MSG-002 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, {
        messages: messageSection("create-order", { content: [
          "#### Headers", "", marker,
          "", "#### Bindings", "", "none", "", "#### Payload", "", "none"
        ] })
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-002"));
  });
}

task6Test("DM-MSG-002 rejects a primary replacement unit in reply Bindings", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: [
      "- channel: orders.replies", "- correlation: trace-id matches the request",
      "- timeout: 30 seconds -- report unresolved", "", "#### Channel", "",
      "- Parameters: none", "- Bindings: none", "",
      ...messageSection("create-order-reply", { level: 4, content: [
        "- Headers: none", "##### Bindings", "",
        "**unsupported**: replaces message Bindings create-order-reply: encoded binding at source.json#/binding",
        "", "##### Payload", "", "none"
      ] })
    ] })
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-002"));
});

task6Test("accepts DM-MSG-003 lexical primary Messages with observable selection rules", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "created-order; updated-order";
  const messages = [
    ...messageSection("created-order", {
      selection: "Use this message when the `event` header is `created`.",
      content: ["- Headers: none", "- Bindings: none", "#### Payload", "", "none"]
    }),
    "",
    ...messageSection("updated-order", {
      selection: "Use this message when the `event` header is `updated`.",
      content: ["- Headers: none", "- Bindings: none", "#### Payload", "", "none"]
    })
  ];
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { messages })
  });

  const result = taskScoped(root);
  assert.ok(!ruleIds(result).includes("DM-MSG-003"));
  assert.deepEqual(
    result.facts.core.messageDefinitions.byOperation["create-order"].map((entry) => entry.name),
    ["created-order", "updated-order"]
  );
});

task6Test("accepts DM-MSG-003 a prototype-named operation in message facts", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[2] = "__proto__";
  row[3] = "safe-message";
  const root = createFlatOperationSet(t, { rows: [row] });

  let result;
  assert.doesNotThrow(() => {
    result = taskScoped(root);
  });
  assert.equal(
    Object.hasOwn(result.facts.core.messageDefinitions.byOperation, "__proto__"),
    true
  );
});

task6Test("accepts DM-MSG-003 complete primary and reply Message replacements", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      messages: messageSection("create-order", { content: [
        "**unsupported**: replaces Message create-order: encoded envelope at source.json#/messages/create"
      ] }),
      reply: [
        "- channel: orders.replies",
        "- correlation: trace-id matches the request trace-id header",
        "- timeout: 30 seconds -- report the order as unresolved",
        "", "#### Channel", "", "- Parameters: none", "- Bindings: none", "",
        ...messageSection("create-order-reply", { level: 4, content: [
          "**unsupported**: replaces reply Message create-order-reply: encoded reply at source.json#/messages/reply"
        ] })
      ]
    })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-003"));
});

task6Test("accepts DM-MSG-003 selection prose retained by multi-reply replacements", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:accepted-reply; reply:rejected-reply";
  const replyMessages = [
    ...messageSection("accepted-reply", {
      level: 4,
      selection: "Use when the `status` header is `accepted`.",
      content: [
        "**unsupported**: replaces reply Message accepted-reply: encoded reply at source.json#/accepted"
      ]
    }),
    "",
    ...messageSection("rejected-reply", {
      level: 4,
      selection: "Use when the `status` header is `rejected`.",
      content: ["- Headers: none", "- Bindings: none", "##### Payload", "", "none"]
    })
  ];
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: [
      "- channel: orders.replies", "- correlation: trace-id matches the request",
      "- timeout: 30 seconds -- report unresolved", "",
      "#### Channel", "", "- Parameters: none", "- Bindings: none", "",
      ...replyMessages
    ] })
  });

  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-003"));
});

task6Test("DM-MSG-003 rejects a missing multi-reply selection rule", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:accepted-reply; reply:rejected-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: [
      "- channel: orders.replies", "- correlation: trace-id matches the request",
      "- timeout: 30 seconds -- report unresolved", "",
      "#### Channel", "", "- Parameters: none", "- Bindings: none", "",
      ...messageSection("accepted-reply", { level: 4 }), "",
      ...messageSection("rejected-reply", {
        level: 4,
        selection: "Use when the `status` header is `rejected`."
      })
    ] })
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-003"));
});

for (const [name, rowMessage, messages] of [
  ["an invalid name", "create-order", messageSection("create/order")],
  ["a Message set that differs from INDEX routing", "create-order", messageSection("submit-order")],
  ["duplicate names", "create-order", [
    ...messageSection("create-order"), "", ...messageSection("create-order")
  ]],
  ["primary Messages outside lexical order", "alpha-order; zeta-order", [
    ...messageSection("zeta-order", { selection: "Use when the kind header is zeta." }), "",
    ...messageSection("alpha-order", { selection: "Use when the kind header is alpha." })
  ]],
  ["a missing multi-Message selection rule", "alpha-order; zeta-order", [
    ...messageSection("alpha-order"), "",
    ...messageSection("zeta-order", { selection: "Use when the kind header is zeta." })
  ]],
  ["an unterminated multi-Message selection rule", "alpha-order; zeta-order", [
    ...messageSection("alpha-order", { selection: "Use when the kind header is alpha" }), "",
    ...messageSection("zeta-order", { selection: "Use when the kind header is zeta." })
  ]],
  ["a three-sentence multi-Message selection rule", "alpha-order; zeta-order", [
    ...messageSection("alpha-order", { selection: "First condition. Second condition. Third condition." }), "",
    ...messageSection("zeta-order", { selection: "Use when the kind header is zeta." })
  ]],
  ["selection prose on a single expanded Message", "create-order", messageSection("create-order", {
    selection: "Use the only message."
  })],
  ["a replacement naming another Message", "create-order", messageSection("create-order", { content: [
    "**unsupported**: replaces Message submit-order: encoded envelope at source.json#/messages/create"
  ] })],
  ["extra prose after a complete replacement", "create-order", messageSection("create-order", { content: [
    "**unsupported**: replaces Message create-order: encoded envelope at source.json#/messages/create",
    "Unexpected contract prose."
  ] })],
  ["normal subsections after a complete replacement", "create-order", messageSection("create-order", { content: [
    "**unsupported**: replaces Message create-order: encoded envelope at source.json#/messages/create",
    "#### Headers", "", "none", "", "#### Bindings", "", "none", "", "#### Payload", "", "none"
  ] })]
]) {
  task6Test(`DM-MSG-003 rejects ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[3] = rowMessage;
    const root = createFlatOperationSet(t, {
      rows: [row],
      channelBody: operationBody(row, { messages })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-003"));
  });
}

task6Test("DM-MSG-003 rejects a reply Message name duplicated by a primary Message", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      reply: [
        "- channel: orders.replies", "- correlation: none", "- timeout: none",
        "", "#### Channel", "", "- Parameters: none", "- Bindings: none", "",
        ...messageSection("create-order", { level: 4 })
      ]
    })
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-003"));
});

for (const [name, content] of [
  ["collapsed Bindings after expanded Headers", [
    "#### Headers", "",
    "| Name | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| trace-id | string | yes | no | Trace identifier |",
    "", "- Bindings: none", "#### Payload", "", "none"
  ]],
  ["a collapsed Payload", [
    "- Headers: none", "- Bindings: none", "- Payload: none"
  ]],
  ["reordered Headers and Bindings", [
    "#### Bindings", "", "none",
    "", "#### Headers", "", "none",
    "", "#### Payload", "", "none"
  ]],
  ["a missing Bindings subsection", [
    "#### Headers", "", "none", "", "#### Payload", "", "none"
  ]],
  ["an empty Payload subsection", [
    "- Headers: none", "- Bindings: none", "#### Payload"
  ]],
  ["whole-subsection unknown Headers without its marker", [
    "#### Headers", "", "unknown",
    "", "#### Bindings", "", "none",
    "", "#### Payload", "", "none"
  ]],
  ["a malformed message Bindings table", [
    "- Headers: none", "#### Bindings", "",
    "| Protocol | Name | Value / Rule |",
    "|---|---|---|",
    "| kafka | key | customer identifier |",
    "", "#### Payload", "", "none"
  ]]
]) {
  task6Test(`DM-MSG-002 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, {
        messages: messageSection("create-order", { content })
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-002"));
  });
}

task6Test("DM-MSG-001 through DM-MSG-003 are cataloged for Task 6 checkpoint 3", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(
    ["DM-MSG-001", "DM-MSG-002", "DM-MSG-003"]
      .filter((ruleId) => !cataloged.has(ruleId)),
    []
  );
});

task6Test("DM-MSG-001 through DM-MSG-003 maintain Task 6 checkpoint 3 rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task6RuleTestNames.filter((name) => name.includes("DM-MSG-")),
    rulePrefixes: ["DM-MSG"]
  });

  assert.deepEqual(result, { passed: true, errors: [] });
});

task6Test("accepts DM-MSG-004 whole-payload representation-set unknown", (t) => {
  const root = createFlatOperationSet(t, {
    childMetadata: { knowledge: "requires-input" },
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", [
        "**payload_required**: unknown",
        "**unknown**: payload requiredness requires the message schema",
        "unknown",
        "**unknown**: payload representation set requires the wire contract"
      ])
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-004"));
});

task6Test("accepts DM-MSG-004 representation-local field-collection unknown", (t) => {
  const root = createFlatOperationSet(t, {
    childMetadata: { knowledge: "requires-input" },
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", [
        "**payload_required**: yes", "",
        "**media_type**: application/json", "",
        "**payload_nullable**: unknown",
        "**unknown**: payload nullability requires the message schema",
        "unknown",
        "**unknown**: payload field collection requires the message schema"
      ])
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-004"));
});

task6Test("accepts DM-MSG-004 a named-sibling field table with canonical example omission", (t) => {
  const root = createFlatOperationSet(t, {
    childMetadata: { knowledge: "requires-input" },
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", [
        "**payload_required**: yes", "", "**media_type**: application/json", "",
        "**payload_nullable**: no", "",
        "| Field | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| id | string | yes | no | Order identifier |",
        "**unknown**: additional unnamed field requires the complete message schema"
      ])
    })
  });
  const ids = ruleIds(taskScoped(root));
  assert.ok(!ids.includes("DM-MSG-001"));
  assert.ok(!ids.includes("DM-MSG-004"));
  assert.ok(!ids.includes("DM-MSG-005"));
});

task6Test("accepts DM-MSG-004 an opaque raw-binary representation", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", [
        "**payload_required**: yes", "",
        "**media_type**: application/octet-stream", "",
        "Opaque image bytes are limited to 2 MiB and carry a SHA-256 integrity digest."
      ])
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-004"));
});

task6Test("accepts DM-MSG-004 an exact payload-representation replacement", (t) => {
  const root = createFlatOperationSet(t, {
    childMetadata: { coverage: "requires-source" },
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", [
        "**payload_required**: yes", "",
        "**unsupported**: replaces payload representation create-order 16:application/json: recursive schema at source.json#/payload"
      ])
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-004"));
});

task6Test("accepts DM-MSG-004 receive-side exact-condition payload presence", (t) => {
  const row = ["RECEIVE", ...BASIC_OPERATION_ROW.slice(1)];
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      messages: payloadMessage("create-order", jsonPayload({
        direction: "RECEIVE",
        marker: "**payload_presence**: when the broker delivery contains content bytes",
        rows: ["| id | string | always | no | Order identifier |"]
      }))
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-004"));
});

task6Test("accepts DM-MSG-004 a non-empty reply Payload in the reversed direction", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: [
      "- channel: orders.replies", "- correlation: trace-id matches the request",
      "- timeout: 30 seconds -- report unresolved", "", "#### Channel", "",
      "- Parameters: none", "- Bindings: none", "",
      ...payloadMessage("create-order-reply", jsonPayload({
        direction: "RECEIVE",
        rows: ["| id | string | always | no | Order identifier |"]
      }), { level: 4 })
    ] })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-004"));
});

for (const [name, payload] of [
  ["a receive-side marker in SEND", jsonPayload({ marker: "**payload_presence**: always" })],
  ["an invalid whole-payload value", jsonPayload({ marker: "**payload_required**: optional" })],
  ["a missing key-local marker", [
    "**payload_required**: unknown", "", "**media_type**: application/json", "",
    "**payload_nullable**: no", "", "```json", "{}", "```", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|", "| $ | object | yes | no | Additional properties forbidden |"
  ]],
  ["the forbidden unknown media type", jsonPayload({ mediaType: "unknown" })],
  ["a non-canonical media type", jsonPayload({ mediaType: "Application/JSON" })],
  ["an invalid payload_nullable value", jsonPayload({ nullable: "optional" })],
  ["a missing concrete example", [
    "**payload_required**: yes", "", "**media_type**: application/json", "",
    "**payload_nullable**: no", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|", "| id | string | yes | no | Order identifier |"
  ]],
  ["a whole-payload unknown form with a representation", [
    "**payload_required**: yes", "", "unknown",
    "**unknown**: payload representation set requires the wire contract", "",
    "**media_type**: application/json"
  ]],
  ["a byte-length-mismatched representation replacement", [
    "**payload_required**: yes", "",
    "**unsupported**: replaces payload representation create-order 15:application/json: recursive schema"
  ]],
  ["structured JSON disguised as raw binary", [
    "**payload_required**: yes", "", "**media_type**: application/json", "",
    "Opaque structured bytes are limited to 2 MiB and have no integrity metadata."
  ]],
  ["structured XML disguised as raw binary", [
    "**payload_required**: yes", "", "**media_type**: application/xml", "",
    "Opaque structured bytes are limited to 2 MiB and have no integrity metadata."
  ]],
  ["parameterized JSON disguised as raw binary", [
    "**payload_required**: yes", "", "**media_type**: application/json;charset=utf-8", "",
    "Opaque structured bytes are limited to 2 MiB and have no integrity metadata."
  ]],
  ["structured YAML disguised as raw binary", [
    "**payload_required**: yes", "", "**media_type**: application/yaml", "",
    "Opaque structured bytes are limited to 2 MiB and have no integrity metadata."
  ]],
  ["prose between payload nullability and its concrete example", [
    "**payload_required**: yes", "", "**media_type**: application/json", "",
    "**payload_nullable**: no", "", "Unexpected representation prose.", "",
    "```json", '{"id":"ord_01"}', "```", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|", "| id | string | yes | no | Order identifier |"
  ]]
]) {
  task6Test(`DM-MSG-004 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, {
        messages: payloadMessage("create-order", payload)
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-004"));
  });
}

task6Test("accepts DM-MSG-005 nested example coverage, object openness, and ordered constraints", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", jsonPayload({
        example: '{"customer":{"id":"cus_01"},"attempts":2}',
        rows: [
          "| customer | object | yes | no | Additional properties forbidden |",
          "| customer.id | string | yes | no | `minLength=1`; `maxLength=40`; Customer identifier |",
          "| attempts | int | yes | no | `minimum=0`; `maximum=5`; Attempt count |"
        ]
      }))
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-005"));
});

task6Test("accepts DM-MSG-005 object openness through an API-wide Data Representation default", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", jsonPayload({
        example: '{"customer":{"id":"cus_01"}}',
        rows: [
          "| customer | object | yes | no | Customer record |",
          "| customer.id | string | yes | no | Customer identifier |"
        ]
      }))
    })
  });
  write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
    "Data Representation": ["Object containers forbid additional properties by default unless a local deviation states otherwise."]
  }) }));
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-005"));
});

task6Test("accepts DM-MSG-005 homogeneous array container and item field paths", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", jsonPayload({
        example: '{"items":[{"id":"item_01"}]}',
        rows: [
          "| items | object[] | yes | no | Order items |",
          "| items[] | object | yes | no | Additional properties forbidden |",
          "| items[].id | string | yes | no | Item identifier |"
        ]
      }))
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-005"));
});

task6Test("accepts DM-MSG-005 null independently of non-null numeric constraints", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", jsonPayload({
        example: '{"age":null}',
        rows: ["| age | int | yes | yes | `minimum=10`; `maximum=5`; Age when non-null |"]
      }))
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-005"));
});

for (const [name, payload] of [
  ["an invalid field path", jsonPayload({ rows: [
    "| customer..id | string | yes | no | Customer identifier |"
  ] })],
  ["an invalid field type", jsonPayload({ rows: [
    "| id | uuid | yes | no | Order identifier |"
  ] })],
  ["a null Type row that is not nullable", jsonPayload({
    example: '{"id":null}', rows: ["| id | null | yes | no | Exact null value |"]
  })],
  ["a null root example when the payload is non-nullable", jsonPayload({
    example: "null", rows: ["| $ | object | yes | no | Decoded object root |"]
  })],
  ["an example value that disagrees with its field Type", jsonPayload({
    example: '{"id":42}', rows: ["| id | string | yes | no | Order identifier |"]
  })],
  ["heterogeneous example array items", jsonPayload({
    example: '{"items":[1,"two"]}', rows: [
      "| items | number[] | yes | no | Numeric values |",
      "| items[] | number | yes | no | Numeric value |"
    ]
  })],
  ["an example member missing from the field table", jsonPayload({
    example: '{"id":"ord_01","status":"created"}'
  })],
  ["a missing top-level required example field", jsonPayload({
    example: "{}", rows: ["| id | string | yes | no | Order identifier |"]
  })],
  ["a missing nested required field under a present ancestor", jsonPayload({
    example: '{"customer":{}}', rows: [
      "| customer | object | yes | no | Additional properties forbidden |",
      "| customer.id | string | yes | no | Customer identifier |"
    ]
  })],
  ["an object row without an openness rule", jsonPayload({
    example: '{"customer":{"id":"cus_01"}}',
    rows: [
      "| customer | object | yes | no | Customer record |",
      "| customer.id | string | yes | no | Customer identifier |"
    ]
  })],
  ["out-of-order constraint fragments", jsonPayload({ rows: [
    "| id | string | yes | no | `maxLength=40`; `minLength=1`; Order identifier |"
  ] })],
  ["a non-compact constraint value", jsonPayload({ rows: [
    "| id | string | yes | no | `enum=[\"a\", \"b\"]`; Order identifier |"
  ] })],
  ["a type-invalid constraint value", jsonPayload({ rows: [
    "| id | string | yes | no | `minLength=\"one\"`; Order identifier |"
  ] })],
  ["a type-invalid const on an optional absent field", jsonPayload({ rows: [
    "| id | string | yes | no | Order identifier |",
    "| status | string | no | no | `const=1`; Optional status |"
  ] })],
  ["an invalid pattern on an optional absent field", jsonPayload({ rows: [
    "| id | string | yes | no | Order identifier |",
    "| status | string | no | no | `pattern=\"[\"`; Optional status |"
  ] })],
  ["mutually exclusive format constraint roles", jsonPayload({ rows: [
    "| id | string | yes | no | `format=\"uuid\"`; `format_annotation=\"uuid\"`; Order identifier |"
  ] })],
  ["contradictory constraints on an optional absent field", jsonPayload({ rows: [
    "| id | string | yes | no | Order identifier |",
    "| attempts | int | no | no | `minimum=10`; `maximum=5`; Attempt count |"
  ] })],
  ["an enormous integer constraint without throwing", jsonPayload({ rows: [
    "| id | string | yes | no | `minLength=1e999999999999999999999`; Order identifier |"
  ] })],
  ["duplicate JSON example object names", jsonPayload({ example: '{"id":"a","id":"b"}' })],
  ["malformed JSON example content", jsonPayload({ example: '{"id":}' })]
]) {
  task6Test(`DM-MSG-005 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, {
        messages: payloadMessage("create-order", payload)
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-005"));
  });
}

task6Test("accepts DM-MSG-006 multiple media types with explicit selection and branching", (t) => {
  const second = jsonPayload({
    mediaType: "application/vnd.order+json",
    example: '{"code":"created"}',
    rows: ["| code | string | yes | no | Result code |"]
  }).slice(2);
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", [
        ...jsonPayload({
          beforeRepresentation: [
            "The sender selects the vendor representation when negotiated, and the receiver branches on the wire media type."
          ]
        }),
        "", ...second
      ])
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-006"));
});

task6Test("accepts DM-MSG-006 ordered tagged variants with exact discriminator const values", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", [
        "**payload_required**: yes", "", "**media_type**: application/json", "",
        "**payload_nullable**: no", "",
        "**variant**: kind = \"created\"", "",
        "```json", '{"kind":"created","id":"ord_01"}', "```", "",
        "| Field | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| kind | string | yes | no | `const=\"created\"`; Variant discriminator |",
        "| id | string | yes | no | Order identifier |", "",
        "**variant**: kind = \"rejected\"", "",
        "```json", '{"kind":"rejected","reason":"invalid"}', "```", "",
        "| Field | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| kind | string | yes | no | `const=\"rejected\"`; Variant discriminator |",
        "| reason | string | yes | no | Rejection reason |"
      ])
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-006"));
});

task6Test("accepts DM-MSG-006 ordered untagged complete variants", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: payloadMessage("create-order", [
        "**payload_required**: yes", "", "**media_type**: application/json", "",
        "**payload_nullable**: no", "", "The sender selects the applicable command shape.", "",
        "**variant**: create", "", "```json", '{"id":"ord_01"}', "```", "",
        "| Field | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|", "| id | string | yes | no | Order identifier |", "",
        "**variant**: \u00a0delete\u00a0", "", "```json", '{"reason":"expired"}', "```", "",
        "| Field | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|", "| reason | string | yes | no | Deletion reason |"
      ])
    })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-MSG-006"));
});

for (const [name, payload] of [
  ["duplicate concrete media types", [
    ...jsonPayload(), "", ...jsonPayload().slice(2)
  ]],
  ["multiple media types without selection and branch prose", [
    ...jsonPayload(), "", ...jsonPayload({ mediaType: "application/vnd.order+json" }).slice(2)
  ]],
  ["a tagged variant with non-compact JSON", [
    "**payload_required**: yes", "", "**media_type**: application/json", "",
    "**payload_nullable**: no", "", "**variant**: kind = \"created\" ", ""
  ]],
  ["a tagged discriminator const mismatch", [
    "**payload_required**: yes", "", "**media_type**: application/json", "",
    "**payload_nullable**: no", "", "**variant**: kind = \"created\"", "",
    "```json", '{"kind":"created"}', "```", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|", "| kind | string | yes | no | `const=\"rejected\"` |"
  ]],
  ["out-of-order tagged variants", [
    "**payload_required**: yes", "", "**media_type**: application/json", "",
    "**payload_nullable**: no", "", "**variant**: kind = \"z\"", "",
    "```json", '{"kind":"z"}', "```", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|", "| kind | string | yes | no | `const=\"z\"` |", "",
    "**variant**: kind = \"a\"", "", "```json", '{"kind":"a"}', "```", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|", "| kind | string | yes | no | `const=\"a\"` |"
  ]],
  ["tagged variants using different discriminator paths", [
    "**payload_required**: yes", "", "**media_type**: application/json", "",
    "**payload_nullable**: no", "", "**variant**: kind = \"a\"", "",
    "```json", '{"kind":"a"}', "```", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|", "| kind | string | yes | no | `const=\"a\"` |", "",
    "**variant**: type = \"b\"", "", "```json", '{"type":"b"}', "```", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|", "| type | string | yes | no | `const=\"b\"` |"
  ]]
]) {
  task6Test(`DM-MSG-006 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, {
        messages: payloadMessage("create-order", payload)
      })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-MSG-006"));
  });
}

task6Test("accepts DM-CONV-003 exact format catalog resolution and selective dependency closure", (t) => {
  const row = [...BASIC_OPERATION_ROW, "Data Representation"];
  const root = createFlatOperationSet(t, {
    rows: [row],
    columns: [
      "Action", "Channel", "Operation", "Message", "Task", "Summary",
      "Required context", "Supplemental context", "Conventions"
    ],
    channelBody: operationBody(row, {
      messages: payloadMessage("create-order", jsonPayload({ rows: [
        "| id | string | yes | no | `format=\"uuid\"`; UUID construction and validation |"
      ] }))
    })
  });
  write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
    "Data Representation": [
      "| Format | Role | Meaning |", "|---|---|---|",
      "| \"uuid\" | constraint | Accept canonical UUID strings and construct and validate them without narrowing. |"
    ]
  }) }));
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-CONV-003"));
});

task6Test("accepts DM-CONV-003 format_annotation resolution from a Message Headers table", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, {
      messages: messageSection("create-order", { content: [
        "#### Headers", "",
        "| Name | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| sent-at | string | yes | no | `format_annotation=\"date-time\"`; Representation hint only |",
        "", "#### Bindings", "", "none", "", "#### Payload", "", "none"
      ] })
    })
  });
  write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
    "Data Representation": [
      "| Format | Role | Meaning |", "|---|---|---|",
      "| \"date-time\" | annotation | Preserve date-time representation intent without adding validation or construction behavior. |"
    ]
  }) }));
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-CONV-003"));
});

task6Test("DM-CONV-003 rejects an unresolved Channel Parameter format fragment", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[1] = "orders.{tenant}";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { channel: [
      "#### Parameters", "",
      "| Name | Type | Constraints / Meaning |", "|---|---|---|",
      "| tenant | string | `format=\"uuid\"`; Tenant identifier |",
      "", "#### Bindings", "", "none"
    ] })
  });
  assert.ok(ruleIds(taskScoped(root)).includes("DM-CONV-003"));
});

task6Test("DM-CONV-003 rejects a selective closure that omits a required workflow format", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[6] = "workflows/formatted.md";
  row.push("Serialization");
  const root = createFlatOperationSet(t, {
    rows: [row],
    columns: [
      "Action", "Channel", "Operation", "Message", "Task", "Summary",
      "Required context", "Supplemental context", "Conventions"
    ]
  });
  writeDocument(root, "workflows/formatted.md", { body: [
    "# Formatted workflow", "", "## Data", "",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| id | string | yes | no | `format=\"uuid\"`; Workflow identifier |"
  ].join("\n") });
  write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
    "Data Representation": [
      "| Format | Role | Meaning |", "|---|---|---|",
      "| \"uuid\" | constraint | Construct and validate canonical UUID strings without narrowing. |"
    ]
  }) }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-CONV-003"));
});

task5Test("DM-IDX-004 rejects an invalid optional Conventions selector", (t) => {
  const row = [...BASIC_OPERATION_ROW, "Data Representation, Unknown Convention"];
  const root = createFlatOperationSet(t, {
    rows: [row],
    columns: [
      "Action", "Channel", "Operation", "Message", "Task", "Summary",
      "Required context", "Supplemental context", "Conventions"
    ]
  });
  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-004"));
});

for (const [name, conventionContent, selector = "Data Representation"] of [
  ["a missing matching format row", ["Data representation prose."], "Data Representation"],
  ["a duplicate matching format row", [
    "|Format| Role |Meaning|", "|---|---|---|",
    "| \"uuid\" | constraint | First complete meaning. |",
    "| \"uuid\" | constraint | Second complete meaning. |"
  ]],
  ["a second Format catalog table", [
    "| Format | Role | Meaning |", "|---|---|---|",
    "| \"uuid\" | constraint | First complete meaning. |", "",
    "Additional format prose.", "",
    "|Format|Role|Meaning|", "|---|---|---|",
    "| \"uuid\" | constraint | Second complete meaning. |"
  ]],
  ["out-of-order format rows", [
    "| Format | Role | Meaning |", "|---|---|---|",
    "| \"uuid\" | constraint | UUID meaning. |",
    "| \"date-time\" | constraint | Date-time meaning. |"
  ]],
  ["a selective convention closure missing Data Representation", [
    "| Format | Role | Meaning |", "|---|---|---|",
    "| \"uuid\" | constraint | UUID construction and validation meaning. |"
  ], "Serialization"]
]) {
  task6Test(`DM-CONV-003 rejects ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW, selector];
    const root = createFlatOperationSet(t, {
      rows: [row],
      columns: [
        "Action", "Channel", "Operation", "Message", "Task", "Summary",
        "Required context", "Supplemental context", "Conventions"
      ],
      channelBody: operationBody(row, {
        messages: payloadMessage("create-order", jsonPayload({ rows: [
          "| id | string | yes | no | `format=\"uuid\"`; UUID construction and validation |"
        ] }))
      })
    });
    write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
      "Data Representation": conventionContent
    }) }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-CONV-003"));
  });
}

task6Test("DM-MSG-004 through DM-MSG-006 and DM-CONV-003 are cataloged for Task 6 checkpoint 4", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(
    ["DM-MSG-004", "DM-MSG-005", "DM-MSG-006", "DM-CONV-003"]
      .filter((ruleId) => !cataloged.has(ruleId)),
    []
  );
});

task6Test("DM-MSG-004 through DM-MSG-006 and DM-CONV-003 maintain Task 6 checkpoint 4 rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task6RuleTestNames.filter((name) => /DM-(?:MSG|CONV)-/.test(name)),
    rulePrefixes: ["DM-MSG", "DM-CONV"]
  });
  assert.deepEqual(result, { passed: true, errors: [] });
});

for (const [name, reply] of [
  ["none", ["none"]],
  ["whole-section unknown", [
    "unknown",
    "**unknown**: reply message set requires an authoritative reply selection"
  ]],
  ["whole-section replacement", [
    "**unsupported**: replaces Reply: zero-message reply source.json#/reply/messages"
  ]],
  ["a deviation followed by none", [
    "**deviation**: this operation suppresses the inherited reply retry rule",
    "none"
  ]]
]) {
  task6Test(`accepts DM-REPLY-001 Reply state ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, { reply })
    });
    assert.ok(!ruleIds(taskScoped(root)).includes("DM-REPLY-001"));
  });
}

for (const [name, reply] of [
  ["unknown without its marker", ["unknown"]],
  ["unknown with a non-adjacent marker", [
    "unknown", "", "**unknown**: reply channel requires the reply contract"
  ]],
  ["unknown with a non-reply marker", [
    "unknown", "**unknown**: reply keys require the reply contract"
  ]],
  ["unknown mixed with Reply keys", [
    "unknown", "**unknown**: reply message set requires an authoritative selection",
    "- channel: orders.replies"
  ]],
  ["a replacement naming another unit", [
    "**unsupported**: replaces reply Message create-order-reply: zero-message reply source.json#/reply"
  ]],
  ["a replacement followed by normal content", [
    "**unsupported**: replaces Reply: unsupported selector source.json#/reply",
    "- channel: orders.replies"
  ]],
  ["none mixed with an expanded Channel", [
    "none", "", "#### Channel", "", "- Parameters: none", "- Bindings: none"
  ]],
  ["an unsorted leading deviation group", [
    "**deviation**: zeta inherited reply rule is suppressed",
    "**deviation**: alpha inherited reply rule is replaced",
    "none"
  ]],
  ["a deviation without a core state", [
    "**deviation**: the inherited reply rule is suppressed"
  ]]
]) {
  task6Test(`DM-REPLY-001 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, { reply })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-REPLY-001"));
  });
}

task6Test("accepts DM-REPLY-002 an expanded static Reply with exact address parameters", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: expandedReply("create-order-reply", {
      channel: "orders.{tenant}.replies",
      channelContent: [
        "##### Parameters", "",
        "| Name | Type | Constraints / Meaning |",
        "|---|---|---|",
        "| tenant | string | Tenant identifier returned by authentication |",
        "", "##### Bindings", "", "none"
      ]
    }) })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-REPLY-002"));
});

task6Test("accepts DM-REPLY-002 a dynamic Reply channel and key-local unknowns", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: expandedReply("create-order-reply", {
      channel: "dynamic -- taken from the request `reply_to` header",
      correlation: "unknown",
      timeout: "unknown",
      keyMarkers: [
        "**unknown**: correlation rule requires the reply contract",
        "**unknown**: timeout behavior requires the retry policy"
      ]
    }) })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-REPLY-002"));
});

task6Test("accepts DM-REPLY-002 timeout none for a RECEIVE operation", (t) => {
  const row = ["RECEIVE", ...BASIC_OPERATION_ROW.slice(1)];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: expandedReply("create-order-reply", {
      timeout: "none"
    }) })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-REPLY-002"));
});

task6Test("accepts DM-REPLY-002 a static address beginning with dynamic", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: expandedReply("create-order-reply", {
      channel: "dynamic.orders.replies"
    }) })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-REPLY-002"));
});

for (const [name, reply] of [
  ["Reply keys in the wrong order", [
    "- correlation: matches the request", "- channel: orders.replies",
    "- timeout: 30 seconds -- report unresolved", "",
    "#### Channel", "", "- Parameters: none", "- Bindings: none", "",
    ...messageSection("create-order-reply", { level: 4 })
  ]],
  ["a missing correlation key", [
    "- channel: orders.replies", "- timeout: 30 seconds -- report unresolved", "",
    "#### Channel", "", "- Parameters: none", "- Bindings: none", "",
    ...messageSection("create-order-reply", { level: 4 })
  ]],
  ["channel unknown", expandedReply("create-order-reply", { channel: "unknown" })],
  ["channel unknown even with a key-local marker", expandedReply("create-order-reply", {
    channel: "unknown",
    keyMarkers: ["**unknown**: reply channel requires the reply contract"]
  })],
  ["a malformed dynamic channel", expandedReply("create-order-reply", { channel: "dynamic -- " })],
  ["an invalid static channel", expandedReply("create-order-reply", { channel: "orders replies" })],
  ["correlation none", expandedReply("create-order-reply", { correlation: "none" })],
  ["timeout none for SEND", expandedReply("create-order-reply", { timeout: "none" })],
  ["an unknown key without a marker", expandedReply("create-order-reply", { correlation: "unknown" })],
  ["an unknown marker without an unknown key", expandedReply("create-order-reply", {
    keyMarkers: ["**unknown**: timeout behavior requires the retry policy"]
  })],
  ["a missing reply Channel", [
    "- channel: orders.replies", "- correlation: matches the request",
    "- timeout: 30 seconds -- report unresolved", "",
    ...messageSection("create-order-reply", { level: 4 })
  ]],
  ["reply Channel subsections in reverse order", expandedReply("create-order-reply", {
    channelContent: [
      "##### Bindings", "", "none", "", "##### Parameters", "", "none"
    ]
  })],
  ["collapsed reply Bindings after expanded Parameters", expandedReply("create-order-reply", {
    channel: "orders.{tenant}.replies",
    channelContent: [
      "##### Parameters", "",
      "| Name | Type | Constraints / Meaning |", "|---|---|---|",
      "| tenant | string | Tenant identifier |", "", "- Bindings: none"
    ]
  })],
  ["a static reply parameter omitted from Parameters", expandedReply("create-order-reply", {
    channel: "orders.{tenant}.replies"
  })],
  ["Parameters on a dynamic reply channel", expandedReply("create-order-reply", {
    channel: "dynamic -- taken from the request `reply_to` header",
    channelContent: [
      "##### Parameters", "",
      "| Name | Type | Constraints / Meaning |", "|---|---|---|",
      "| tenant | string | Tenant identifier |", "", "##### Bindings", "", "none"
    ]
  })],
  ["a primary-channel replacement unit in reply Bindings", expandedReply("create-order-reply", {
    channelContent: [
      "- Parameters: none", "##### Bindings", "",
      "**unsupported**: replaces channel Bindings: broker extension source.json#/reply/channel"
    ]
  })],
  ["unsorted reply Channel deviations", expandedReply("create-order-reply", {
    channelContent: [
      "**deviation**: zeta environment rule is replaced",
      "**deviation**: alpha environment rule is replaced",
      "- Parameters: none", "- Bindings: none"
    ]
  })]
]) {
  task6Test(`DM-REPLY-002 rejects ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[3] = "create-order; reply:create-order-reply";
    const root = createFlatOperationSet(t, {
      rows: [row],
      channelBody: operationBody(row, { reply })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-REPLY-002"));
  });
}

task6Test("accepts DM-REPLY-003 exact reply routing without synthesizing an operation", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, { rows: [row] });
  const result = taskScoped(root);
  assert.ok(!ruleIds(result).includes("DM-REPLY-003"));
  assert.deepEqual(Object.keys(result.facts.core.operationDefinitions.byName), ["create-order"]);
});

for (const [name, rowMessage, reply] of [
  ["a reply INDEX entry beside Reply none", "create-order; reply:create-order-reply", ["none"]],
  ["a reply INDEX entry beside whole-Reply unknown", "create-order; reply:create-order-reply", [
    "unknown", "**unknown**: reply message set requires an authoritative selection"
  ]],
  ["a reply INDEX entry beside a whole-Reply replacement", "create-order; reply:create-order-reply", [
    "**unsupported**: replaces Reply: zero-message reply source.json#/reply/messages"
  ]],
  ["an expanded Reply omitted from INDEX", "create-order", expandedReply("create-order-reply")],
  ["an INDEX reply name differing from the expanded Message", "create-order; reply:accepted-reply",
    expandedReply("create-order-reply")],
  ["an expanded Reply without a reply Message", "create-order", [
    "- channel: orders.replies", "- correlation: matches the request",
    "- timeout: 30 seconds -- report unresolved", "", "#### Channel", "",
    "- Parameters: none", "- Bindings: none"
  ]]
]) {
  task6Test(`DM-REPLY-003 rejects ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[3] = rowMessage;
    const root = createFlatOperationSet(t, {
      rows: [row],
      channelBody: operationBody(row, { reply })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-REPLY-003"));
  });
}

task6Test("DM-REPLY-003 rejects an expanded multi-message Reply without every selection rule", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:accepted-reply; reply:rejected-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, { reply: expandedReply("accepted-reply", { messages: [
      ...messageSection("accepted-reply", { level: 4 }), "",
      ...messageSection("rejected-reply", {
        level: 4,
        selection: "Use when the reply status is rejected."
      })
    ] }) })
  });
  assert.ok(ruleIds(taskScoped(root)).includes("DM-REPLY-003"));
});

task6Test("DM-REPLY-001 through DM-REPLY-003 are cataloged for Task 6 checkpoint 5", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(
    ["DM-REPLY-001", "DM-REPLY-002", "DM-REPLY-003"]
      .filter((ruleId) => !cataloged.has(ruleId)),
    []
  );
});

task6Test("DM-REPLY-001 through DM-REPLY-003 maintain Task 6 checkpoint 5 rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task6RuleTestNames.filter((name) => name.includes("DM-REPLY-")),
    rulePrefixes: ["DM-REPLY"]
  });
  assert.deepEqual(result, { passed: true, errors: [] });
});

for (const [name, failureHandling] of [
  ["none", ["none"]],
  ["whole-section unknown", [
    "unknown", "**unknown**: operation failure handling requires the broker retry policy"
  ]],
  ["whole-section replacement", [
    "**unsupported**: replaces Failure Handling: broker-specific recovery source.json#/failures"
  ]],
  ["a suppression deviation followed by none", [
    "**deviation**: this operation suppresses the inherited retry rule",
    "none"
  ]],
  ["a deviation followed by an expanded table", [
    "**deviation**: this operation replaces the inherited publish-timeout rule",
    ...failureTable()
  ]]
]) {
  task6Test(`accepts DM-FAIL-001 Failure Handling state ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling })
    });
    assert.ok(!ruleIds(taskScoped(root)).includes("DM-FAIL-001"));
  });
}

for (const [name, failureHandling] of [
  ["an empty section", []],
  ["unknown without its marker", ["unknown"]],
  ["unknown with a non-adjacent marker", [
    "unknown", "", "**unknown**: failure behavior requires the broker contract"
  ]],
  ["none mixed with expanded content", ["none", ...failureTable()]],
  ["a replacement naming another unit", [
    "**unsupported**: replaces Reply: failure behavior source.json#/failures"
  ]],
  ["a replacement followed by normal content", [
    "**unsupported**: replaces Failure Handling: recovery extension source.json#/failures",
    ...failureTable()
  ]],
  ["unsorted leading deviations", [
    "**deviation**: zeta inherited failure rule is suppressed",
    "**deviation**: alpha inherited failure rule is replaced",
    "none"
  ]],
  ["a deviation without a core state", [
    "**deviation**: the inherited failure rule is suppressed"
  ]]
]) {
  task6Test(`DM-FAIL-001 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-FAIL-001"));
  });
}

task6Test("accepts DM-FAIL-002 a failure table with non-shape and common signals", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling: failureTable([
      ["broker-timeout", "broker timeout", "The publish deadline expires", "Report the outcome as unresolved and resend with the same message ID"],
      ["dead-letter", "common:dead-letter", "Delivery retries are exhausted", "Inspect the failed state and escalate without retrying the message"]
    ]) })
  });
  write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
    "Error Handling": [
      "Messages that exhaust delivery retries use the common signal.", "",
      ...failureShape("dead-letter")
    ]
  }) }));
  const result = taskScoped(root);
  assert.ok(!ruleIds(result).includes("DM-FAIL-002"));
  assert.deepEqual(result.facts.core.failureShapes.commonReferences, [{
    label: "dead-letter",
    operation: "create-order"
  }]);
});

task6Test("accepts DM-FAIL-002 repeated inline references resolved once", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling: [
      ...failureTable([
        ["invalid-header", "inline:invalid-message", "A required header is malformed", "Reject the message and report its state as unprocessed"],
        ["invalid-payload", "inline:invalid-message", "The payload cannot be decoded", "Reject the message and report its state as unprocessed"]
      ]),
      "",
      ...failureShape("invalid-message")
    ] })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-FAIL-002"));
});

for (const [name, failureHandling] of [
  ["a non-canonical table header", [
    "| Name | Signal | Condition | Action |", "|---|---|---|---|",
    "| timeout | broker timeout | Publish deadline expires | Report unresolved and do not retry |"
  ]],
  ["an empty Action cell", [
    "| Failure | Signal | Condition | Action |", "|---|---|---|---|",
    "| timeout | broker timeout | Publish deadline expires | |"
  ]],
  ["an Action without a next step or recovery state", failureTable([[
    "timeout", "broker timeout", "The publish deadline expires", "Record the failure details"
  ]])],
  ["a duplicate Failure label", failureTable([
    ["timeout", "broker timeout", "First timeout condition", "Report the first outcome as unresolved"],
    ["timeout", "negative acknowledgement", "Second timeout condition", "Escalate the second outcome without retrying"]
  ])],
  ["an embedded common reference token", failureTable([[
    "dead-letter", "received common:dead-letter signal", "Delivery retries are exhausted", "Escalate and preserve the failed state"
  ]])],
  ["an unresolved common reference", failureTable([[
    "dead-letter", "common:missing-shape", "Delivery retries are exhausted", "Escalate and preserve the failed state"
  ]])],
  ["an unresolved inline reference", failureTable([[
    "invalid", "inline:invalid-message", "The message cannot be decoded", "Reject and preserve the message as unprocessed"
  ]])],
  ["an unreferenced inline shape", [
    ...failureTable(), "", ...failureShape("unused-shape")
  ]],
  ["inline shapes outside first-reference order", [
    ...failureTable([
      ["alpha", "inline:alpha-shape", "The alpha condition occurs", "Report the alpha state and stop processing"],
      ["zeta", "inline:zeta-shape", "The zeta condition occurs", "Report the zeta state and stop processing"]
    ]), "", ...failureShape("zeta-shape"), "", ...failureShape("alpha-shape")
  ]]
]) {
  task6Test(`DM-FAIL-002 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-FAIL-002"));
  });
}

task6Test("accepts DM-FAIL-003 an expanded inline Presence shape", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling: [
      ...failureTable([[
        "rejected", "inline:rejection", "The command is rejected", "Report the rejection state and do not retry"
      ]]), "",
      ...failureShape("rejection", { content: [
        "#### Headers", "",
        "| Name | Type | Presence | Nullable | Meaning |",
        "|---|---|---|---|---|",
        "| error-code | string | always | no | Machine-readable rejection code |",
        "", "#### Bindings", "", "none",
        "", "#### Payload", "",
        ...jsonPayload({
          direction: "RECEIVE",
          rows: ["| reason | string | always | no | Human-readable rejection reason |"],
          example: '{"reason":"credit limit exceeded"}'
        })
      ] })
    ] })
  });
  const result = taskScoped(root);
  assert.ok(!ruleIds(result).includes("DM-FAIL-003"));
  assert.deepEqual(result.facts.core.failureShapes.inline.map((shape) => shape.label), ["rejection"]);
});

task6Test("accepts DM-FAIL-003 an exact inline failure-shape replacement", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling: [
      ...failureTable([[
        "encoded", "inline:encoded-signal", "The encoded failure is received", "Preserve the unresolved state and escalate"
      ]]), "", ...failureShape("encoded-signal", { replacement: "encoded-signal" })
    ] })
  });
  assert.ok(!ruleIds(taskScoped(root)).includes("DM-FAIL-003"));
});

for (const [name, shape] of [
  ["an invalid inline label", failureShape("Invalid.Shape")],
  ["a replacement naming another label", failureShape("encoded-signal", { replacement: "other-signal" })],
  ["a replacement followed by subsections", [
    ...failureShape("encoded-signal", { replacement: "encoded-signal" }),
    "", "#### Payload", "", "none"
  ]],
  ["reordered shape subsections", failureShape("encoded-signal", { content: [
    "#### Bindings", "", "none", "", "#### Headers", "", "none",
    "", "#### Payload", "", "none"
  ] })],
  ["a collapsed Payload", failureShape("encoded-signal", { content: [
    "- Headers: none", "- Bindings: none", "- Payload: none"
  ] })],
  ["collapsed Bindings after expanded Headers", failureShape("encoded-signal", { content: [
    "#### Headers", "",
    "| Name | Type | Presence | Nullable | Meaning |", "|---|---|---|---|---|",
    "| error | string | always | no | Failure code |", "",
    "- Bindings: none", "#### Payload", "", "none"
  ] })],
  ["Required semantics in a failure shape", failureShape("encoded-signal", { content: [
    "#### Headers", "",
    "| Name | Type | Required | Nullable | Constraints / Meaning |", "|---|---|---|---|---|",
    "| error | string | yes | no | Failure code |", "",
    "#### Bindings", "", "none", "", "#### Payload", "", "none"
  ] })],
  ["a forbidden shape-local deviation", failureShape("encoded-signal", { content: [
    "**deviation**: this shape changes the inherited envelope",
    "- Headers: none", "- Bindings: none", "#### Payload", "", "none"
  ] })]
]) {
  task6Test(`DM-FAIL-003 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t, {
      channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling: [
        ...failureTable([[
          "encoded", "inline:encoded-signal", "The encoded failure is received", "Preserve the unresolved state and escalate"
        ]]), "", ...shape
      ] })
    });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-FAIL-003"));
  });
}

task6Test("accepts DM-CONV-004 expanded and replacement common failure shapes", (t) => {
  const root = createFlatOperationSet(t);
  write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
    "Error Handling": [
      "Common failure signals are defined below.", "",
      ...failureShape("dead-letter"), "",
      ...failureShape("encoded-failure", { replacement: "encoded-failure" })
    ]
  }) }));
  const diagnostics = ruleIds(taskScoped(root));
  assert.ok(!diagnostics.includes("DM-CONV-002"));
  assert.ok(!diagnostics.includes("DM-CONV-004"));
});

for (const [name, selector, expectedDiagnostic] of [
  ["resolves a referenced common-shape format through Data Representation", "Data Representation", false],
  ["requires a referenced common-shape format in selective convention closure", "Serialization", true]
]) {
  task6Test(`DM-CONV-003 ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW, selector];
    const root = createFlatOperationSet(t, {
      rows: [row],
      columns: [
        "Action", "Channel", "Operation", "Message", "Task", "Summary",
        "Required context", "Supplemental context", "Conventions"
      ],
      channelBody: operationBody(row, { failureHandling: failureTable([[
        "dead-letter", "common:dead-letter", "Delivery retries are exhausted",
        "Inspect the failed state and escalate without retrying the message"
      ]]) })
    });
    write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
      "Error Handling": [
        "Messages that exhaust delivery retries use the common signal.", "",
        ...failureShape("dead-letter", { content: [
          "#### Headers", "",
          "| Name | Type | Presence | Nullable | Meaning |", "|---|---|---|---|---|",
          "| failure-id | string | always | no | `format=\"uuid\"`; Failure identifier |", "",
          "#### Bindings", "", "none", "", "#### Payload", "", "none"
        ] })
      ],
      "Data Representation": [
        "| Format | Role | Meaning |", "|---|---|---|",
        "| \"uuid\" | constraint | Accept canonical UUID strings and construct and validate them without narrowing. |"
      ]
    }) }));
    const result = taskScoped(root);
    assert.equal(
      ruleIds(result).includes("DM-CONV-003"),
      expectedDiagnostic,
      JSON.stringify({
        failures: result.facts.core.failureShapes,
        operations: result.facts.core.operations,
        formats: result.facts.core.formats,
        diagnostics: result.diagnostics
      })
    );
  });
}

for (const [name, shapes] of [
  ["an invalid common label", [failureShape("Dead.Letter")]],
  ["a malformed common marker", [[
    "**message_shape**:dead-letter", "", "- Headers: none", "- Bindings: none",
    "#### Payload", "", "none"
  ]]],
  ["a duplicate common label", [failureShape("dead-letter"), failureShape("dead-letter")]],
  ["a mismatched common replacement label", [
    failureShape("dead-letter", { replacement: "other-shape" })
  ]],
  ["Required semantics in a common shape", [failureShape("dead-letter", { content: [
    "#### Headers", "",
    "| Name | Type | Required | Nullable | Constraints / Meaning |", "|---|---|---|---|---|",
    "| error | string | yes | no | Failure code |", "",
    "#### Bindings", "", "none", "", "#### Payload", "", "none"
  ] })]],
  ["a common shape outside Error Handling", []]
]) {
  task6Test(`DM-CONV-004 rejects ${name}`, (t) => {
    const root = createFlatOperationSet(t);
    const sectionContents = name === "a common shape outside Error Handling"
      ? { Authentication: failureShape("dead-letter") }
      : { "Error Handling": [
        "Common failure signals are defined below.",
        ...shapes.flatMap((shape, index) => index === 0 ? shape : ["", ...shape])
      ] };
    write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody(sectionContents) }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-CONV-004"));
  });
}

task6Test("DM-FAIL-001 through DM-FAIL-003 and DM-CONV-004 are cataloged for Task 6 checkpoint 6", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(
    ["DM-FAIL-001", "DM-FAIL-002", "DM-FAIL-003", "DM-CONV-004"]
      .filter((ruleId) => !cataloged.has(ruleId)),
    []
  );
});

task6Test("DM-FAIL-001 through DM-FAIL-003 and DM-CONV-004 maintain Task 6 checkpoint 6 rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task6RuleTestNames.filter((name) => /DM-(?:FAIL|CONV)-/.test(name)),
    rulePrefixes: ["DM-FAIL", "DM-CONV"]
  });
  assert.deepEqual(result, { passed: true, errors: [] });
});

task6Test("accepts DM-FAIL-001 operation none without suppressing inherited common failure handling", (t) => {
  const root = createFlatOperationSet(t);
  write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
    "Error Handling": [
      "Messages that exhaust delivery retries use the common signal.", "",
      ...failureShape("dead-letter")
    ]
  }) }));
  const result = taskScoped(root);
  assert.ok(!ruleIds(result).includes("DM-FAIL-001"));
  assert.deepEqual(result.facts.core.failureShapes.common.map((shape) => shape.label), [
    "dead-letter"
  ]);
  assert.deepEqual(result.facts.core.failureShapes.inline, []);
});

task6Test("DM-FAIL-001 rejects suppression prose before none without a deviation marker", (t) => {
  const root = createFlatOperationSet(t, {
    channelBody: operationBody(BASIC_OPERATION_ROW, { failureHandling: [
      "This operation suppresses the inherited retry rule.",
      "none"
    ] })
  });
  assert.ok(ruleIds(taskScoped(root)).includes("DM-FAIL-001"));
});

task6Test("accepts DM-CONV-004 DM-OP-004 DM-MSG-005 DM-REPLY-003 and DM-FAIL-002 as one integrated core contract", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[3] = "create-order; reply:create-order-reply";
  const root = createFlatOperationSet(t, {
    rows: [row],
    channelBody: operationBody(row, {
      operationBindings: [
        "| Protocol | Property | Value / Rule |", "|---|---|---|",
        "| kafka | acks | all |"
      ],
      messages: payloadMessage("create-order", jsonPayload()),
      reply: expandedReply("create-order-reply", {
        messages: payloadMessage("create-order-reply", jsonPayload({
          direction: "RECEIVE",
          example: '{"status":"accepted"}',
          rows: ["| status | string | always | no | Final order acceptance state |"]
        }), { level: 4 })
      }),
      failureHandling: failureTable([[
        "dead-letter", "common:dead-letter", "Delivery retries are exhausted",
        "Inspect the failed state and escalate without retrying the message"
      ]])
    })
  });
  write(root, "CONVENTIONS.md", documentSource({ body: conventionsBody({
    "Error Handling": [
      "Messages that exhaust delivery retries use the common signal.", "",
      ...failureShape("dead-letter")
    ]
  }) }));
  const result = taskScoped(root);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.facts.core.messageDefinitions.byOperation["create-order"].map((entry) => ({
      name: entry.name,
      reply: entry.reply
    })),
    [
      { name: "create-order", reply: false },
      { name: "create-order-reply", reply: true }
    ]
  );
  assert.deepEqual(result.facts.core.failureShapes.commonReferences, [{
    label: "dead-letter",
    operation: "create-order"
  }]);
});

task6Test("DM-CONV-001 DM-OP-001 DM-MSG-001 DM-REPLY-001 and DM-FAIL-001 maintain Task 6 integration rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task6RuleTestNames,
    rulePrefixes: ["DM-CONV", "DM-OP", "DM-MSG", "DM-REPLY", "DM-FAIL"]
  });
  assert.deepEqual(result, { passed: true, errors: [] });
});

task7Test("DM-INC-001 classifies missing knowledge known absence known unrepresentable and authoritative conflict separately", () => {
  assert.equal(typeof coreValidator.evaluateIncompleteSourceExpectations, "function");
  const result = coreValidator.evaluateIncompleteSourceExpectations([
    {
      factId: "missing-authorization",
      inputs: []
    },
    {
      factId: "no-operation-binding",
      inputs: [{ sourceId: "source-a", priority: 0, state: "absent" }]
    },
    {
      factId: "recursive-payload",
      representable: false,
      inputs: [{ sourceId: "source-a", priority: 0, state: "value", value: "recursive-schema" }]
    },
    {
      factId: "conflicting-delivery",
      inputs: [
        { sourceId: "source-a", priority: 0, state: "value", value: "at-least-once" },
        { sourceId: "source-b", priority: 0, state: "value", value: "at-most-once" }
      ]
    },
    {
      factId: "resolved-delivery",
      inputs: [
        { sourceId: "source-a", priority: 0, state: "value", value: "at-least-once" },
        { sourceId: "source-b", priority: 1, state: "value", value: "at-most-once" }
      ]
    }
  ]);
  assert.deepEqual(result, [
    {
      factId: "missing-authorization",
      outcome: "emit-unknown",
      coverage: "complete",
      knowledge: "requires-input"
    },
    {
      factId: "no-operation-binding",
      outcome: "emit-none",
      coverage: "complete",
      knowledge: "complete"
    },
    {
      factId: "recursive-payload",
      outcome: "emit-unsupported",
      coverage: "requires-source",
      knowledge: "complete"
    },
    {
      factId: "conflicting-delivery",
      outcome: "generation-failure",
      reason: "authoritative-conflict"
    },
    {
      factId: "resolved-delivery",
      outcome: "emit-expanded",
      value: "at-least-once",
      coverage: "complete",
      knowledge: "complete"
    }
  ]);
});

function incompleteConventionSet(t, {
  content = ["none"],
  childCoverage = "complete",
  childKnowledge = "complete",
  rootCoverage = "complete",
  rootKnowledge = "complete"
} = {}) {
  const root = createSet(t, {
    childMetadata: { coverage: childCoverage, knowledge: childKnowledge }
  });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { coverage: rootCoverage, knowledge: rootKnowledge }
  }));
  write(root, "CONVENTIONS.md", documentSource({
    metadataOverrides: { coverage: childCoverage, knowledge: childKnowledge },
    body: conventionsBody({ Authentication: content })
  }));
  return root;
}

for (const [name, options] of [
  ["unsupported coverage", {
    content: [
      "Authentication uses a source-defined mechanism.",
      "**unsupported**: localized: recursive authentication schema source.json#/authentication"
    ],
    childCoverage: "requires-source",
    rootCoverage: "requires-source"
  }],
  ["unknown knowledge", {
    content: [
      "Authentication applies to the API.",
      "**unknown**: credential acquisition requires the deployment configuration"
    ],
    childKnowledge: "requires-input",
    rootKnowledge: "requires-input"
  }],
  ["known absence", {}]
]) {
  task7Test(`accepts DM-INC-002 exact file and root propagation for ${name}`, (t) => {
    const root = incompleteConventionSet(t, options);
    assert.ok(!ruleIds(taskScoped(root)).includes("DM-INC-002"));
  });
}

for (const [name, options] of [
  ["unsupported marker with complete file coverage", {
    content: [
      "Authentication uses a source-defined mechanism.",
      "**unsupported**: localized: recursive authentication schema source.json#/authentication"
    ],
    rootCoverage: "requires-source"
  }],
  ["unsupported child omitted from root coverage", {
    content: [
      "Authentication uses a source-defined mechanism.",
      "**unsupported**: localized: recursive authentication schema source.json#/authentication"
    ],
    childCoverage: "requires-source"
  }],
  ["unknown marker with complete file knowledge", {
    content: [
      "Authentication applies to the API.",
      "**unknown**: credential acquisition requires the deployment configuration"
    ],
    rootKnowledge: "requires-input"
  }],
  ["unknown child omitted from root knowledge", {
    content: [
      "Authentication applies to the API.",
      "**unknown**: credential acquisition requires the deployment configuration"
    ],
    childKnowledge: "requires-input"
  }],
  ["requires-source without an unsupported marker", {
    childCoverage: "requires-source",
    rootCoverage: "requires-source"
  }],
  ["requires-input without an unknown marker", {
    childKnowledge: "requires-input",
    rootKnowledge: "requires-input"
  }]
]) {
  task7Test(`DM-INC-002 rejects ${name}`, (t) => {
    const root = incompleteConventionSet(t, options);
    assert.ok(ruleIds(taskScoped(root)).includes("DM-INC-002"));
  });
}

task7Test("DM-INC-003 keeps an unrelated marker from blocking selected-operation readiness", (t) => {
  const archiveRow = [
    "SEND", "orders.archive", "archive-order", "archive-order", "archive order",
    "Archives an order command", "none", "none"
  ];
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { coverage: "requires-source" },
    body: minimalRootBody({
      operationContent: flatOperations([
        { path: "channels/orders.md", rows: [BASIC_OPERATION_ROW] },
        { path: "channels/archive.md", rows: [archiveRow] }
      ])
    })
  }));
  writeDocument(root, "channels/orders.md", { body: operationBody(BASIC_OPERATION_ROW) });
  write(root, "channels/archive.md", documentSource({
    metadataOverrides: { coverage: "requires-source" },
    body: operationBody(archiveRow, { messages: [
      "### Message archive-order", "",
      "**unsupported**: replaces Message archive-order: recursive schema source.json#/archive"
    ] })
  }));
  const documentSet = loadDocumentSet(root);
  const validation = validateDocumentSet(documentSet, { wholeSet: false });
  assert.equal(typeof coreValidator.evaluateSelectedOperationReadiness, "function");
  const selected = coreValidator.evaluateSelectedOperationReadiness(
    documentSet,
    validation.facts.core,
    { operation: "create-order" }
  );
  const unrelated = coreValidator.evaluateSelectedOperationReadiness(
    documentSet,
    validation.facts.core,
    { operation: "archive-order" }
  );
  assert.deepEqual(selected, {
    operation: "create-order",
    ready: true,
    selectedPaths: ["CONVENTIONS.md", "INDEX.md", "channels/orders.md"],
    blockingMarkers: []
  });
  assert.deepEqual(unrelated, {
    operation: "archive-order",
    ready: false,
    selectedPaths: ["CONVENTIONS.md", "INDEX.md", "channels/archive.md"],
    blockingMarkers: [{ kind: "unsupported", path: "channels/archive.md" }]
  });
});

task7Test("DM-INC-001 through DM-INC-003 are cataloged for Task 7 Step 1", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(
    ["DM-INC-001", "DM-INC-002", "DM-INC-003"].filter((ruleId) => !cataloged.has(ruleId)),
    []
  );
});

task7Test("DM-INC-001 through DM-INC-003 maintain Task 7 Step 1 rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task7RuleTestNames,
    rulePrefixes: ["DM-INC"]
  });
  assert.deepEqual(result, { passed: true, errors: [] });
});

task7Test("DM-INC-004 retains named siblings without synthetic rows and omits an unfaithful payload example", () => {
  assert.equal(typeof coreValidator.evaluatePartialCollectionSourceExpectations, "function");
  const result = coreValidator.evaluatePartialCollectionSourceExpectations([
    {
      collectionId: "request-headers",
      memberKind: "header",
      namedMembers: ["correlation-id"],
      unnamedMembers: 1
    },
    {
      collectionId: "channel-parameters",
      memberKind: "parameter",
      namedMembers: ["tenant"],
      unnamedMembers: 1
    },
    {
      collectionId: "request-fields",
      memberKind: "field",
      namedMembers: ["id"],
      unnamedMembers: 1,
      polymorphic: false,
      exampleFaithful: false,
      representation: {
        mediaType: "application/json",
        nullable: "no"
      }
    }
  ]);

  assert.deepEqual(result, [
    {
      collectionId: "request-headers",
      form: "partial-table",
      retainedNames: ["correlation-id"],
      marker: "additional unnamed header"
    },
    {
      collectionId: "channel-parameters",
      form: "partial-table",
      retainedNames: ["tenant"],
      marker: "additional unnamed parameter"
    },
    {
      collectionId: "request-fields",
      form: "partial-table",
      retainedNames: ["id"],
      marker: "additional unnamed field",
      canonicalExample: "omit",
      representation: {
        mediaType: "application/json",
        nullable: "no"
      }
    }
  ]);
});

task7Test("DM-INC-005 distinguishes no-sibling Headers and Parameters from payload field collections", () => {
  assert.equal(typeof coreValidator.evaluatePartialCollectionSourceExpectations, "function");
  const result = coreValidator.evaluatePartialCollectionSourceExpectations([
    {
      collectionId: "response-headers",
      memberKind: "header",
      namedMembers: [],
      unnamedMembers: 1
    },
    {
      collectionId: "reply-parameters",
      memberKind: "parameter",
      namedMembers: [],
      unnamedMembers: 2
    },
    {
      collectionId: "response-fields",
      memberKind: "field",
      namedMembers: [],
      unnamedMembers: 1,
      polymorphic: false,
      representation: {
        mediaType: "application/json",
        nullable: "yes"
      }
    },
    {
      collectionId: "event-variants",
      memberKind: "field",
      namedMembers: ["eventType"],
      unnamedMembers: 1,
      polymorphic: true,
      representation: {
        mediaType: "application/json",
        nullable: "no"
      }
    }
  ]);

  assert.deepEqual(result, [
    {
      collectionId: "response-headers",
      form: "whole-section-unknown"
    },
    {
      collectionId: "reply-parameters",
      form: "whole-section-unknown"
    },
    {
      collectionId: "response-fields",
      form: "representation-local-unknown",
      representation: {
        mediaType: "application/json",
        nullable: "yes"
      }
    },
    {
      collectionId: "event-variants",
      form: "representation-local-unknown",
      representation: {
        mediaType: "application/json",
        nullable: "no"
      }
    }
  ]);
});

task7Test("DM-INC-004 and DM-INC-005 are cataloged for Task 7 Step 2", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(
    ["DM-INC-004", "DM-INC-005"].filter((ruleId) => !cataloged.has(ruleId)),
    []
  );
});

task7Test("DM-INC-004 and DM-INC-005 maintain Task 7 Step 2 rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const result = auditRuleTestCorrespondence({
    catalogRuleIds: catalog.rules.map((entry) => entry.rule_id),
    testNames: task7RuleTestNames,
    rulePrefixes: ["DM-INC"]
  });
  assert.deepEqual(result, { passed: true, errors: [] });
});

nodeTest("accepts source and evidence siblings outside a closed document-set root", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-publication-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  write(publication, "source/input.json", "{}\n");
  write(publication, "evidence/report.txt", "outside the set\n");

  const loaded = loadDocumentSet(root);

  assert.deepEqual(loaded.paths, ["CONVENTIONS.md", "INDEX.md"]);
  assert.deepEqual(loaded.diagnostics, []);
});

nodeTest("DM-ID-004 rejects an unrelated file inside the closed root", (t) => {
  const root = createSet(t);
  write(root, "notes.txt", "not a document-set file\n");
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

nodeTest("DM-ID-004 rejects a symbolic link inside the closed root", (t) => {
  const root = createSet(t);
  fs.mkdirSync(path.join(root, "channels"));
  fs.symlinkSync(path.join(root, "CONVENTIONS.md"), path.join(root, "channels", "linked.md"));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

nodeTest("DM-ID-004 rejects invalid UTF-8 inside the closed root", (t) => {
  const root = createSet(t);
  write(root, "channels/bad.md", Buffer.from([0xc3, 0x28]));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

nodeTest("DM-ID-004 rejects an empty directory inside the closed root", (t) => {
  const root = createSet(t);
  fs.mkdirSync(path.join(root, "channels"));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

nodeTest("DM-ID-001 rejects a document with no identity trailer", (t) => {
  const root = createSet(t);
  write(root, "CONVENTIONS.md", `${metadata()}\n\n# Conventions\n`);
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-001"));
});

nodeTest("DM-ID-001 rejects non-empty content after an identity trailer", (t) => {
  const root = createSet(t);
  write(root, "CONVENTIONS.md", `${documentSource()}unexpected\n`);
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-001"));
});

for (const mismatch of [
  ["DM-ID-005", { childMetadata: { "docai-messaging": "0.17.2" } }],
  ["DM-ID-006", { childMetadata: { profile: "compact" } }],
  ["DM-ID-007", { childMetadata: { perspective: "Storefront" } }],
  ["DM-ID-008", { childIdentity: { setId: ALTERNATE_ID } }],
  ["DM-ID-009", { childIdentity: { projectionId: ALTERNATE_ID } }]
]) {
  nodeTest(`${mismatch[0]} rejects its mixed-set identity mismatch`, (t) => {
    const root = createSet(t, mismatch[1]);
    assert.ok(ruleIds(taskScoped(root)).includes(mismatch[0]));
  });
}

nodeTest("permits coverage, knowledge, and source_refs to vary by file", (t) => {
  const root = createSet(t, {
    childMetadata: {
      coverage: "requires-source",
      knowledge: "requires-input",
      source_refs: "source-a, source-z"
    }
  });
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: directSources([
        ["source-a", "pass-through", "none", "none", "none", "a.json", "none"],
        ["source-z", "configuration", "none", "none", "none", "z.json", "none"]
      ])
    })
  }));
  assert.deepEqual(taskScoped(root).diagnostics, []);
});

for (const identityMismatch of [
  { rootIdentity: { setId: ALTERNATE_ID }, childIdentity: { setId: ALTERNATE_ID } },
  {
    rootIdentity: { projectionId: ALTERNATE_ID },
    childIdentity: { projectionId: ALTERNATE_ID }
  }
]) {
  nodeTest("DM-ID-002 rejects a root short ID not derived from its full digest", (t) => {
    const root = createSet(t, identityMismatch);
    assert.ok(ruleIds(taskScoped(root)).includes("DM-ID-002"));
  });
}

nodeTest("task-scoped validation checks handles without recomputing the whole set", (t) => {
  const root = createSet(t);
  const documentSet = loadDocumentSet(root);

  assert.equal(ruleIds(validateDocumentSet(documentSet, { wholeSet: false })).includes("DM-ID-003"), false);
  assert.equal(ruleIds(validateDocumentSet(documentSet, { wholeSet: true })).includes("DM-ID-003"), true);
});

nodeTest("loaders and validators never repair an invalid document set", (t) => {
  const root = createSet(t, { childIdentity: { setId: ALTERNATE_ID } });
  const before = fs.readFileSync(path.join(root, "CONVENTIONS.md"));
  validateDocumentSet(loadDocumentSet(root), { wholeSet: true });
  assert.deepEqual(fs.readFileSync(path.join(root, "CONVENTIONS.md")), before);
});

nodeTest("catalogs every Task 4 identity diagnostic", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const taskRuleIds = Array.from({ length: 9 }, (_, index) => `DM-ID-${String(index + 1).padStart(3, "0")}`);
  assert.deepEqual(taskRuleIds.filter((ruleId) => !cataloged.has(ruleId)), []);
});

nodeTest("restamp requires an explicit root even when a manifest is supplied", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const manifestPath = path.join(publication, "projection-input-manifest.json");
  fs.writeFileSync(manifestPath, MANIFEST_SOURCE);
  const result = runRestamp("--projection-manifest", manifestPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit document-set root/i);
});

nodeTest("restamp requires --projection-manifest and never auto-discovers it", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const before = fs.readFileSync(path.join(root, "INDEX.md"));

  const result = runRestamp(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--projection-manifest/);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

nodeTest("restamp rejects a missing projection manifest without writing", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const before = fs.readFileSync(path.join(root, "INDEX.md"));
  const result = runRestamp(
    "--write",
    "--projection-manifest",
    path.join(publication, "source", "missing.json"),
    root
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /projection manifest cannot be read/i);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

nodeTest("restamp rejects an invalid UTF-8 projection manifest without writing", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, Buffer.from([0xc3, 0x28]));
  const before = fs.readFileSync(path.join(root, "INDEX.md"));

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valid UTF-8/i);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

nodeTest("restamp rejects a projection manifest inside the closed root", (t) => {
  const root = createSet(t);
  const manifestPath = path.join(root, "projection-input-manifest.json");
  fs.writeFileSync(manifestPath, MANIFEST_SOURCE);
  const before = fs.readFileSync(path.join(root, "INDEX.md"));

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the document-set root/i);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

nodeTest("restamp rejects an external lexical alias that resolves inside the root", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const alias = path.join(publication, "outside-alias");
  fs.symlinkSync(root, alias, "dir");
  const manifestPath = path.join(alias, "CONVENTIONS.md");
  const before = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the document-set root/i);
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes);
  }
});

nodeTest("restamp rejects an outside hard link to a root document", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "outside-hard-link.md");
  fs.linkSync(path.join(root, "CONVENTIONS.md"), manifestPath);
  const before = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /same physical file|hard link/i);
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes);
  }
});

nodeTest("a BOM before opening metadata stays visible and restamp never strips it", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const indexPath = path.join(root, "INDEX.md");
  const before = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    fs.readFileSync(indexPath)
  ]);
  fs.writeFileSync(indexPath, before);

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /opening metadata/i);
  assert.deepEqual(fs.readFileSync(indexPath), before);
});

for (const [name, lineEnding] of [["CRLF", "\r\n"], ["lone CR", "\r"]]) {
  nodeTest(`restamp handles ${name} trailer boundaries without normalizing bytes`, (t) => {
    const publication = temporaryDirectory(t, "docai-messaging-restamp-");
    const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
    const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
    write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
    const sources = new Map([
      ["INDEX.md", withLineEnding(documentSource({ root: true }), lineEnding)],
      ["CONVENTIONS.md", withLineEnding(documentSource(), lineEnding)]
    ]);
    for (const [relativePath, bytes] of sources) fs.writeFileSync(path.join(root, relativePath), bytes);

    const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

    assert.equal(result.status, 0, result.stderr);
    for (const [relativePath, before] of sources) {
      const after = fs.readFileSync(path.join(root, relativePath));
      const trailerStart = before.indexOf(Buffer.from("> docai-identity:", "ascii"));
      assert.deepEqual(after.subarray(0, trailerStart), before.subarray(0, trailerStart));
      assert.deepEqual(after.subarray(after.length - lineEnding.length), Buffer.from(lineEnding, "ascii"));
      if (lineEnding === "\r") assert.equal(after.includes(0x0a), false);
    }
    assert.deepEqual(validateDocumentSet(loadDocumentSet(root), { wholeSet: true }).diagnostics, []);
  });
}

nodeTest("restamp defaults to a non-mutating dry-run", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const indexPath = path.join(root, "INDEX.md");
  const childPath = path.join(root, "CONVENTIONS.md");
  const before = [fs.readFileSync(indexPath), fs.readFileSync(childPath)];

  const dryRun = runRestamp("--projection-manifest", manifestPath, root);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /restamp required: yes/);
  assert.deepEqual(fs.readFileSync(indexPath), before[0]);
  assert.deepEqual(fs.readFileSync(childPath), before[1]);
});

nodeTest("restamp --write hashes exact manifest bytes before stamping set identity", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const indexPath = path.join(root, "INDEX.md");
  const childPath = path.join(root, "CONVENTIONS.md");
  const before = [fs.readFileSync(indexPath), fs.readFileSync(childPath)];

  const writeRun = runRestamp("--write", "--projection-manifest", manifestPath, root);
  assert.equal(writeRun.status, 0, writeRun.stderr);
  assert.match(writeRun.stdout, /restamp required: yes/);
  assert.notDeepEqual(fs.readFileSync(indexPath), before[0]);
  assert.notDeepEqual(fs.readFileSync(childPath), before[1]);
  assert.match(fs.readFileSync(indexPath, "utf8"), new RegExp(
    `projection_id: ${MANIFEST_ID} \\| set_digest: sha256:[0-9a-f]{64} \\| projection_digest: ${MANIFEST_DIGEST}`
  ));
  assert.match(fs.readFileSync(childPath, "utf8"), new RegExp(`projection_id: ${MANIFEST_ID}$`, "m"));
  assert.deepEqual(validateDocumentSet(loadDocumentSet(root), { wholeSet: true }).diagnostics, []);
});

nodeTest("restamp identity depends on manifest bytes but not its external path", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const firstManifest = path.join(publication, "source", "projection-input-manifest.json");
  const secondManifest = path.join(publication, "evidence", "same-bytes.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  write(publication, "evidence/same-bytes.json", MANIFEST_SOURCE);
  const writeRun = runRestamp("--write", "--projection-manifest", firstManifest, root);
  assert.equal(writeRun.status, 0, writeRun.stderr);

  const cleanDryRun = runRestamp("--projection-manifest", secondManifest, root);
  assert.equal(cleanDryRun.status, 0, cleanDryRun.stderr);
  assert.match(cleanDryRun.stdout, /restamp required: no/);
});

nodeTest("restamp rejects a manifest path rebound after its descriptor is read", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  const reboundPath = path.join(publication, "source", "rebound.json");
  const openedPath = path.join(publication, "source", "opened.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  write(publication, "source/rebound.json", "{\"projection\":\"rebound\"}\n");
  const before = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);
  let rebound = false;

  assert.throws(() => restampDocumentSet(root, manifestPath, {
    write: true,
    statPath(candidate) {
      if (!rebound && candidate === manifestPath) {
        fs.renameSync(manifestPath, openedPath);
        fs.renameSync(reboundPath, manifestPath);
        rebound = true;
      }
      return fs.statSync(candidate);
    }
  }), /manifest path.*changed|same opened file/i);

  assert.equal(rebound, true);
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes);
  }
});

nodeTest("restamp preserves complete file modes despite restrictive stage creation", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const documentPaths = [path.join(root, "INDEX.md"), path.join(root, "CONVENTIONS.md")];
  fs.chmodSync(documentPaths[0], 0o6777);
  fs.chmodSync(documentPaths[1], 0o1776);
  const expectedModes = new Map(documentPaths.map((filePath) => [
    path.basename(filePath),
    fs.statSync(filePath).mode & 0o7777
  ]));
  let stageOpens = 0;

  restampDocumentSet(root, manifestPath, {
    write: true,
    openFile(filePath, flags, mode) {
      stageOpens += 1;
      return fs.openSync(filePath, flags, mode & 0o700);
    }
  });

  assert.equal(stageOpens, documentPaths.length);
  for (const filePath of documentPaths) {
    assert.equal(fs.statSync(filePath).mode & 0o7777, expectedModes.get(path.basename(filePath)));
  }
});

nodeTest("restamp rolls back earlier replacements when a later atomic replacement fails", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const before = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);
  let replacements = 0;

  assert.throws(() => restampDocumentSet(root, manifestPath, {
    write: true,
    replaceFile(from, to) {
      replacements += 1;
      if (replacements === 2) throw new Error("injected replacement failure");
      fs.renameSync(from, to);
    }
  }), /injected replacement failure/);

  assert.equal(replacements, 2);
  for (const [relativePath, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes);
  }
  assert.deepEqual(fs.readdirSync(root).sort(), ["CONVENTIONS.md", "INDEX.md"]);

  const recovered = restampDocumentSet(root, manifestPath, { write: true });
  assert.equal(recovered.changed, true);
  assert.deepEqual(validateDocumentSet(loadDocumentSet(root), { wholeSet: true }).diagnostics, []);
  assert.equal(restampDocumentSet(root, manifestPath).changed, false);
});

nodeTest("restamp retains and reports a backup when rollback restore fails", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  const manifestPath = path.join(publication, "source", "projection-input-manifest.json");
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const originals = new Map([
    ["INDEX.md", fs.readFileSync(path.join(root, "INDEX.md"))],
    ["CONVENTIONS.md", fs.readFileSync(path.join(root, "CONVENTIONS.md"))]
  ]);
  let replacements = 0;
  let retainedBackup = null;
  let restoreTarget = null;
  let failure;

  try {
    restampDocumentSet(root, manifestPath, {
      write: true,
      replaceFile(from, to) {
        replacements += 1;
        if (replacements === 2) throw new Error("injected commit failure");
        fs.renameSync(from, to);
      },
      restoreFile(from, to) {
        retainedBackup = from;
        restoreTarget = to;
        throw new Error("injected restore failure");
      }
    });
  } catch (error) {
    failure = error;
  }

  assert.ok(failure instanceof AggregateError);
  assert.notEqual(retainedBackup, null);
  assert.equal(failure.message.includes(retainedBackup), true);
  assert.equal(fs.existsSync(retainedBackup), true);
  assert.deepEqual(fs.readFileSync(retainedBackup), originals.get(path.basename(restoreTarget)));
});
