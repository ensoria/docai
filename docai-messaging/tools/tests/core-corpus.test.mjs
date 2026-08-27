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
import {
  auditFixtureOneInvalidity,
  runFixtureCorpus
} from "../lib/fixture-runner.mjs";
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
  "identity-perspective-normalization-mixed",
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
  "unprojected-source-missing-identity-invalid",
  "unprojected-source-missing-location-invalid",
  "unprojected-source-sensitive-valid",
  "unprojected-unrelated-marker-readiness-valid"
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
  "asyncapi-3.1.0-reply-message-index-invalid",
  "reply-independent-operation-projection-invalid",
  "reply-independent-operation-valid"
];

const authoritativeReplySelectionCaseIds = [
  "asyncapi-3.0.0-reply-authoritative-selection-valid",
  "asyncapi-3.1.0-reply-authoritative-selection-valid",
  "reply-selection-ambiguous-identity-invalid",
  "reply-selection-duplicate-target-invalid",
  "reply-selection-duplicate-identity-invalid",
  "reply-selection-missing-identity-invalid",
  "reply-selection-out-of-scope-identity-invalid",
  "reply-selection-unmatched-target-invalid",
  "reply-selection-unresolved-identity-invalid"
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

const payloadUnknownCaseIds = [
  "payload-field-collection-coexists-table-invalid",
  "payload-generic-whole-section-unknown-invalid",
  "payload-partial-example-retained-invalid",
  "payload-partial-marker-missing-invalid",
  "payload-unknown-forms-and-partial-collections-valid",
  "payload-whole-unknown-coexists-representation-invalid"
];

const payloadRootShapeCaseIds = [
  "payload-object-openness-missing-invalid",
  "payload-recursive-replacement-coexists-invalid",
  "payload-root-nullable-mismatch-invalid",
  "payload-root-receive-presence-invalid",
  "payload-root-scalar-row-missing-invalid",
  "payload-root-send-required-invalid",
  "payload-root-shapes-and-recursive-unsupported-valid"
];

const payloadConstraintAndFormatCaseIds = [
  "conventions-format-catalog-missing-invalid",
  "conventions-required-workflow-format-closure-invalid",
  "conventions-required-workflow-format-closure-valid",
  "payload-default-annotation-effective-behavior-invalid",
  "payload-default-send-behavior-missing-invalid",
  "payload-exact-constraints-defaults-formats-valid",
  "payload-exact-unique-items-invalid",
  "payload-format-catalog-role-invalid",
  "schema-format-default-projection-valid",
  "schema-custom-format-projection-invalid"
];

const schemaExampleProjectionCaseIds = [
  "payload-unsatisfiable-constraints-replacement-valid",
  "schema-example-projection-invalid",
  "schema-example-projection-valid"
];

const partialCollectionSourceCaseIds = [
  "partial-collection-no-sibling-form-invalid",
  "partial-collection-source-valid",
  "partial-collection-synthetic-member-invalid"
];

const wireAndHeaderCaseIds = [
  "adapter-header-encoding-projection-invalid",
  "adapter-parameterized-wire-projection-invalid",
  "adapter-wire-header-projection-valid",
  "payload-parameterized-json-as-raw-invalid",
  "payload-structured-xml-as-raw-invalid",
  "payload-wire-and-raw-boundaries-valid"
];

const replyContractCaseIds = [
  "reply-correlation-none-invalid",
  "reply-dynamic-channel-parameters-invalid",
  "reply-send-timeout-none-invalid",
  "reply-static-channel-parameters-invalid",
  "reply-states-routing-valid",
  "reply-whole-fallback-coexists-expanded-invalid",
  "reply-whole-fallback-index-invalid"
];

const failureContractCaseIds = [
  "common-failure-shape-replacement-mismatch-invalid",
  "failure-action-recovery-invalid",
  "failure-actions-and-shapes-valid",
  "failure-deviation-order-invalid",
  "failure-inline-order-invalid",
  "failure-inline-replacement-content-invalid",
  "failure-reference-embedded-invalid",
  "failure-shape-replacement-mismatch-invalid",
  "failure-signal-root-presence-invalid",
  "failure-signal-root-row-valid",
  "failure-state-mixed-invalid"
];

const trustAndPublicationCaseIds = [
  "publication-safety-feature-class-disclosure-invalid",
  "publication-safety-identical-override-invalid",
  "publication-safety-location-disclosure-invalid",
  "publication-safety-mandatory-catalog-invalid",
  "publication-safety-mandatory-invalid",
  "publication-safety-mandatory-location-invalid",
  "publication-safety-override-disclosure-invalid",
  "publication-safety-source-valid",
  "trust-boundary-authority-invalid",
  "trust-boundary-navigation-denial-missing-invalid",
  "trust-boundary-source-valid",
  "trust-boundary-structure-invalid"
];

const canonicalStructureCaseIds = [
  "behavior-marker-group-split-invalid",
  "behavior-marker-order-invalid",
  "canonical-deviations-deprecation-valid",
  "deprecated-summary-mismatch-invalid",
  "deviation-failure-shape-invalid",
  "deviation-message-heading-invalid",
  "deviation-order-invalid",
  "deviation-related-invalid",
  "deviation-split-payload-sequence-invalid",
  "language-localized-structure-invalid",
  "language-mixed-prose-invalid",
  "language-structure-source-valid"
];

const implementationReadinessCaseIds = [
  "implementation-readiness-capability-matrix-valid",
  "implementation-readiness-projection-invalid",
  "implementation-readiness-required-workflow-projection-invalid",
  "implementation-readiness-required-workflow-valid"
];

const publicationFailureCases = [
  ["publication-safety-mandatory-invalid", "unsafe-mandatory-structural-value"],
  ["publication-safety-mandatory-catalog-invalid", "unsafe-mandatory-catalog-cell"],
  ["publication-safety-mandatory-location-invalid", "unsafe-mandatory-with-location"],
  ["publication-safety-identical-override-invalid", "unsafe-identical-override"],
  ["publication-safety-feature-class-disclosure-invalid", "unsafe-feature-class-disclosure"],
  ["publication-safety-location-disclosure-invalid", "unsafe-location-disclosure"],
  ["publication-safety-override-disclosure-invalid", "unsafe-override-disclosure"]
];

function fixtureSource(fixturePath) {
  const source = fs.readFileSync(fixturePath, "utf8");
  return source.endsWith("\n") ? source.slice(0, -1) : source;
}

function validateDocumentSetMutation(fixturePath) {
  const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const basePath = path.resolve(path.dirname(fixturePath), scenario.base);
  const documentSet = loadDocumentSet(basePath);
  const file = documentSet.files.find((entry) => entry.path === scenario.path);
  assert.notEqual(file, undefined, `${scenario.path} must exist in ${scenario.base}`);
  const occurrences = file.content.split(scenario.replace.from).length - 1;
  assert.equal(occurrences, 1, `${scenario.id} replacement source must occur exactly once`);
  file.content = file.content.replace(scenario.replace.from, scenario.replace.to);
  return validateDocumentSet(documentSet, { wholeSet: false });
}

function validateCase(fixturePath, fixtureCase) {
  if (fixtureCase.kind === "document-set") {
    return validateDocumentSet(loadDocumentSet(fixturePath), { wholeSet: true });
  }
  if (fixtureCase.kind === "task-scoped-document-set") {
    return validateDocumentSet(loadDocumentSet(fixturePath), { wholeSet: false });
  }
  if (fixtureCase.kind === "task-scoped-document-set-mutation") {
    return validateDocumentSetMutation(fixturePath);
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
  if (fixtureCase.kind === "schema-field-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validateSchemaFieldSourceExpectations(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "schema-example-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validateSchemaExampleSourceExpectations(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "partial-collection-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validatePartialCollectionSourceExpectations(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "adapter-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validateAdapterSourceExpectations(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "trust-boundary-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validateTrustBoundarySourceExpectations(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "publication-safety-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validatePublicationSafetySourceExpectations(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "language-structure-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validateLanguageStructureSourceExpectations(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "implementation-readiness-source-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const documentSet = loadDocumentSet(path.resolve(
      path.dirname(fixturePath),
      scenario.documentSet
    ));
    const validation = validateDocumentSet(documentSet, { wholeSet: false });
    assert.deepEqual(validation.diagnostics, [], `${fixtureCase.id} base document set`);
    return coreValidator.validateImplementationReadinessExpectations(
      documentSet,
      validation.facts.core,
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

  const canonicalCase = byId.get("metadata-canonical-extensions-and-escapes");
  const canonical = validateCase(
    path.join(corpusPath, canonicalCase.path),
    canonicalCase
  );
  assert.equal(canonical.value.perspective, "店舗 service|west\\edge");
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

  const normalizationCase = byId.get("identity-perspective-normalization-mixed");
  const normalizationPath = path.join(corpusPath, normalizationCase.path);
  const normalizationSet = loadDocumentSet(normalizationPath);
  const indexPerspective = normalizationSet.files
    .find((file) => file.path === "INDEX.md").metadata.perspective;
  const conventionsPerspective = normalizationSet.files
    .find((file) => file.path === "CONVENTIONS.md").metadata.perspective;
  const codePoints = (value) => [...value].map((character) => character.codePointAt(0));

  assert.deepEqual(codePoints(indexPerspective), [99, 97, 102, 233]);
  assert.deepEqual(codePoints(conventionsPerspective), [99, 97, 102, 101, 769]);
  assert.notEqual(indexPerspective, conventionsPerspective);
  assert.equal(indexPerspective.normalize("NFC"), conventionsPerspective.normalize("NFC"));

  const normalization = validateCase(normalizationPath, normalizationCase);
  assert.deepEqual(
    normalization.diagnostics.map(({ ruleId, severity }) => ({ ruleId, severity })),
    [{ ruleId: "DM-ID-007", severity: "error" }]
  );
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

  const readinessCase = byId.get("unprojected-unrelated-marker-readiness-valid");
  const readinessDocumentSet = loadDocumentSet(path.join(corpusPath, readinessCase.path));
  const readinessValidation = validateDocumentSet(readinessDocumentSet, { wholeSet: false });
  assert.deepEqual(readinessValidation.diagnostics, []);
  assert.equal(
    readinessDocumentSet.files.find((file) => file.path === "INDEX.md").metadata.coverage,
    "requires-source"
  );
  assert.deepEqual(coreValidator.evaluateSelectedOperationReadiness(
    readinessDocumentSet,
    readinessValidation.facts.core,
    { operation: "create-order" }
  ), {
    operation: "create-order",
    ready: true,
    selectedPaths: ["CONVENTIONS.md", "INDEX.md", "channels/orders.md"],
    blockingMarkers: []
  });

  const extraRootMarkerSet = {
    ...readinessDocumentSet,
    files: readinessDocumentSet.files.map((file) => file.path === "INDEX.md"
      ? {
          ...file,
          content: file.content.replace(
            "\n\n> docai-identity:",
            "\n**unknown**: an independent root input remains unresolved\n\n> docai-identity:"
          )
        }
      : file)
  };
  assert.deepEqual(coreValidator.evaluateSelectedOperationReadiness(
    extraRootMarkerSet,
    readinessValidation.facts.core,
    { operation: "create-order" }
  ).blockingMarkers, [{ kind: "unknown", path: "INDEX.md" }]);
  assert.deepEqual(coreValidator.evaluateSelectedOperationReadiness(
    readinessDocumentSet,
    { ...readinessValidation.facts.core, unprojectedOperations: null },
    { operation: "create-order" }
  ).blockingMarkers, [{ kind: "unsupported", path: "INDEX.md" }]);

  const missingIdentityCase = byId.get("unprojected-source-missing-identity-invalid");
  const missingIdentity = validateCase(
    path.join(corpusPath, missingIdentityCase.path),
    missingIdentityCase
  );
  assert.deepEqual(missingIdentity.facts.unprojectedSourceExpectations, [{
    sourceOperationId: "operation-missing-identity",
    expectation: "generation-failure",
    reason: "publication-safe-operation-identity-unavailable"
  }]);

  const missingLocationCase = byId.get("unprojected-source-missing-location-invalid");
  const missingLocation = validateCase(
    path.join(corpusPath, missingLocationCase.path),
    missingLocationCase
  );
  assert.deepEqual(missingLocation.facts.unprojectedSourceExpectations, [{
    sourceOperationId: "operation-missing-location",
    expectation: "generation-failure",
    reason: "publication-safe-source-location-unavailable"
  }]);
  for (const sourceFailure of [missingIdentity, missingLocation]) {
    assert.deepEqual(
      sourceFailure.diagnostics.map(({ ruleId, severity }) => ({ ruleId, severity })),
      [{ ruleId: "DM-IDX-008", severity: "error" }]
    );
  }

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
      projectedOperationIds: [
        "replyMessagesEmpty",
        "replyMessagesExplicit",
        "replyMessagesOmitted",
        "replyMessagesOmittedEmptyChannel",
        "replyMessagesOmittedNoChannel",
        "replyMessagesOmittedSingle"
      ],
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
      indexRoutingMismatches: [],
      operationProjectionMismatches: [],
      selectionResolutionFailures: []
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

  const coexistenceCase = byId.get("reply-independent-operation-valid");
  const coexistence = validateCase(path.join(corpusPath, coexistenceCase.path), coexistenceCase);
  assert.deepEqual(coexistence.diagnostics, []);
  assert.deepEqual(coexistence.facts.asyncApiReplyMessageSelection.projectedOperationIds, [
    "independentReplyConsumer",
    "requestWithReply"
  ]);
  assert.deepEqual(coexistence.facts.asyncApiReplyMessageSelection.operations, [{
    operationId: "requestWithReply",
    outcome: "emit-expanded-reply",
    resolution: "explicit-non-empty",
    channelId: "replySelection",
    replyMessages: ["replyAccepted"],
    indexReplyEntries: ["reply:replyAccepted"],
    primaryOperationRetained: true
  }]);

  const projectionInvalidCase = byId.get("reply-independent-operation-projection-invalid");
  const projectionInvalid = validateCase(
    path.join(corpusPath, projectionInvalidCase.path),
    projectionInvalidCase
  );
  const projectionErrors = projectionInvalid.diagnostics.filter((entry) => (
    entry.severity === "error"
  ));
  assert.equal(projectionErrors.length, 1);
  assert.equal(projectionErrors[0].ruleId, "DM-REPLY-003");
  assert.deepEqual(
    projectionInvalid.facts.asyncApiReplyMessageSelection.operationProjectionMismatches,
    [{
      expected: ["independentReplyConsumer", "requestWithReply"],
      actual: ["independentReplyConsumer", "requestWithReply", "syntheticReplyOperation"]
    }]
  );
});

test("executes authoritative Reply selection and rejects invalid selected identities", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    authoritativeReplySelectionCaseIds.filter((id) => !byId.has(id)),
    []
  );
  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  for (const version of ["3.0.0", "3.1.0"]) {
    const fixtureCase = byId.get(`asyncapi-${version}-reply-authoritative-selection-valid`);
    const validation = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    assert.deepEqual(validation.diagnostics, []);
    assert.deepEqual(validation.facts.asyncApiReplyMessageSelection, {
      sourceSpecification: `AsyncAPI ${version}`,
      projectedOperationIds: [
        "replyAuthoritativeEmpty",
        "replyAuthoritativeMultiple",
        "replyAuthoritativeNoChannel",
        "replyAuthoritativeSingle"
      ],
      operations: [
        {
          operationId: "replyAuthoritativeEmpty",
          outcome: "emit-whole-reply-unsupported",
          reason: "zero-message reply",
          selection: "authoritative-empty",
          selectionSourceId: "selection-empty",
          channelId: "replyEmpty",
          replyMessages: [],
          indexReplyEntries: [],
          primaryOperationRetained: true
        },
        {
          operationId: "replyAuthoritativeMultiple",
          outcome: "emit-expanded-reply",
          resolution: "authoritative-non-empty",
          selectionSourceId: "selection-multiple",
          channelId: "replyMultiple",
          replyMessages: ["replyAccepted", "replyRejected"],
          indexReplyEntries: ["reply:replyAccepted", "reply:replyRejected"],
          primaryOperationRetained: true
        },
        {
          operationId: "replyAuthoritativeNoChannel",
          outcome: "emit-expanded-reply",
          resolution: "authoritative-non-empty",
          selectionSourceId: "selection-no-channel",
          channelId: null,
          replyMessages: ["replyDetached"],
          indexReplyEntries: ["reply:replyDetached"],
          primaryOperationRetained: true
        },
        {
          operationId: "replyAuthoritativeSingle",
          outcome: "emit-expanded-reply",
          resolution: "authoritative-non-empty",
          selectionSourceId: "selection-single",
          channelId: "replySingle",
          replyMessages: ["replyAccepted"],
          indexReplyEntries: ["reply:replyAccepted"],
          primaryOperationRetained: true
        }
      ],
      indexRoutingMismatches: [],
      operationProjectionMismatches: [],
      selectionResolutionFailures: []
    });
  }

  for (const [id, reason] of [
    ["reply-selection-ambiguous-identity-invalid", "ambiguous-selected-identity"],
    ["reply-selection-duplicate-identity-invalid", "duplicate-selected-identity"],
    ["reply-selection-missing-identity-invalid", "unresolved-selected-identity"],
    ["reply-selection-out-of-scope-identity-invalid", "out-of-scope-selected-identity"],
    ["reply-selection-unresolved-identity-invalid", "unresolved-selected-identity"]
  ]) {
    const fixtureCase = byId.get(id);
    const validation = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const errors = validation.diagnostics.filter((entry) => entry.severity === "error");
    assert.equal(errors.length, 1, id);
    assert.equal(errors[0].ruleId, "DM-REPLY-003", id);
    assert.deepEqual(validation.facts.asyncApiReplyMessageSelection.operations, [{
      operationId: "invalidReplySelection",
      outcome: "generation-failure",
      reason,
      selection: "authoritative-invalid",
      selectionSourceId: "selection-invalid",
      channelId: "replySelection",
      replyMessages: [],
      indexReplyEntries: []
    }], id);
    assert.deepEqual(
      validation.facts.asyncApiReplyMessageSelection.selectionResolutionFailures,
      [{ operationId: "invalidReplySelection", reason }],
      id
    );
    assert.deepEqual(
      validation.facts.asyncApiReplyMessageSelection.indexRoutingMismatches,
      [],
      id
    );
    const scenario = JSON.parse(fs.readFileSync(path.join(corpusPath, fixtureCase.path), "utf8"));
    const forbiddenDiagnosticValues = scenario.authoritativeReplyMessageSelections.flatMap((entry) => [
      entry.sourceId,
      entry.targetOperationId,
      ...entry.selectedIdentities.flatMap((identity) => [
        identity.identity,
        ...identity.sourceMessageRefs
      ])
    ]).filter((value) => typeof value === "string" && value.length > 0);
    for (const forbidden of forbiddenDiagnosticValues) {
      assert.equal(errors[0].message.includes(forbidden), false, `${id}: ${forbidden}`);
    }
  }

  for (const [id, failure] of [
    ["reply-selection-duplicate-target-invalid", {
      operationId: "invalidReplySelection",
      reason: "duplicate-authoritative-selection-target"
    }],
    ["reply-selection-unmatched-target-invalid", {
      operationId: "notAReply",
      reason: "unmatched-authoritative-selection-target"
    }]
  ]) {
    const fixtureCase = byId.get(id);
    const validation = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const errors = validation.diagnostics.filter((entry) => entry.severity === "error");
    assert.equal(errors.length, 1, id);
    assert.equal(errors[0].ruleId, "DM-REPLY-003", id);
    assert.deepEqual(
      validation.facts.asyncApiReplyMessageSelection.selectionResolutionFailures,
      [failure],
      id
    );
    assert.deepEqual(
      validation.facts.asyncApiReplyMessageSelection.indexRoutingMismatches,
      [],
      id
    );
    const scenario = JSON.parse(fs.readFileSync(path.join(corpusPath, fixtureCase.path), "utf8"));
    const forbiddenDiagnosticValues = scenario.authoritativeReplyMessageSelections.flatMap((entry) => [
      entry.sourceId,
      entry.targetOperationId,
      ...entry.selectedIdentities.flatMap((identity) => [
        identity.identity,
        ...identity.sourceMessageRefs
      ])
    ]).filter((value) => typeof value === "string" && value.length > 0);
    for (const forbidden of forbiddenDiagnosticValues) {
      assert.equal(errors[0].message.includes(forbidden), false, `${id}: ${forbidden}`);
    }
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

test("executes the Task 9 DM-MSG-004 payload unknown and partial-collection corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    payloadUnknownCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of payloadUnknownCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("payload-unknown-forms-and-partial-collections-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  const validChannel = fs.readFileSync(path.join(
    corpusPath,
    validCase.path,
    "channels/payload-unknown.md"
  ), "utf8");
  assert.equal(
    validChannel.includes(`#### Parameters

unknown
**unknown**: channel parameter collection requires the complete channel declaration at source-a

#### Bindings`),
    true
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(valid.facts.core.messageDefinitions.byOperation).map(
      ([operation, definitions]) => [operation, definitions.map((entry) => entry.name)]
    )),
    {
      "partial-fields": ["partial-fields-message"],
      "partial-members": ["partial-members-message"],
      "unknown-fields": ["unknown-fields-message"],
      "unknown-representations": ["unknown-representations-message"],
      "unknown-parameters": ["unknown-parameters-message"]
    }
  );

  for (const id of payloadUnknownCaseIds.filter((caseId) => caseId !== validCase.id)) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), ["DM-MSG-004"], id);
  }
});

test("executes the Task 9 DM-MSG-001 DM-MSG-004 DM-MSG-005 root-shape openness and recursion corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    payloadRootShapeCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of payloadRootShapeCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("payload-root-shapes-and-recursive-unsupported-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.deepEqual(
    Object.fromEntries(Object.entries(valid.facts.core.messageDefinitions.byOperation).map(
      ([operation, definitions]) => [operation, definitions.map((entry) => entry.name)]
    )),
    {
      "root-array": ["root-array-message"],
      "root-map": ["root-map-message"],
      "root-object": ["root-object-message"],
      "root-scalar": ["root-scalar-message"],
      "recursive-payload": ["recursive-payload-message"]
    }
  );

  for (const id of payloadRootShapeCaseIds.filter((caseId) => caseId !== validCase.id)) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), fixtureCase.expected_rule_ids, id);
  }
});

