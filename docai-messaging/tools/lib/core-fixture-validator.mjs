import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  loadDocumentSet,
  validateDocumentSet,
  validateOperationProfilePair
} from "./document-set.mjs";
import { scanUtf8Lines } from "./identity.mjs";
import { parseOpeningMetadata } from "./metadata.mjs";
import { validateSentenceLine } from "./sentence.mjs";
import * as coreValidator from "./validators/core.mjs";
import * as coreRouting from "./validators/core-routing.mjs";
import * as coreSources from "./validators/core-sources.mjs";

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
  const identityLines = scanUtf8Lines(file.content).lines
    .filter((line) => line.text.startsWith("> docai-identity:"));
  assert.equal(identityLines.length, 1, `${scenario.id} must retain exactly one identity trailer`);
  file.identityLine = identityLines[0].line;
  return validateDocumentSet(documentSet, { wholeSet: false });
}

export function loadRoutingProvenanceScenario(fixturePath) {
  const source = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const scenario = source.baseScenario === undefined
    ? source
    : {
      ...JSON.parse(fs.readFileSync(
        path.resolve(path.dirname(fixturePath), source.baseScenario),
        "utf8"
      )),
      mutation: source.mutation
    };
  const documentSet = loadDocumentSet(path.resolve(
    path.dirname(fixturePath),
    scenario.documentSet
  ));
  if (scenario.mutation !== undefined) {
    const file = documentSet.files.find((entry) => entry.path === scenario.mutation.path);
    assert.notEqual(file, undefined, `${scenario.mutation.path} must exist in ${scenario.documentSet}`);
    const occurrences = file.content.split(scenario.mutation.replace.from).length - 1;
    assert.equal(occurrences, 1, `${scenario.mutation.path} replacement source must occur exactly once`);
    file.content = file.content.replace(
      scenario.mutation.replace.from,
      scenario.mutation.replace.to
    );
    const metadata = parseOpeningMetadata({
      text: file.content.split("\n", 1)[0],
      file: file.path,
      line: file.metadataLine
    });
    assert.deepEqual(metadata.diagnostics, [], `${scenario.mutation.path} mutated metadata`);
    file.metadata = metadata.value;
  }
  return { documentSet, scenario };
}

export function loadSourceShardProvenanceScenario(fixturePath) {
  const source = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const scenario = source.baseScenario === undefined
    ? source
    : {
      ...JSON.parse(fs.readFileSync(
        path.resolve(path.dirname(fixturePath), source.baseScenario),
        "utf8"
      )),
      mutation: source.mutation
    };
  const documentSet = loadDocumentSet(path.resolve(
    path.dirname(fixturePath),
    scenario.documentSet
  ));
  if (scenario.mutation !== undefined) {
    const file = documentSet.files.find((entry) => entry.path === scenario.mutation.path);
    assert.notEqual(file, undefined, `${scenario.mutation.path} must exist`);
    const occurrences = file.content.split(scenario.mutation.replace.from).length - 1;
    assert.equal(occurrences, 1, `${scenario.mutation.path} replacement source must occur exactly once`);
    file.content = file.content.replace(
      scenario.mutation.replace.from,
      scenario.mutation.replace.to
    );
    const metadata = parseOpeningMetadata({
      text: file.content.split("\n", 1)[0],
      file: file.path,
      line: file.metadataLine
    });
    assert.deepEqual(metadata.diagnostics, [], `${scenario.mutation.path} mutated metadata`);
    file.metadata = metadata.value;
  }
  return { documentSet, scenario };
}

export function validateCoreFixtureCase(fixturePath, fixtureCase) {
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
  if (fixtureCase.kind === "source-api-identity-scenario") {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return coreValidator.validateSourceApiIdentityExpectations(
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "routing-provenance-source-scenario") {
    const { documentSet, scenario } = loadRoutingProvenanceScenario(fixturePath);
    const validation = validateDocumentSet(documentSet, {
      wholeSet: scenario.mutation === undefined
    });
    assert.deepEqual(validation.diagnostics, [], `${fixtureCase.id} document set`);
    return coreRouting.validateRoutingProvenanceExpectations(
      documentSet,
      validation.facts.core,
      scenario,
      { file: fixtureCase.path }
    );
  }
  if (fixtureCase.kind === "source-shard-provenance-scenario") {
    const { documentSet, scenario } = loadSourceShardProvenanceScenario(fixturePath);
    const validation = validateDocumentSet(documentSet, { wholeSet: false });
    assert.deepEqual(validation.diagnostics, [], `${fixtureCase.id} document set`);
    return coreSources.validateSourceShardProvenanceExpectations(
      documentSet,
      validation.facts.core,
      scenario,
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
  const scenarioValidators = {
    "schema-field-source-scenario": coreValidator.validateSchemaFieldSourceExpectations,
    "schema-example-source-scenario": coreValidator.validateSchemaExampleSourceExpectations,
    "partial-collection-source-scenario": coreValidator.validatePartialCollectionSourceExpectations,
    "message-selection-source-scenario": coreValidator.validateMessageSelectionSourceExpectations,
    "adapter-source-scenario": coreValidator.validateAdapterSourceExpectations,
    "adapter-publication-source-scenario": coreValidator.validateAdapterPublicationExpectations,
    "payload-media-identity-source-scenario": coreValidator.validatePayloadMediaIdentityExpectations,
    "trust-boundary-source-scenario": coreValidator.validateTrustBoundarySourceExpectations,
    "publication-safety-source-scenario": coreValidator.validatePublicationSafetySourceExpectations,
    "language-structure-source-scenario": coreValidator.validateLanguageStructureSourceExpectations
  };
  if (scenarioValidators[fixtureCase.kind] !== undefined) {
    const scenario = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    return scenarioValidators[fixtureCase.kind](scenario, { file: fixtureCase.path });
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
