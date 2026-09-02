import { diagnostic } from "../diagnostics.mjs";
import { isDeepStrictEqual } from "node:util";
import { compareExactJsonNumbers, parseExactJson } from "../json-value.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { canonicalizeMediaType } from "../media-type.mjs";
import { parseDocsPath } from "../paths.mjs";
import { validateCoreConventions, validateCoreFormatCatalog } from "./core-conventions.mjs";
import { validateCoreMessages } from "./core-messages.mjs";
import { validateCoreOperations } from "./core-operations.mjs";
import { validateCoreRouting, validateCoreUnprojected } from "./core-routing.mjs";
import { validateCoreSources } from "./core-sources.mjs";

function indexDiagnostic(ruleId, root, line, message) {
  return diagnostic(ruleId, root.path, line, message);
}

function validateProfileLink(root, markdown) {
  if (root.metadata === null) return { diagnostics: [], profileLink: null };

  const firstHeadingLine = markdown.headings[0]?.line ?? root.identityLine ?? Number.MAX_SAFE_INTEGER;
  const prelude = markdown.lines.filter((entry) => (
    entry.line > root.metadataLine
      && entry.line < firstHeadingLine
      && entry.text !== ""
  ));
  const fullProfile = root.metadata.profile === "full";
  const expectedLabel = fullProfile ? "Compact set:" : "Full set:";
  const required = !fullProfile;

  if (prelude.length === 0 && !required) return { diagnostics: [], profileLink: null };
  if (prelude.length !== 1 || !prelude[0].text.startsWith(`${expectedLabel} `)) {
    return {
      diagnostics: [indexDiagnostic(
        "DM-IDX-002",
        root,
        prelude[0]?.line ?? root.metadataLine + 1,
        fullProfile
          ? "A full root INDEX may contain only one optional 'Compact set:' profile link before its title."
          : "A non-full root INDEX requires exactly one 'Full set:' profile link before its title."
      )],
      profileLink: null
    };
  }

  const linkLine = prelude[0];
  const pathSource = linkLine.text.slice(expectedLabel.length + 1);
  const parsed = parseDocsPath({ text: pathSource, file: root.path, line: linkLine.line });
  if (parsed.value === null || parsed.value.kind !== "profile-link") {
    return {
      diagnostics: [indexDiagnostic(
        "DM-IDX-002",
        root,
        linkLine.line,
        `${expectedLabel} must use the profile-link relative-directory grammar.`
      )],
      profileLink: null
    };
  }
  return { diagnostics: [], profileLink: parsed.value.path };
}

function validateRootStructure(root, markdown) {
  const headings = markdown.headings.filter((heading) => heading.level <= 2);
  const firstHeading = markdown.headings[0];
  const titleIsFirstHeading = firstHeading?.level === 1 && firstHeading.text === "Messaging Index";
  const titleBodyLine = titleIsFirstHeading && headings[1] !== undefined
    ? markdown.lines.find((entry) => (
      entry.line > firstHeading.line
        && entry.line < headings[1].line
        && entry.text !== ""
    ))
    : undefined;
  const operationHeading = headings[2]?.text;
  const operationIsValid = operationHeading === "Operations" || operationHeading === "Operation Shards";
  const hasUnprojected = headings.length === 5 && headings[4]?.text === "Unprojected Operations";
  const valid = titleIsFirstHeading
    && titleBodyLine === undefined
    && headings[0]?.level === 1
    && headings[0]?.text === "Messaging Index"
    && headings[1]?.level === 2
    && headings[1]?.text === "Sources"
    && headings[2]?.level === 2
    && operationIsValid
    && headings[3]?.level === 2
    && headings[3]?.text === "Workflows"
    && (headings.length === 4 || hasUnprojected);

  if (!valid) {
    const expected = "# Messaging Index, ## Sources, exactly one of ## Operations or ## Operation Shards, ## Workflows, then optional ## Unprojected Operations";
    const observed = markdown.headings.length === 0
      ? "none"
      : markdown.headings.map((heading) => `${"#".repeat(heading.level)} ${heading.text}`).join(" -> ");
    const structuralMismatch = headings.find((heading, index) => {
      if (index === 0) return heading.level !== 1 || heading.text !== "Messaging Index";
      if (index === 1) return heading.level !== 2 || heading.text !== "Sources";
      if (index === 2) return heading.level !== 2 || !["Operations", "Operation Shards"].includes(heading.text);
      if (index === 3) return heading.level !== 2 || heading.text !== "Workflows";
      if (index === 4) return heading.level !== 2 || heading.text !== "Unprojected Operations";
      return true;
    });
    const mismatch = titleIsFirstHeading
      ? [titleBodyLine, structuralMismatch]
        .filter((entry) => entry !== undefined)
        .sort((left, right) => left.line - right.line)[0]
      : firstHeading;
    return {
      diagnostics: [indexDiagnostic(
        "DM-IDX-001",
        root,
        mismatch?.line ?? root.identityLine ?? 1,
        `Root INDEX headings must be ordered as ${expected}; observed ${observed}.`
      )],
      operationRouting: null,
      hasUnprojected: false
    };
  }

  return {
    diagnostics: [],
    operationRouting: operationHeading === "Operations" ? "flat" : "sharded",
    hasUnprojected
  };
}

function incompleteMarkers(file, { excludedLines = new Set() } = {}) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return { unknown: false, unsupported: false };
  const eligible = (line) => !line.inFence && !excludedLines.has(line.line);
  return {
    unknown: scanned.value.lines.some((line) => (
      eligible(line) && line.text.startsWith("**unknown**: ")
    )),
    unsupported: scanned.value.lines.some((line) => (
      eligible(line) && line.text.startsWith("**unsupported**: ")
    ))
  };
}

function unprojectedMarkerLinesByPath(coreFacts) {
  const linesByPath = new Map();
  for (const group of coreFacts?.unprojectedOperations?.groups ?? []) {
    for (const marker of group.markers ?? []) {
      if (typeof marker.indexPath !== "string" || !Number.isInteger(marker.line)) continue;
      if (!linesByPath.has(marker.indexPath)) linesByPath.set(marker.indexPath, new Set());
      linesByPath.get(marker.indexPath).add(marker.line);
    }
  }
  return linesByPath;
}

function validateIncompleteMetadata(documentSet, root) {
  const markersByPath = new Map(documentSet.files.map((file) => [file.path, incompleteMarkers(file)]));
  const aggregate = {
    unknown: [...markersByPath.values()].some((entry) => entry.unknown),
    unsupported: [...markersByPath.values()].some((entry) => entry.unsupported)
  };
  const diagnostics = [];
  for (const file of documentSet.files) {
    if (file.metadata === null) continue;
    const markers = file.path === root.path ? aggregate : markersByPath.get(file.path);
    const expectedCoverage = markers.unsupported ? "requires-source" : "complete";
    const expectedKnowledge = markers.unknown ? "requires-input" : "complete";
    if (file.metadata.coverage !== expectedCoverage || file.metadata.knowledge !== expectedKnowledge) {
      diagnostics.push(diagnostic(
        "DM-INC-002",
        file.path,
        file.metadataLine,
        `File coverage and knowledge must be '${expectedCoverage}' and '${expectedKnowledge}' for its effective unknown and unsupported markers.`
      ));
    }
  }
  return diagnostics;
}

