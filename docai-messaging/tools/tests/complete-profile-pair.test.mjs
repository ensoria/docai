import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodeTest from "node:test";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { auditRuleTestCorrespondence } from "../lib/fixture-runner.mjs";
import { deriveShortId } from "../lib/identity.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { validateCompleteFieldDefaults } from "../lib/validators/complete-field-defaults.mjs";
import { validateCompleteSameAs } from "../lib/validators/complete-same-as.mjs";

const validPairPath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/focused/valid/operations-profile-path-parity-valid/",
  import.meta.url
));
const invalidPathPairPath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/focused/invalid/operations-profile-path-parity-invalid/",
  import.meta.url
));
const catalogPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));
const profileRuleTestNames = [];
const profileModule = await import("../lib/validators/complete-profiles.mjs")
  .catch((loadError) => ({ loadError }));

function test(name, ...arguments_) {
  profileRuleTestNames.push(String(name));
  return nodeTest(name, ...arguments_);
}

function validateDocumentSets(full, compact, options = { wholeSet: false }) {
  assert.equal(profileModule.loadError, undefined, "complete profile-pair validator loads");
  assert.equal(
    typeof profileModule.validateCompleteProfilePair,
    "function",
    "complete profile-pair validator is exported"
  );
  return profileModule.validateCompleteProfilePair(
    full,
    compact,
    options
  );
}

function loadPair(pairPath) {
  return {
    full: loadDocumentSet(path.join(pairPath, "full")),
    compact: loadDocumentSet(path.join(pairPath, "compact"))
  };
}

function refreshIdentityLine(file) {
  file.identityLine = file.content.split("\n")
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

function validatePair(pairPath, options = { wholeSet: false }) {
  const pair = loadPair(pairPath);
  return validateDocumentSets(pair.full, pair.compact, options);
}

function replaceAlphaPayload(documentSet, example) {
  const channel = documentSet.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(channel, undefined);
  channel.content = channel.content.replace("#### Payload\n\nnone", [
    "#### Payload",
    "",
    "**payload_required**: yes",
    "**media_type**: application/json",
    "**payload_nullable**: no",
    "```json",
    example,
    "```",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| count | int | yes | no | Exact item count |",
    "| id | string | yes | no | Stable item identifier |"
  ].join("\n"));
  refreshIdentityLine(channel);
}

function replaceZetaPayload(documentSet, example) {
  const channel = documentSet.files.find((file) => file.path === "channels/zeta.md");
  assert.notEqual(channel, undefined);
  channel.content = channel.content.replace("#### Payload\n\nnone", [
    "#### Payload",
    "",
    "**payload_presence**: optional",
    "**media_type**: application/json",
    "**payload_nullable**: no",
    "```json",
    example,
    "```",
    "| Field | Type | Presence | Nullable | Meaning |",
    "|---|---|---|---|---|",
    "| count | int | optional | no |  |",
    "| id | string | optional | no |  |"
  ].join("\n"));
  refreshIdentityLine(channel);
}

function replaceAlphaHeaders(documentSet) {
  const channel = documentSet.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(channel, undefined);
  channel.content = channel.content.replace("#### Headers\n\nnone", [
    "#### Headers",
    "",
    "| Name | Type | Required | Nullable | Constraints / Meaning | x-source |",
    "|---|---|---|---|---|---|",
    "| trace-id | string | yes | no | Stable trace identifier | api |"
  ].join("\n"));
  refreshIdentityLine(channel);
}

function addAlphaMessage(documentSet, payload) {
  const channel = documentSet.files.find((file) => file.path === "channels/alpha.md");
  const operationIndex = documentSet.files.find((file) => (
    file.path === "indexes/operations-broad.md"
  ));
  assert.notEqual(channel, undefined);
  assert.notEqual(operationIndex, undefined);
  channel.content = channel.content.replace(
    "### Message a-message\n\n#### Headers",
    "### Message a-message\n\nUse this message when the `kind` field is `a`.\n\n#### Headers"
  ).replace("### Reply\n\nnone", [
    "### Message b-message",
    "",
    "Use this message when the `kind` field is `b`.",
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
    "**payload_required**: yes",
    payload,
    "",
    "### Reply",
    "",
    "none"
  ].join("\n"));
  operationIndex.content = operationIndex.content.replace(
    "| SEND | a.events | a-operation | a-message | alpha task |",
    "| SEND | a.events | a-operation | a-message; b-message | alpha task |"
  );
  refreshIdentityLine(channel);
}

function alphaSameAsPair() {
  const pair = loadPair(validPairPath);
  const example = "{\"count\":1,\"id\":\"item_01\"}";
  const expandedRepresentation = [
    "**media_type**: application/json",
    "**payload_nullable**: no",
    "```json",
    example,
    "```",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| count | int | yes | no | Exact item count |",
    "| id | string | yes | no | Stable item identifier |"
  ].join("\n");
  for (const profile of [pair.full, pair.compact]) {
    replaceAlphaPayload(profile, example);
    addAlphaMessage(profile, expandedRepresentation);
  }
  const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(compactChannel, undefined);
  compactChannel.metadata["x-retrieval-unit"] = "channel-file";
  compactChannel.content = compactChannel.content.replace(
    "source_refs: all",
    "source_refs: all | x-retrieval-unit: channel-file"
  ).replace(
    `**payload_required**: yes\n${expandedRepresentation}\n\n### Reply`,
    "**payload_required**: yes\n"
      + "**same_as**: Operation a-operation Message a-message Payload application/json\n\n"
      + "### Reply"
  );
  refreshIdentityLine(compactChannel);
  return pair;
}

function validateSameAsContent(content, pathName = "channels/same-as.md") {
  return validateCompleteSameAs({
    files: [{
      path: pathName,
      content,
      identityLine: content.split("\n").length + 1,
      metadata: { profile: "compact", "x-retrieval-unit": "channel-file" }
    }]
  });
}

test("DM-PROFILE-001 and DM-PROFILE-002 accept one matching full and compact pair", () => {
  const result = validatePair(validPairPath);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.completeProfilePair.paths, [
    "CONVENTIONS.md",
    "INDEX.md",
    "channels/alpha.md",
    "channels/middle.md",
    "channels/zeta.md",
    "indexes/operations-broad.md",
    "indexes/operations-middle.md"
  ]);
  assert.deepEqual(result.facts.completeProfilePair.projection, {
    docaiMessaging: "0.17.1",
    perspective: "storefront",
    projectionId: "b32:2su6l5snggpayed76bebjwuzuy",
    projectionDigest: "sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480"
  });
  assert.deepEqual(result.facts.completeProfilePair.full.catalogs, {
    sources: { form: "direct", shardPaths: [] },
    operations: {
      form: "sharded",
      shardPaths: ["indexes/operations-broad.md", "indexes/operations-middle.md"]
    },
    workflows: { form: "none", shardPaths: [], routes: [] },
    unprojectedOperations: { form: "none", shardPaths: [] }
  });
  assert.deepEqual(
    result.facts.completeProfilePair.compact.catalogs,
    result.facts.completeProfilePair.full.catalogs
  );
  assert.equal(result.facts.completeProfilePair.full.profileLink, "../compact/");
  assert.equal(result.facts.completeProfilePair.compact.profileLink, "../full/");
  assert.notEqual(
    result.facts.completeProfilePair.full.setId,
    result.facts.completeProfilePair.compact.setId
  );
});

