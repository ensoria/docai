import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDocumentSet,
  validateDocumentSet,
  validateOperationProfilePair
} from "../lib/document-set.mjs";
import { runFixtureCorpus } from "../lib/fixture-runner.mjs";
import { parseOpeningMetadata } from "../lib/metadata.mjs";
import { validateSentenceLine } from "../lib/sentence.mjs";
import * as coreValidator from "../lib/validators/core.mjs";
import * as coreRouting from "../lib/validators/core-routing.mjs";

const corpusPath = fileURLToPath(new URL("../../fixtures/core/v0.17.1/", import.meta.url));

const metadataAndSentenceCaseIds = [
  "metadata-canonical-extensions-and-escapes",
  "metadata-coverage-invalid",
  "metadata-duplicate-extension-key",
  "metadata-duplicate-standard-key",
  "metadata-extension-disallowed-punctuation",
  "metadata-extension-empty-suffix",
  "metadata-extension-uppercase",
  "metadata-format-version-invalid",
  "metadata-knowledge-invalid",
  "metadata-missing-standard-key",
  "metadata-perspective-empty",
  "metadata-perspective-leading-space",
  "metadata-perspective-trailing-space",
  "metadata-profile-invalid",
  "metadata-standard-key-order-invalid",
  "metadata-trailing-backslash",
  "metadata-unknown-escape",
  "metadata-unknown-non-extension-key",
  "sentence-adjacent-japanese-valid",
  "sentence-literal-inline-terminator-valid",
  "sentence-three-terminators-invalid",
  "sentence-two-lines-invalid",
  "sentence-unterminated-invalid"
];

const identityCaseIds = [
  "identity-closed-root-extra-file",
  "identity-format-version-mixed",
  "identity-perspective-mixed",
  "identity-profile-mixed",
  "identity-projection-id-mixed",
  "identity-projection-short-id-invalid",
  "identity-set-id-mixed",
  "identity-set-short-id-invalid",
  "identity-task-scoped-stale-digest",
  "identity-task-scoped-stale-digest-whole-set-invalid",
  "identity-trailer-malformed-projection-digest",
  "identity-trailer-missing",
  "identity-whole-set-valid"
];

const sourceCaseIds = [
  "sources-direct-columns-invalid",
  "sources-direct-duplicate-id-invalid",
  "sources-direct-known-revision-none-valid",
  "sources-direct-unknown-api-valid",
  "sources-revision-sha-invalid",
  "sources-shard-bounds-invalid",
  "sources-sharded-cycle-valid",
  "sources-sharded-duplicate-row-invalid",
  "sources-sharded-missing-row-invalid",
  "sources-sharded-overlap-valid",
  "sources-source-refs-missing-invalid",
  "sources-unknown-conventions-repeat-missing-invalid",
  "sources-unknown-marker-missing-invalid"
];

const operationCaseIds = [
  "operations-flat-routing-valid",
  "operations-flat-table-invalid",
  "operations-hierarchical-bounds-invalid",
  "operations-hierarchical-overlap-valid",
  "operations-profile-path-parity-invalid",
  "operations-profile-path-parity-valid",
  "operations-row-action-invalid"
];

const contextCaseIds = [
  "contexts-duplicate-path-invalid",
  "contexts-none-path-valid",
  "contexts-order-invalid",
  "contexts-overlap-invalid",
  "contexts-required-reference-invalid",
  "contexts-required-supplemental-valid",
  "contexts-separator-invalid",
  "contexts-supplemental-channel-invalid"
];

const unprojectedCaseIds = [
  "unprojected-direct-byte-length-invalid",
  "unprojected-direct-multibyte-sensitive-valid",
  "unprojected-sharded-group-split-invalid",
  "unprojected-sharded-retrieval-valid",
  "unprojected-source-collision-invalid",
  "unprojected-source-sensitive-valid"
];

const perspectiveCaseIds = [
  "perspective-action-only-fallback-valid",
  "perspective-counterpart-complete-valid",
  "perspective-counterpart-conflict-invalid",
  "perspective-counterpart-missing-valid",
  "perspective-same-application-valid"
];

