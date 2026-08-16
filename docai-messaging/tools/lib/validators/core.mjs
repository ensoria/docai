import { diagnostic } from "../diagnostics.mjs";
import { parseExactJson } from "../json-value.mjs";
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

function incompleteMarkers(file) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return { unknown: false, unsupported: false };
  return {
    unknown: scanned.value.lines.some((line) => (
      !line.inFence && line.text.startsWith("**unknown**: ")
    )),
    unsupported: scanned.value.lines.some((line) => (
      !line.inFence && line.text.startsWith("**unsupported**: ")
    ))
  };
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
  const blockingMarkers = [];
  for (const selectedPath of selectedPaths) {
    const file = documentSet.files.find((entry) => entry.path === selectedPath);
    if (file === undefined) continue;
    const markers = incompleteMarkers(file);
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

export function evaluateAsyncApiReplyMessageSelection(source) {
  const operations = Object.entries(source.operations ?? {})
    .filter(([, operation]) => operation.reply !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([operationId, operation]) => {
      const channelSegments = localReferenceSegments(operation.reply.channel);
      const channelId = channelSegments.length === 2 && channelSegments[0] === "channels"
        ? channelSegments[1]
        : null;
      const candidateMessages = Object.keys(source.channels?.[channelId]?.messages ?? {}).sort();
      const explicit = Object.hasOwn(operation.reply, "messages");
      if (!explicit) {
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
    operations
  };
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export function validateAsyncApiReplyMessageSelection(scenario, { file = "source-input.json" } = {}) {
  const selection = evaluateAsyncApiReplyMessageSelection(scenario.source);
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
  const diagnostics = indexRoutingMismatches.length === 0
    ? []
    : [diagnostic(
      "DM-REPLY-003",
      file,
      1,
      `AsyncAPI reply selection has ${indexRoutingMismatches.length} inconsistent INDEX reply routing result(s).`
    )];
  return {
    diagnostics,
    facts: {
      asyncApiReplyMessageSelection: {
        ...selection,
        indexRoutingMismatches
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

function publicationMapping(entry, version, predicate = () => true) {
  return (entry.publicationMappings ?? []).find((mapping) => (
    mapping.docaiMessagingVersion === version
      && mapping.adapterClass === entry.adapterClass
      && exactTarget(mapping.target, entry.target)
      && predicate(mapping)
  ));
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

function payloadWireMapping(entry, version) {
  return publicationMapping(
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
      const mapping = payloadWireMapping(entry, docaiMessagingVersion);
      if (mapping !== undefined) {
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
      const mapping = publicationMapping(entry, docaiMessagingVersion, (candidate) => (
        candidate.defines?.includes("encoding")
          && candidate.defines?.includes("exposure")
          && (entry.schemaTarget === undefined
            || candidate.compatibleSchemaTargets?.includes(entry.schemaTarget))
      ));
      return mapping === undefined
        ? {
          caseId: entry.caseId,
          outcome: "emit-unsupported",
          resolution: "no-exact-mapping",
          projection: "replace-header-representation",
          ordinaryReaderRequirement: "normalized-contract-only"
        }
        : supportedAdapter(entry, mapping, "emit-header-map");
    }

    const mapping = publicationMapping(entry, docaiMessagingVersion);
    return mapping === undefined
      ? {
        caseId: entry.caseId,
        outcome: "emit-unsupported",
        resolution: "no-exact-mapping",
        projection: "smallest-channel-binding-unsupported",
        ordinaryReaderRequirement: "normalized-contract-only"
      }
      : supportedAdapter(entry, mapping, "emit-channel-binding");
  });
}

export function validateAdapterSourceExpectations(scenario, { file = "source-input.json" } = {}) {
  const expectations = evaluateAdapterSourceExpectations(scenario);
  const sources = new Map((scenario.cases ?? []).map((entry) => [entry.caseId, entry]));
  const mismatches = expectations.flatMap((expected) => {
    const source = sources.get(expected.caseId);
    if (exactTarget(expected, source?.projected)) return [];
    return [{
      ruleId: source?.adapterClass === "header-encoding" ? "DM-ADAPTER-003" : "DM-ADAPTER-002"
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