export function validateCoreDocumentSet(documentSet) {
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  const facts = {
    profileLink: null,
    operationRouting: null,
    hasUnprojectedOperations: false,
    sources: null,
    sourceResolutions: {},
    operations: null,
    operationRetrieval: null,
    unprojectedOperations: null,
    unprojectedRetrieval: null,
    conventions: null,
    formats: null,
    operationDefinitions: null,
    messageDefinitions: null,
    failureShapes: null
  };
  if (root === undefined) return { diagnostics: [], facts };

  const scanned = scanMarkdown({ text: root.content, file: root.path });
  if (scanned.value === null) return { diagnostics: scanned.diagnostics, facts };

  const incompleteMetadataDiagnostics = validateIncompleteMetadata(documentSet, root);

  const profile = validateProfileLink(root, scanned.value);
  const structure = validateRootStructure(root, scanned.value);
  facts.profileLink = profile.profileLink;
  facts.operationRouting = structure.operationRouting;
  facts.hasUnprojectedOperations = structure.hasUnprojected;
  const sources = structure.diagnostics.length === 0
    ? validateCoreSources(documentSet, root, scanned.value)
    : { diagnostics: [], facts: { sources: null, sourceResolutions: {} } };
  facts.sources = sources.facts.sources;
  facts.sourceResolutions = sources.facts.sourceResolutions;
  const routing = structure.diagnostics.length === 0
    ? validateCoreRouting(documentSet, root, scanned.value, sources.facts)
    : { diagnostics: [], facts: { operations: null, operationRetrieval: null } };
  facts.operations = routing.facts.operations;
  facts.operationRetrieval = routing.facts.operationRetrieval;
  const unprojected = structure.diagnostics.length === 0
    ? validateCoreUnprojected(documentSet, root, scanned.value, sources.facts)
    : { diagnostics: [], facts: { unprojectedOperations: null, unprojectedRetrieval: null } };
  facts.unprojectedOperations = unprojected.facts.unprojectedOperations;
  facts.unprojectedRetrieval = unprojected.facts.unprojectedRetrieval;
  const conventions = validateCoreConventions(documentSet);
  facts.conventions = conventions.facts.conventions;
  const operationDefinitions = structure.diagnostics.length === 0 && routing.diagnostics.length === 0
    ? validateCoreOperations(documentSet, routing.facts)
    : { diagnostics: [], facts: { operationDefinitions: null } };
  facts.operationDefinitions = operationDefinitions.facts.operationDefinitions;
  const messages = structure.diagnostics.length === 0
    && routing.diagnostics.length === 0
    && operationDefinitions.diagnostics.length === 0
    ? validateCoreMessages(documentSet, routing.facts, conventions.facts)
    : { diagnostics: [], facts: { failureShapes: null, messageDefinitions: null } };
  facts.messageDefinitions = messages.facts.messageDefinitions;
  facts.failureShapes = messages.facts.failureShapes;
  const formats = structure.diagnostics.length === 0
    && routing.diagnostics.length === 0
    && conventions.diagnostics.length === 0
    && operationDefinitions.diagnostics.length === 0
    && messages.diagnostics.length === 0
    ? validateCoreFormatCatalog(documentSet, routing.facts, messages.facts)
    : { diagnostics: [], facts: { formats: null } };
  facts.formats = formats.facts.formats;
  return {
    diagnostics: [
      ...profile.diagnostics,
      ...structure.diagnostics,
      ...incompleteMetadataDiagnostics,
      ...sources.diagnostics,
      ...routing.diagnostics,
      ...unprojected.diagnostics,
      ...conventions.diagnostics,
      ...operationDefinitions.diagnostics,
      ...messages.diagnostics,
      ...formats.diagnostics
    ],
    facts
  };
}

export function evaluateIncompleteSourceExpectations(cases) {
  return cases.map((entry) => {
    const inputs = Array.isArray(entry.inputs) ? entry.inputs : [];
    if (inputs.length === 0) {
      return {
        factId: entry.factId,
        outcome: "emit-unknown",
        coverage: "complete",
        knowledge: "requires-input"
      };
    }

    const highestPriority = Math.min(...inputs.map((input) => input.priority));
    const authoritative = inputs.filter((input) => input.priority === highestPriority);
    const signatures = new Set(authoritative.map((input) => (
      input.state === "value" ? `value:${JSON.stringify(input.value)}` : input.state
    )));
    if (signatures.size > 1) {
      return {
        factId: entry.factId,
        outcome: "generation-failure",
        reason: "authoritative-conflict"
      };
    }

    const selected = authoritative[0];
    if (selected.state === "absent") {
      return {
        factId: entry.factId,
        outcome: "emit-none",
        coverage: "complete",
        knowledge: "complete"
      };
    }
    if (selected.state !== "value") {
      return {
        factId: entry.factId,
        outcome: "emit-unknown",
        coverage: "complete",
        knowledge: "requires-input"
      };
    }
    if (entry.representable === false) {
      return {
        factId: entry.factId,
        outcome: "emit-unsupported",
        coverage: "requires-source",
        knowledge: "complete"
      };
    }
    return {
      factId: entry.factId,
      outcome: "emit-expanded",
      value: selected.value,
      coverage: "complete",
      knowledge: "complete"
    };
  });
}

export function evaluateSourceApiIdentityExpectations({ cases }) {
  return cases.map((entry) => {
    if (typeof entry.source?.id === "string" && entry.source.id !== "") {
      return {
        caseId: entry.caseId,
        outcome: "emit-api-identity",
        identity: entry.source.id,
        resolution: "source-id",
        contributingSourceIds: [entry.sourceId]
      };
    }

    const authoritative = (entry.logicalApiIdentityInputs ?? []).filter((input) => (
      input.authoritative === true
        && typeof input.identity === "string"
        && input.identity !== ""
        && typeof input.sourceId === "string"
        && input.sourceId !== ""
        && Number.isFinite(input.priority)
    ));
    if (authoritative.length > 0) {
      const highestPriority = Math.min(...authoritative.map((input) => input.priority));
      const selected = authoritative.filter((input) => input.priority === highestPriority);
      if (new Set(selected.map((input) => input.identity)).size > 1) {
        return {
          caseId: entry.caseId,
          outcome: "generation-failure",
          reason: "authoritative-conflict",
          conflictingSourceIds: selected.map((input) => input.sourceId).sort()
        };
      }
      return {
        caseId: entry.caseId,
        outcome: "emit-api-identity",
        identity: selected[0].identity,
        resolution: "authoritative-input",
        contributingSourceIds: selected.map((input) => input.sourceId).sort()
      };
    }

    return {
      caseId: entry.caseId,
      outcome: "emit-unknown",
      api: "unknown",
      marker: `**unknown**: API identity for source ${entry.sourceId} requires authoritative logical API identity input`,
      knowledge: "requires-input"
    };
  });
}

export function validateSourceApiIdentityExpectations(
  scenario,
  { file = "source-input.json" } = {}
) {
  const expectations = evaluateSourceApiIdentityExpectations(scenario);
  const sources = new Map((scenario.cases ?? []).map((entry) => [entry.caseId, entry]));
  const mismatches = expectations.filter((expected) => (
    !isDeepStrictEqual(expected, sources.get(expected.caseId)?.projected)
  ));
  const failures = expectations.filter((expected) => expected.outcome === "generation-failure");
  return {
    diagnostics: mismatches.length === 0 && failures.length === 0
      ? []
      : [diagnostic(
        "DM-SRC-003",
        file,
        1,
        `Source API identity resolution has ${failures.length} conflict(s) and ${mismatches.length} projection mismatch(es).`
      )],
    facts: { sourceApiIdentityExpectations: expectations }
  };
}

export function evaluatePartialCollectionSourceExpectations(cases) {
  return cases.map((entry) => {
    const namedMembers = Array.isArray(entry.namedMembers) ? entry.namedMembers : [];
    const collection = { collectionId: entry.collectionId };
    if (entry.polymorphic === true || namedMembers.length === 0) {
      if (entry.memberKind === "field") {
        return {
          ...collection,
          form: "representation-local-unknown",
          representation: entry.representation
        };
      }
      return { ...collection, form: "whole-section-unknown" };
    }

    const result = {
      ...collection,
      form: "partial-table",
      retainedNames: [...namedMembers],
      marker: `additional unnamed ${entry.memberKind}`
    };
    if (entry.memberKind === "field") {
      if (entry.exampleFaithful === false) result.canonicalExample = "omit";
      result.representation = entry.representation;
    }
    return result;
  });
}

export function validatePartialCollectionSourceExpectations(
  scenario,
  { file = "source-input.json" } = {}
) {
  const cases = scenario.cases ?? [];
  const expectations = evaluatePartialCollectionSourceExpectations(cases);
  const mismatches = expectations.flatMap((expected, index) => {
    if (isDeepStrictEqual(expected, cases[index]?.projected)) return [];
    return [{
      ruleId: expected.form === "partial-table" ? "DM-INC-004" : "DM-INC-005"
    }];
  });
  const ruleIds = [...new Set(mismatches.map((entry) => entry.ruleId))];
  return {
    diagnostics: ruleIds.map((ruleId) => diagnostic(
      ruleId,
      file,
      1,
      `Partial collection projection disagrees with ${mismatches.filter((entry) => entry.ruleId === ruleId).length} exact source expectation(s).`
    )),
    facts: { partialCollectionSourceExpectations: expectations }
  };
}

const JSON_SCHEMA_DRAFT_07_FORMATS = new Set([
  "date-time", "date", "time", "email", "idn-email", "hostname", "idn-hostname",
  "ipv4", "ipv6", "uri", "uri-reference", "iri", "iri-reference", "uri-template",
  "json-pointer", "relative-json-pointer", "regex"
]);

