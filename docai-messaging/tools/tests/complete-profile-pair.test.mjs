import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodeTest from "node:test";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { auditRuleTestCorrespondence } from "../lib/fixture-runner.mjs";
import { deriveShortId } from "../lib/identity.mjs";

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

test("DM-PROFILE-001 and DM-PROFILE-002 defer pair diagnostics after constituent failure", () => {
  const pair = loadPair(validPairPath);
  const root = pair.compact.files.find((file) => file.path === "INDEX.md");
  root.content = root.content.replace("# Messaging Index", "# Invalid Messaging Index");

  const result = validateDocumentSets(pair.full, pair.compact);

  assert.equal(result.diagnostics.some((entry) => entry.ruleId === "DM-IDX-001"), true);
  assert.equal(result.diagnostics.some((entry) => entry.ruleId.startsWith("DM-PROFILE-")), false);
  assert.equal(result.facts.completeProfilePair, null);
});

test("DM-PROFILE-001 and DM-PROFILE-002 maintain complete-scope rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const profileRules = catalog.rules.filter((entry) => (
    entry.rule_id === "DM-PROFILE-001" || entry.rule_id === "DM-PROFILE-002"
  ));

  assert.deepEqual(
    profileRules.map((entry) => entry.rule_id),
    ["DM-PROFILE-001", "DM-PROFILE-002"]
  );
  assert.deepEqual(profileRules.map((entry) => entry.scope), ["complete", "complete"]);
  assert.deepEqual(auditRuleTestCorrespondence({
    catalogRuleIds: profileRules.map((entry) => entry.rule_id),
    testNames: profileRuleTestNames,
    rulePrefixes: ["DM-PROFILE"]
  }), { passed: true, errors: [] });
});