test("executes the Task 9 DM-MSG-005 DM-CONV-003 exact-constraint default and format corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    payloadConstraintAndFormatCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of payloadConstraintAndFormatCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("payload-exact-constraints-defaults-formats-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.deepEqual(valid.facts.core.formats, [
    {
      format: '"date-time"',
      meaning: "Preserve RFC 3339 date-time representation intent without adding validation or construction behavior.",
      role: "annotation"
    },
    {
      format: '"int32"',
      meaning: "Accept signed 32-bit integers and construct and validate them without narrowing.",
      role: "constraint"
    }
  ]);

  const workflowClosureCase = byId.get("conventions-required-workflow-format-closure-valid");
  const workflowClosure = validateCase(
    path.join(corpusPath, workflowClosureCase.path),
    workflowClosureCase
  );
  assert.deepEqual(workflowClosure.diagnostics, []);
  assert.deepEqual(workflowClosure.facts.core.formats, [{
    format: '"uuid"',
    meaning: "Accept canonical UUID strings and construct and validate them without narrowing.",
    role: "constraint"
  }]);
  assert.deepEqual(
    workflowClosure.facts.core.operations.rows.map((row) => ({
      operation: row.operation,
      requiredContexts: row.requiredContexts,
      conventions: row.conventions
    })),
    [{
      operation: "create-order",
      requiredContexts: ["workflows/formatted.md"],
      conventions: ["Data Representation"]
    }]
  );

  const sourceCase = byId.get("schema-format-default-projection-valid");
  const source = validateCase(path.join(corpusPath, sourceCase.path), sourceCase);
  assert.deepEqual(source.diagnostics, []);
  assert.deepEqual(source.facts.schemaFieldSourceExpectations, [
    {
      caseId: "asyncapi-3.0-int32",
      coverage: "complete",
      fragment: '`format="int32"`',
      requiredBehavior: "constraint-catalog"
    },
    {
      caseId: "asyncapi-case-mismatched-int32",
      coverage: "requires-source",
      fragment: null,
      requiredBehavior: "localized-unsupported"
    },
    {
      caseId: "asyncapi-default",
      coverage: "complete",
      fragment: '`default="safe"`',
      requiredBehavior: "send-effective-value-when-omitted"
    },
    {
      caseId: "asyncapi-default-receive",
      coverage: "complete",
      fragment: '`default="safe"`',
      requiredBehavior: "receive-effective-value-when-absent"
    },
    {
      caseId: "asyncapi-int32",
      coverage: "complete",
      fragment: '`format="int32"`',
      requiredBehavior: "constraint-catalog"
    },
    {
      caseId: "asyncapi-open-uuid",
      coverage: "requires-source",
      fragment: null,
      requiredBehavior: "localized-unsupported"
    },
    {
      caseId: "draft07-date-time",
      coverage: "complete",
      fragment: '`format_annotation="date-time"`',
      requiredBehavior: "annotation-catalog"
    },
    {
      caseId: "draft07-default",
      coverage: "complete",
      fragment: '`default_annotation="draft"`',
      requiredBehavior: "annotation-only"
    },
    {
      caseId: "draft07-default-null",
      coverage: "complete",
      fragment: "`default_annotation=null`",
      requiredBehavior: "annotation-only"
    },
    {
      caseId: "draft07-open-custom-format",
      coverage: "requires-source",
      fragment: null,
      requiredBehavior: "localized-unsupported"
    }
  ]);

  for (const id of payloadConstraintAndFormatCaseIds.filter((caseId) => (
    ![validCase.id, sourceCase.id].includes(caseId)
  ))) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), fixtureCase.expected_rule_ids, id);
  }
});