test("DM-PROFILE-001 rejects a full profile link that does not discover its compact pair", () => {
  const pair = loadPair(validPairPath);
  const root = pair.full.files.find((file) => file.path === "INDEX.md");
  assert.notEqual(root, undefined);
  root.content = root.content.replace("Compact set: ../compact/", "Compact set: ../elsewhere/");

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-001"]);
  assert.equal(result.facts.completeProfilePair, null);
});

test("DM-PROFILE-001 rejects mismatched pair profile and projection metadata", async (t) => {
  const cases = [
    {
      name: "compact root declared as full",
      mutate(compact) {
        for (const file of compact.files) file.metadata.profile = "full";
        const root = compact.files.find((file) => file.path === "INDEX.md");
        root.content = root.content.replace("Full set: ../full/", "Compact set: ../full/");
      }
    },
    {
      name: "DocAI Messaging version",
      mutate(compact) {
        for (const file of compact.files) file.metadata["docai-messaging"] = "0.17.2";
      }
    },
    {
      name: "perspective",
      mutate(compact) {
        for (const file of compact.files) file.metadata.perspective = "warehouse";
      }
    },
    {
      name: "projection identity",
      mutate(compact) {
        const projectionDigest = `sha256:${"a".repeat(64)}`;
        const projectionId = deriveShortId(projectionDigest);
        for (const file of compact.files) file.identity.projection_id = projectionId;
        const root = compact.files.find((file) => file.path === "INDEX.md");
        root.identity.projection_digest = projectionDigest;
      }
    }
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, () => {
      const pair = loadPair(validPairPath);
      fixtureCase.mutate(pair.compact);

      const result = validateDocumentSets(pair.full, pair.compact);

      assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-001"]);
      assert.equal(result.facts.completeProfilePair, null);
    });
  }
});

test("DM-PROFILE-001 rejects different full and compact document paths", () => {
  const result = validatePair(invalidPathPairPath);

  assert.equal(result.diagnostics.some((entry) => entry.ruleId === "DM-PROFILE-001"), true);
  assert.equal(result.facts.completeProfilePair, null);
});

test("DM-PROFILE-002 rejects different operation routing forms or shard paths", () => {
  const result = validatePair(invalidPathPairPath);

  assert.deepEqual(
    result.diagnostics.map((entry) => entry.ruleId),
    ["DM-PROFILE-001", "DM-PROFILE-002"]
  );
  assert.equal(result.facts.completeProfilePair, null);
});

test("DM-PROFILE-002 rejects catalog parity drift outside Operations", async (t) => {
  const cases = [
    {
      name: "Sources form",
      mutate(compact) {
        const root = compact.files.find((file) => file.path === "INDEX.md");
        root.content = root.content.replace(
          [
            "## Sources",
            "",
            "| ID | Kind | Specification | API | Contract version | Location | Revision |",
            "|---|---|---|---|---|---|---|",
            "| source-a | pass-through | none | none | none | source.md | none |"
          ].join("\n"),
          [
            "## Sources",
            "",
            "### Source Shards",
            "",
            "| First ID | Last ID | Kinds | Summary | Details |",
            "|---|---|---|---|---|",
            "| source-a | source-a | pass-through | Source inputs | indexes/sources.md |"
          ].join("\n")
        );
        refreshIdentityLine(root);
        addDocument(compact, "indexes/sources.md", [
          "# Messaging Source Index",
          "",
          "## Sources",
          "",
          "| ID | Kind | Specification | API | Contract version | Location | Revision |",
          "|---|---|---|---|---|---|---|",
          "| source-a | pass-through | none | none | none | source.md | none |"
        ].join("\n"));
      }
    },
    {
      name: "Workflows form and route",
      mutate(compact) {
        const root = compact.files.find((file) => file.path === "INDEX.md");
        root.content = root.content.replace("## Workflows\n\nnone", [
          "## Workflows",
          "",
          "| Name | Summary | Details |",
          "|---|---|---|",
          "| Order flow | Coordinate order handling | workflows/order-flow.md |"
        ].join("\n"));
        refreshIdentityLine(root);
        addDocument(compact, "workflows/order-flow.md", [
          "# Order flow",
          "",
          "Order flow coordinates the selected messaging operations.",
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
        ].join("\n"));
      }
    },
    {
      name: "Unprojected Operations form",
      mutate(compact) {
        const root = compact.files.find((file) => file.path === "INDEX.md");
        root.metadata.coverage = "requires-source";
        root.content = root.content.replace("## Workflows\n\nnone", [
          "## Workflows",
          "",
          "none",
          "",
          "## Unprojected Operations",
          "",
          "**unsupported**: localized: source operation source-a 12:legacy-order: source operation cannot be projected from source.json#/operations/1"
        ].join("\n"));
        refreshIdentityLine(root);
      }
    }
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, () => {
      const pair = loadPair(validPairPath);
      fixtureCase.mutate(pair.compact);

      const result = validateDocumentSets(pair.full, pair.compact);

      assert.equal(result.diagnostics.some((entry) => entry.ruleId === "DM-PROFILE-002"), true);
      assert.deepEqual(
        result.diagnostics
          .map((entry) => entry.ruleId)
          .filter((ruleId) => !ruleId.startsWith("DM-PROFILE-")),
        []
      );
      assert.equal(result.facts.completeProfilePair, null);
    });
  }
});

