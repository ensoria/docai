import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadDocumentSet, validateDocumentSet } from "../lib/document-set.mjs";
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

function documentSource({ root = false, metadataOverrides, identityOverrides, body } = {}) {
  return [
    metadata(metadataOverrides),
    "",
    body ?? (root ? minimalRootBody() : "# Conventions"),
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
  if (writeChannel) writeDocument(root, channelPath, { sourceRefs: channelSourceRefs });
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
  writeDocument(root, "channels/alpha.md", { sourceRefs: "source-a" });
  writeDocument(root, "channels/zeta.md", { sourceRefs: "source-a" });
  writeDocument(root, "channels/middle.md", { sourceRefs: "source-z" });
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

test("accepts the DM-IDX-001 flat root INDEX with empty Operations and Workflows", (t) => {
  const root = createSet(t);
  assert.deepEqual(taskScoped(root).diagnostics, []);
});

test("accepts the DM-IDX-002 optional compact profile link in a full root INDEX", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({ profileLink: "Compact set: ../docs-compact/" })
  }));
  assert.deepEqual(taskScoped(root).diagnostics, []);
});

test("accepts the DM-IDX-001 Operation Shards root structure", (t) => {
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

test("accepts the DM-IDX-001 optional final Unprojected Operations section structure", (t) => {
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
  test(`DM-IDX-001 rejects a root INDEX with ${name}`, (t) => {
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
  test(`DM-IDX-002 rejects ${name}`, (t) => {
    const root = createSet(t);
    write(root, "INDEX.md", documentSource({
      root: true,
      metadataOverrides: { profile },
      body: minimalRootBody({ profileLink })
    }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-002"));
  });
}

test("accepts the DM-IDX-002 required full profile link in a compact root INDEX", (t) => {
  const root = createSet(t, { childMetadata: { profile: "compact" } });
  write(root, "INDEX.md", documentSource({
    root: true,
    metadataOverrides: { profile: "compact" },
    body: minimalRootBody({ profileLink: "Full set: ../docs-full/" })
  }));
  assert.deepEqual(taskScoped(root).diagnostics, []);
});

test("DM-IDX-001 and DM-IDX-002 are cataloged for Task 5 checkpoint 1", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  assert.deepEqual(["DM-IDX-001", "DM-IDX-002"].filter((ruleId) => !cataloged.has(ruleId)), []);
});

test("accepts DM-SRC-001 direct Sources and exposes exact catalog facts", (t) => {
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

test("DM-SRC-001 rejects a direct Sources table with the wrong standard columns", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({
      sourcesContent: directSources().replace("Contract version", "Version")
    })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-001"));
});

test("DM-SRC-001 rejects an empty direct Sources catalog", (t) => {
  const root = createSet(t);
  write(root, "INDEX.md", documentSource({
    root: true,
    body: minimalRootBody({ sourcesContent: directSources([]) })
  }));
  assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-001"));
});

test("DM-SRC-001 diagnoses a short-column Sources table without throwing", (t) => {
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
  test(`DM-SRC-002 rejects direct Sources with ${name}`, (t) => {
    const root = createSet(t);
    write(root, "INDEX.md", documentSource({
      root: true,
      body: minimalRootBody({ sourcesContent: directSources(rows) })
    }));
    assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-002"));
  });
}

test("accepts DM-SRC-003 source-qualified API unknown markers and root knowledge propagation", (t) => {
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

test("DM-SRC-003 rejects an unknown API identity without its source-qualified marker", (t) => {
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

test("DM-SRC-003 rejects an unknown contract version marker that omits its source ID", (t) => {
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

test("DM-SRC-003 rejects API unknown markers when root knowledge remains complete", (t) => {
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

test("DM-SRC-003 rejects prose between a Sources table and its required unknown marker", (t) => {
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

test("DM-SRC-004 rejects a malformed sha256 Revision", (t) => {
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
  test(`DM-SRC-005 rejects source_refs with ${name}`, (t) => {
    const root = createSet(t, { childMetadata: { source_refs: sourceRefs } });
    assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-005"));
  });
}

test("accepts DM-SRC-006 sharded Sources and resolves a DM-SRC-007 transitive contributor cycle", (t) => {
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

test("DM-SRC-007 records every overlapping-range false-positive shard load", (t) => {
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

test("accepts DM-SRC-003 localized unknown state in a source shard", (t) => {
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

test("DM-SRC-003 rejects a source-shard unknown value without its localized marker", (t) => {
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
  test(`DM-SRC-006 rejects ${name}`, (t) => {
    const root = createSet(t);
    write(root, "INDEX.md", documentSource({
      root: true,
      body: minimalRootBody({ sourcesContent: sourceShardRoutes([route]) })
    }));
    writeSourceShard(root, route[4], shard);
    assert.ok(ruleIds(taskScoped(root)).includes("DM-SRC-006"));
  });
}

test("DM-SRC-006 rejects a root route whose source shard is missing", (t) => {
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

test("accepts DM-SRC-006 source-shard Details outside the conventional indexes directory", (t) => {
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

test("DM-SRC-006 rejects an extra heading in a source-index shard", (t) => {
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

test("DM-SRC-006 diagnoses a short-column Source Shards table without throwing", (t) => {
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

test("DM-SRC-005 rejects a source shard whose source_refs omits one of its own rows", (t) => {
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

test("DM-SRC-007 rejects a requested ID absent from every loaded overlapping shard", (t) => {
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

test("DM-SRC-007 rejects a duplicate source ID across loaded shards", (t) => {
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

test("DM-SRC-001 through DM-SRC-007 are cataloged for Task 5 checkpoint 2", () => {
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

test("accepts DM-IDX-003 flat operation rows and records a DM-IDX-007 provenance-closed exact trace", (t) => {
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

test("accepts DM-IDX-005 workflows/none.md as a context path distinct from the none sentinel", (t) => {
  const row = [...BASIC_OPERATION_ROW];
  row[6] = "workflows/none.md";
  const root = createFlatOperationSet(t, { rows: [row] });
  writeDocument(root, "workflows/none.md");

  assert.deepEqual(taskScoped(root).diagnostics, []);
});

test("DM-IDX-003 rejects a flat operation table with the wrong standard columns", (t) => {
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

test("DM-IDX-003 rejects a flat channel route whose file is missing", (t) => {
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
  test(`DM-IDX-004 rejects a flat operation row with ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[cell] = value;
    const root = createFlatOperationSet(t, { rows: [row] });

    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-004"));
  });
}

test("DM-IDX-004 rejects a duplicate operation name across channel subsections", (t) => {
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
  test(`DM-IDX-005 rejects ${name}`, (t) => {
    const row = [...BASIC_OPERATION_ROW];
    row[6] = required;
    row[7] = supplemental;
    const root = createFlatOperationSet(t, { rows: [row] });
    for (const file of files) writeDocument(root, file);

    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-005"));
  });
}

test("accepts DM-IDX-006 overlapping operation shards and records DM-IDX-007 exact and fallback traces", (t) => {
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
  test(`DM-IDX-006 rejects ${name}`, (t) => {
    const routes = OVERLAPPING_OPERATION_ROUTES.map((row) => [...row]);
    routes[routeIndex][cellIndex] = value;
    const root = createShardedOperationSet(t, { routes });

    assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
  });
}

test("DM-IDX-006 rejects a missing operation-index shard", (t) => {
  const root = createShardedOperationSet(t, { writeMiddle: false });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

test("DM-IDX-006 rejects an operation-index shard with the wrong structure", (t) => {
  const root = createShardedOperationSet(t, { middleBody: "# Wrong Operation Index" });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

test("DM-IDX-006 rejects an empty operation-index shard", (t) => {
  const root = createShardedOperationSet(t, {
    middleBody: "# Messaging Operation Index\n\n## Operations\n\nnone"
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

test("DM-IDX-006 rejects an unlisted operation-index shard", (t) => {
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

test("DM-IDX-004 rejects a duplicate operation name across operation-index shards", (t) => {
  const duplicate = [...MIDDLE_OPERATION_ROW];
  duplicate[2] = "a-operation";
  const root = createShardedOperationSet(t, { middleRows: [duplicate] });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-004"));
});

test("DM-IDX-003 rejects one channel-file subsection split across operation-index shards", (t) => {
  const root = createShardedOperationSet(t);
  writeOperationShard(root, "indexes/operations-middle.md", {
    sourceRefs: "source-q",
    groups: [{ path: "channels/alpha.md", rows: [MIDDLE_OPERATION_ROW] }]
  });

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-003"));
});

test("DM-IDX-006 diagnoses a short-column Operation Shards table without throwing", (t) => {
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

test("DM-IDX-006 rejects content after the root Operation Shards routing table", (t) => {
  const root = createShardedOperationSet(t);
  const indexPath = path.join(root, "INDEX.md");
  const content = fs.readFileSync(indexPath, "utf8").replace(
    "\n\n## Workflows",
    "\n\nUnexpected routing prose.\n\n## Workflows"
  );
  write(root, "INDEX.md", content);

  assert.ok(ruleIds(taskScoped(root)).includes("DM-IDX-006"));
});

test("DM-IDX-003 through DM-IDX-007 are cataloged for Task 5 checkpoint 3", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const expected = ["DM-IDX-003", "DM-IDX-004", "DM-IDX-005", "DM-IDX-006", "DM-IDX-007"];
  assert.deepEqual(expected.filter((ruleId) => !cataloged.has(ruleId)), []);
});

test("accepts DM-IDX-008 direct Unprojected Operations with length-prefixed ASCII and multibyte identities", (t) => {
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
  test(`DM-IDX-008 rejects ${name}`, (t) => {
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

test("DM-IDX-008 rejects an Unprojected Operations marker for an unknown source ID", (t) => {
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

test("DM-IDX-008 rejects duplicate completeness markers for one grouping key", (t) => {
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

test("DM-IDX-008 rejects marker completeness that is not aggregated by root metadata", (t) => {
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

test("accepts DM-IDX-009 sharded Unprojected Operations and records DM-IDX-010 exact and fallback traces", (t) => {
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
  test(`DM-IDX-009 rejects ${name}`, (t) => {
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

test("DM-IDX-009 rejects one grouping key split across unprojected-operation shards", (t) => {
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

test("DM-IDX-009 rejects a missing unprojected-operation shard", (t) => {
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

test("DM-IDX-009 rejects an unlisted unprojected-operation shard", (t) => {
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

test("DM-IDX-009 rejects an unprojected-operation shard with the wrong fixed structure", (t) => {
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

test("DM-IDX-009 rejects an empty unprojected-operation shard", (t) => {
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

test("DM-IDX-009 rejects shard completeness metadata that does not match its markers", (t) => {
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

test("DM-IDX-009 rejects shard source_refs that omits a marker source ID", (t) => {
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

test("accepts DM-IDX-009 contributor source refs beyond the marker source and routes DM-IDX-010 retrieval", (t) => {
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

test("DM-IDX-009 diagnoses a short-column shard table without throwing", (t) => {
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

test("records DM-IDX-008 source-aware generation-failure and sensitive-withholding expectations separately", () => {
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

test("DM-IDX-008 through DM-IDX-010 are cataloged for Task 5 checkpoint 4", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const expected = ["DM-IDX-008", "DM-IDX-009", "DM-IDX-010"];
  assert.deepEqual(expected.filter((ruleId) => !cataloged.has(ruleId)), []);
});

test("accepts source and evidence siblings outside a closed document-set root", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-publication-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  write(publication, "source/input.json", "{}\n");
  write(publication, "evidence/report.txt", "outside the set\n");

  const loaded = loadDocumentSet(root);

  assert.deepEqual(loaded.paths, ["CONVENTIONS.md", "INDEX.md"]);
  assert.deepEqual(loaded.diagnostics, []);
});

test("DM-ID-004 rejects an unrelated file inside the closed root", (t) => {
  const root = createSet(t);
  write(root, "notes.txt", "not a document-set file\n");
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

test("DM-ID-004 rejects a symbolic link inside the closed root", (t) => {
  const root = createSet(t);
  fs.mkdirSync(path.join(root, "channels"));
  fs.symlinkSync(path.join(root, "CONVENTIONS.md"), path.join(root, "channels", "linked.md"));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

test("DM-ID-004 rejects invalid UTF-8 inside the closed root", (t) => {
  const root = createSet(t);
  write(root, "channels/bad.md", Buffer.from([0xc3, 0x28]));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

test("DM-ID-004 rejects an empty directory inside the closed root", (t) => {
  const root = createSet(t);
  fs.mkdirSync(path.join(root, "channels"));
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-004"));
});

test("DM-ID-001 rejects a document with no identity trailer", (t) => {
  const root = createSet(t);
  write(root, "CONVENTIONS.md", `${metadata()}\n\n# Conventions\n`);
  assert.ok(ruleIds(loadDocumentSet(root)).includes("DM-ID-001"));
});

test("DM-ID-001 rejects non-empty content after an identity trailer", (t) => {
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
  test(`${mismatch[0]} rejects its mixed-set identity mismatch`, (t) => {
    const root = createSet(t, mismatch[1]);
    assert.ok(ruleIds(taskScoped(root)).includes(mismatch[0]));
  });
}

test("permits coverage, knowledge, and source_refs to vary by file", (t) => {
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
  test("DM-ID-002 rejects a root short ID not derived from its full digest", (t) => {
    const root = createSet(t, identityMismatch);
    assert.ok(ruleIds(taskScoped(root)).includes("DM-ID-002"));
  });
}

test("task-scoped validation checks handles without recomputing the whole set", (t) => {
  const root = createSet(t);
  const documentSet = loadDocumentSet(root);

  assert.equal(ruleIds(validateDocumentSet(documentSet, { wholeSet: false })).includes("DM-ID-003"), false);
  assert.equal(ruleIds(validateDocumentSet(documentSet, { wholeSet: true })).includes("DM-ID-003"), true);
});

test("loaders and validators never repair an invalid document set", (t) => {
  const root = createSet(t, { childIdentity: { setId: ALTERNATE_ID } });
  const before = fs.readFileSync(path.join(root, "CONVENTIONS.md"));
  validateDocumentSet(loadDocumentSet(root), { wholeSet: true });
  assert.deepEqual(fs.readFileSync(path.join(root, "CONVENTIONS.md")), before);
});

test("catalogs every Task 4 identity diagnostic", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const cataloged = new Set(catalog.rules.map((entry) => entry.rule_id));
  const taskRuleIds = Array.from({ length: 9 }, (_, index) => `DM-ID-${String(index + 1).padStart(3, "0")}`);
  assert.deepEqual(taskRuleIds.filter((ruleId) => !cataloged.has(ruleId)), []);
});

test("restamp requires an explicit root even when a manifest is supplied", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const manifestPath = path.join(publication, "projection-input-manifest.json");
  fs.writeFileSync(manifestPath, MANIFEST_SOURCE);
  const result = runRestamp("--projection-manifest", manifestPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit document-set root/i);
});

test("restamp requires --projection-manifest and never auto-discovers it", (t) => {
  const publication = temporaryDirectory(t, "docai-messaging-restamp-");
  const root = createSet(t, { rootDir: path.join(publication, "valid", "full") });
  write(publication, "source/projection-input-manifest.json", MANIFEST_SOURCE);
  const before = fs.readFileSync(path.join(root, "INDEX.md"));

  const result = runRestamp(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--projection-manifest/);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

test("restamp rejects a missing projection manifest without writing", (t) => {
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

test("restamp rejects an invalid UTF-8 projection manifest without writing", (t) => {
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

test("restamp rejects a projection manifest inside the closed root", (t) => {
  const root = createSet(t);
  const manifestPath = path.join(root, "projection-input-manifest.json");
  fs.writeFileSync(manifestPath, MANIFEST_SOURCE);
  const before = fs.readFileSync(path.join(root, "INDEX.md"));

  const result = runRestamp("--write", "--projection-manifest", manifestPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the document-set root/i);
  assert.deepEqual(fs.readFileSync(path.join(root, "INDEX.md")), before);
});

test("restamp rejects an external lexical alias that resolves inside the root", (t) => {
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

test("restamp rejects an outside hard link to a root document", (t) => {
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

test("a BOM before opening metadata stays visible and restamp never strips it", (t) => {
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
  test(`restamp handles ${name} trailer boundaries without normalizing bytes`, (t) => {
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

test("restamp defaults to a non-mutating dry-run", (t) => {
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

test("restamp --write hashes exact manifest bytes before stamping set identity", (t) => {
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

test("restamp identity depends on manifest bytes but not its external path", (t) => {
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

test("restamp rejects a manifest path rebound after its descriptor is read", (t) => {
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

test("restamp preserves complete file modes despite restrictive stage creation", (t) => {
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

test("restamp rolls back earlier replacements when a later atomic replacement fails", (t) => {
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

test("restamp retains and reports a backup when rollback restore fails", (t) => {
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