test("executes the Task 9 DM-MSG-004 DM-MSG-005 schema example projection corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    schemaExampleProjectionCaseIds.filter((id) => !byId.has(id)),
    []
  );

  const sourceCase = byId.get("schema-example-projection-valid");
  const source = validateCase(path.join(corpusPath, sourceCase.path), sourceCase);
  assert.deepEqual(source.diagnostics, []);
  assert.deepEqual(source.facts.schemaExampleSourceExpectations, [
    {
      caseId: "contradictory-bounds-example-conflict",
      outcome: "generation-failure",
      reason: "authoritative-conflict",
      replacement: null
    },
    {
      caseId: "contradictory-bounds-location-unavailable",
      outcome: "generation-failure",
      reason: "publication-safe-source-location-unavailable",
      replacement: null
    },
    {
      caseId: "contradictory-bounds-replacement",
      outcome: "replacement-unsupported",
      reason: "provably-empty-supported-schema",
      replacement: "**unsupported**: replaces payload representation empty-schema-message 16:application/json: effective supported schema permits no valid decoded instance at source.json#/components/schemas/Empty"
    },
    {
      caseId: "generator-example-production-unavailable",
      outcome: "generation-failure",
      reason: "generator-example-production-capability-unavailable",
      replacement: null
    },
    {
      caseId: "generator-example-validation-unavailable",
      outcome: "generation-failure",
      reason: "generator-example-validation-capability-unavailable",
      replacement: null
    },
    {
      caseId: "nonnumeric-bounds-not-empty",
      outcome: "generation-failure",
      reason: "generator-example-production-capability-unavailable",
      replacement: null
    }
  ]);

  const replacementCase = byId.get("payload-unsatisfiable-constraints-replacement-valid");
  const replacement = validateCase(
    path.join(corpusPath, replacementCase.path),
    replacementCase
  );
  assert.deepEqual(replacement.diagnostics, []);

  const invalidCase = byId.get("schema-example-projection-invalid");
  const invalid = validateCase(path.join(corpusPath, invalidCase.path), invalidCase);
  const primary = invalid.diagnostics.filter((entry) => (
    entry.severity === "error" && !entry.cascade
  ));
  assert.deepEqual(primary.map((entry) => entry.ruleId), ["DM-MSG-005"]);
  assert.equal(primary[0].message.includes("source-example-message"), false);
  assert.equal(primary[0].message.includes("generator-validation-misclassified"), false);
  assert.equal(primary[0].message.includes("5"), false);

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);
});