test("DM-PROFILE-002 rejects workflow routing-name drift within matching direct forms", () => {
  const pair = loadPair(validPairPath);
  for (const [profile, name] of [[pair.full, "Order flow"], [pair.compact, "Order handling"]]) {
    const root = profile.files.find((file) => file.path === "INDEX.md");
    root.content = root.content.replace("## Workflows\n\nnone", [
      "## Workflows",
      "",
      "| Name | Summary | Details |",
      "|---|---|---|",
      `| ${name} | Coordinate order handling | workflows/order-flow.md |`
    ].join("\n"));
    refreshIdentityLine(root);
    addDocument(profile, "workflows/order-flow.md", [
      "# Order flow",
      "",
      "Order flow coordinates the selected messaging operations.",
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
    ].join("\n"));
  }

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-002"]);
  assert.equal(result.facts.completeProfilePair, null);
});

test("DM-PROFILE-001 rejects corresponding-file metadata drift", async (t) => {
  const cases = [
    {
      name: "coverage",
      mutate(compact) {
        const root = compact.files.find((file) => file.path === "INDEX.md");
        const conventions = compact.files.find((file) => file.path === "CONVENTIONS.md");
        root.metadata.coverage = "requires-source";
        conventions.metadata.coverage = "requires-source";
        conventions.content = conventions.content.replace(
          "## Authentication\n\nnone",
          "## Authentication\n\n**unsupported**: replaces CONVENTIONS Authentication: source authentication scheme"
        );
      }
    },
    {
      name: "knowledge",
      mutate(compact) {
        const root = compact.files.find((file) => file.path === "INDEX.md");
        const conventions = compact.files.find((file) => file.path === "CONVENTIONS.md");
        root.metadata.knowledge = "requires-input";
        conventions.metadata.knowledge = "requires-input";
        conventions.content = conventions.content.replace(
          "## Authentication\n\nnone",
          "## Authentication\n\nunknown\n**unknown**: authentication requires an authoritative security input"
        );
        conventions.identityLine += 1;
      }
    },
    {
      name: "source_refs",
      mutate(compact) {
        const channel = compact.files.find((file) => file.path === "channels/alpha.md");
        channel.metadata.source_refs = "source-a";
      }
    }
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, () => {
      const pair = loadPair(validPairPath);
      fixtureCase.mutate(pair.compact);

      const result = validateDocumentSets(pair.full, pair.compact);

      assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-001"]);
      assert.equal(result.facts.completeProfilePair, null);
    });
  }
});

test("DM-PROFILE-003 rejects a normalized prose mismatch in a corresponding file", () => {
  const pair = loadPair(validPairPath);
  const channel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(channel, undefined);
  channel.content = channel.content.replace(
    "Documents the selected messaging operation.",
    "Documents a different selected messaging operation."
  );

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-003"]);
  assert.equal(result.diagnostics[0].file, "compact/channels/alpha.md");
  assert.equal(result.facts.completeProfilePair, null);
});

test("DM-PROFILE-003 normalizes prose trailing spaces but preserves fixed structural text", async (t) => {
  await t.test("accepts trailing ASCII spaces on prose", () => {
    const pair = loadPair(validPairPath);
    const fullChannel = pair.full.files.find((file) => file.path === "channels/alpha.md");
    const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
    assert.notEqual(fullChannel, undefined);
    assert.notEqual(compactChannel, undefined);
    fullChannel.content = fullChannel.content.replace(
      "### Related\n\nnone",
      "### Related\n\nSee the operation guide."
    );
    compactChannel.content = compactChannel.content.replace(
      "### Related\n\nnone",
      "### Related\n\nSee the operation guide.  "
    );

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(result.diagnostics, []);
  });

  await t.test("rejects trailing ASCII spaces on a fixed value", () => {
    const pair = loadPair(validPairPath);
    const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
    assert.notEqual(compactChannel, undefined);
    compactChannel.content = compactChannel.content.replace(
      "### Related\n\nnone",
      "### Related\n\nnone  "
    );

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-003"]);
  });
});

test("DM-PROFILE-003 excludes profile-specific x- extension structures", () => {
  const pair = loadPair(validPairPath);
  const fullRoot = pair.full.files.find((file) => file.path === "INDEX.md");
  const compactRoot = pair.compact.files.find((file) => file.path === "INDEX.md");
  const fullChannel = pair.full.files.find((file) => file.path === "channels/alpha.md");
  const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(fullRoot, undefined);
  assert.notEqual(compactRoot, undefined);
  assert.notEqual(fullChannel, undefined);
  assert.notEqual(compactChannel, undefined);

  fullRoot.metadata["x-profile-note"] = "full-only";
  fullRoot.content = fullRoot.content.replace(
    "source_refs: all",
    "source_refs: all | x-profile-note: full-only"
  ).replace(
    "| ID | Kind | Specification | API | Contract version | Location | Revision |\n|---|---|---|---|---|---|---|\n| source-a | pass-through | none | none | none | source.md | none |",
    "| ID | Kind | Specification | API | Contract version | Location | Revision | x-full |\n|---|---|---|---|---|---|---|---|\n| source-a | pass-through | none | none | none | source.md | none | full-only |"
  );
  compactRoot.metadata["x-retrieval-unit"] = "root";
  compactRoot.content = compactRoot.content.replace(
    "source_refs: all",
    "source_refs: all | x-retrieval-unit: root"
  ).replace(
    "| ID | Kind | Specification | API | Contract version | Location | Revision |\n|---|---|---|---|---|---|---|\n| source-a | pass-through | none | none | none | source.md | none |",
    "| ID | Kind | Specification | API | Contract version | Location | Revision | x-compact |\n|---|---|---|---|---|---|---|---|\n| source-a | pass-through | none | none | none | source.md | none | compact-only |"
  );
  fullChannel.content = fullChannel.content.replace(
    "### Related\n\nnone",
    "### Related\n\nnone\n\n**x-full-note**: ignored"
  );
  fullChannel.identityLine += 2;
  compactChannel.content = compactChannel.content.replace(
    "### Related\n\nnone",
    "### Related\n\nnone\n\n#### x-Retrieval\n\nRuntime-only compact retrieval note."
  );
  compactChannel.identityLine += 4;

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics, []);
});