const operationMessageSelectionCaseIds = [
  "asyncapi-3.0.0-operation-message-selection-valid",
  "asyncapi-3.0.0-operation-message-zero-invalid",
  "asyncapi-3.1.0-operation-message-selection-valid",
  "asyncapi-3.1.0-operation-message-zero-invalid"
];

const replyMessageSelectionCaseIds = [
  "asyncapi-3.0.0-reply-message-selection-valid",
  "asyncapi-3.0.0-reply-message-index-invalid",
  "asyncapi-3.1.0-reply-message-selection-valid",
  "asyncapi-3.1.0-reply-message-index-invalid"
];

const conventionsAndFailureCaseIds = [
  "common-failure-shape-replacement-mismatch-invalid",
  "conventions-format-catalog-duplicate-invalid",
  "conventions-state-mixed-invalid",
  "conventions-states-format-failures-valid",
  "failure-shape-replacement-mismatch-invalid"
];

const behaviorCaseIds = [
  "behavior-delivery-token-invalid",
  "behavior-exactly-once-unqualified-invalid",
  "behavior-key-order-invalid",
  "behavior-six-keys-delivery-unknown-valid",
  "behavior-unknown-marker-missing-invalid"
];

const bindingScopeCaseIds = [
  "binding-channel-table-invalid",
  "binding-failure-table-invalid",
  "binding-message-table-invalid",
  "binding-operation-table-invalid",
  "binding-reply-channel-table-invalid",
  "binding-reply-message-table-invalid",
  "binding-scopes-valid"
];

const messageDirectionCaseIds = [
  "message-direction-nullable-invalid",
  "message-direction-receive-bare-conditional-invalid",
  "message-direction-receive-required-columns-invalid",
  "message-direction-send-conditional-meaning-invalid",
  "message-direction-send-presence-columns-invalid",
  "message-direction-unknown-marker-missing-invalid",
  "message-direction-values-and-nested-ancestors-valid"
];

function fixtureSource(fixturePath) {
  const source = fs.readFileSync(fixturePath, "utf8");
  return source.endsWith("\n") ? source.slice(0, -1) : source;
}

function validateCase(fixturePath, fixtureCase) {
  if (fixtureCase.kind === "document-set") {
    return validateDocumentSet(loadDocumentSet(fixturePath), { wholeSet: true });
  }
  if (fixtureCase.kind === "task-scoped-document-set") {
    return validateDocumentSet(loadDocumentSet(fixturePath), { wholeSet: false });
  }
  if (fixtureCase.kind === "operation-profile-pair") {
    return validateOperationProfilePair(
      loadDocumentSet(path.join(fixturePath, "full")),
      loadDocumentSet(path.join(fixturePath, "compact"))
    );
  }
  if (fixtureCase.kind === "unprojected-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreRouting.validateUnprojectedSourceExpectations(
      scenario.cases,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "perspective-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validatePerspectiveSourceExpectations(
      scenario.cases,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "asyncapi-operation-message-selection") {
    const source = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validateAsyncApiOperationMessageSelection(
      source,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "asyncapi-reply-message-selection") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validateAsyncApiReplyMessageSelection(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "metadata-line") {
    return parseOpeningMetadata({
      text: fixtureSource(fixturePath),
      file: fixtureCase.path,
      line: 1
    });
  }
  if (fixtureCase.kind === "sentence-line") {
    return validateSentenceLine({
      text: fixtureSource(fixturePath),
      file: fixtureCase.path,
      line: 1
    }, 1, 2);
  }
  throw new Error(`Unsupported focused fixture kind: ${fixtureCase.kind}`);
}

test("executes the Task 9 metadata and sentence focused corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    metadataAndSentenceCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of metadataAndSentenceCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);
});

test("executes the Task 9 identity focused corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    identityCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of identityCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);
});