const ASYNCAPI_DEFINED_FORMAT_ROLES = new Map([
  ...["AsyncAPI 3.0.0", "AsyncAPI 3.1.0"].map((version) => [version, new Map([
    ...["int32", "int64", "float", "double", "byte", "binary", "date", "date-time"]
      .map((format) => [format, "constraint"]),
    ["password", "annotation"]
  ])])
]);

function compactExactJsonSource(source) {
  if (typeof source !== "string" || source === "") return { valid: false, value: null };
  let value;
  try { value = parseExactJson(source); } catch { return { valid: false, value: null }; }
  let inString = false;
  let escaped = false;
  for (const character of source) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
    } else if (/\s/u.test(character)) {
      return { valid: false, value: null };
    }
  }
  return { valid: true, value };
}

function constraintFragment(keyword, valueSource) {
  const longest = [...valueSource.matchAll(/`+/g)]
    .reduce((maximum, match) => Math.max(maximum, match[0].length), 0);
  const delimiter = "`".repeat(longest + 1);
  return `${delimiter}${keyword}=${valueSource}${delimiter}`;
}

function schemaFieldSourceExpectation(entry) {
  const parsed = compactExactJsonSource(entry.valueSource);
  if (!parsed.valid) {
    return {
      caseId: entry.caseId,
      coverage: "complete",
      fragment: null,
      requiredBehavior: "generation-failure"
    };
  }
  const { value } = parsed;

  if (entry.keyword === "default") {
    const draft07 = entry.sourceSpecification === "JSON Schema Draft 07";
    const asyncApi = ["AsyncAPI 3.0.0", "AsyncAPI 3.1.0"].includes(entry.sourceSpecification);
    if (!draft07 && !asyncApi) {
      return {
        caseId: entry.caseId,
        coverage: "requires-source",
        fragment: null,
        requiredBehavior: "localized-unsupported"
      };
    }
    const keyword = draft07 ? "default_annotation" : "default";
    let requiredBehavior = "annotation-only";
    if (asyncApi && entry.omissionAllowed === true) {
      requiredBehavior = entry.direction === "RECEIVE"
        ? "receive-effective-value-when-absent"
        : "send-effective-value-when-omitted";
    } else if (asyncApi) {
      requiredBehavior = "requiredness-unchanged";
    }
    return {
      caseId: entry.caseId,
      coverage: "complete",
      fragment: constraintFragment(keyword, entry.valueSource),
      requiredBehavior
    };
  }

  if (entry.keyword === "format" && typeof value === "string") {
    const draft07 = entry.sourceSpecification === "JSON Schema Draft 07";
    const asyncApiRoles = ASYNCAPI_DEFINED_FORMAT_ROLES.get(entry.sourceSpecification);
    const role = draft07 && JSON_SCHEMA_DRAFT_07_FORMATS.has(value)
      ? "annotation"
      : asyncApiRoles?.get(value)
        ?? (asyncApiRoles !== undefined && JSON_SCHEMA_DRAFT_07_FORMATS.has(value) ? "annotation" : null);
    if (role !== null) {
      return {
        caseId: entry.caseId,
        coverage: "complete",
        fragment: constraintFragment(role === "constraint" ? "format" : "format_annotation", entry.valueSource),
        requiredBehavior: `${role}-catalog`
      };
    }
  }

  return {
    caseId: entry.caseId,
    coverage: "requires-source",
    fragment: null,
    requiredBehavior: "localized-unsupported"
  };
}

export function evaluateSchemaFieldSourceExpectations(scenario) {
  return (scenario.cases ?? [])
    .map(schemaFieldSourceExpectation)
    .sort((left, right) => left.caseId < right.caseId ? -1 : left.caseId > right.caseId ? 1 : 0);
}

export function validateSchemaFieldSourceExpectations(scenario, { file = "source-input.json" } = {}) {
  const expectations = evaluateSchemaFieldSourceExpectations(scenario);
  const byCaseId = new Map((scenario.cases ?? []).map((entry) => [entry.caseId, entry]));
  const mismatches = expectations.filter((expected) => {
    const projected = byCaseId.get(expected.caseId)?.projected;
    return projected?.fragment !== expected.fragment
      || projected?.requiredBehavior !== expected.requiredBehavior
      || projected?.localizedUnsupported !== (expected.coverage === "requires-source");
  });
  return {
    diagnostics: mismatches.length === 0
      ? []
      : [diagnostic(
        "DM-MSG-005",
        file,
        1,
        `Schema field projection disagrees with ${mismatches.length} exact default or format expectation(s).`
      )],
    facts: { schemaFieldSourceExpectations: expectations }
  };
}

const NUMERIC_LOWER_BOUNDS = new Set(["minimum", "exclusiveMinimum"]);
const NUMERIC_UPPER_BOUNDS = new Set(["maximum", "exclusiveMaximum"]);
const NUMERIC_SCHEMA_TYPES = new Set(["integer", "number"]);

function sourceSchemaProvablyEmpty(sourceSchema) {
  if (!NUMERIC_SCHEMA_TYPES.has(sourceSchema?.type)
    || sourceSchema?.nullable === true
    || !Array.isArray(sourceSchema?.constraints)) return false;
  const constraints = sourceSchema.constraints.flatMap((constraint) => {
    if (typeof constraint?.keyword !== "string" || typeof constraint?.valueSource !== "string") return [];
    try {
      return [{ keyword: constraint.keyword, value: parseExactJson(constraint.valueSource) }];
    } catch {
      return [];
    }
  });
  const lower = constraints.filter((constraint) => NUMERIC_LOWER_BOUNDS.has(constraint.keyword));
  const upper = constraints.filter((constraint) => NUMERIC_UPPER_BOUNDS.has(constraint.keyword));
  for (const minimum of lower) {
    for (const maximum of upper) {
      const comparison = compareExactJsonNumbers(minimum.value, maximum.value);
      if (comparison > 0 || (comparison === 0
        && (minimum.keyword === "exclusiveMinimum" || maximum.keyword === "exclusiveMaximum"))) {
        return true;
      }
    }
  }
  return false;
}

function schemaExampleSourceExpectation(entry) {
  if (sourceSchemaProvablyEmpty(entry.sourceSchema)) {
    if (typeof entry.sourceExampleSource === "string") {
      return {
        caseId: entry.caseId,
        outcome: "generation-failure",
        reason: "authoritative-conflict",
        replacement: null
      };
    }
    if (typeof entry.sourceLocation !== "string" || entry.sourceLocation.length === 0) {
      return {
        caseId: entry.caseId,
        outcome: "generation-failure",
        reason: "publication-safe-source-location-unavailable",
        replacement: null
      };
    }
    const mediaType = String(entry.mediaType);
    return {
      caseId: entry.caseId,
      outcome: "replacement-unsupported",
      reason: "provably-empty-supported-schema",
      replacement: `**unsupported**: replaces payload representation ${entry.messageName} ${Buffer.byteLength(mediaType, "utf8")}:${mediaType}: effective supported schema permits no valid decoded instance at ${entry.sourceLocation}`
    };
  }
  const capabilities = entry.generatorCapabilities ?? {};
  if (typeof entry.sourceExampleSource !== "string" && capabilities.produceExample !== true) {
    return {
      caseId: entry.caseId,
      outcome: "generation-failure",
      reason: "generator-example-production-capability-unavailable",
      replacement: null
    };
  }
  if (capabilities.validateExample !== true) {
    return {
      caseId: entry.caseId,
      outcome: "generation-failure",
      reason: "generator-example-validation-capability-unavailable",
      replacement: null
    };
  }
  return {
    caseId: entry.caseId,
    outcome: "example-ready",
    reason: null,
    replacement: null
  };
}

export function evaluateSchemaExampleSourceExpectations(scenario) {
  return (scenario.cases ?? [])
    .map(schemaExampleSourceExpectation)
    .sort((left, right) => left.caseId < right.caseId ? -1 : left.caseId > right.caseId ? 1 : 0);
}

export function validateSchemaExampleSourceExpectations(scenario, { file = "source-input.json" } = {}) {
  const expectations = evaluateSchemaExampleSourceExpectations(scenario);
  const byCaseId = new Map((scenario.cases ?? []).map((entry) => [entry.caseId, entry]));
  const mismatches = expectations.filter((expected) => {
    const projected = byCaseId.get(expected.caseId)?.projected;
    return !isDeepStrictEqual(projected, {
      outcome: expected.outcome,
      reason: expected.reason,
      replacement: expected.replacement
    });
  });
  return {
    diagnostics: mismatches.length === 0
      ? []
      : [diagnostic(
        "DM-MSG-005",
        file,
        1,
        `Schema example projection disagrees with ${mismatches.length} satisfiability or generator-capability expectation(s).`
      )],
    facts: { schemaExampleSourceExpectations: expectations }
  };
}

export function evaluateSelectedOperationReadiness(documentSet, coreFacts, selection) {
  const row = coreFacts.operations?.rows?.find((entry) => entry.operation === selection.operation);
  if (row === undefined) {
    return {
      operation: selection.operation,
      ready: false,
      selectedPaths: ["CONVENTIONS.md", "INDEX.md"],
      blockingMarkers: []
    };
  }
  const selectedPaths = [...new Set([
    "CONVENTIONS.md",
    "INDEX.md",
    row.channelPath,
    ...(row.requiredContexts ?? [])
  ])].sort();
  const unprojectedMarkerLines = unprojectedMarkerLinesByPath(coreFacts);
  const blockingMarkers = [];
  for (const selectedPath of selectedPaths) {
    const file = documentSet.files.find((entry) => entry.path === selectedPath);
    if (file === undefined) continue;
    const markers = incompleteMarkers(file, {
      excludedLines: unprojectedMarkerLines.get(selectedPath) ?? new Set()
    });
    if (markers.unknown) blockingMarkers.push({ kind: "unknown", path: selectedPath });
    if (markers.unsupported) blockingMarkers.push({ kind: "unsupported", path: selectedPath });
  }
  return {
    operation: selection.operation,
    ready: blockingMarkers.length === 0,
    selectedPaths,
    blockingMarkers
  };
}

function capabilitySet(values) {
  return new Set(Array.isArray(values) ? values.filter((value) => typeof value === "string") : []);
}

function requirementsForTask(requirements, trustedTask) {
  return (Array.isArray(requirements) ? requirements : []).filter((requirement) => (
    typeof requirement?.id === "string"
      && (requirement.tasks === undefined
        || (Array.isArray(requirement.tasks) && requirement.tasks.includes(trustedTask)))
  ));
}

function addMissingCapabilityBlockers(blockers, prefix, requirements, supported) {
  for (const requirement of requirements) {
    if (!supported.has(requirement.id)) blockers.push(`${prefix}:${requirement.id}`);
  }
}

function addMissingRequiredContextStructureBlockers(blockers, operationRow, supported) {
  if (supported.has("workflow")) return;
  for (const contextPath of operationRow?.requiredContexts ?? []) {
    blockers.push(`structure:workflow:${contextPath}`);
  }
}

export function evaluateImplementationReadinessExpectations(
  documentSet,
  coreFacts,
  scenario
) {
  const selection = scenario.selection ?? {};
  const contract = scenario.contract ?? {};
  const root = documentSet.files.find((entry) => entry.path === "INDEX.md");
  const rootVersion = root?.metadata?.["docai-messaging"] ?? contract.docaiMessagingVersion;
  const rootProfile = root?.metadata?.profile ?? contract.profile;
  const selected = evaluateSelectedOperationReadiness(documentSet, coreFacts, {
    operation: selection.operation
  });
  const operationRow = coreFacts.operations?.rows?.find(
    (entry) => entry.operation === selection.operation
  );
  const trustedTask = selection.trustedTask;
  const requiredStructures = requirementsForTask(contract.requiredStructures, trustedTask);
  const requiredRuntimeCapabilities = requirementsForTask(
    contract.requiredRuntimeCapabilities,
    trustedTask
  );
  const requiredSourceAdapters = requirementsForTask(
    contract.requiredSourceAdapters,
    trustedTask
  );

  return (Array.isArray(scenario.cases) ? scenario.cases : [])
    .map((entry) => {
      const reader = entry.reader ?? {};
      const readerMode = reader.mode === "source-aware" ? "source-aware" : "ordinary";
      const readerStructures = capabilitySet(reader.structures);
      const blockers = selected.blockingMarkers.map(
        (marker) => `marker:${marker.kind}:${marker.path}`
      );
      if (operationRow === undefined) blockers.push(`operation:${selection.operation}`);
      if (!operationRow?.tasks?.includes(trustedTask)) blockers.push(`trusted-task:${trustedTask}`);
      if (!capabilitySet(reader.docaiMessagingVersions).has(rootVersion)) {
        blockers.push(`docai-messaging-version:${rootVersion}`);
      }
      if (!capabilitySet(reader.profiles).has(rootProfile)) {
        blockers.push(`profile:${rootProfile}`);
      }
      if (!capabilitySet(reader.publicationScopes).has(contract.publicationScope)) {
        blockers.push(`publication-scope:${contract.publicationScope}`);
      }
      addMissingCapabilityBlockers(
        blockers,
        "structure",
        requiredStructures,
        readerStructures
      );
      addMissingRequiredContextStructureBlockers(
        blockers,
        operationRow,
        readerStructures
      );
      addMissingCapabilityBlockers(
        blockers,
        "runtime-capability",
        requiredRuntimeCapabilities,
        capabilitySet(entry.targetRuntimeCapabilities)
      );
      if (readerMode === "source-aware") {
        addMissingCapabilityBlockers(
          blockers,
          "source-adapter",
          requiredSourceAdapters,
          capabilitySet(entry.sourceAdapters)
        );
      }
      blockers.sort();
      return {
        caseId: entry.caseId,
        readerMode,
        operation: selection.operation,
        trustedTask,
        ready: blockers.length === 0,
        blockers
      };
    })
    .sort((left, right) => left.caseId < right.caseId ? -1 : left.caseId > right.caseId ? 1 : 0);
}

export function validateImplementationReadinessExpectations(
  documentSet,
  coreFacts,
  scenario,
  { file = "source-input.json" } = {}
) {
  const expectations = evaluateImplementationReadinessExpectations(
    documentSet,
    coreFacts,
    scenario
  );
  const cases = new Map((scenario.cases ?? []).map((entry) => [entry.caseId, entry]));
  const mismatches = expectations.filter((expected) => {
    const projected = cases.get(expected.caseId)?.projected;
    return projected?.ready !== expected.ready
      || !sameStringArray(projected?.blockers, expected.blockers);
  });
  return {
    diagnostics: mismatches.length === 0
      ? []
      : [diagnostic(
        "DM-INC-003",
        file,
        1,
        `Projected readiness disagrees with ${mismatches.length} reader, task, runtime, or adapter capability expectation(s).`
      )],
    facts: { implementationReadinessExpectations: expectations }
  };
}

const COUNTERPART_COVERAGE = [
  ["serverEnvironmentAndBindings", "server-environment-and-bindings"],
  ["authorization", "authorization"],
  ["purposeAndBehavior", "purpose-and-behavior"],
  ["messageApplicability", "message-applicability"]
];

function counterpartMissing(mapping) {
  const missing = [];
  if (!["SEND", "RECEIVE"].includes(mapping.target?.action)) missing.push("action");
  if (typeof mapping.target?.channel !== "string" || mapping.target.channel === "") {
    missing.push("channel-address");
  }
  for (const [key, label] of COUNTERPART_COVERAGE) {
    if (!["confirmed-shared", "replaced"].includes(mapping.coverage?.[key])) missing.push(label);
  }
  if (!Array.isArray(mapping.target?.primaryMessages)
    || mapping.target.primaryMessages.length === 0) {
    if (!missing.includes("message-applicability")) missing.push("message-applicability");
  }
  return missing;
}

function counterpartSignature(mapping) {
  return JSON.stringify({ target: mapping.target, coverage: mapping.coverage });
}

export function evaluatePerspectiveSourceExpectations(cases) {
  return cases.map((entry) => {
    if (entry.perspective === entry.sourceApplication) {
      return {
        caseId: entry.caseId,
        outcome: "emit-operation",
        resolution: "source-application-carry-through",
        action: String(entry.sourceOperation.action).toUpperCase(),
        channel: entry.sourceOperation.channel,
        primaryMessages: [...entry.sourceOperation.primaryMessages]
      };
    }

    const applicable = (entry.counterpartMappings ?? []).filter((mapping) => (
      mapping.sourceOperationId === entry.sourceOperation.id
        && mapping.targetApplication === entry.perspective
    ));
    if (applicable.length === 0) {
      return {
        caseId: entry.caseId,
        outcome: "emit-unprojected-unknown",
        reason: "counterpart mapping",
        knowledge: "requires-input"
      };
    }

    const highestPriority = Math.min(...applicable.map((mapping) => mapping.priority));
    const authoritative = applicable.filter((mapping) => mapping.priority === highestPriority);
    if (new Set(authoritative.map(counterpartSignature)).size > 1) {
      return {
        caseId: entry.caseId,
        outcome: "generation-failure",
        reason: "authoritative-conflict",
        conflictingSourceIds: authoritative.map((mapping) => mapping.sourceId).sort()
      };
    }

    const selected = authoritative[0];
    const missing = counterpartMissing(selected);
    if (missing.length > 0) {
      return {
        caseId: entry.caseId,
        outcome: "emit-unprojected-unknown",
        reason: "incomplete counterpart mapping",
        missing,
        knowledge: "requires-input"
      };
    }

    const result = {
      caseId: entry.caseId,
      outcome: "emit-operation",
      resolution: "authoritative-counterpart",
      action: selected.target.action,
      channel: selected.target.channel,
      primaryMessages: [...selected.target.primaryMessages]
    };
    if (Array.isArray(selected.target.replyMessages)) {
      result.replyMessages = [...selected.target.replyMessages];
    }
    result.contributingSourceIds = authoritative.map((mapping) => mapping.sourceId).sort();
    return result;
  });
}

export function validatePerspectiveSourceExpectations(cases, { file = "source-input.json" } = {}) {
  const expectations = evaluatePerspectiveSourceExpectations(cases);
  const failures = expectations.filter((entry) => entry.outcome === "generation-failure");
  const diagnostics = failures.length === 0
    ? []
    : [diagnostic(
      "DM-INC-001",
      file,
      1,
      `Perspective source inputs contain ${failures.length} unresolved authoritative conflict(s).`
    )];
  return {
    diagnostics,
    facts: { perspectiveSourceExpectations: expectations }
  };
}

function localReferenceSegments(reference) {
  if (typeof reference?.$ref !== "string" || !reference.$ref.startsWith("#/")) return [];
  return reference.$ref.slice(2).split("/").map((segment) => (
    segment.replaceAll("~1", "/").replaceAll("~0", "~")
  ));
}

export function evaluateAsyncApiOperationMessageSelection(source) {
  const operations = Object.entries(source.operations ?? {})
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([operationId, operation]) => {
      const channelSegments = localReferenceSegments(operation.channel);
      const channelId = channelSegments.length === 2 && channelSegments[0] === "channels"
        ? channelSegments[1]
        : null;
      const channelMessages = Object.keys(source.channels?.[channelId]?.messages ?? {}).sort();
      const explicit = Object.hasOwn(operation, "messages");
      const primaryMessages = explicit
        ? (operation.messages ?? []).map((reference) => {
          const segments = localReferenceSegments(reference);
          return segments.length === 4
              && segments[0] === "channels"
              && segments[1] === channelId
              && segments[2] === "messages"
            ? segments[3]
            : null;
        })
        : channelMessages;
      if (primaryMessages.length === 0) {
        return {
          operationId,
          outcome: "emit-unprojected-unsupported",
          reason: "zero-message operation",
          selection: explicit ? "explicit-empty" : "omitted-empty-channel",
          channelId,
          primaryMessages
        };
      }
      return {
        operationId,
        outcome: "emit-operation",
        resolution: explicit ? "explicit-non-empty" : "omitted-all-channel-messages",
        channelId,
        primaryMessages
      };
    });
  return {
    sourceSpecification: `AsyncAPI ${source.asyncapi}`,
    operations
  };
}

export function validateAsyncApiOperationMessageSelection(source, { file = "source-input.json" } = {}) {
  const selection = evaluateAsyncApiOperationMessageSelection(source);
  const zeroMessageOperations = selection.operations.filter((entry) => (
    entry.outcome === "emit-unprojected-unsupported"
  ));
  const diagnostics = zeroMessageOperations.length === 0
    ? []
    : [diagnostic(
      "DM-IDX-008",
      file,
      1,
      `AsyncAPI source contains ${zeroMessageOperations.length} known zero-message operation(s).`
    )];
  return {
    diagnostics,
    facts: { asyncApiOperationMessageSelection: selection }
  };
}

function authoritativeReplyMessageEntry(source, reference) {
  const segments = localReferenceSegments({ $ref: reference });
  if (segments.length === 4 && segments[0] === "channels" && segments[2] === "messages") {
    const channelId = segments[1];
    const messageId = segments[3];
    const messages = source.channels?.[channelId]?.messages ?? {};
    return Object.hasOwn(messages, messageId)
      ? { channelId, messageId, value: messages[messageId] }
      : null;
  }
  if (segments.length === 3 && segments[0] === "components" && segments[1] === "messages") {
    const messageId = segments[2];
    const messages = source.components?.messages ?? {};
    return Object.hasOwn(messages, messageId)
      ? { channelId: null, messageId, value: messages[messageId] }
      : null;
  }
  return null;
}

function resolveAuthoritativeReplyMessage(source, reference, seen = new Set()) {
  if (typeof reference !== "string" || seen.has(reference)) return null;
  const entry = authoritativeReplyMessageEntry(source, reference);
  if (entry === null || entry.value === null || typeof entry.value !== "object"
    || Array.isArray(entry.value)) {
    return null;
  }
  if (Object.hasOwn(entry.value, "$ref")) {
    if (typeof entry.value.$ref !== "string") return null;
    const nextSeen = new Set(seen);
    nextSeen.add(reference);
    if (resolveAuthoritativeReplyMessage(source, entry.value.$ref, nextSeen) === null) return null;
  }
  return { channelId: entry.channelId, messageId: entry.messageId };
}

function authoritativeReplySelectionOutcome(source, operationId, channelId, selection) {
  const selectedIdentities = Array.isArray(selection.selectedIdentities)
    ? selection.selectedIdentities
    : [];
  if (selectedIdentities.length === 0) {
    return {
      operationId,
      outcome: "emit-whole-reply-unsupported",
      reason: "zero-message reply",
      selection: "authoritative-empty",
      selectionSourceId: selection.sourceId,
      channelId,
      replyMessages: [],
      indexReplyEntries: [],
      primaryOperationRetained: true
    };
  }

  const identityNames = selectedIdentities.map((entry) => entry?.identity);
  let invalidReason = identityNames.every((identity) => (
    typeof identity === "string" && identity.length > 0
  ))
    ? null
    : "unresolved-selected-identity";
  if (invalidReason === null && new Set(identityNames).size !== identityNames.length) {
    invalidReason = "duplicate-selected-identity";
  }
  const resolved = [];
  const selectedReferences = new Set();
  for (const identity of selectedIdentities) {
    if (invalidReason !== null) break;
    const references = Array.isArray(identity.sourceMessageRefs)
      ? identity.sourceMessageRefs
      : [];
    if (references.length === 0) {
      invalidReason = "unresolved-selected-identity";
      break;
    }
    if (references.length > 1) {
      invalidReason = "ambiguous-selected-identity";
      break;
    }
    const reference = references[0];
    const message = resolveAuthoritativeReplyMessage(source, reference);
    if (message === null) {
      invalidReason = "unresolved-selected-identity";
      break;
    }
    const inScope = channelId === null
      ? identity.applicableToReply === true
      : message.channelId === channelId;
    if (!inScope) {
      invalidReason = "out-of-scope-selected-identity";
      break;
    }
    if (selectedReferences.has(reference)) {
      invalidReason = "duplicate-selected-identity";
      break;
    }
    selectedReferences.add(reference);
    resolved.push(message.messageId);
  }

  if (invalidReason !== null) {
    return {
      operationId,
      outcome: "generation-failure",
      reason: invalidReason,
      selection: "authoritative-invalid",
      selectionSourceId: selection.sourceId,
      channelId,
      replyMessages: [],
      indexReplyEntries: []
    };
  }

  const replyMessages = resolved.sort();
  return {
    operationId,
    outcome: "emit-expanded-reply",
    resolution: "authoritative-non-empty",
    selectionSourceId: selection.sourceId,
    channelId,
    replyMessages,
    indexReplyEntries: replyMessages.map((name) => `reply:${name}`),
    primaryOperationRetained: true
  };
}

export function evaluateAsyncApiReplyMessageSelection(source, authoritativeSelections = []) {
  const projectedOperationIds = evaluateAsyncApiOperationMessageSelection(source).operations
    .filter((entry) => entry.outcome === "emit-operation")
    .map((entry) => entry.operationId);
  const replyOperations = Object.entries(source.operations ?? {})
    .filter(([, operation]) => operation.reply !== undefined);
  const replyOperationIds = new Set(replyOperations.map(([operationId]) => operationId));
  const authoritativeByOperation = new Map();
  for (const selection of authoritativeSelections) {
    const selections = authoritativeByOperation.get(selection.targetOperationId) ?? [];
    selections.push(selection);
    authoritativeByOperation.set(selection.targetOperationId, selections);
  }
  const selectionInputFailures = [...authoritativeByOperation.keys()]
    .filter((targetOperationId) => !replyOperationIds.has(targetOperationId))
    .sort()
    .map((operationId) => ({
      operationId,
      reason: "unmatched-authoritative-selection-target"
    }));
  const operations = replyOperations
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([operationId, operation]) => {
      const channelSegments = localReferenceSegments(operation.reply.channel);
      const channelId = channelSegments.length === 2 && channelSegments[0] === "channels"
        ? channelSegments[1]
        : null;
      const candidateMessages = Object.keys(source.channels?.[channelId]?.messages ?? {}).sort();
      const authoritativeForOperation = authoritativeByOperation.get(operationId) ?? [];
      if (authoritativeForOperation.length > 1) {
        return {
          operationId,
          outcome: "generation-failure",
          reason: "duplicate-authoritative-selection-target",
          selection: "authoritative-invalid",
          channelId,
          replyMessages: [],
          indexReplyEntries: []
        };
      }
      const explicit = Object.hasOwn(operation.reply, "messages");
      if (!explicit) {
        if (authoritativeForOperation.length === 1) {
          return authoritativeReplySelectionOutcome(
            source,
            operationId,
            channelId,
            authoritativeForOperation[0]
          );
        }
        return {
          operationId,
          outcome: "emit-whole-reply-unknown",
          reason: "reply message set",
          selection: "omitted",
          channelId,
          candidateMessages,
          replyMessages: [],
          indexReplyEntries: [],
          primaryOperationRetained: true
        };
      }
      const replyMessages = (operation.reply.messages ?? []).map((reference) => {
        const segments = localReferenceSegments(reference);
        return segments.length === 4
            && segments[0] === "channels"
            && segments[1] === channelId
            && segments[2] === "messages"
          ? segments[3]
          : null;
      });
      if (replyMessages.length === 0) {
        return {
          operationId,
          outcome: "emit-whole-reply-unsupported",
          reason: "zero-message reply",
          selection: "explicit-empty",
          channelId,
          replyMessages,
          indexReplyEntries: [],
          primaryOperationRetained: true
        };
      }
      return {
        operationId,
        outcome: "emit-expanded-reply",
        resolution: "explicit-non-empty",
        channelId,
        replyMessages,
        indexReplyEntries: replyMessages.map((name) => `reply:${name}`),
        primaryOperationRetained: true
      };
    });
  return {
    sourceSpecification: `AsyncAPI ${source.asyncapi}`,
    projectedOperationIds,
    operations,
    selectionInputFailures
  };
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export function validateAsyncApiReplyMessageSelection(scenario, { file = "source-input.json" } = {}) {
  const selection = evaluateAsyncApiReplyMessageSelection(
    scenario.source,
    scenario.authoritativeReplyMessageSelections
  );
  const indexRoutingMismatches = selection.operations.flatMap((entry) => {
    const actual = scenario.projectedIndexReplyEntries?.[entry.operationId] ?? [];
    return sameStringArray(actual, entry.indexReplyEntries)
      ? []
      : [{
        operationId: entry.operationId,
        expected: [...entry.indexReplyEntries],
        actual: Array.isArray(actual) ? [...actual] : actual
      }];
  });
  const operationProjectionMismatches = Object.hasOwn(scenario, "projectedOperationIds")
    && !sameStringArray(scenario.projectedOperationIds, selection.projectedOperationIds)
    ? [{
      expected: [...selection.projectedOperationIds],
      actual: Array.isArray(scenario.projectedOperationIds)
        ? [...scenario.projectedOperationIds]
        : scenario.projectedOperationIds
    }]
    : [];
  const selectionResolutionFailures = [
    ...selection.selectionInputFailures,
    ...selection.operations
    .filter((entry) => entry.outcome === "generation-failure")
    .map((entry) => ({ operationId: entry.operationId, reason: entry.reason }))
  ];
  const mismatchCount = indexRoutingMismatches.length
    + operationProjectionMismatches.length
    + selectionResolutionFailures.length;
  const diagnostics = mismatchCount === 0
    ? []
    : [diagnostic(
      "DM-REPLY-003",
      file,
      1,
      `AsyncAPI reply selection has ${mismatchCount} inconsistent projection result(s).`
    )];
  return {
    diagnostics,
    facts: {
      asyncApiReplyMessageSelection: {
        sourceSpecification: selection.sourceSpecification,
        projectedOperationIds: selection.projectedOperationIds,
        operations: selection.operations,
        indexRoutingMismatches,
        operationProjectionMismatches,
        selectionResolutionFailures
      }
    }
  };
}

const DIRECT_SCHEMA_TARGETS = new Map([
  ["application/vnd.aai.asyncapi;version=3.0.0", "direct-asyncapi-schema-object-3.0.0"],
  ["application/vnd.aai.asyncapi+json;version=3.0.0", "direct-asyncapi-schema-object-3.0.0"],
  ["application/vnd.aai.asyncapi+yaml;version=3.0.0", "direct-asyncapi-schema-object-3.0.0"],
  ["application/vnd.aai.asyncapi;version=3.1.0", "direct-asyncapi-schema-object-3.1.0"],
  ["application/vnd.aai.asyncapi+json;version=3.1.0", "direct-asyncapi-schema-object-3.1.0"],
  ["application/vnd.aai.asyncapi+yaml;version=3.1.0", "direct-asyncapi-schema-object-3.1.0"],
  ["application/schema+json;version=draft-07", "direct-json-schema-draft-07"],
  ["application/schema+yaml;version=draft-07", "direct-json-schema-draft-07"]
]);

function exactTarget(left, right) {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return left === right;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && exactTarget(left[key], right[key])
    ));
}

