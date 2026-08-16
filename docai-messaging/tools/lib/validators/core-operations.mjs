import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { validateSentenceLine } from "../sentence.mjs";
import { parsePipeTable } from "../tables.mjs";
import { validChannelAddress } from "./core-routing.mjs";

const OPERATION_HEADING = /^(SEND|RECEIVE) (.+) \(([A-Za-z0-9._-]+)\)$/;
const BEHAVIOR_KEYS = [
  "side_effects",
  "idempotency",
  "preconditions",
  "authorization",
  "delivery",
  "ordering"
];

function operationDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file.path, line, message);
}

function operationName(heading) {
  return heading.text.match(/\(([^()]+)\)$/)?.[1] ?? null;
}

function validSectionOrder(headings) {
  if (headings[0]?.text !== "Behavior"
    || headings[1]?.text !== "Operation Bindings"
    || headings[2]?.text !== "Channel") {
    return false;
  }
  let index = 3;
  const firstMessage = index;
  while (headings[index]?.text.startsWith("Message ")) index += 1;
  if (index === firstMessage) return false;
  return headings[index]?.text === "Reply"
    && headings[index + 1]?.text === "Failure Handling"
    && headings[index + 2]?.text === "Related"
    && index + 3 === headings.length;
}

function contentLines(file, markdown, heading, nextHeading) {
  const endLine = nextHeading?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  return markdown.lines.filter((line) => (
    line.line > heading.line
      && line.line < endLine
      && line.text !== ""
      && !line.inFence
  ));
}

function validDelivery(value) {
  if (value === "none" || value === "unknown") return true;
  return /^(?:at-most-once|at-least-once)(?: -- .+)?$/.test(value)
    || /^exactly-once -- .+$/.test(value);
}

function validateBehavior(file, markdown, heading, nextHeading) {
  const lines = contentLines(file, markdown, heading, nextHeading);
  let index = 0;
  while (lines[index]?.text.startsWith("**deviation**: ")) index += 1;
  if (!validLeadingDeviations(lines.slice(0, index))) {
    return [operationDiagnostic(
      "DM-OP-003",
      file,
      lines[0]?.line ?? heading.line,
      "Behavior deviations must be non-empty and ordered by complete source line before the six canonical keys."
    )];
  }

  const values = [];
  for (const key of BEHAVIOR_KEYS) {
    const matched = lines[index]?.text.match(new RegExp(`^- ${key}: (.+)$`));
    if (matched === null || matched === undefined) {
      return [operationDiagnostic(
        "DM-OP-003",
        file,
        lines[index]?.line ?? heading.line,
        "Behavior requires the six canonical non-empty keys exactly once and in fixed order."
      )];
    }
    values.push(matched[1]);
    index += 1;
  }

  const markers = lines.slice(index);
  const validMarkers = markers.every((line) => (
    line.text.startsWith("**unknown**: ")
      && line.text.length > "**unknown**: ".length
  ));
  const markersOrdered = markers.every((line, markerIndex) => (
    markerIndex === 0
      || unicodeScalarCompare(markers[markerIndex - 1].text, line.text) < 0
  ));
  const markersContiguous = markers.every((line, markerIndex) => (
    line.line === (markerIndex === 0 ? lines[index - 1].line : markers[markerIndex - 1].line) + 1
  ));
  const hasUnknown = values.includes("unknown");
  if (!validMarkers
    || !markersOrdered
    || !markersContiguous
    || hasUnknown !== (markers.length > 0)
    || !validDelivery(values[4])) {
    return [operationDiagnostic(
      "DM-OP-003",
      file,
      markers[0]?.line ?? heading.line,
      "Behavior values require canonical delivery syntax and post-key unknown markers for missing facts, with no additional core content."
    )];
  }
  return [];
}