test("executes the Task 9 Sources focused corpus and fixes retrieval facts", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    sourceCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of sourceCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const directCase = byId.get("sources-direct-known-revision-none-valid");
  const direct = validateCase(path.join(corpusPath, directCase.path), directCase);
  assert.equal(direct.facts.core.sources.form, "direct");
  assert.deepEqual(direct.facts.core.sources.rows.map((row) => row.id), ["api-a", "notes-z"]);
  assert.deepEqual(direct.facts.core.sourceResolutions["CONVENTIONS.md"], {
    requestedIds: ["api-a"],
    resolvedIds: ["api-a"],
    loadedPaths: ["INDEX.md"]
  });

  const cycleCase = byId.get("sources-sharded-cycle-valid");
  const cycle = validateCase(path.join(corpusPath, cycleCase.path), cycleCase);
  assert.equal(cycle.facts.core.sources.form, "sharded");
  assert.deepEqual(cycle.facts.core.sourceResolutions["CONVENTIONS.md"], {
    requestedIds: ["a"],
    resolvedIds: ["a", "z"],
    loadedPaths: ["indexes/sources-a.md", "indexes/sources-z.md"]
  });
  assert.deepEqual(cycle.facts.core.sourceResolutions["INDEX.md"].loadedPaths, [
    "indexes/sources-a.md",
    "indexes/sources-z.md"
  ]);

  const overlapCase = byId.get("sources-sharded-overlap-valid");
  const overlap = validateCase(path.join(corpusPath, overlapCase.path), overlapCase);
  assert.deepEqual(overlap.facts.core.sourceResolutions["CONVENTIONS.md"], {
    requestedIds: ["b"],
    resolvedIds: ["a", "b", "c"],
    loadedPaths: ["indexes/sources-a-c.md", "indexes/sources-b.md"]
  });
});

test("executes the Task 9 Operations focused corpus and fixes retrieval facts", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    operationCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of operationCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const flatCase = byId.get("operations-flat-routing-valid");
  const flat = validateCase(path.join(corpusPath, flatCase.path), flatCase);
  assert.equal(flat.facts.core.operations.form, "flat");
  assert.deepEqual(flat.facts.core.operationRetrieval.exact.operation["create-order"], {
    selector: { operation: "create-order" },
    loadedIndexPaths: ["INDEX.md"],
    falsePositiveIndexPaths: [],
    matchedOperationNames: ["create-order"],
    loadedChannelPaths: ["channels/orders.md"],
    requiredContextPaths: [],
    supplementalContextPaths: [],
    sourceIds: ["source-a"],
    loadedSourceIndexPaths: ["INDEX.md"]
  });

  const hierarchicalCase = byId.get("operations-hierarchical-overlap-valid");
  const hierarchical = validateCase(
    path.join(corpusPath, hierarchicalCase.path),
    hierarchicalCase
  );
  assert.equal(hierarchical.facts.core.operations.form, "sharded");
  assert.deepEqual(
    hierarchical.facts.core.operationRetrieval.exact.operation["m-operation"],
    {
      selector: { operation: "m-operation" },
      loadedIndexPaths: ["indexes/operations-broad.md", "indexes/operations-middle.md"],
      falsePositiveIndexPaths: ["indexes/operations-broad.md"],
      matchedOperationNames: ["m-operation"],
      loadedChannelPaths: ["channels/middle.md"],
      requiredContextPaths: [],
      supplementalContextPaths: [],
      sourceIds: ["source-a"],
      loadedSourceIndexPaths: ["INDEX.md"]
    }
  );
  assert.deepEqual(
    hierarchical.facts.core.operationRetrieval.semanticFallback.loadedIndexPaths,
    ["indexes/operations-broad.md", "indexes/operations-middle.md"]
  );
  assert.deepEqual(
    hierarchical.facts.core.operationRetrieval.semanticFallback.matchedOperationNames,
    ["a-operation", "m-operation", "z-operation"]
  );

  const pairCase = byId.get("operations-profile-path-parity-valid");
  const pair = validateCase(path.join(corpusPath, pairCase.path), pairCase);
  assert.deepEqual(pair.facts.operationProfilePair, {
    full: {
      form: "sharded",
      shardPaths: ["indexes/operations-broad.md", "indexes/operations-middle.md"]
    },
    compact: {
      form: "sharded",
      shardPaths: ["indexes/operations-broad.md", "indexes/operations-middle.md"]
    }
  });

  const invalidPairCase = byId.get("operations-profile-path-parity-invalid");
  const invalidPairPath = path.join(corpusPath, invalidPairCase.path);
  const invalidFullPaths = loadDocumentSet(path.join(invalidPairPath, "full")).paths;
  const invalidCompactPaths = loadDocumentSet(path.join(invalidPairPath, "compact")).paths;
  assert.deepEqual(
    invalidFullPaths.filter((candidate) => !invalidCompactPaths.includes(candidate)),
    ["indexes/operations-broad.md"]
  );
  assert.deepEqual(
    invalidCompactPaths.filter((candidate) => !invalidFullPaths.includes(candidate)),
    []
  );
});