function resolvePublicationMapping(entry, version, predicate = () => true) {
  const matches = (entry.publicationMappings ?? []).filter((mapping) => (
    mapping.docaiMessagingVersion === version
      && mapping.adapterClass === entry.adapterClass
      && exactTarget(mapping.target, entry.target)
  ));
  if (matches.length > 1) return { status: "duplicate" };
  if (matches.length !== 1 || !predicate(matches[0])) return { status: "missing" };
  return { status: "unique", mapping: matches[0] };
}

function duplicatePublicationMappingFailure(entry) {
  return {
    caseId: entry.caseId,
    outcome: "generation-failure",
    reason: "duplicate-publication-mapping",
    ordinaryReaderRequirement: "normalized-contract-only"
  };
}

function supportedAdapter(entry, mapping, projection) {
  return {
    caseId: entry.caseId,
    outcome: "supported",
    resolution: "publication-mapping",
    ruleId: mapping.ruleId,
    ruleVersion: mapping.ruleVersion,
    mappingSourceIds: [mapping.sourceId],
    projection,
    ordinaryReaderRequirement: "normalized-contract-only"
  };
}

const PAYLOAD_WIRE_MAPPING_DEFINES = [
  "byte-encoding",
  "character-encoding",
  "parameter-semantics",
  "decoded-value-model",
  "full-example",
  "compact-example",
  "canonical-comparison",
  "schema-composition"
];