test("executes partial-collection source scenarios", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(
    partialCollectionSourceCaseIds.filter((id) => !byId.has(id)),
    []
  );
  for (const id of partialCollectionSourceCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("partial-collection-source-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.deepEqual(valid.facts.partialCollectionSourceExpectations, [
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
      representation: { mediaType: "application/json", nullable: "no" }
    },
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
      representation: { mediaType: "application/json", nullable: "yes" }
    },
    {
      collectionId: "event-variants",
      form: "representation-local-unknown",
      representation: { mediaType: "application/json", nullable: "no" }
    }
  ]);

  for (const id of partialCollectionSourceCaseIds.filter((caseId) => caseId !== validCase.id)) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), fixtureCase.expected_rule_ids, id);
  }
});

test("associates duplicate partial-collection IDs by source-case index", () => {
  const result = coreValidator.validatePartialCollectionSourceExpectations({
    cases: [
      {
        collectionId: "shared-collection",
        memberKind: "header",
        namedMembers: ["correlation-id"],
        projected: {
          collectionId: "shared-collection",
          form: "partial-table",
          retainedNames: ["correlation-id"],
          marker: "additional unnamed header"
        }
      },
      {
        collectionId: "shared-collection",
        memberKind: "parameter",
        namedMembers: [],
        projected: {
          collectionId: "shared-collection",
          form: "whole-section-unknown"
        }
      }
    ]
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.partialCollectionSourceExpectations, [
    {
      collectionId: "shared-collection",
      form: "partial-table",
      retainedNames: ["correlation-id"],
      marker: "additional unnamed header"
    },
    {
      collectionId: "shared-collection",
      form: "whole-section-unknown"
    }
  ]);
});

test("executes the Task 9 DM-ADAPTER-002 DM-ADAPTER-003 DM-MSG-004 wire header and raw corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(wireAndHeaderCaseIds.filter((id) => !byId.has(id)), []);
  for (const id of wireAndHeaderCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const documentCase = byId.get("payload-wire-and-raw-boundaries-valid");
  const document = validateCase(path.join(corpusPath, documentCase.path), documentCase);
  assert.deepEqual(document.diagnostics, []);
  assert.deepEqual(
    Object.fromEntries(Object.entries(document.facts.core.messageDefinitions.byOperation).map(
      ([operation, definitions]) => [operation, definitions.map((entry) => entry.name)]
    )),
    {
      "direct-json": ["direct-json-message"],
      "direct-vendor-json": ["direct-vendor-json-message"],
      "opaque-binary": ["opaque-binary-message"],
      "parameterized-json": ["parameterized-json-message"],
      "unregistered-xml": ["unregistered-xml-message"]
    }
  );

  const sourceCase = byId.get("adapter-wire-header-projection-valid");
  const source = validateCase(path.join(corpusPath, sourceCase.path), sourceCase);
  assert.deepEqual(source.diagnostics, []);
  assert.deepEqual(source.facts.adapterSourceExpectations, [
    {
      caseId: "application-json",
      outcome: "supported",
      resolution: "direct",
      effectiveTarget: "application/json",
      ruleId: "direct-json-wire",
      ruleVersion: "0.17.1",
      ordinaryReaderRequirement: "normalized-contract-only"
    },
    {
      caseId: "vendor-json",
      outcome: "supported",
      resolution: "direct",
      effectiveTarget: "text/vnd.example+json",
      ruleId: "direct-json-wire",
      ruleVersion: "0.17.1",
      ordinaryReaderRequirement: "normalized-contract-only"
    },
    {
      caseId: "token-rich-vendor-json",
      outcome: "supported",
      resolution: "direct",
      effectiveTarget: "application/vnd.example%2btag+json",
      ruleId: "direct-json-wire",
      ruleVersion: "0.17.1",
      ordinaryReaderRequirement: "normalized-contract-only"
    },
    {
      caseId: "parameterized-json-unmapped",
      outcome: "emit-unsupported",
      resolution: "no-exact-mapping",
      effectiveTarget: "application/json;charset=utf-8",
      projection: "replace-payload-representation",
      ordinaryReaderRequirement: "normalized-contract-only"
    },
    {
      caseId: "xml-unmapped",
      outcome: "emit-unsupported",
      resolution: "no-exact-mapping",
      effectiveTarget: "application/xml",
      projection: "replace-payload-representation",
      ordinaryReaderRequirement: "normalized-contract-only"
    },
    {
      caseId: "parameterized-json-preserved",
      outcome: "supported",
      resolution: "publication-mapping",
      effectiveTarget: "application/json;charset=utf-8",
      emittedMediaType: "application/json;charset=utf-8",
      mediaTypeResolution: "preserved",
      ruleId: "json-charset-preserving-wire",
      ruleVersion: "1.0.0",
      mappingSourceIds: ["adapter-catalog"],
      projection: "emit-payload-representation",
      ordinaryReaderRequirement: "normalized-contract-only"
    },
    {
      caseId: "parameterized-json-normalized",
      outcome: "supported",
      resolution: "publication-mapping",
      effectiveTarget: "application/json;charset=utf-8",
      emittedMediaType: "application/json",
      mediaTypeResolution: "adapter-normalized",
      ruleId: "json-charset-normalizing-wire",
      ruleVersion: "1.1.0",
      mappingSourceIds: ["adapter-catalog"],
      projection: "emit-payload-representation",
      ordinaryReaderRequirement: "normalized-contract-only"
    },
    {
      caseId: "mapped-kafka-headers",
      outcome: "supported",
      resolution: "publication-mapping",
      ruleId: "kafka-header-map",
      ruleVersion: "1.0.0",
      mappingSourceIds: ["adapter-catalog"],
      projection: "emit-header-map",
      ordinaryReaderRequirement: "normalized-contract-only"
    },
    {
      caseId: "incompatible-kafka-headers",
      outcome: "emit-unsupported",
      resolution: "no-exact-mapping",
      projection: "replace-header-representation",
      ordinaryReaderRequirement: "normalized-contract-only"
    }
  ]);

  for (const id of wireAndHeaderCaseIds.filter((caseId) => (
    ![documentCase.id, sourceCase.id].includes(caseId)
  ))) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), fixtureCase.expected_rule_ids, id);
  }
});