test("executes the Task 9 context focused corpus and fixes selected context paths", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    contextCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of contextCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const combinedCase = byId.get("contexts-required-supplemental-valid");
  const combined = validateCase(path.join(corpusPath, combinedCase.path), combinedCase);
  const combinedTrace = combined.facts.core.operationRetrieval.exact.operation["create-order"];
  assert.deepEqual(combinedTrace.requiredContextPaths, [
    "workflows/a-required.md",
    "workflows/none.md"
  ]);
  assert.deepEqual(combinedTrace.supplementalContextPaths, [
    "references/guide.md",
    "workflows/z-supplemental.md"
  ]);

  const nonePathCase = byId.get("contexts-none-path-valid");
  const nonePath = validateCase(path.join(corpusPath, nonePathCase.path), nonePathCase);
  const nonePathTrace = nonePath.facts.core.operationRetrieval.exact.operation["create-order"];
  assert.deepEqual(nonePathTrace.requiredContextPaths, ["workflows/none.md"]);
  assert.deepEqual(nonePathTrace.supplementalContextPaths, []);
});

test("executes the Task 9 Unprojected Operations corpus and fixes audit retrieval", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    unprojectedCaseIds.filter((id) => !byId.has(id)),
    []
  );
  assert.equal(typeof coreRouting.validateUnprojectedSourceExpectations, "function");
  for (const id of unprojectedCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const directCase = byId.get("unprojected-direct-multibyte-sensitive-valid");
  const direct = validateCase(path.join(corpusPath, directCase.path), directCase);
  assert.equal(direct.facts.core.unprojectedOperations.form, "direct");
  assert.deepEqual(
    direct.facts.core.unprojectedOperations.groups.map((group) => ({
      sourceId: group.sourceId,
      identity: group.identity,
      dimensions: group.dimensions
    })),
    [
      { sourceId: "source-a", identity: "legacy: route", dimensions: ["unsupported", "unknown"] },
      { sourceId: "source-z", identity: "操作: 二", dimensions: ["unknown"] }
    ]
  );
  const sensitiveMarker = direct.facts.core.unprojectedOperations.groups[0].markers[0];
  assert.equal(
    sensitiveMarker.reason,
    "sensitive routing-critical value withheld at source-a.json#/operations/0"
  );
  assert.equal(sensitiveMarker.reason.includes("tenant-secret-route"), false);

  const shardedCase = byId.get("unprojected-sharded-retrieval-valid");
  const sharded = validateCase(path.join(corpusPath, shardedCase.path), shardedCase);
  assert.equal(sharded.facts.core.unprojectedOperations.form, "sharded");
  assert.deepEqual(sharded.facts.core.unprojectedRetrieval.exactBySourceId["source-a"], {
    selector: { sourceId: "source-a" },
    loadedIndexPaths: ["indexes/unprojected-a-z.md", "indexes/unprojected-a.md"],
    matchedGroupingKeys: [
      "source-a\u0000legacy-a",
      "source-a\u0000legacy-a-2",
      "source-z\u0000legacy-z"
    ]
  });
  assert.deepEqual(
    sharded.facts.core.unprojectedRetrieval.semanticFallback.loadedIndexPaths,
    ["indexes/unprojected-a-z.md", "indexes/unprojected-a.md"]
  );

  const sensitiveCase = byId.get("unprojected-source-sensitive-valid");
  const sensitive = validateCase(path.join(corpusPath, sensitiveCase.path), sensitiveCase);
  assert.deepEqual(sensitive.facts.unprojectedSourceExpectations, [{
    sourceOperationId: "operation-sensitive",
    expectation: "emit-unsupported",
    reason: "sensitive routing-critical value withheld at source.json#/operations/3",
    prohibitedValues: ["tenant-secret-route"]
  }]);
  assert.equal(
    sensitive.facts.unprojectedSourceExpectations[0].reason.includes("tenant-secret-route"),
    false
  );

  const collisionCase = byId.get("unprojected-source-collision-invalid");
  const collision = validateCase(path.join(corpusPath, collisionCase.path), collisionCase);
  const collisionErrors = collision.diagnostics.filter((entry) => entry.severity === "error");
  assert.equal(collisionErrors.length, 1);
  assert.equal(collisionErrors[0].ruleId, "DM-IDX-008");
  assert.equal(collisionErrors[0].message.includes("safe-operation"), false);
  assert.deepEqual(
    collision.facts.unprojectedSourceExpectations.map((entry) => ({
      sourceOperationId: entry.sourceOperationId,
      expectation: entry.expectation,
      reason: entry.reason
    })),
    [
      {
        sourceOperationId: "operation-1",
        expectation: "generation-failure",
        reason: "grouping-key-collision"
      },
      {
        sourceOperationId: "operation-2",
        expectation: "generation-failure",
        reason: "grouping-key-collision"
      }
    ]
  );
});