const SCHEMA_MAPPING_DEFINES = [
  "constraint-mapping",
  "example-value-projection",
  "logical-types",
  "runtime-schema-resolution"
];

function canonicalMediaTypeSource(value) {
  if (typeof value !== "string") return false;
  try { return canonicalizeMediaType(value) === value; } catch { return false; }
}

function directJsonWireTarget(value) {
  if (!canonicalMediaTypeSource(value) || value.includes(";")) return false;
  const slash = value.indexOf("/");
  return value === "application/json"
    || (slash !== -1 && value.slice(slash + 1).endsWith("+json"));
}

function resolvePayloadWireMapping(entry, version) {
  return resolvePublicationMapping(
    { ...entry, target: entry.mediaType },
    version,
    (candidate) => {
      const complete = PAYLOAD_WIRE_MAPPING_DEFINES.every((name) => (
        candidate.defines?.includes(name)
      ));
      const emitted = candidate.emittedMediaType;
      const preserves = emitted === entry.mediaType && candidate.parameterHandling === "preserve";
      const normalizes = emitted !== entry.mediaType
        && candidate.parameterHandling === "normalize-proven"
        && candidate.projectionDigestCovered === true;
      return complete && canonicalMediaTypeSource(emitted) && (preserves || normalizes);
    }
  );
}