test("executes the Task 9 DM-REPLY-001 DM-REPLY-002 DM-REPLY-003 channel state and routing corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(replyContractCaseIds.filter((id) => !byId.has(id)), []);
  for (const id of replyContractCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("reply-states-routing-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.deepEqual(Object.keys(valid.facts.core.operationDefinitions.byName), [
    "consume-static-reply",
    "dynamic-request",
    "no-reply",
    "receive-request",
    "static-request",
    "unknown-reply",
    "unsupported-reply"
  ]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(valid.facts.core.messageDefinitions.byOperation).map(
      ([operation, definitions]) => [operation, definitions.map((entry) => ({
        direction: entry.direction,
        name: entry.name,
        reply: entry.reply
      }))]
    )),
    {
      "consume-static-reply": [
        { direction: "RECEIVE", name: "static-reply", reply: false }
      ],
      "dynamic-request": [
        { direction: "SEND", name: "dynamic-request-message", reply: false },
        { direction: "RECEIVE", name: "dynamic-reply", reply: true }
      ],
      "no-reply": [
        { direction: "SEND", name: "no-reply-message", reply: false }
      ],
      "receive-request": [
        { direction: "RECEIVE", name: "receive-request-message", reply: false },
        { direction: "SEND", name: "receive-reply", reply: true }
      ],
      "static-request": [
        { direction: "SEND", name: "static-request-message", reply: false },
        { direction: "RECEIVE", name: "static-reply", reply: true }
      ],
      "unknown-reply": [
        { direction: "SEND", name: "unknown-reply-message", reply: false }
      ],
      "unsupported-reply": [
        { direction: "SEND", name: "unsupported-reply-message", reply: false }
      ]
    }
  );

  for (const [id, expectedRuleId] of [
    ["reply-correlation-none-invalid", "DM-REPLY-002"],
    ["reply-dynamic-channel-parameters-invalid", "DM-REPLY-002"],
    ["reply-send-timeout-none-invalid", "DM-REPLY-002"],
    ["reply-static-channel-parameters-invalid", "DM-REPLY-002"],
    ["reply-whole-fallback-coexists-expanded-invalid", "DM-REPLY-001"],
    ["reply-whole-fallback-index-invalid", "DM-REPLY-003"]
  ]) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), [expectedRuleId], id);
  }
});