function unicodeScalarCompare(left, right) {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0));
  const rightScalars = Array.from(right, (value) => value.codePointAt(0));
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index += 1) {
    if (leftScalars[index] !== rightScalars[index]) return leftScalars[index] - rightScalars[index];
  }
  return leftScalars.length - rightScalars.length;
}

function validLeadingDeviations(lines) {
  if (lines.some((line) => (
    !line.text.startsWith("**deviation**: ")
      || line.text.length <= "**deviation**: ".length
  ))) return false;
  return lines.every((line, index) => (
    index === 0 || unicodeScalarCompare(lines[index - 1].text, line.text) < 0
  ));
}

function markerKind(text, parameterTable) {
  const collectionPrefix = "**unknown**: additional unnamed parameter requires ";
  if (parameterTable && text.startsWith(collectionPrefix) && text.length > collectionPrefix.length) {
    return { rank: 0, type: "collection-unknown" };
  }
  if (text.startsWith("**unknown**: ") && text.length > "**unknown**: ".length) {
    return { rank: 1, type: "unknown" };
  }
  const unsupportedPrefix = "**unsupported**: localized: ";
  if (text.startsWith(unsupportedPrefix) && text.length > unsupportedPrefix.length) {
    return { rank: 2, type: "unsupported" };
  }
  if (/^\*\*x-[A-Za-z0-9._-]+\*\*: .+$/.test(text)) return { rank: 3, type: "extension" };
  return null;
}

function validPostTableMarkers(markers, table, parameterTable) {
  const hasUnknownCell = table.rows.some((row) => row.includes("unknown"));
  if (markers.length === 0) return !hasUnknownCell;
  if (markers[0].line !== table.endLine + 1
    || markers.some((line, index) => index > 0 && line.line !== markers[index - 1].line + 1)) {
    return false;
  }
  const classified = markers.map((line) => markerKind(line.text, parameterTable));
  if (classified.some((entry) => entry === null)) return false;
  for (let index = 1; index < classified.length; index += 1) {
    if (classified[index].rank < classified[index - 1].rank) return false;
    if (classified[index].rank === classified[index - 1].rank
      && unicodeScalarCompare(markers[index - 1].text, markers[index].text) >= 0) return false;
  }
  if (classified.filter((entry) => entry.type === "collection-unknown").length > 1) return false;
  const hasStandardUnknownMarker = classified.some((entry) => entry.type === "unknown");
  return hasUnknownCell === hasStandardUnknownMarker;
}

function tableState(lines, expectedHeader) {
  const parsed = parsePipeTable(lines);
  if (parsed.value === null) return null;
  const table = parsed.value;
  const tableLines = lines.filter((line) => line.line <= table.endLine);
  const markers = lines.slice(tableLines.length);
  const standardPrefix = table.header.slice(0, expectedHeader.length);
  const extensionSuffix = table.header.slice(expectedHeader.length);
  const parameterTable = expectedHeader[0] === "Name";
  return standardPrefix.length === expectedHeader.length
    && standardPrefix.every((cell, index) => cell === expectedHeader[index])
    && extensionSuffix.every((cell) => cell.startsWith("x-") && cell.length > 2)
    && table.rows.length > 0
    && table.rows.every((row) => row.every((cell) => cell !== ""))
    && tableLines.every((line, index) => index === 0 || line.line === tableLines[index - 1].line + 1)
    && validPostTableMarkers(markers, table, parameterTable)
    ? table
    : null;
}

function coreUnitState(lines, { replacementUnit, tableHeader }) {
  let index = 0;
  while (lines[index]?.text.startsWith("**deviation**: ")) index += 1;
  if (!validLeadingDeviations(lines.slice(0, index))) return null;
  const core = lines.slice(index);
  if (core.length === 1 && core[0].text === "none") {
    return { state: "none", table: null };
  }
  if (core.length === 2
    && core[0].text === "unknown"
    && core[1].line === core[0].line + 1
    && core[1].text.startsWith("**unknown**: ")
    && core[1].text.length > "**unknown**: ".length) {
    return { state: "unknown", table: null };
  }
  const replacementPrefix = `**unsupported**: replaces ${replacementUnit}: `;
  if (core.length === 1
    && core[0].text.startsWith(replacementPrefix)
    && core[0].text.length > replacementPrefix.length) {
    return { state: "unsupported", table: null };
  }
  const table = tableState(core, tableHeader);
  return table === null ? null : { state: "expanded", table };
}