function headerSchemaAdapter(entry, version) {
  if (entry.schemaTarget === undefined || DIRECT_SCHEMA_TARGETS.has(entry.schemaTarget)) {
    return { supported: true };
  }
  const resolution = resolvePublicationMapping(
    {
      adapterClass: "schema",
      target: entry.schemaTarget,
      publicationMappings: entry.publicationMappings
    },
    version,
    (candidate) => SCHEMA_MAPPING_DEFINES.every((name) => candidate.defines?.includes(name))
  );
  if (resolution.status === "duplicate") return { supported: false, duplicate: true };
  return resolution.status !== "unique"
    ? { supported: false }
    : {
      supported: true,
      provenance: {
        resolution: "publication-mapping",
        ruleId: resolution.mapping.ruleId,
        ruleVersion: resolution.mapping.ruleVersion,
        mappingSourceIds: [resolution.mapping.sourceId]
      }
    };
}

export function evaluateAdapterSourceExpectations({ docaiMessagingVersion, cases }) {
  return cases.map((entry) => {
    if (entry.adapterClass === "schema") {
      const sourceDefault = entry.schemaFormat === null
        ? new Map([
          ["AsyncAPI 3.0.0", "application/vnd.aai.asyncapi+json;version=3.0.0"],
          ["AsyncAPI 3.1.0", "application/vnd.aai.asyncapi+json;version=3.1.0"]
        ]).get(entry.sourceSpecification)
        : undefined;
      const effectiveTarget = sourceDefault ?? entry.schemaFormat;
      const ruleId = DIRECT_SCHEMA_TARGETS.get(effectiveTarget);
      if (ruleId !== undefined) {
        return {
          caseId: entry.caseId,
          outcome: "supported",
          resolution: sourceDefault === undefined ? "direct" : "source-default",
          effectiveTarget,
          ruleId,
          ruleVersion: docaiMessagingVersion,
          ordinaryReaderRequirement: "normalized-contract-only"
        };
      }
      const resolution = resolvePublicationMapping(
        { ...entry, target: effectiveTarget },
        docaiMessagingVersion,
        (candidate) => SCHEMA_MAPPING_DEFINES.every((name) => candidate.defines?.includes(name))
      );
      if (resolution.status === "duplicate") {
        return duplicatePublicationMappingFailure(entry);
      }
      if (resolution.status === "unique") {
        return {
          caseId: entry.caseId,
          outcome: "supported",
          resolution: "publication-mapping",
          effectiveTarget,
          ruleId: resolution.mapping.ruleId,
          ruleVersion: resolution.mapping.ruleVersion,
          mappingSourceIds: [resolution.mapping.sourceId],
          projection: "emit-schema-projection",
          ordinaryReaderRequirement: "normalized-contract-only"
        };
      }
      return {
        caseId: entry.caseId,
        outcome: "emit-unsupported",
        resolution: "no-exact-mapping",
        effectiveTarget,
        projection: "smallest-applicable-unsupported",
        ordinaryReaderRequirement: "normalized-contract-only"
      };
    }

    if (entry.adapterClass === "payload-wire") {
      const direct = directJsonWireTarget(entry.mediaType);
      if (direct) {
        return {
          caseId: entry.caseId,
          outcome: "supported",
          resolution: "direct",
          effectiveTarget: entry.mediaType,
          ruleId: "direct-json-wire",
          ruleVersion: docaiMessagingVersion,
          ordinaryReaderRequirement: "normalized-contract-only"
        };
      }
      const resolution = resolvePayloadWireMapping(entry, docaiMessagingVersion);
      if (resolution.status === "duplicate") {
        return duplicatePublicationMappingFailure(entry);
      }
      if (resolution.status === "unique") {
        const mapping = resolution.mapping;
        return {
          caseId: entry.caseId,
          outcome: "supported",
          resolution: "publication-mapping",
          effectiveTarget: entry.mediaType,
          emittedMediaType: mapping.emittedMediaType,
          mediaTypeResolution: mapping.emittedMediaType === entry.mediaType
            ? "preserved"
            : "adapter-normalized",
          ruleId: mapping.ruleId,
          ruleVersion: mapping.ruleVersion,
          mappingSourceIds: [mapping.sourceId],
          projection: "emit-payload-representation",
          ordinaryReaderRequirement: "normalized-contract-only"
        };
      }
      return {
        caseId: entry.caseId,
        outcome: "emit-unsupported",
        resolution: "no-exact-mapping",
        effectiveTarget: entry.mediaType,
        projection: "replace-payload-representation",
        ordinaryReaderRequirement: "normalized-contract-only"
      };
    }

    if (entry.adapterClass === "header-encoding") {
      const resolution = resolvePublicationMapping(entry, docaiMessagingVersion, (candidate) => (
        candidate.defines?.includes("encoding")
          && candidate.defines?.includes("exposure")
          && (entry.schemaTarget === undefined
            || candidate.compatibleSchemaTargets?.includes(entry.schemaTarget))
      ));
      if (resolution.status === "duplicate") {
        return duplicatePublicationMappingFailure(entry);
      }
      const schemaAdapter = headerSchemaAdapter(entry, docaiMessagingVersion);
      if (schemaAdapter.duplicate) return duplicatePublicationMappingFailure(entry);
      if (!schemaAdapter.supported || resolution.status !== "unique") {
        return {
          caseId: entry.caseId,
          outcome: "emit-unsupported",
          resolution: "no-exact-mapping",
          projection: "replace-header-representation",
          ordinaryReaderRequirement: "normalized-contract-only"
        };
      }
      const mapping = resolution.mapping;
      const supported = supportedAdapter(entry, mapping, "emit-header-map");
      return schemaAdapter.provenance === undefined
        ? supported
        : { ...supported, schemaAdapter: schemaAdapter.provenance };
    }

    const resolution = resolvePublicationMapping(entry, docaiMessagingVersion);
    if (resolution.status === "duplicate") {
      return duplicatePublicationMappingFailure(entry);
    }
    return resolution.status !== "unique"
      ? {
        caseId: entry.caseId,
        outcome: "emit-unsupported",
        resolution: "no-exact-mapping",
        projection: "smallest-channel-binding-unsupported",
        ordinaryReaderRequirement: "normalized-contract-only"
      }
      : supportedAdapter(entry, resolution.mapping, "emit-channel-binding");
  });
}