test("executes the Task 9 DM-FAIL-001 DM-FAIL-002 DM-FAIL-003 DM-CONV-004 states actions and shapes corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(failureContractCaseIds.filter((id) => !byId.has(id)), []);
  for (const id of failureContractCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("failure-actions-and-shapes-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  const validChannel = fs.readFileSync(
    path.join(corpusPath, validCase.path, "channels/failures.md"),
    "utf8"
  );
  for (const expectedFragment of [
    "### Failure Handling\n\nnone",
    "### Failure Handling\n\nunknown\n**unknown**:",
    "### Failure Handling\n\n**unsupported**: replaces Failure Handling:",
    "### Failure Handling\n\n**deviation**: alpha inherited retry rule is replaced by immediate escalation\n**deviation**: zeta inherited dead-letter rule is replaced by quarantine routing\n| Failure | Signal | Condition | Action |",
    "### Failure Handling\n\n**deviation**: inherited poison-message retry rule is suppressed because this operation has no poison-message state\nnone",
    "### Failure Handling\n\n**deviation**: inherited retry rule is replaced by escalation before unresolved behavior is consulted\nunknown\n**unknown**:",
    "### Failure Handling\n\n**deviation**: inherited retry rule is replaced by escalation before encoded failure rules are consulted\n**unsupported**: replaces Failure Handling:",
    "| malformed-payload | inline:malformed-payload |",
    "| unknown-variant | inline:unknown-variant |",
    "| handler-error | common:handler-error |"
  ]) {
    assert.equal(validChannel.includes(expectedFragment), true, expectedFragment);
  }
  assert.deepEqual(
    valid.facts.core.failureShapes.common.map((shape) => ({
      label: shape.label,
      replacement: shape.replacement
    })),
    [
      { label: "handler-error", replacement: false },
      { label: "legacy-error", replacement: true }
    ]
  );
  assert.deepEqual(valid.facts.core.failureShapes.commonReferences, [
    { label: "handler-error", operation: "expanded-receive" },
    { label: "legacy-error", operation: "expanded-receive" }
  ]);
  assert.deepEqual(
    valid.facts.core.failureShapes.inline.map((shape) => ({
      label: shape.label,
      operation: shape.operation,
      replacement: shape.replacement
    })),
    [
      { label: "malformed-payload", operation: "expanded-receive", replacement: false },
      { label: "unknown-variant", operation: "expanded-receive", replacement: false },
      { label: "encoded-signal", operation: "expanded-receive", replacement: true }
    ]
  );
  assert.deepEqual(Object.keys(valid.facts.core.operationDefinitions.byName), [
    "expanded-receive",
    "expanded-with-deviation",
    "none",
    "none-with-deviation",
    "unknown",
    "unknown-with-deviation",
    "unsupported",
    "unsupported-with-deviation"
  ]);

  for (const [id, expectedRuleId] of [
    ["common-failure-shape-replacement-mismatch-invalid", "DM-CONV-004"],
    ["failure-action-recovery-invalid", "DM-FAIL-002"],
    ["failure-deviation-order-invalid", "DM-FAIL-001"],
    ["failure-inline-order-invalid", "DM-FAIL-002"],
    ["failure-inline-replacement-content-invalid", "DM-FAIL-003"],
    ["failure-reference-embedded-invalid", "DM-FAIL-002"],
    ["failure-shape-replacement-mismatch-invalid", "DM-FAIL-003"],
    ["failure-state-mixed-invalid", "DM-FAIL-001"]
  ]) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), [expectedRuleId], id);
  }
});