test("executes the Task 9 DM-INC-001 DM-INC-006 DM-INC-007 perspective corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    perspectiveCaseIds.filter((id) => !byId.has(id)),
    []
  );
  assert.equal(typeof coreValidator.validatePerspectiveSourceExpectations, "function");
  for (const id of perspectiveCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const sameCase = byId.get("perspective-same-application-valid");
  const same = validateCase(path.join(corpusPath, sameCase.path), sameCase);
  assert.deepEqual(same.facts.perspectiveSourceExpectations, [
    {
      caseId: "same-application-send",
      outcome: "emit-operation",
      resolution: "source-application-carry-through",
      action: "SEND",
      channel: "orders.commands",
      primaryMessages: ["create-order"]
    },
    {
      caseId: "same-application-receive",
      outcome: "emit-operation",
      resolution: "source-application-carry-through",
      action: "RECEIVE",
      channel: "orders.events",
      primaryMessages: ["order-created"]
    }
  ]);

  const completeCase = byId.get("perspective-counterpart-complete-valid");
  const complete = validateCase(path.join(corpusPath, completeCase.path), completeCase);
  assert.deepEqual(complete.facts.perspectiveSourceExpectations, [{
    caseId: "complete-counterpart",
    outcome: "emit-operation",
    resolution: "authoritative-counterpart",
    action: "SEND",
    channel: "storefront.orders",
    primaryMessages: ["create-order"],
    replyMessages: ["order-accepted"],
    contributingSourceIds: ["storefront-mapping"]
  }]);

  const missingCase = byId.get("perspective-counterpart-missing-valid");
  const missing = validateCase(path.join(corpusPath, missingCase.path), missingCase);
  assert.deepEqual(missing.facts.perspectiveSourceExpectations, [{
    caseId: "missing-counterpart",
    outcome: "emit-unprojected-unknown",
    reason: "counterpart mapping",
    knowledge: "requires-input"
  }]);

  const actionOnlyCase = byId.get("perspective-action-only-fallback-valid");
  const actionOnly = validateCase(path.join(corpusPath, actionOnlyCase.path), actionOnlyCase);
  assert.deepEqual(actionOnly.facts.perspectiveSourceExpectations, [{
    caseId: "action-only-counterpart",
    outcome: "emit-unprojected-unknown",
    reason: "incomplete counterpart mapping",
    missing: [
      "channel-address",
      "server-environment-and-bindings",
      "authorization",
      "purpose-and-behavior",
      "message-applicability"
    ],
    knowledge: "requires-input"
  }]);

  const conflictCase = byId.get("perspective-counterpart-conflict-invalid");
  const conflict = validateCase(path.join(corpusPath, conflictCase.path), conflictCase);
  const conflictErrors = conflict.diagnostics.filter((entry) => entry.severity === "error");
  assert.equal(conflictErrors.length, 1);
  assert.equal(conflictErrors[0].ruleId, "DM-INC-001");
  assert.equal(conflictErrors[0].message.includes("mapping-a"), false);
  assert.deepEqual(conflict.facts.perspectiveSourceExpectations, [{
    caseId: "conflicting-counterparts",
    outcome: "generation-failure",
    reason: "authoritative-conflict",
    conflictingSourceIds: ["mapping-a", "mapping-b"]
  }]);
});