function validateOperationBindings(file, markdown, heading, nextHeading) {
  const state = coreUnitState(contentLines(file, markdown, heading, nextHeading), {
    replacementUnit: "Operation Bindings",
    tableHeader: ["Protocol", "Property", "Value / Rule"]
  });
  return state === null
    ? [operationDiagnostic(
      "DM-OP-004",
      file,
      heading.line,
      "Operation Bindings requires exactly one canonical none, whole-section unknown, replacement unsupported, or non-empty protocol binding table."
    )]
    : [];
}

function subsectionLines(lines, startIndex, endIndex) {
  return lines.slice(startIndex, endIndex);
}

function parseHeadedChannelSubsection(lines, index, name, nextName) {
  if (lines[index]?.text !== `#### ${name}`) return null;
  const nextIndex = nextName === null
    ? lines.length
    : lines.findIndex((line, candidate) => (
      candidate > index && line.text === `#### ${nextName}`
    ));
  const endIndex = nextIndex === -1 ? lines.length : nextIndex;
  return {
    content: subsectionLines(lines, index + 1, endIndex),
    nextIndex: endIndex
  };
}

function addressParameters(address) {
  return [...new Set([...address.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]))];
}

function sameNames(actual, expected) {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.length === sortedExpected.length
    && sortedActual.every((name, index) => name === sortedExpected[index]);
}

function validateChannel(file, markdown, heading, nextHeading, address) {
  const lines = contentLines(file, markdown, heading, nextHeading);
  let index = 0;
  while (lines[index]?.text.startsWith("**deviation**: ")) index += 1;
  if (!validLeadingDeviations(lines.slice(0, index))) return null;
  const core = lines.slice(index);
  index = 0;

  let parameterState;
  if (core[index]?.text === "- Parameters: none") {
    parameterState = { state: "none", table: null };
    index += 1;
  } else {
    const parsed = parseHeadedChannelSubsection(core, index, "Parameters", "Bindings");
    if (parsed === null) return null;
    parameterState = coreUnitState(parsed.content, {
      replacementUnit: "channel Parameters",
      tableHeader: ["Name", "Type", "Constraints / Meaning"]
    });
    if (parameterState === null) return null;
    index = parsed.nextIndex;
  }

  const firstNonEmpty = parameterState.state !== "none";
  let bindingState;
  if (core[index]?.text === "- Bindings: none") {
    if (firstNonEmpty) return null;
    bindingState = { state: "none", table: null };
    index += 1;
  } else {
    const parsed = parseHeadedChannelSubsection(core, index, "Bindings", null);
    if (parsed === null) return null;
    bindingState = coreUnitState(parsed.content, {
      replacementUnit: "channel Bindings",
      tableHeader: ["Protocol", "Property", "Value / Rule"]
    });
    if (bindingState === null) return null;
    index = parsed.nextIndex;
  }
  if (index !== core.length) return null;

  const actualNames = parameterState.table?.rows.map((row) => row[0]) ?? [];
  const expectedNames = addressParameters(address);
  if (parameterState.state === "none" && expectedNames.length !== 0) return null;
  if ((parameterState.state === "unknown" || parameterState.state === "unsupported")
    && expectedNames.length === 0) return null;
  if (parameterState.state === "expanded"
    && (new Set(actualNames).size !== actualNames.length
      || !sameNames(actualNames, expectedNames))) return null;
  return { bindings: bindingState, parameters: parameterState };
}