test("executes the failure-signal root-row corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(failureContractCaseIds.filter((id) => !byId.has(id)), []);

  const validCase = byId.get("failure-signal-root-row-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  const validChannel = fs.readFileSync(
    path.join(corpusPath, validCase.path, "channels/failure-root.md"),
    "utf8"
  );
  assert.equal(validChannel.includes(`**message_shape**: failure-code

- Headers: none
- Bindings: none
#### Payload

**payload_presence**: always
**media_type**: application/json
**payload_nullable**: no
\`\`\`json
"rejected"
\`\`\`
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | string | always | no | Stable failure code |`), true);
  assert.deepEqual(
    valid.facts.core.failureShapes.inline.map((shape) => ({
      label: shape.label,
      operation: shape.operation,
      replacement: shape.replacement
    })),
    [{ label: "failure-code", operation: "publish-with-failure-root", replacement: false }]
  );

  const invalidCase = byId.get("failure-signal-root-presence-invalid");
  const invalid = validateCase(path.join(corpusPath, invalidCase.path), invalidCase);
  const primary = invalid.diagnostics.filter((entry) => (
    entry.severity === "error" && !entry.cascade
  ));
  assert.deepEqual(primary.map((entry) => entry.ruleId), ["DM-FAIL-003"]);
});

test("executes the Task 9 DM-TRUST-001 DM-TRUST-002 DM-TRUST-003 publication and structural-escape corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(trustAndPublicationCaseIds.filter((id) => !byId.has(id)), []);
  assert.equal(typeof coreValidator.validateTrustBoundarySourceExpectations, "function");
  assert.equal(typeof coreValidator.validatePublicationSafetySourceExpectations, "function");
  for (const id of trustAndPublicationCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const trustCase = byId.get("trust-boundary-source-valid");
  const trust = validateCase(path.join(corpusPath, trustCase.path), trustCase);
  assert.deepEqual(trust.diagnostics, []);
  assert.deepEqual(trust.facts.trustBoundarySourceExpectations, [
    {
      caseId: "instruction-like-prose",
      outcome: "treat-as-contract-data",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "navigation-url",
      outcome: "preserve-navigation-data",
      retrievalAuthorized: false,
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "bounded-example",
      outcome: "preserve-inside-bounded-example",
      detectedStructure: "identity-like-data",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "schema-string-table-row",
      outcome: "encode-assigned-value",
      detectedStructure: "table-row",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "metadata-like-line",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "opening-metadata",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "identity-like-line",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "identity-trailer",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "profile-link",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "profile-link",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "behavior-key",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "fixed-key-list",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "reply-key",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "fixed-key-list",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "standard-marker",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "standard-marker",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "extension-structure",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "extension-structure",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "standalone-fixed-value",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "fixed-value",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "heading",
      outcome: "neutralize-line-leading-structure",
      detectedStructure: "heading",
      instructionAuthority: "none",
      authorizedActions: []
    },
    {
      caseId: "collapsed-fixed-value",
      outcome: "emit-unsupported",
      reason: "ambiguous-fixed-sentinel",
      instructionAuthority: "none",
      authorizedActions: []
    }
  ]);

  const publicationCase = byId.get("publication-safety-source-valid");
  const publication = validateCase(
    path.join(corpusPath, publicationCase.path),
    publicationCase
  );
  assert.deepEqual(publication.diagnostics, []);
  assert.deepEqual(publication.facts.publicationSafetySourceExpectations, [
    {
      caseId: "authorized-broker-host",
      outcome: "emit-exact",
      emittedValue: "broker.public.example",
      coverage: "complete",
      knowledge: "complete",
      prohibitedOutputValues: []
    },
    {
      caseId: "authorized-class-overlap",
      outcome: "emit-exact",
      emittedValue: "host",
      coverage: "complete",
      knowledge: "complete",
      prohibitedOutputValues: []
    },
    {
      caseId: "sensitive-credential-contract",
      outcome: "emit-unsupported",
      markerReason: "sensitive credential withheld at source.json#/security/0",
      coverage: "requires-source",
      knowledge: "complete",
      prohibitedOutputValues: ["SYNTHETIC_SECRET_SENTINEL"]
    },
    {
      caseId: "sensitive-client-override-not-sanitized",
      outcome: "emit-unsupported",
      markerReason: "sensitive credential withheld at source.json#/security/2",
      coverage: "requires-source",
      knowledge: "complete",
      prohibitedOutputValues: ["SYNTHETIC_SECOND_SECRET_SENTINEL"]
    },
    {
      caseId: "regulated-data-example",
      outcome: "replace-with-synthetic-placeholder",
      coverage: "complete",
      knowledge: "complete",
      prohibitedOutputValues: ["SYNTHETIC_PII_SENTINEL"]
    },
    {
      caseId: "authorized-safe-override",
      outcome: "emit-safe-override",
      emittedValue: "broker.public.example",
      coverage: "complete",
      knowledge: "complete",
      prohibitedOutputValues: ["SYNTHETIC_INTERNAL_HOST_SENTINEL"]
    }
  ]);

  for (const [id, caseId] of publicationFailureCases) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    assert.deepEqual(
      invalid.facts.publicationSafetySourceExpectations.map((entry) => ({
        caseId: entry.caseId,
        outcome: entry.outcome
      })),
      [{ caseId, outcome: "generation-failure" }],
      id
    );
    assert.equal(
      invalid.diagnostics.some((entry) => entry.message.includes("SYNTHETIC_")),
      false,
      id
    );
  }

  for (const [id, expectedRuleId] of [
    ["publication-safety-feature-class-disclosure-invalid", "DM-TRUST-003"],
    ["publication-safety-identical-override-invalid", "DM-TRUST-003"],
    ["publication-safety-location-disclosure-invalid", "DM-TRUST-003"],
    ["publication-safety-mandatory-catalog-invalid", "DM-TRUST-003"],
    ["publication-safety-mandatory-invalid", "DM-TRUST-003"],
    ["publication-safety-mandatory-location-invalid", "DM-TRUST-003"],
    ["publication-safety-override-disclosure-invalid", "DM-TRUST-003"],
    ["trust-boundary-authority-invalid", "DM-TRUST-001"],
    ["trust-boundary-navigation-denial-missing-invalid", "DM-TRUST-001"],
    ["trust-boundary-structure-invalid", "DM-TRUST-002"]
  ]) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), [expectedRuleId], id);
  }
});