test("DM-PROFILE-003 compares JSON examples by exact decoded value", async (t) => {
  await t.test("accepts compact one-line object-order and exact number-spelling differences", () => {
    const pair = loadPair(validPairPath);
    replaceAlphaPayload(pair.full, [
      "{",
      "  \"count\": 9007199254740993,",
      "  \"id\": \"item_01\"",
      "}"
    ].join("\n"));
    replaceAlphaPayload(
      pair.compact,
      "{\"id\":\"item_01\",\"count\":9007199254740993.0}"
    );

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(result.diagnostics, []);
  });

  await t.test("rejects unequal values beyond IEEE 754 precision", () => {
    const pair = loadPair(validPairPath);
    replaceAlphaPayload(
      pair.full,
      "{\"count\":9007199254740993,\"id\":\"item_01\"}"
    );
    replaceAlphaPayload(
      pair.compact,
      "{\"count\":9007199254740992,\"id\":\"item_01\"}"
    );

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-003"]);
    assert.equal(result.facts.completeProfilePair, null);
  });
});

test("DM-PROFILE-003 defers invalid compact JSON fence and rendering diagnostics", async (t) => {
  await t.test("rejects a non-json fence info string before pair comparison", () => {
    const pair = loadPair(validPairPath);
    const example = "{\"count\":1,\"id\":\"item_01\"}";
    replaceAlphaPayload(pair.full, example);
    replaceAlphaPayload(pair.compact, example);
    const compactChannel = pair.compact.files.find((file) => (
      file.path === "channels/alpha.md"
    ));
    assert.notEqual(compactChannel, undefined);
    compactChannel.content = compactChannel.content.replace("```json\n", "```jsonc\n");

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-MSG-004"]);
    assert.equal(result.facts.completeProfilePair, null);
  });

  for (const fixtureCase of [
    {
      name: "trailing comma",
      example: "{\"count\":1,\"id\":\"item_01\",}"
    },
    {
      name: "duplicate object name",
      example: "{\"count\":1,\"id\":\"item_01\",\"id\":\"item_02\"}"
    }
  ]) {
    await t.test(`rejects ${fixtureCase.name} rendering before pair comparison`, () => {
      const pair = loadPair(validPairPath);
      replaceAlphaPayload(pair.full, "{\"count\":1,\"id\":\"item_01\"}");
      replaceAlphaPayload(pair.compact, fixtureCase.example);

      const result = validateDocumentSets(pair.full, pair.compact);

      assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-MSG-005"]);
      assert.equal(result.facts.completeProfilePair, null);
    });
  }
});

test("DM-PROFILE-004 reconstructs compact SEND payload field defaults", () => {
  const pair = loadPair(validPairPath);
  for (const profile of [pair.full, pair.compact]) {
    replaceAlphaPayload(profile, "{\"count\":1,\"id\":\"item_01\"}");
  }
  const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(compactChannel, undefined);
  compactChannel.content = compactChannel.content.replace([
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| count | int | yes | no | Exact item count |",
    "| id | string | yes | no | Stable item identifier |"
  ].join("\n"), [
    "**field_defaults**: Required=yes | Nullable=no",
    "",
    "| Field | Type | Constraints / Meaning |",
    "|---|---|---|",
    "| count | int | Exact item count |",
    "| id | string | Stable item identifier |"
  ].join("\n"));
  refreshIdentityLine(compactChannel);

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics, []);
});

test("DM-PROFILE-004 reconstructs RECEIVE Meaning=none as empty cells", () => {
  const pair = loadPair(validPairPath);
  for (const profile of [pair.full, pair.compact]) {
    replaceZetaPayload(profile, "{\"count\":1,\"id\":\"item_01\"}");
  }
  const compactChannel = pair.compact.files.find((file) => file.path === "channels/zeta.md");
  assert.notEqual(compactChannel, undefined);
  compactChannel.content = compactChannel.content.replace([
    "| Field | Type | Presence | Nullable | Meaning |",
    "|---|---|---|---|---|",
    "| count | int | optional | no |  |",
    "| id | string | optional | no |  |"
  ].join("\n"), [
    "**field_defaults**: Presence=optional | Nullable=no | Meaning=none",
    "",
    "| Field | Type |",
    "|---|---|",
    "| count | int |",
    "| id | string |"
  ].join("\n"));
  refreshIdentityLine(compactChannel);

  const singleResult = validateCompleteDocumentSet(pair.compact, { wholeSet: false });
  const pairResult = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(singleResult.diagnostics, []);
  assert.deepEqual(singleResult.facts.complete.fieldDefaults.map((entry) => ({
    path: entry.path,
    columns: entry.columns,
    logicalHeader: entry.logicalHeader
  })), [{
    path: "channels/zeta.md",
    columns: [
      { column: "Presence", value: "optional" },
      { column: "Nullable", value: "no" },
      { column: "Meaning", value: "none" }
    ],
    logicalHeader: ["Field", "Type", "Presence", "Nullable", "Meaning"]
  }]);
  assert.deepEqual(pairResult.diagnostics, []);
});