function validateHeadingAndPurpose(file, markdown, heading, nextLine, routedRow) {
  const diagnostics = [];
  const matched = heading.text.match(OPERATION_HEADING);
  const headingValid = matched !== null
    && validChannelAddress(matched[2])
    && routedRow !== undefined
    && matched[1] === routedRow.action
    && matched[2] === routedRow.channel
    && matched[3] === routedRow.operation;
  if (!headingValid) {
    diagnostics.push(operationDiagnostic(
      "DM-OP-002",
      file,
      heading.line,
      "An operation heading must use its routed ACTION, channel address, and set-unique operation name."
    ));
  }

  const behaviorLine = markdown.headings.find((entry) => (
    entry.level === 3
      && entry.text === "Behavior"
      && entry.line > heading.line
      && entry.line < nextLine
  ))?.line ?? nextLine;
  const prelude = markdown.lines.filter((line) => (
    line.line > heading.line
      && line.line < behaviorLine
      && line.text !== ""
  ));
  const marker = prelude[0]?.text.startsWith("**deprecated**:") ? prelude[0] : null;
  const validMarker = marker === null
    || (marker.text.startsWith("**deprecated**: ")
      && marker.text.length > "**deprecated**: ".length);
  const purpose = marker === null ? prelude[0] : prelude[1];
  const validPreludeLength = prelude.length === (marker === null ? 1 : 2);
  const validPurpose = purpose !== undefined
    && validateSentenceLine({ text: purpose.text, file: file.path, line: purpose.line }, 1, 2).value !== null;
  const summaryDeprecated = routedRow?.summary.startsWith("(deprecated)") ?? false;
  if (!validMarker
    || !validPreludeLength
    || !validPurpose
    || summaryDeprecated !== (marker !== null)) {
    diagnostics.push(operationDiagnostic(
      "DM-OP-002",
      file,
      purpose?.line ?? marker?.line ?? heading.line,
      "An operation requires one source line of one or two purpose sentences, optionally preceded by one non-empty deprecation marker that matches the INDEX summary prefix."
    ));
  }
  return { diagnostics, deprecated: marker !== null };
}

function validateRelated(file, markdown, heading, nextHeading) {
  const lines = contentLines(file, markdown, heading, nextHeading);
  const misplaced = lines.find((line) => line.text.startsWith("**deviation**:"));
  return misplaced === undefined
    ? []
    : [operationDiagnostic(
      "DM-OP-001",
      file,
      misplaced.line,
      "Related is navigation-only and does not permit deviation markers."
    )];
}