test("executes the Task 9 DM-LANG-001 canonical marker deviation deprecation language and English-structure corpus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(canonicalStructureCaseIds.filter((id) => !byId.has(id)), []);
  assert.equal(typeof coreValidator.validateLanguageStructureSourceExpectations, "function");
  for (const id of canonicalStructureCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("canonical-deviations-deprecation-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.equal(valid.facts.core.operationDefinitions.byName["publish-order"].deprecated, true);
  const validChannel = fs.readFileSync(
    path.join(corpusPath, validCase.path, "channels/deviations.md"),
    "utf8"
  );
  for (const fragment of [
    "**deprecated**: use publish-order-v2 and migrate producers before retirement",
    "### Behavior\n\n**deviation**:",
    "### Operation Bindings\n\n**deviation**:",
    "### Channel\n\n**deviation**:",
    "#### Parameters\n\n**deviation**:",
    "#### Bindings\n\n**deviation**:",
    "#### Headers\n\n**deviation**:",
    "#### Payload\n\n**deviation**:",
    "### Reply\n\n**deviation**:",
    "##### Parameters\n\n**deviation**:",
    "##### Payload\n\n**deviation**:",
    "### Failure Handling\n\n**deviation**:"
  ]) {
    assert.equal(validChannel.includes(fragment), true, fragment);
  }

  const languageCase = byId.get("language-structure-source-valid");
  const language = validateCase(path.join(corpusPath, languageCase.path), languageCase);
  assert.deepEqual(language.diagnostics, []);
  assert.deepEqual(language.facts.languageStructureSourceExpectations, [
    {
      caseId: "behavior-heading",
      expectedLanguage: "en",
      expectedValue: "Behavior",
      role: "structure"
    },
    {
      caseId: "operation-purpose",
      expectedLanguage: "ja",
      expectedValue: null,
      role: "prose"
    },
    {
      caseId: "payload-heading",
      expectedLanguage: "en",
      expectedValue: "Payload",
      role: "structure"
    },
    {
      caseId: "summary",
      expectedLanguage: "ja",
      expectedValue: null,
      role: "prose"
    }
  ]);

  for (const [id, expectedRuleId] of [
    ["behavior-marker-order-invalid", "DM-OP-003"],
    ["behavior-marker-group-split-invalid", "DM-OP-003"],
    ["deprecated-summary-mismatch-invalid", "DM-OP-002"],
    ["deviation-failure-shape-invalid", "DM-FAIL-003"],
    ["deviation-message-heading-invalid", "DM-MSG-003"],
    ["deviation-order-invalid", "DM-OP-003"],
    ["deviation-related-invalid", "DM-OP-001"],
    ["deviation-split-payload-sequence-invalid", "DM-MSG-004"],
    ["language-localized-structure-invalid", "DM-LANG-001"],
    ["language-mixed-prose-invalid", "DM-LANG-001"]
  ]) {
    const fixtureCase = byId.get(id);
    const invalid = validateCase(path.join(corpusPath, fixtureCase.path), fixtureCase);
    const primary = invalid.diagnostics.filter((entry) => (
      entry.severity === "error" && !entry.cascade
    ));
    assert.deepEqual(primary.map((entry) => entry.ruleId), [expectedRuleId], id);
  }
});

test("executes the Task 9 DM-INC-003 implementation-readiness capability matrix", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  const byId = new Map(manifest.cases.map((fixtureCase) => [fixtureCase.id, fixtureCase]));

  assert.deepEqual(implementationReadinessCaseIds.filter((id) => !byId.has(id)), []);
  assert.equal(typeof coreValidator.validateImplementationReadinessExpectations, "function");
  for (const id of implementationReadinessCaseIds) {
    const fixtureCase = byId.get(id);
    assert.equal(
      fixtureCase.expected === "valid" || fixtureCase.expected_rule_ids.length === 1,
      true,
      id
    );
  }

  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);

  const validCase = byId.get("implementation-readiness-capability-matrix-valid");
  const valid = validateCase(path.join(corpusPath, validCase.path), validCase);
  assert.deepEqual(valid.diagnostics, []);
  assert.deepEqual(
    valid.facts.implementationReadinessExpectations.map((entry) => ({
      caseId: entry.caseId,
      ready: entry.ready,
      blockers: entry.blockers
    })),
    [
      {
        caseId: "ordinary-missing-required-runtime",
        ready: false,
        blockers: ["runtime-capability:kafka-producer"]
      },
      {
        caseId: "ordinary-missing-required-structure",
        ready: false,
        blockers: ["structure:payload.application/json"]
      },
      {
        caseId: "ordinary-ready-without-source-adapters-or-unused-avro",
        ready: true,
        blockers: []
      },
      {
        caseId: "ordinary-unsupported-docai-version",
        ready: false,
        blockers: ["docai-messaging-version:0.17.1"]
      },
      {
        caseId: "ordinary-unsupported-profile",
        ready: false,
        blockers: ["profile:full"]
      },
      {
        caseId: "ordinary-unsupported-publication-scope",
        ready: false,
        blockers: ["publication-scope:core/v0.17.1"]
      },
      {
        caseId: "source-aware-exact-adapters",
        ready: true,
        blockers: []
      },
      {
        caseId: "source-aware-missing-exact-adapter",
        ready: false,
        blockers: ["source-adapter:schema:asyncapi@3.1.0"]
      }
    ]
  );

  const requiredWorkflowCase = byId.get("implementation-readiness-required-workflow-valid");
  const requiredWorkflow = validateCase(
    path.join(corpusPath, requiredWorkflowCase.path),
    requiredWorkflowCase
  );
  assert.deepEqual(requiredWorkflow.diagnostics, []);
  assert.deepEqual(
    requiredWorkflow.facts.implementationReadinessExpectations.map((entry) => ({
      caseId: entry.caseId,
      ready: entry.ready,
      blockers: entry.blockers
    })),
    [
      {
        caseId: "core-required-workflow-not-ready",
        ready: false,
        blockers: [
          "structure:workflow:workflows/a-required.md",
          "structure:workflow:workflows/none.md"
        ]
      },
      {
        caseId: "workflow-capable-reader-ready",
        ready: true,
        blockers: []
      }
    ]
  );
});

test("audits every Task 9 invalid fixture as one primary concern", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(corpusPath, "cases.json"), "utf8"));
  assert.equal(manifest.cases.length, 202);
  const result = runFixtureCorpus(corpusPath, validateCase);
  assert.equal(result.failed, 0, result.report);
  const audit = auditFixtureOneInvalidity({
    manifestCases: manifest.cases,
    corpusCases: result.cases
  });

  assert.deepEqual(audit, { passed: true, audited: 149, errors: [] });
});