test("executes the Task 9 DM-IDX-008 exact-version operation message-selection corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    operationMessageSelectionCaseIds.filter((id) => !byId.has(id)),
    []
  );
  assert.equal(typeof coreValidator.validateAsyncApiOperationMessageSelection, "function");
  for (const id of operationMessageSelectionCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  for (const version of ["3.0.0", "3.1.0"]) {
    const validCase = byId.get(`asyncapi-${version}-operation-message-selection-valid`);
    const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
    assert.deepEqual(valid.diagnostics, []);
    assert.deepEqual(valid.facts.asyncApiOperationMessageSelection, {
      sourceSpecification: `AsyncAPI ${version}`,
      operations: [
        {
          operationId: "operationMessagesExplicit",
          outcome: "emit-operation",
          resolution: "explicit-non-empty",
          channelId: "operationSelection",
          primaryMessages: ["commandAlpha"]
        },
        {
          operationId: "operationMessagesOmitted",
          outcome: "emit-operation",
          resolution: "omitted-all-channel-messages",
          channelId: "operationSelection",
          primaryMessages: ["commandAlpha", "commandBeta"]
        }
      ]
    });

    const invalidCase = byId.get(`asyncapi-${version}-operation-message-zero-invalid`);
    const invalid = validateCase(path.join(corpusPath, invalidCase.path), invalidCase);
    const errors = invalid.diagnostics.filter((entry) => entry.severity === "error");
    assert.equal(errors.length, 1);
    assert.equal(errors[0].ruleId, "DM-IDX-008");
    assert.deepEqual(invalid.facts.asyncApiOperationMessageSelection, {
      sourceSpecification: `AsyncAPI ${version}`,
      operations: [
        {
          operationId: "operationMessagesEmpty",
          outcome: "emit-unprojected-unsupported",
          reason: "zero-message operation",
          selection: "explicit-empty",
          channelId: "operationSelection",
          primaryMessages: []
        },
        {
          operationId: "operationMessagesOmittedEmptyChannel",
          outcome: "emit-unprojected-unsupported",
          reason: "zero-message operation",
          selection: "omitted-empty-channel",
          channelId: "emptySelection",
          primaryMessages: []
        }
      ]
    });
  }
});