test("DM-PROFILE-004 reconstructs Headers while preserving trailing x- columns", () => {
  const pair = loadPair(validPairPath);
  for (const profile of [pair.full, pair.compact]) replaceAlphaHeaders(profile);
  const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(compactChannel, undefined);
  compactChannel.content = compactChannel.content.replace([
    "| Name | Type | Required | Nullable | Constraints / Meaning | x-source |",
    "|---|---|---|---|---|---|",
    "| trace-id | string | yes | no | Stable trace identifier | api |"
  ].join("\n"), [
    "**field_defaults**: Required=yes | Nullable=no",
    "",
    "| Name | Type | Constraints / Meaning | x-source |",
    "|---|---|---|---|",
    "| trace-id | string | Stable trace identifier | api |"
  ].join("\n"));
  refreshIdentityLine(compactChannel);

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics, []);
});

test("DM-PROFILE-004 accepts nested Reply Headers and Payload tables", () => {
  const content = [
    "##### Payload",
    "",
    "**field_defaults**: Presence=always | Nullable=no | Meaning=none",
    "",
    "| Field | Type |",
    "|---|---|",
    "| id | string |"
  ].join("\n");
  const result = validateCompleteFieldDefaults({
    files: [{
      path: "channels/reply.md",
      content,
      metadata: { profile: "compact" }
    }]
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.expandedDocumentSet.files[0].content.includes(
    "| Field | Type | Presence | Nullable | Meaning |\n"
      + "|---|---|---|---|---|\n"
      + "| id | string | always | no |  |"
  ), true);
});

test("DM-PROFILE-004 rejects invalid field default grammar and placement", async (t) => {
  const cases = [
    {
      name: "duplicate column",
      marker: "Required=yes | Required=yes | Nullable=no",
      compactHeader: ["Field", "Type", "Constraints / Meaning"]
    },
    {
      name: "out-of-order columns",
      marker: "Nullable=no | Required=yes",
      compactHeader: ["Field", "Type", "Constraints / Meaning"]
    },
    { name: "unknown column", marker: "Unknown=yes" },
    { name: "inapplicable direction column", marker: "Presence=optional" },
    {
      name: "prohibited default value",
      marker: "Required=conditional | Nullable=no",
      compactHeader: ["Field", "Type", "Constraints / Meaning"]
    },
    { name: "defaulted column remains in table", marker: "Required=yes" }
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, () => {
      const pair = loadPair(validPairPath);
      for (const profile of [pair.full, pair.compact]) {
        replaceAlphaPayload(profile, "{\"count\":1,\"id\":\"item_01\"}");
      }
      const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
      assert.notEqual(compactChannel, undefined);
      const fullTable = [
        "| Field | Type | Required | Nullable | Constraints / Meaning |",
        "|---|---|---|---|---|",
        "| count | int | yes | no | Exact item count |",
        "| id | string | yes | no | Stable item identifier |"
      ];
      const table = fixtureCase.compactHeader === undefined
        ? fullTable
        : [
          `| ${fixtureCase.compactHeader.join(" | ")} |`,
          `|${fixtureCase.compactHeader.map(() => "---").join("|")}|`,
          "| count | int | Exact item count |",
          "| id | string | Stable item identifier |"
        ];
      compactChannel.content = compactChannel.content.replace(
        fullTable.join("\n"),
        [`**field_defaults**: ${fixtureCase.marker}`, "", ...table].join("\n")
      );
      refreshIdentityLine(compactChannel);

      const result = validateDocumentSets(pair.full, pair.compact);

      assert.equal(result.diagnostics.length > 0, true);
      assert.deepEqual(
        [...new Set(result.diagnostics.map((entry) => entry.ruleId))],
        ["DM-PROFILE-004"]
      );
    });
  }

  await t.test("marker in full profile", () => {
    const pair = loadPair(validPairPath);
    for (const profile of [pair.full, pair.compact]) {
      replaceAlphaPayload(profile, "{\"count\":1,\"id\":\"item_01\"}");
    }
    const fullChannel = pair.full.files.find((file) => file.path === "channels/alpha.md");
    assert.notEqual(fullChannel, undefined);
    fullChannel.content = fullChannel.content.replace(
      "| Field | Type | Required | Nullable | Constraints / Meaning |",
      "**field_defaults**: Required=yes\n\n| Field | Type | Required | Nullable | Constraints / Meaning |"
    );
    refreshIdentityLine(fullChannel);

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(
      [...new Set(result.diagnostics.map((entry) => entry.ruleId))],
      ["DM-PROFILE-004"]
    );
  });

  await t.test("marker not before a field table", () => {
    const pair = loadPair(validPairPath);
    const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
    assert.notEqual(compactChannel, undefined);
    compactChannel.content = compactChannel.content.replace(
      "#### Payload\n\nnone",
      "#### Payload\n\n**field_defaults**: Required=yes\n\nnone"
    );
    refreshIdentityLine(compactChannel);

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(
      [...new Set(result.diagnostics.map((entry) => entry.ruleId))],
      ["DM-PROFILE-004"]
    );
  });
});

test("DM-PROFILE-005 expands a backward same-file same_as reference", () => {
  const pair = alphaSameAsPair();

  const compactResult = validateCompleteDocumentSet(pair.compact, { wholeSet: false });
  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(compactResult.diagnostics, []);
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
    path: "channels/alpha.md",
    reference: {
      operation: "a-operation",
      message: "b-message",
      reply: false,
      mediaType: "application/json"
    },
    target: {
      operation: "a-operation",
      message: "a-message",
      reply: false,
      mediaType: "application/json"
    }
  }]);
  assert.deepEqual(result.diagnostics, []);
});

test("DM-PROFILE-005 uses canonical JSON equality for paired-full representations", () => {
  const pair = alphaSameAsPair();
  const fullChannel = pair.full.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(fullChannel, undefined);
  const secondMessage = fullChannel.content.indexOf("### Message b-message");
  fullChannel.content = fullChannel.content.slice(0, secondMessage)
    + fullChannel.content.slice(secondMessage).replace(
      "{\"count\":1,\"id\":\"item_01\"}",
      "{\"id\":\"item_01\",\"count\":1.0}"
    );

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics, []);
});