function parseOperationFile(file, routedRows) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return { diagnostics: scanned.diagnostics, definitions: [] };
  const markdown = scanned.value;
  const diagnostics = [];
  const definitions = [];
  const operationHeadings = markdown.headings.filter((heading) => heading.level === 2);
  const firstOperationLine = operationHeadings[0]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  const wrapper = markdown.lines.find((line) => (
    line.line > file.metadataLine
      && line.line < firstOperationLine
      && line.text !== ""
  ));
  if (operationHeadings.length === 0
    || markdown.headings.some((heading) => heading.level === 1)
    || wrapper !== undefined) {
    diagnostics.push(operationDiagnostic(
      "DM-OP-001",
      file,
      wrapper?.line ?? markdown.headings[0]?.line ?? file.identityLine ?? 1,
      "A channel file contains one or more operation definitions without a file-level title or prose wrapper."
    ));
    return { diagnostics, definitions };
  }

  for (let index = 0; index < operationHeadings.length; index += 1) {
    const heading = operationHeadings[index];
    const nextLine = operationHeadings[index + 1]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
    const sections = markdown.headings.filter((entry) => (
      entry.level === 3 && entry.line > heading.line && entry.line < nextLine
    ));
    const name = operationName(heading);
    const routedRow = routedRows.find((row) => row.operation === name) ?? routedRows[index];
    const headingResult = validateHeadingAndPurpose(file, markdown, heading, nextLine, routedRow);
    diagnostics.push(...headingResult.diagnostics);
    if (!validSectionOrder(sections)) {
      diagnostics.push(operationDiagnostic(
        "DM-OP-001",
        file,
        sections.find((entry, sectionIndex) => {
          if (sectionIndex === 0) return entry.text !== "Behavior";
          if (sectionIndex === 1) return entry.text !== "Operation Bindings";
          if (sectionIndex === 2) return entry.text !== "Channel";
          return false;
        })?.line ?? heading.line,
        "Each operation requires Behavior, Operation Bindings, Channel, one or more Message sections, Reply, Failure Handling, and Related in fixed order."
      ));
    }
    const behaviorIndex = sections.findIndex((entry) => entry.text === "Behavior");
    if (behaviorIndex !== -1) {
      diagnostics.push(...validateBehavior(
        file,
        markdown,
        sections[behaviorIndex],
        sections[behaviorIndex + 1]
      ));
    }
    const operationBindingsIndex = sections.findIndex((entry) => entry.text === "Operation Bindings");
    if (operationBindingsIndex !== -1) {
      diagnostics.push(...validateOperationBindings(
        file,
        markdown,
        sections[operationBindingsIndex],
        sections[operationBindingsIndex + 1]
      ));
    }
    const channelIndex = sections.findIndex((entry) => entry.text === "Channel");
    if (channelIndex !== -1) {
      const headingAddress = heading.text.match(OPERATION_HEADING)?.[2] ?? "";
      if (validateChannel(
        file,
        markdown,
        sections[channelIndex],
        sections[channelIndex + 1],
        headingAddress
      ) === null) {
        diagnostics.push(operationDiagnostic(
          "DM-OP-004",
          file,
          sections[channelIndex].line,
          "Channel requires Parameters then Bindings with canonical states, leading-empty collapse, and exactly one row per address parameter."
        ));
      }
    }
    const relatedIndex = sections.findIndex((entry) => entry.text === "Related");
    if (relatedIndex !== -1) {
      diagnostics.push(...validateRelated(
        file,
        markdown,
        sections[relatedIndex],
        { line: nextLine }
      ));
    }
    if (name !== null) {
      const headingMatch = heading.text.match(/^([^ ]+) (.+) \(([^()]+)\)$/);
      definitions.push({
        action: headingMatch?.[1] ?? null,
        channel: headingMatch?.[2] ?? null,
        deprecated: headingResult.deprecated,
        line: heading.line,
        name,
        path: file.path
      });
    }
  }

  const routedNames = routedRows.map((row) => row.operation).sort();
  const definedNames = definitions.map((entry) => entry.name).sort();
  if (routedNames.length !== definedNames.length
    || routedNames.some((name, index) => name !== definedNames[index])) {
    diagnostics.push(operationDiagnostic(
      "DM-OP-001",
      file,
      operationHeadings[0]?.line ?? file.identityLine ?? 1,
      "Every operation routed to a channel file must be defined there exactly once, with no unrouted operation definitions."
    ));
  }
  return { diagnostics, definitions };
}

export function validateCoreOperations(documentSet, routingFacts) {
  const rows = routingFacts.operations?.rows ?? [];
  const channelPaths = [...new Set(rows.map((row) => row.channelPath))];
  const diagnostics = [];
  const definitions = [];
  for (const channelPath of channelPaths) {
    const file = documentSet.files.find((entry) => entry.path === channelPath);
    if (file === undefined) continue;
    const parsed = parseOperationFile(
      file,
      rows.filter((row) => row.channelPath === channelPath)
    );
    diagnostics.push(...parsed.diagnostics);
    definitions.push(...parsed.definitions);
  }
  return {
    diagnostics,
    facts: {
      operationDefinitions: {
        byName: Object.fromEntries(definitions.map((entry) => [entry.name, entry]))
      }
    }
  };
}