test("executes the Task 9 DM-REPLY-003 exact-version reply selection and INDEX omission corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    replyMessageSelectionCaseIds.filter((id) => !byId.has(id)),
    []
  );
  assert.equal(typeof coreValidator.validateAsyncApiReplyMessageSelection, "function");
  for (const id of replyMessageSelectionCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  for (const version of ["3.0.0", "3.1.0"]) {
    const validCase = byId.get(`asyncapi-${version}-reply-message-selection-valid`);
    const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
    assert.deepEqual(valid.diagnostics, []);
    assert.deepEqual(valid.facts.asyncApiReplyMessageSelection, {
      sourceSpecification: `AsyncAPI ${version}`,
      operations: [
        {
          operationId: "replyMessagesEmpty",
          outcome: "emit-whole-reply-unsupported",
          reason: "zero-message reply",
          selection: "explicit-empty",
          channelId: "replySelection",
          replyMessages: [],
          indexReplyEntries: [],
          primaryOperationRetained: true
        },
        {
          operationId: "replyMessagesExplicit",
          outcome: "emit-expanded-reply",
          resolution: "explicit-non-empty",
          channelId: "replySelection",
          replyMessages: ["replyAccepted"],
          indexReplyEntries: ["reply:replyAccepted"],
          primaryOperationRetained: true
        },
        {
          operationId: "replyMessagesOmitted",
          outcome: "emit-whole-reply-unknown",
          reason: "reply message set",
          selection: "omitted",
          channelId: "replySelection",
          candidateMessages: ["replyAccepted", "replyRejected"],
          replyMessages: [],
          indexReplyEntries: [],
          primaryOperationRetained: true
        },
        {
          operationId: "replyMessagesOmittedEmptyChannel",
          outcome: "emit-whole-reply-unknown",
          reason: "reply message set",
          selection: "omitted",
          channelId: "replyEmpty",
          candidateMessages: [],
          replyMessages: [],
          indexReplyEntries: [],
          primaryOperationRetained: true
        },
        {
          operationId: "replyMessagesOmittedNoChannel",
          outcome: "emit-whole-reply-unknown",
          reason: "reply message set",
          selection: "omitted",
          channelId: null,
          candidateMessages: [],
          replyMessages: [],
          indexReplyEntries: [],
          primaryOperationRetained: true
        },
        {
          operationId: "replyMessagesOmittedSingle",
          outcome: "emit-whole-reply-unknown",
          reason: "reply message set",
          selection: "omitted",
          channelId: "replySingle",
          candidateMessages: ["replyAccepted"],
          replyMessages: [],
          indexReplyEntries: [],
          primaryOperationRetained: true
        }
      ],
      indexRoutingMismatches: []
    });

    const invalidCase = byId.get(`asyncapi-${version}-reply-message-index-invalid`);
    const invalid = validateCase(path.join(corpusPath, invalidCase.path), invalidCase);
    const errors = invalid.diagnostics.filter((entry) => entry.severity === "error");
    assert.equal(errors.length, 1);
    assert.equal(errors[0].ruleId, "DM-REPLY-003");
    assert.deepEqual(invalid.facts.asyncApiReplyMessageSelection.indexRoutingMismatches, [
      {
        operationId: "replyMessagesEmpty",
        expected: [],
        actual: ["reply:inventedReply"]
      },
      {
        operationId: "replyMessagesExplicit",
        expected: ["reply:replyAccepted"],
        actual: []
      },
      {
        operationId: "replyMessagesOmitted",
        expected: [],
        actual: ["reply:replyAccepted", "reply:replyRejected"]
      },
      {
        operationId: "replyMessagesOmittedEmptyChannel",
        expected: [],
        actual: ["reply:inventedReply"]
      },
      {
        operationId: "replyMessagesOmittedNoChannel",
        expected: [],
        actual: ["reply:inventedReply"]
      },
      {
        operationId: "replyMessagesOmittedSingle",
        expected: [],
        actual: ["reply:replyAccepted"]
      }
    ]);
    assert.equal(
      invalid.facts.asyncApiReplyMessageSelection.operations.every((entry) => (
        entry.primaryOperationRetained === true
      )),
      true
    );
  }
});

test("executes the Task 9 DM-CONV-002 DM-CONV-003 DM-CONV-004 and DM-FAIL-003 corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    conventionsAndFailureCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of conventionsAndFailureCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("conventions-states-format-failures-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.equal(valid.facts.core.conventions.sections.Environments.state, "none");
  assert.equal(valid.facts.core.conventions.sections["Protocols and Bindings"].state, "unknown");
  assert.equal(valid.facts.core.conventions.sections.Authentication.state, "unsupported");
  assert.equal(valid.facts.core.conventions.sections["Connection and Session"].state, "expanded");
  assert.deepEqual(valid.facts.core.formats, [{
    format: "\"uuid\"",
    role: "constraint",
    meaning: "Accept canonical UUID strings and construct and validate them without narrowing."
  }]);
  assert.deepEqual(
    valid.facts.core.failureShapes.common.map((shape) => ({
      label: shape.label,
      replacement: shape.replacement
    })),
    [
      { label: "dead-letter", replacement: false },
      { label: "encoded-common", replacement: true }
    ]
  );
  assert.deepEqual(valid.facts.core.failureShapes.commonReferences, [{
    label: "dead-letter",
    operation: "create-order"
  }]);
  assert.deepEqual(
    valid.facts.core.failureShapes.inline.map((shape) => ({
      label: shape.label,
      replacement: shape.replacement
    })),
    [{ label: "encoded-inline", replacement: true }]
  );

  for (const [id, expectedRuleId] of [
    ["common-failure-shape-replacement-mismatch-invalid", "DM-CONV-004"],
    ["conventions-state-mixed-invalid", "DM-CONV-002"],
    ["conventions-format-catalog-duplicate-invalid", "DM-CONV-003"],
    ["failure-shape-replacement-mismatch-invalid", "DM-FAIL-003"]
  ]) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), [expectedRuleId]);
  }
});