test("DM-PROFILE-005 expands field_defaults before copying a same_as target", () => {
  const pair = alphaSameAsPair();
  const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(compactChannel, undefined);
  compactChannel.content = compactChannel.content.replace([
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| count | int | yes | no | Exact item count |",
    "| id | string | yes | no | Stable item identifier |"
  ].join("\n"), [
    "**field_defaults**: Required=yes | Nullable=no",
    "",
    "| Field | Type | Constraints / Meaning |",
    "|---|---|---|",
    "| count | int | Exact item count |",
    "| id | string | Stable item identifier |"
  ].join("\n"));
  refreshIdentityLine(compactChannel);

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics, []);
});

test("DM-PROFILE-005 rejects paired-full canonical representation mismatch", () => {
  const pair = alphaSameAsPair();
  const fullChannel = pair.full.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(fullChannel, undefined);
  const secondMessage = fullChannel.content.indexOf("### Message b-message");
  const before = fullChannel.content.slice(0, secondMessage);
  const after = fullChannel.content.slice(secondMessage).replace(
    "Stable item identifier",
    "Request-local item identifier"
  );
  fullChannel.content = before + after;

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
  assert.equal(result.facts.completeProfilePair, null);
});

test("DM-PROFILE-005 requires channel-file retrieval-unit metadata", () => {
  const pair = alphaSameAsPair();
  const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(compactChannel, undefined);
  delete compactChannel.metadata["x-retrieval-unit"];
  compactChannel.content = compactChannel.content.replace(
    " | x-retrieval-unit: channel-file",
    ""
  );

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
});

test("DM-PROFILE-005 rejects same_as in a full profile", () => {
  const pair = alphaSameAsPair();
  const fullChannel = pair.full.files.find((file) => file.path === "channels/alpha.md");
  assert.notEqual(fullChannel, undefined);
  fullChannel.metadata["x-retrieval-unit"] = "channel-file";
  fullChannel.content = fullChannel.content.replace(
    "source_refs: all",
    "source_refs: all | x-retrieval-unit: channel-file"
  );
  const secondMessage = fullChannel.content.indexOf("### Message b-message");
  const reply = fullChannel.content.indexOf("### Reply", secondMessage);
  const messagePrefix = fullChannel.content.slice(0, secondMessage);
  const message = fullChannel.content.slice(secondMessage, reply).replace(
    /\*\*media_type\*\*: application\/json[\s\S]*$/,
    "**same_as**: Operation a-operation Message a-message Payload application/json\n\n"
  );
  fullChannel.content = messagePrefix + message + fullChannel.content.slice(reply);
  refreshIdentityLine(fullChannel);

  const result = validateCompleteDocumentSet(pair.full, { wholeSet: false });

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
});

test("DM-PROFILE-005 rejects a raw binary target", () => {
  const pair = alphaSameAsPair();
  const structured = [
    "**media_type**: application/json",
    "**payload_nullable**: no",
    "```json",
    "{\"count\":1,\"id\":\"item_01\"}",
    "```",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| count | int | yes | no | Exact item count |",
    "| id | string | yes | no | Stable item identifier |"
  ].join("\n");
  const raw = [
    "**media_type**: application/octet-stream",
    "Carries the opaque item envelope bytes."
  ].join("\n");
  for (const profile of [pair.full, pair.compact]) {
    const channel = profile.files.find((file) => file.path === "channels/alpha.md");
    assert.notEqual(channel, undefined);
    channel.content = channel.content.replaceAll(structured, raw).replace(
      "Payload application/json",
      "Payload application/octet-stream"
    );
    refreshIdentityLine(channel);
  }

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
});

test("DM-PROFILE-005 rejects malformed, forward, and non-local targets without Core cascades", async (t) => {
  const structured = [
    "**media_type**: application/json",
    "**payload_nullable**: no",
    "```json",
    "{\"count\":1,\"id\":\"item_01\"}",
    "```",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| count | int | yes | no | Exact item count |",
    "| id | string | yes | no | Stable item identifier |"
  ].join("\n");
  const cases = [
    {
      name: "malformed marker",
      mutate(channel) {
        channel.content = channel.content.replace(
          "Operation a-operation Message a-message Payload application/json",
          "Operation a-operation Messages a-message Payload application/json"
        );
      }
    },
    {
      name: "forward target",
      mutate(channel) {
        const reference = "**same_as**: Operation a-operation Message a-message Payload application/json";
        channel.content = channel.content.replace(structured, [
          "**same_as**: Operation a-operation Message b-message Payload application/json"
        ].join("\n")).replace(reference, structured);
      }
    },
    {
      name: "target in another file",
      mutate(channel) {
        channel.content = channel.content.replace(
          "Operation a-operation Message a-message Payload application/json",
          "Operation z-operation Message z-message Payload application/json"
        );
      }
    }
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, () => {
      const pair = alphaSameAsPair();
      const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
      assert.notEqual(compactChannel, undefined);
      fixtureCase.mutate(compactChannel);
      refreshIdentityLine(compactChannel);

      const result = validateDocumentSets(pair.full, pair.compact);

      assert.deepEqual(
        [...new Set(result.diagnostics.map((entry) => entry.ruleId))],
        ["DM-PROFILE-005"]
      );
    });
  }
});

test("DM-PROFILE-005 rejects same_as outside its exact representation boundary", async (t) => {
  await t.test("outside a Message Payload", () => {
    const pair = alphaSameAsPair();
    const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
    assert.notEqual(compactChannel, undefined);
    const marker = "**same_as**: Operation a-operation Message a-message Payload application/json";
    const targetStart = compactChannel.content.indexOf("**media_type**: application/json");
    const targetEnd = compactChannel.content.indexOf("### Message b-message");
    const target = compactChannel.content.slice(targetStart, targetEnd).trimEnd();
    compactChannel.content = compactChannel.content.replace(marker, target).replace(
      "### Failure Handling\n\nnone",
      `### Failure Handling\n\n${marker}`
    );
    refreshIdentityLine(compactChannel);

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
  });

  await t.test("with adjacent representation content", () => {
    const pair = alphaSameAsPair();
    const compactChannel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
    assert.notEqual(compactChannel, undefined);
    compactChannel.content = compactChannel.content.replace(
      "Payload application/json\n\n### Reply",
      "Payload application/json\nUnexpected representation prose.\n\n### Reply"
    );
    refreshIdentityLine(compactChannel);

    const result = validateDocumentSets(pair.full, pair.compact);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
  });
});