export function validateAdapterSourceExpectations(scenario, { file = "source-input.json" } = {}) {
  const expectations = evaluateAdapterSourceExpectations(scenario);
  const sources = new Map((scenario.cases ?? []).map((entry) => [entry.caseId, entry]));
  const mismatches = expectations.flatMap((expected) => {
    const source = sources.get(expected.caseId);
    if (exactTarget(expected, source?.projected)) return [];
    return [{
      ruleId: source?.adapterClass === "schema"
        ? "DM-ADAPTER-001"
        : source?.adapterClass === "header-encoding"
          ? "DM-ADAPTER-003"
          : source?.adapterClass === "protocol-binding"
            ? "DM-ADAPTER-004"
            : "DM-ADAPTER-002"
    }];
  });
  const rules = [...new Set(mismatches.map((entry) => entry.ruleId))];
  return {
    diagnostics: rules.map((ruleId) => diagnostic(
      ruleId,
      file,
      1,
      `Adapter projection disagrees with ${mismatches.filter((entry) => entry.ruleId === ruleId).length} exact source expectation(s).`
    )),
    facts: { adapterSourceExpectations: expectations }
  };
}

function trustResult(entry, outcome, details = {}) {
  return {
    caseId: entry.caseId,
    outcome,
    ...details,
    instructionAuthority: "none",
    authorizedActions: []
  };
}