test("executes the Task 9 DM-OP-003 Behavior corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    behaviorCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of behaviorCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("behavior-six-keys-delivery-unknown-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.deepEqual(
    Object.keys(valid.facts.core.operationDefinitions.byName),
    ["at-least-once", "at-most-once", "exactly-once", "unknown-facts"]
  );

  for (const id of behaviorCaseIds.filter((caseId) => caseId !== validCase.id)) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), ["DM-OP-003"], id);
  }
});

test("executes the Task 9 DM-OP-004 DM-MSG-002 DM-REPLY-002 and DM-FAIL-003 binding-scope corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    bindingScopeCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of bindingScopeCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("binding-scopes-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.deepEqual(
    valid.facts.core.messageDefinitions.byOperation["publish-order"].map((entry) => ({
      name: entry.name,
      reply: entry.reply
    })),
    [
      { name: "publish-order", reply: false },
      { name: "publish-order-reply", reply: true }
    ]
  );
  assert.deepEqual(
    valid.facts.core.failureShapes.inline.map((shape) => shape.label),
    ["publish-error"]
  );

  for (const [id, expectedRuleId] of [
    ["binding-channel-table-invalid", "DM-OP-004"],
    ["binding-failure-table-invalid", "DM-FAIL-003"],
    ["binding-message-table-invalid", "DM-MSG-002"],
    ["binding-operation-table-invalid", "DM-OP-004"],
    ["binding-reply-channel-table-invalid", "DM-REPLY-002"],
    ["binding-reply-message-table-invalid", "DM-MSG-002"]
  ]) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), [expectedRuleId], id);
  }
});

test("executes the Task 9 DM-MSG-001 direction nullability and nested-ancestor corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    messageDirectionCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of messageDirectionCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("message-direction-values-and-nested-ancestors-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  const validChannel = fs.readFileSync(path.join(
    corpusPath,
    validCase.path,
    "channels/directions.md"
  ), "utf8");
  for (const contractLine of [
    "| x-tenant | string | when the channel is shared by multiple tenants | no | Identifies the tenant on shared channels |",
    "| x-trace | unknown | unknown | unknown | Trace contract requires the event envelope source |",
    "| account | object | optional | yes | Additional properties are forbidden |",
    "| account.id | string | always | no | Account identifier when account is present and non-null |",
    "| audit.actor | string | always | no | Actor identifier when audit is present and non-null |",
    "| source.name | string | always | no | Source name when source is present and non-null |",
    "| x-tenant | string | conditional | no | Required when the command channel is shared by multiple tenants |",
    "| x-trace | unknown | unknown | unknown | Trace contract requires the command envelope source |",
    "| customer | object | no | yes | Additional properties are forbidden |",
    "| customer.id | string | yes | no | Customer identifier when customer is present and non-null |",
    "| delivery.address | string | yes | no | Address when delivery is present and non-null |",
    "| metadata.trace | string | yes | no | Trace value when metadata is present and non-null |"
  ]) {
    assert.equal(validChannel.includes(contractLine), true, contractLine);
  }
  assert.deepEqual(
    Object.fromEntries(Object.entries(valid.facts.core.messageDefinitions.byOperation).map(
      ([operation, definitions]) => [operation, definitions.map((entry) => ({
        direction: entry.direction,
        name: entry.name
      }))]
    )),
    {
      "receive-order": [{ direction: "RECEIVE", name: "order-received" }],
      "send-order": [{ direction: "SEND", name: "order-command" }]
    }
  );

  for (const id of messageDirectionCaseIds.filter((caseId) => caseId !== validCase.id)) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), ["DM-MSG-001"], id);
  }
});