test("DM-PROFILE-005 rejects target and reference direction-semantics mismatch", () => {
  const content = [
    "## SEND a.events (send-operation)",
    "### Message send-message",
    "#### Payload",
    "**payload_required**: yes",
    "**media_type**: application/json",
    "**payload_nullable**: no",
    "```json",
    "{\"id\":\"item_01\"}",
    "```",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| id | string | yes | no | Stable identifier |",
    "## RECEIVE b.events (receive-operation)",
    "### Message receive-message",
    "#### Payload",
    "**payload_presence**: always",
    "**same_as**: Operation send-operation Message send-message Payload application/json"
  ].join("\n");
  const result = validateCompleteSameAs({
    files: [{
      path: "channels/directions.md",
      content,
      identityLine: content.split("\n").length + 1,
      metadata: { profile: "compact", "x-retrieval-unit": "channel-file" }
    }]
  });

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
});

test("DM-PROFILE-005 applies the opposite operation direction to Reply Messages", () => {
  const content = [
    "## SEND a.events (send-operation)",
    "### Message send-message",
    "#### Payload",
    "**payload_required**: yes",
    "**media_type**: application/json",
    "**payload_nullable**: no",
    "```json",
    "{\"id\":\"item_01\"}",
    "```",
    "| Field | Type | Required | Nullable | Constraints / Meaning |",
    "|---|---|---|---|---|",
    "| id | string | yes | no | Stable identifier |",
    "### Reply",
    "#### Message reply-message",
    "##### Payload",
    "**payload_presence**: always",
    "**same_as**: Operation send-operation Message send-message Payload application/json"
  ].join("\n");
  const result = validateCompleteSameAs({
    files: [{
      path: "channels/reply-direction.md",
      content,
      identityLine: content.split("\n").length + 1,
      metadata: { profile: "compact", "x-retrieval-unit": "channel-file" }
    }]
  });

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
});

test("DM-PROFILE-005 accepts a backward Reply Message target", () => {
  const content = [
    "## SEND a.events (send-operation)",
    "### Reply",
    "#### Message a-reply",
    "##### Payload",
    "**payload_presence**: always",
    "**media_type**: application/json",
    "**payload_nullable**: no",
    "```json",
    "{\"id\":\"item_01\"}",
    "```",
    "| Field | Type | Presence | Nullable | Meaning |",
    "|---|---|---|---|---|",
    "| id | string | always | no | Stable identifier |",
    "#### Message b-reply",
    "##### Payload",
    "**payload_presence**: always",
    "**same_as**: Operation send-operation Reply Message a-reply Payload application/json"
  ].join("\n");

  const result = validateSameAsContent(content, "channels/replies.md");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.facts.sameAs[0].reference.reply, true);
  assert.equal(result.facts.sameAs[0].target.reply, true);
});

test("DM-PROFILE-005 rejects incomplete, recursive, and failure-shape targets", async (t) => {
  await t.test("representation-local field unknown", () => {
    const content = [
      "## SEND a.events (send-operation)",
      "### Message a-message",
      "#### Payload",
      "**payload_required**: yes",
      "**media_type**: application/json",
      "**payload_nullable**: no",
      "unknown",
      "**unknown**: payload field collection requires source schema",
      "### Message b-message",
      "#### Payload",
      "**payload_required**: yes",
      "**same_as**: Operation send-operation Message a-message Payload application/json"
    ].join("\n");

    const result = validateSameAsContent(content);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
  });

  await t.test("collection-level unknown", () => {
    const content = [
      "## SEND a.events (send-operation)",
      "### Message a-message",
      "#### Payload",
      "**payload_required**: yes",
      "**media_type**: application/json",
      "**payload_nullable**: no",
      "| Field | Type | Required | Nullable | Constraints / Meaning |",
      "|---|---|---|---|---|",
      "| id | string | yes | no | Stable identifier |",
      "**unknown**: additional unnamed field requires source schema",
      "### Message b-message",
      "#### Payload",
      "**payload_required**: yes",
      "**same_as**: Operation send-operation Message a-message Payload application/json"
    ].join("\n");

    const result = validateSameAsContent(content);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
  });

  await t.test("same_as target", () => {
    const content = [
      "## SEND a.events (send-operation)",
      "### Message a-message",
      "#### Payload",
      "**payload_required**: yes",
      "**media_type**: application/json",
      "**payload_nullable**: no",
      "```json",
      "{\"id\":\"item_01\"}",
      "```",
      "| Field | Type | Required | Nullable | Constraints / Meaning |",
      "|---|---|---|---|---|",
      "| id | string | yes | no | Stable identifier |",
      "### Message b-message",
      "#### Payload",
      "**payload_required**: yes",
      "**same_as**: Operation send-operation Message a-message Payload application/json",
      "### Message c-message",
      "#### Payload",
      "**payload_required**: yes",
      "**same_as**: Operation send-operation Message b-message Payload application/json"
    ].join("\n");

    const result = validateSameAsContent(content);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
  });

  await t.test("failure-signal message shape", () => {
    const content = [
      "## SEND a.events (send-operation)",
      "### Message a-message",
      "#### Payload",
      "**payload_required**: yes",
      "**media_type**: application/json",
      "**payload_nullable**: no",
      "```json",
      "{\"id\":\"item_01\"}",
      "```",
      "| Field | Type | Required | Nullable | Constraints / Meaning |",
      "|---|---|---|---|---|",
      "| id | string | yes | no | Stable identifier |",
      "### Failure Handling",
      "**message_shape**: failure-code",
      "#### Payload",
      "**payload_presence**: always",
      "**same_as**: Operation send-operation Message a-message Payload application/json"
    ].join("\n");

    const result = validateSameAsContent(content);

    assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-005"]);
  });
});