function proseStructure(value) {
  if (/^> docai-messaging:/.test(value)) return "opening-metadata";
  if (/^> docai-identity:/.test(value)) return "identity-trailer";
  if (/^(?:Full|Compact) set: /.test(value)) return "profile-link";
  if (/^- [a-z][a-z0-9_-]*:/.test(value)) return "fixed-key-list";
  if (/^\*\*(?:deprecated|deviation|payload_required|payload_presence|payload_nullable|media_type|variant|message_shape|field_defaults|same_as|instruction_authority|unknown|unsupported)\*\*:/.test(value)) {
    return "standard-marker";
  }
  if (/^\*\*x-[^*]+\*\*:/.test(value)) return "extension-structure";
  if (["none", "unknown"].includes(value)) return "fixed-value";
  if (/^#{1,6} /.test(value)) return "heading";
  return null;
}

export function evaluateTrustBoundarySourceExpectations({ cases }) {
  return cases.map((entry) => {
    const value = Buffer.isBuffer(entry.sourceBytes)
      ? entry.sourceBytes.toString("utf8")
      : String(entry.sourceBytes);
    if (entry.assignedLocation === "related-navigation") {
      return trustResult(entry, "preserve-navigation-data", { retrievalAuthorized: false });
    }
    if (entry.assignedLocation === "json-example") {
      return trustResult(entry, "preserve-inside-bounded-example", {
        detectedStructure: value.includes("docai-identity:") ? "identity-like-data" : "structured-data"
      });
    }
    if (entry.assignedLocation === "constraint-string") {
      return trustResult(entry, "encode-assigned-value", {
        detectedStructure: /^\|.*\|$/.test(value) ? "table-row" : "structural-string"
      });
    }
    if (entry.assignedLocation === "collapsed-fixed-value"
      && ["none", "unknown"].includes(value)) {
      return trustResult(entry, "emit-unsupported", { reason: "ambiguous-fixed-sentinel" });
    }
    const detectedStructure = proseStructure(value);
    if (detectedStructure !== null) {
      return trustResult(entry, "neutralize-line-leading-structure", { detectedStructure });
    }
    return trustResult(entry, "treat-as-contract-data");
  });
}

function trustMismatchRule(expected, projected) {
  const authorityMismatch = projected?.instructionAuthority !== expected.instructionAuthority
    || !sameStringArray(projected?.authorizedActions, expected.authorizedActions)
    || (expected.retrievalAuthorized !== undefined
      && projected?.retrievalAuthorized !== expected.retrievalAuthorized)
    || projected?.retrievalAuthorized === true;
  return authorityMismatch ? "DM-TRUST-001" : "DM-TRUST-002";
}

export function validateTrustBoundarySourceExpectations(
  scenario,
  { file = "source-input.json" } = {}
) {
  const expectations = evaluateTrustBoundarySourceExpectations(scenario);
  const sources = new Map((scenario.cases ?? []).map((entry) => [entry.caseId, entry]));
  const mismatches = expectations.flatMap((expected) => {
    const projected = sources.get(expected.caseId)?.projected;
    if (projected === undefined || exactTarget(expected, projected)) return [];
    return [{ ruleId: trustMismatchRule(expected, projected) }];
  });
  const rules = [...new Set(mismatches.map((entry) => entry.ruleId))];
  return {
    diagnostics: rules.map((ruleId) => diagnostic(
      ruleId,
      file,
      1,
      `Trust-boundary projection disagrees with ${mismatches.filter((entry) => entry.ruleId === ruleId).length} source expectation(s).`
    )),
    facts: { trustBoundarySourceExpectations: expectations }
  };
}

export function evaluatePublicationSafetySourceExpectations({ cases }) {
  return cases.map((entry) => {
    const prohibitedOutputValues = [entry.sourceValue];
    if (entry.valueClassification === "non-secret"
      && entry.distributionPolicyAuthorized === true) {
      return {
        caseId: entry.caseId,
        outcome: "emit-exact",
        emittedValue: entry.sourceValue,
        coverage: "complete",
        knowledge: "complete",
        prohibitedOutputValues: []
      };
    }
    const sensitiveValue = typeof entry.sourceValue === "string" && entry.sourceValue !== ""
      ? entry.sourceValue
      : null;
    const unsafeDisclosure = sensitiveValue !== null && [
      entry.featureClass,
      entry.publicationSafeLocation,
      entry.contractEquivalentSafeOverride
    ].some((value) => typeof value === "string" && value.includes(sensitiveValue));
    if (unsafeDisclosure) {
      return {
        caseId: entry.caseId,
        outcome: "generation-failure",
        reason: "publication-safe-value-unavailable",
        prohibitedOutputValues
      };
    }
    if (entry.factRole === "example" && entry.schemaAllowsSyntheticPlaceholder === true) {
      return {
        caseId: entry.caseId,
        outcome: "replace-with-synthetic-placeholder",
        coverage: "complete",
        knowledge: "complete",
        prohibitedOutputValues
      };
    }
    if (["mandatory-catalog-cell", "mandatory-structural-value"].includes(entry.factRole)
      && typeof entry.contractEquivalentSafeOverride === "string"
      && entry.contractEquivalentSafeOverride !== ""
      && entry.contractEquivalentSafeOverride !== entry.sourceValue
      && entry.safeOverrideAuthorizedBySource === true
      && entry.distributionPolicyAuthorized === true) {
      return {
        caseId: entry.caseId,
        outcome: "emit-safe-override",
        emittedValue: entry.contractEquivalentSafeOverride,
        coverage: "complete",
        knowledge: "complete",
        prohibitedOutputValues
      };
    }
    if (["mandatory-catalog-cell", "mandatory-structural-value"].includes(entry.factRole)) {
      return {
        caseId: entry.caseId,
        outcome: "generation-failure",
        reason: "publication-safe-value-unavailable",
        prohibitedOutputValues
      };
    }
    if (typeof entry.publicationSafeLocation === "string"
      && entry.publicationSafeLocation !== "") {
      return {
        caseId: entry.caseId,
        outcome: "emit-unsupported",
        markerReason: `sensitive ${entry.featureClass} withheld at ${entry.publicationSafeLocation}`,
        coverage: "requires-source",
        knowledge: "complete",
        prohibitedOutputValues
      };
    }
    return {
      caseId: entry.caseId,
      outcome: "generation-failure",
      reason: "publication-safe-value-unavailable",
      prohibitedOutputValues
    };
  });
}

export function validatePublicationSafetySourceExpectations(
  scenario,
  { file = "source-input.json" } = {}
) {
  const expectations = evaluatePublicationSafetySourceExpectations(scenario);
  const sources = new Map((scenario.cases ?? []).map((entry) => [entry.caseId, entry]));
  const failures = expectations.filter((entry) => entry.outcome === "generation-failure");
  const mismatches = expectations.filter((expected) => {
    const projected = sources.get(expected.caseId)?.projected;
    return projected !== undefined && !exactTarget(expected, projected);
  });
  const invalidCount = failures.length + mismatches.length;
  return {
    diagnostics: invalidCount === 0
      ? []
      : [diagnostic(
        "DM-TRUST-003",
        file,
        1,
        `Publication-safety projection has ${invalidCount} unsafe mandatory value or source-expectation failure(s).`
      )],
    facts: { publicationSafetySourceExpectations: expectations }
  };
}

const CANONICAL_STRUCTURAL_VALUES = new Map([
  ["behavior-heading", "Behavior"],
  ["payload-heading", "Payload"]
]);

export function evaluateLanguageStructureSourceExpectations(scenario) {
  const documentLanguage = typeof scenario.documentLanguage === "string"
    && scenario.documentLanguage.length > 0
    ? scenario.documentLanguage
    : null;
  const segments = Array.isArray(scenario.segments) ? scenario.segments : [];
  return segments
    .map((entry) => ({
      caseId: entry.caseId,
      expectedLanguage: entry.role === "structure" ? "en" : documentLanguage,
      expectedValue: entry.role === "structure"
        ? CANONICAL_STRUCTURAL_VALUES.get(entry.structuralKind) ?? null
        : null,
      role: entry.role
    }))
    .sort((left, right) => left.caseId < right.caseId ? -1 : left.caseId > right.caseId ? 1 : 0);
}

export function validateLanguageStructureSourceExpectations(
  scenario,
  { file = "source-input.json" } = {}
) {
  const expectations = evaluateLanguageStructureSourceExpectations(scenario);
  const segments = Array.isArray(scenario.segments) ? scenario.segments : [];
  const byCaseId = new Map(segments.map((entry) => [entry.caseId, entry]));
  const uniqueCaseIds = byCaseId.size === segments.length;
  const mismatches = expectations.filter((expected) => {
    const projected = byCaseId.get(expected.caseId);
    if (expected.role === "prose") {
      return expected.expectedLanguage === null
        || projected?.projectedLanguage !== expected.expectedLanguage
        || projected?.translationCount !== 1;
    }
    return expected.role !== "structure"
      || typeof expected.expectedValue !== "string"
      || expected.expectedValue.length === 0
      || projected?.projectedValue !== expected.expectedValue;
  });
  return {
    diagnostics: mismatches.length === 0 && uniqueCaseIds
      ? []
      : [diagnostic(
        "DM-LANG-001",
        file,
        1,
        `Projected content disagrees with ${mismatches.length + (uniqueCaseIds ? 0 : 1)} document-language or canonical-English structural expectation(s).`
      )],
    facts: { languageStructureSourceExpectations: expectations }
  };
}