test("DM-PROFILE-003 compares normalized standard structures in source order", async (t) => {
  const cases = [
    {
      name: "fixed-key marker value",
      mutate(pair) {
        const channel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
        channel.content = channel.content.replace(
          "- side_effects: none",
          "- side_effects: publishes the selected event"
        );
      }
    },
    {
      name: "logical table cell",
      mutate(pair) {
        const root = pair.compact.files.find((file) => file.path === "INDEX.md");
        root.content = root.content.replace(
          "| source-a | pass-through | none | none | none | source.md | none |",
          "| source-a | pass-through | none | none | none | source.md | revision-a |"
        );
      }
    },
    {
      name: "added standard prose",
      mutate(pair) {
        const channel = pair.compact.files.find((file) => file.path === "channels/alpha.md");
        channel.content = channel.content.replace(
          "### Related\n\nnone",
          "### Related\n\nnone\n\nSee the additional operation guide."
        );
        channel.identityLine += 2;
      }
    },
    {
      name: "standard prose ordering",
      mutate(pair) {
        for (const profile of [pair.full, pair.compact]) {
          const channel = profile.files.find((file) => file.path === "channels/alpha.md");
          channel.content = channel.content.replace(
            "### Related\n\nnone",
            profile === pair.full
              ? "### Related\n\nRead the alpha guide.\nRead the beta guide."
              : "### Related\n\nRead the beta guide.\nRead the alpha guide."
          );
          channel.identityLine += 1;
        }
      }
    },
    {
      name: "workflow display heading",
      mutate(pair) {
        for (const [profile, title] of [
          [pair.full, "Order flow"],
          [pair.compact, "Order handling"]
        ]) {
          const root = profile.files.find((file) => file.path === "INDEX.md");
          root.content = root.content.replace("## Workflows\n\nnone", [
            "## Workflows",
            "",
            "| Name | Summary | Details |",
            "|---|---|---|",
            "| Order flow | Coordinate order handling | workflows/order-flow.md |"
          ].join("\n"));
          refreshIdentityLine(root);
          addDocument(profile, "workflows/order-flow.md", [
            `# ${title}`,
            "",
            "Order flow coordinates the selected messaging operations.",
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
          ].join("\n"));
        }
      }
    }
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, () => {
      const pair = loadPair(validPairPath);
      fixtureCase.mutate(pair);

      const result = validateDocumentSets(pair.full, pair.compact);

      assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-003"]);
      assert.equal(result.facts.completeProfilePair, null);
    });
  }
});

test("DM-PROFILE-003 compares parsed table cells instead of Markdown spacing", () => {
  const pair = loadPair(validPairPath);
  const root = pair.compact.files.find((file) => file.path === "INDEX.md");
  assert.notEqual(root, undefined);
  root.content = root.content.replace(
    "| ID | Kind | Specification | API | Contract version | Location | Revision |\n|---|---|---|---|---|---|---|",
    "  |ID| Kind |Specification| API |Contract version| Location |Revision|  \n  |---|---|---|---|---|---|---|  "
  );

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics, []);
});

test("DM-PROFILE-003 preserves non-example fenced content exactly", () => {
  const pair = loadPair(validPairPath);
  for (const [profile, contentLine] of [
    [pair.full, "Supplemental order guidance.  "],
    [pair.compact, "Supplemental order guidance."]
  ]) {
    const operationIndex = profile.files.find((file) => (
      file.path === "indexes/operations-broad.md"
    ));
    assert.notEqual(operationIndex, undefined);
    operationIndex.content = operationIndex.content.replace(
      "| SEND | a.events | a-operation | a-message | alpha task | Handles the alpha event range | none | none |",
      "| SEND | a.events | a-operation | a-message | alpha task | Handles the alpha event range | none | references/guide.md |"
    );
    addDocument(profile, "references/guide.md", [
      "# Reference Material",
      "",
      "**instruction_authority**: none",
      "",
      "## Content",
      "",
      "````text",
      contentLine,
      "````"
    ].join("\n"));
  }

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-003"]);
  assert.equal(result.diagnostics[0].file, "compact/references/guide.md");
});

test("DM-PROFILE-003 excludes profile-link syntax only from the root INDEX", () => {
  const pair = loadPair(validPairPath);
  for (const [profile, content] of [
    [pair.full, "Full set: full-profile navigation text"],
    [pair.compact, "Compact set: compact-profile navigation text"]
  ]) {
    const channel = profile.files.find((file) => file.path === "channels/alpha.md");
    assert.notEqual(channel, undefined);
    channel.content = channel.content.replace("### Related\n\nnone", `### Related\n\n${content}`);
  }

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.deepEqual(result.diagnostics.map((entry) => entry.ruleId), ["DM-PROFILE-003"]);
});

test("DM-PROFILE-001 and DM-PROFILE-002 defer pair diagnostics after constituent failure", () => {
  const pair = loadPair(validPairPath);
  const root = pair.compact.files.find((file) => file.path === "INDEX.md");
  root.content = root.content.replace("# Messaging Index", "# Invalid Messaging Index");

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.equal(result.diagnostics.some((entry) => entry.ruleId === "DM-IDX-001"), true);
  assert.equal(result.diagnostics.some((entry) => entry.ruleId.startsWith("DM-PROFILE-")), false);
  assert.equal(result.facts.completeProfilePair, null);
});

test("DM-PROFILE-001 through DM-PROFILE-005 maintain complete-scope rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const profileRules = catalog.rules.filter((entry) => entry.rule_id.startsWith("DM-PROFILE-"));

  assert.deepEqual(
    profileRules.map((entry) => entry.rule_id),
    [
      "DM-PROFILE-001",
      "DM-PROFILE-002",
      "DM-PROFILE-003",
      "DM-PROFILE-004",
      "DM-PROFILE-005"
    ]
  );
  assert.deepEqual(
    profileRules.map((entry) => entry.scope),
    ["complete", "complete", "complete", "complete", "complete"]
  );
  assert.deepEqual(auditRuleTestCorrespondence({
    catalogRuleIds: profileRules.map((entry) => entry.rule_id),
    testNames: profileRuleTestNames,
    rulePrefixes: ["DM-PROFILE"]
  }), { passed: true, errors: [] });
});
