import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { validateSentenceLine } from "../sentence.mjs";
import { parsePipeTable } from "../tables.mjs";

const MESSAGE_NAME = /^[A-Za-z0-9._-]+$/;

function messageDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file.path, line, message);
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

function oppositeDirection(action) {
  return action === "SEND" ? "RECEIVE" : "SEND";
}

function operationName(heading) {
  return heading.text.match(/\(([^()]+)\)$/)?.[1] ?? null;
}

function messageName(heading) {
  return heading.text.startsWith("Message ") ? heading.text.slice("Message ".length) : null;
}

function blockEndLine(markdown, heading, fallbackLine) {
  return markdown.headings.find((candidate) => (
    candidate.line > heading.line && candidate.level <= heading.level
  ))?.line ?? fallbackLine;
}

function sourceLines(markdown, startLine, endLine) {
  return markdown.lines.filter((line) => (
    line.line > startLine && line.line < endLine && !line.inFence
  ));
}

function nonEmptyLines(lines) {
  return lines.filter((line) => line.text !== "");
}

function standardColumns(direction, firstColumn) {
  return direction === "SEND"
    ? [firstColumn, "Type", "Required", "Nullable", "Constraints / Meaning"]
    : [firstColumn, "Type", "Presence", "Nullable", "Meaning"];
}

function validHeader(actual, expected) {
  const prefix = actual.slice(0, expected.length);
  const suffix = actual.slice(expected.length);
  return prefix.length === expected.length
    && prefix.every((cell, index) => cell === expected[index])
    && suffix.every((cell) => cell.startsWith("x-") && cell.length > 2);
}

function markerKind(text) {
  if (text.startsWith("**unknown**: ") && text.length > "**unknown**: ".length) {
    return { rank: 0, type: "unknown" };
  }
  const unsupported = "**unsupported**: localized: ";
  if (text.startsWith(unsupported) && text.length > unsupported.length) {
    return { rank: 1, type: "unsupported" };
  }
  if (/^\*\*x-[A-Za-z0-9._-]+\*\*: .+$/.test(text)) {
    return { rank: 2, type: "extension" };
  }
  return null;
}

function postTableMarkers(lines, table) {
  const markers = [];
  let expectedLine = table.endLine + 1;
  while (true) {
    const line = lines.find((entry) => entry.line === expectedLine);
    if (line === undefined || line.text === "") break;
    const kind = markerKind(line.text);
    if (kind === null) break;
    markers.push({ ...line, kind });
    expectedLine += 1;
  }
  return markers;
}

function validMarkerOrder(markers) {
  for (let index = 1; index < markers.length; index += 1) {
    const previous = markers[index - 1];
    const current = markers[index];
    if (current.kind.rank < previous.kind.rank) return false;
    if (current.kind.rank === previous.kind.rank
      && unicodeScalarCompare(previous.text, current.text) >= 0) return false;
  }
  return true;
}

function tableAt(lines, startIndex) {
  const candidate = lines.slice(startIndex);
  const parsed = parsePipeTable(candidate);
  return parsed.value;
}

function looksLikePayloadTableStart(lines, index) {
  const line = lines[index];
  const next = lines[index + 1];
  const hasFieldColumn = /(?:^|\|) *Field *\|/.test(line.text.replace(/^ +/, ""));
  const followedBySeparator = next?.line === line.line + 1
    && /(?:^|\|) *--- *(?:\||$)/.test(next.text);
  return line.text.includes("|") && (hasFieldColumn || followedBySeparator);
}

function validDirectionRows(table, direction, payloadNullable) {
  const directionIndex = 2;
  const nullableIndex = 3;
  const meaningIndex = 4;
  for (const row of table.rows) {
    if (row.slice(0, meaningIndex).some((cell) => cell === "")
      || (direction === "SEND" && row[meaningIndex] === "")) return false;
    const directionValue = row[directionIndex];
    if (direction === "SEND") {
      if (!["yes", "no", "conditional", "unknown"].includes(directionValue)) return false;
      if (directionValue === "conditional"
        && ["", "none", "unknown"].includes(row[meaningIndex])) return false;
    } else if (["conditional", "none", "yes", "no"].includes(directionValue)) {
      return false;
    }
    if (!["yes", "no", "unknown"].includes(row[nullableIndex])) return false;
    if (row[0] === "$"
      && (directionValue !== (direction === "SEND" ? "yes" : "always")
        || (payloadNullable !== null && row[nullableIndex] !== payloadNullable))) {
      return false;
    }
  }
  return true;
}

function validateDirectionTable(file, lines, startIndex, direction, firstColumn, payloadNullable) {
  const table = tableAt(lines, startIndex);
  if (table === null) {
    return [messageDiagnostic(
      "DM-MSG-001",
      file,
      lines[startIndex]?.line ?? 1,
      "Message tables must be contiguous, non-empty pipe tables with consistent rows."
    )];
  }
  const expected = standardColumns(direction, firstColumn);
  const markers = postTableMarkers(lines, table);
  const hasUnknown = table.rows.some((row) => row.includes("unknown"));
  const hasUnknownMarker = markers.some((marker) => marker.kind.type === "unknown");
  if (!validHeader(table.header, expected)
    || table.rows.length === 0
    || !validDirectionRows(table, direction, payloadNullable)
    || !validMarkerOrder(markers)
    || hasUnknown !== hasUnknownMarker) {
    return [messageDiagnostic(
      "DM-MSG-001",
      file,
      table.startLine,
      `${direction} Message tables require the direction-correct columns, values, unknown markers, and root-row invariants.`
    )];
  }
  return [];
}

function subsectionBounds(markdown, heading, blockEnd) {
  const end = markdown.headings.find((candidate) => (
    candidate.line > heading.line
      && candidate.line < blockEnd
      && candidate.level <= heading.level
  ))?.line ?? blockEnd;
  return { start: heading.line, end };
}

function validateMessageTables(file, markdown, message, direction, endLine) {
  const diagnostics = [];
  const subsectionLevel = message.level + 1;
  const subsections = markdown.headings.filter((heading) => (
    heading.level === subsectionLevel
      && heading.line > message.line
      && heading.line < endLine
  ));
  const headers = subsections.find((heading) => heading.text === "Headers");
  if (headers !== undefined) {
    const bounds = subsectionBounds(markdown, headers, endLine);
    const lines = sourceLines(markdown, bounds.start, bounds.end);
    const first = lines.findIndex((line) => line.text !== ""
      && !line.text.startsWith("**deviation**: "));
    if (first !== -1 && lines[first].text.startsWith("|")) {
      diagnostics.push(...validateDirectionTable(file, lines, first, direction, "Name", null));
    }
  }

  const payload = subsections.find((heading) => heading.text === "Payload");
  if (payload !== undefined) {
    const bounds = subsectionBounds(markdown, payload, endLine);
    const lines = sourceLines(markdown, bounds.start, bounds.end);
    for (let index = 0; index < lines.length; index += 1) {
      const table = tableAt(lines, index);
      if (table === null) {
        if (looksLikePayloadTableStart(lines, index)) {
          diagnostics.push(...validateDirectionTable(file, lines, index, direction, "Field", null));
        }
        continue;
      }
      const nullableLine = [...lines.slice(0, index)].reverse()
        .find((line) => line.text.startsWith("**payload_nullable**: "));
      const nullable = nullableLine?.text.slice("**payload_nullable**: ".length) ?? null;
      diagnostics.push(...validateDirectionTable(file, lines, index, direction, "Field", nullable));
      while (lines[index + 1]?.line <= table.endLine) index += 1;
    }
  }
  return diagnostics;
}

function canonicalUnitState(lines, { bindingTable = false, replacementUnit } = {}) {
  let index = 0;
  while (lines[index]?.text.startsWith("**deviation**: ")) index += 1;
  const core = lines.slice(index);
  if (core.length === 1 && core[0].text === "none") return "none";
  if (core.length === 2
    && core[0].text === "unknown"
    && core[1].line === core[0].line + 1
    && core[1].text.startsWith("**unknown**: ")
    && core[1].text.length > "**unknown**: ".length) return "unknown";
  const replacementPrefix = `**unsupported**: replaces ${replacementUnit}: `;
  if (core.length === 1
    && core[0].text.startsWith(replacementPrefix)
    && core[0].text.length > replacementPrefix.length) return "unsupported";
  if (!core[0]?.text.startsWith("|")) return null;
  const table = tableAt(core, 0);
  if (table === null || table.rows.length === 0) return null;
  const markers = postTableMarkers(core, table);
  const consumedLine = markers.at(-1)?.line ?? table.endLine;
  if (core.some((line) => line.line > consumedLine)
    || table.rows.some((row) => row.some((cell, index) => (
      cell === "" && (bindingTable || index !== 4)
    )))
    || !validMarkerOrder(markers)
    || table.rows.some((row) => row.includes("unknown"))
      !== markers.some((marker) => marker.kind.type === "unknown")) return null;
  if (bindingTable
    && !validHeader(table.header, ["Protocol", "Property", "Value / Rule"])) return null;
  return "expanded";
}

function validateMessageStructure(file, markdown, message, endLine, reply) {
  const subsectionLevel = message.level + 1;
  const directHeadings = markdown.headings.filter((heading) => (
    heading.level === subsectionLevel
      && heading.line > message.line
      && heading.line < endLine
  ));
  const lines = sourceLines(markdown, message.line, endLine);
  const entries = [
    ...directHeadings.map((heading) => ({
      collapsed: false,
      line: heading.line,
      name: heading.text
    })),
    ...lines.flatMap((line) => {
      const matched = line.text.match(/^- (Headers|Bindings|Payload): none$/);
      return matched === null ? [] : [{ collapsed: true, line: line.line, name: matched[1] }];
    })
  ].sort((left, right) => left.line - right.line);
  const expected = ["Headers", "Bindings", "Payload"];
  if (entries.length !== expected.length
    || entries.some((entry, index) => entry.name !== expected[index])
    || entries[2]?.collapsed
    || directHeadings.some((heading) => !expected.includes(heading.text))) {
    return [messageDiagnostic(
      "DM-MSG-002",
      file,
      entries.find((entry, index) => entry.name !== expected[index])?.line ?? message.line,
      "An expanded Message requires Headers, Bindings, then a non-collapsed Payload exactly once."
    )];
  }

  let firstNonEmpty = false;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.collapsed) {
      if (firstNonEmpty) {
        return [messageDiagnostic(
          "DM-MSG-002",
          file,
          entry.line,
          "Only leading empty Message subsections may use their collapsed none form."
        )];
      }
      continue;
    }
    const nextLine = entries[index + 1]?.line ?? endLine;
    const content = nonEmptyLines(lines.filter((line) => line.line > entry.line && line.line < nextLine));
    if (entry.name === "Payload") {
      if (content.length === 0) {
        return [messageDiagnostic(
          "DM-MSG-002",
          file,
          entry.line,
          "Payload is never collapsed and requires a non-empty core state."
        )];
      }
      continue;
    }
    const state = canonicalUnitState(content, {
      bindingTable: entry.name === "Bindings",
      replacementUnit: `${reply ? "reply message" : "message"} ${entry.name} ${messageName(message)}`
    });
    if (state === null) {
      return [messageDiagnostic(
        "DM-MSG-002",
        file,
        entry.line,
        `${entry.name} requires one canonical none, whole-subsection unknown, replacement unsupported, or non-empty table state.`
      )];
    }
    if (state !== "none") firstNonEmpty = true;
  }
  return [];
}

function sameNames(actual, expected) {
  return actual.length === expected.length
    && actual.every((name, index) => name === expected[index]);
}

function validateSelectionAndReplacement(file, markdown, heading, endLine, siblingCount, reply) {
  const lines = nonEmptyLines(sourceLines(markdown, heading.line, endLine));
  const subsectionPrefix = `${"#".repeat(heading.level + 1)} `;
  const firstStructureIndex = lines.findIndex((line) => (
    line.text.startsWith(subsectionPrefix)
      || /^- (Headers|Bindings|Payload): none$/.test(line.text)
  ));
  const leading = firstStructureIndex === -1 ? lines : lines.slice(0, firstStructureIndex);
  const replacementIndex = leading.findIndex((line) => line.text.startsWith("**unsupported**: replaces "));
  const replacement = replacementIndex !== -1;
  const selectionLines = replacement ? leading.slice(0, replacementIndex) : leading;
  const selectionValid = siblingCount > 1
    ? selectionLines.length === 1
      && validateSentenceLine({
        text: selectionLines[0].text,
        file: file.path,
        line: selectionLines[0].line
      }, 1, 2).value !== null
    : selectionLines.length === 0;
  if (!selectionValid) {
    return [messageDiagnostic(
      "DM-MSG-003",
      file,
      selectionLines[0]?.line ?? heading.line,
      siblingCount > 1
        ? "Every Message in a multi-message context requires one source line of one or two observable selection sentences."
        : "A single Message begins directly with its contract content and has no selection prose."
    )];
  }
  if (!replacement) return [];

  const name = messageName(heading);
  const prefix = reply
    ? `**unsupported**: replaces reply Message ${name}: `
    : `**unsupported**: replaces Message ${name}: `;
  const marker = leading[replacementIndex];
  const expectedLeadingLength = selectionLines.length + 1;
  if (!marker.text.startsWith(prefix)
    || marker.text.length <= prefix.length
    || leading.length !== expectedLeadingLength
    || firstStructureIndex !== -1) {
    return [messageDiagnostic(
      "DM-MSG-003",
      file,
      marker.line,
      "A complete Message replacement retains only its exact heading, required selection prose, and exact matching replacement marker."
    )];
  }
  return [];
}

function validateMessageIdentity(file, markdown, operationHeading, operationEnd, routedRow, primary, replies) {
  const diagnostics = [];
  const primaryNames = primary.map(messageName);
  const replyNames = replies.map(messageName);
  const allNames = [...primaryNames, ...replyNames];
  const expectedPrimary = (routedRow?.messages ?? []).filter((name) => !name.startsWith("reply:"));
  const validNames = allNames.every((name) => name !== null && MESSAGE_NAME.test(name));
  const uniqueNames = new Set(allNames).size === allNames.length;
  const primaryOrdered = primaryNames.every((name, index) => (
    index === 0 || unicodeScalarCompare(primaryNames[index - 1], name) < 0
  ));
  const replyOrdered = replyNames.every((name, index) => (
    index === 0 || unicodeScalarCompare(replyNames[index - 1], name) < 0
  ));
  if (!validNames || !uniqueNames || !primaryOrdered || !replyOrdered
    || !sameNames(primaryNames, expectedPrimary)) {
    diagnostics.push(messageDiagnostic(
      "DM-MSG-003",
      file,
      [...primary, ...replies].find((heading) => !MESSAGE_NAME.test(messageName(heading) ?? ""))?.line
        ?? operationHeading.line,
      "Message names must be valid and operation-unique, primary and reply groups must be lexically ordered, and primary names must exactly match INDEX routing."
    ));
  }
  for (const heading of primary) {
    diagnostics.push(...validateSelectionAndReplacement(
      file,
      markdown,
      heading,
      blockEndLine(markdown, heading, operationEnd),
      primary.length,
      false
    ));
  }
  const replyHeading = markdown.headings.find((heading) => (
    heading.level === 3
      && heading.text === "Reply"
      && heading.line > operationHeading.line
      && heading.line < operationEnd
  ));
  const replyEnd = replyHeading === undefined ? operationEnd : blockEndLine(markdown, replyHeading, operationEnd);
  for (const heading of replies) {
    diagnostics.push(...validateSelectionAndReplacement(
      file,
      markdown,
      heading,
      blockEndLine(markdown, heading, replyEnd),
      replies.length,
      true
    ));
  }
  return diagnostics;
}

function parseMessageBlocks(file, markdown, operationHeading, operationEnd, routedRow) {
  const diagnostics = [];
  const definitions = [];
  const primary = markdown.headings.filter((heading) => (
    heading.level === 3
      && heading.text.startsWith("Message ")
      && heading.line > operationHeading.line
      && heading.line < operationEnd
  ));
  const replyHeading = markdown.headings.find((heading) => (
    heading.level === 3
      && heading.text === "Reply"
      && heading.line > operationHeading.line
      && heading.line < operationEnd
  ));
  const replyEnd = replyHeading === undefined
    ? operationEnd
    : blockEndLine(markdown, replyHeading, operationEnd);
  const replies = replyHeading === undefined ? [] : markdown.headings.filter((heading) => (
    heading.level === 4
      && heading.text.startsWith("Message ")
      && heading.line > replyHeading.line
      && heading.line < replyEnd
  ));
  diagnostics.push(...validateMessageIdentity(
    file,
    markdown,
    operationHeading,
    operationEnd,
    routedRow,
    primary,
    replies
  ));

  for (const [heading, reply] of [
    ...primary.map((entry) => [entry, false]),
    ...replies.map((entry) => [entry, true])
  ]) {
    const endLine = blockEndLine(markdown, heading, reply ? replyEnd : operationEnd);
    const direction = reply ? oppositeDirection(routedRow?.action) : routedRow?.action;
    if (direction === "SEND" || direction === "RECEIVE") {
      diagnostics.push(...validateMessageTables(file, markdown, heading, direction, endLine));
    }
    const contractLines = nonEmptyLines(sourceLines(markdown, heading.line, endLine));
    const isReplacement = contractLines.some((line) => line.text.startsWith("**unsupported**: replaces "))
      && !contractLines.some((line) => /^#{4,5} (Headers|Bindings|Payload)$/.test(line.text));
    if (!isReplacement) {
      diagnostics.push(...validateMessageStructure(file, markdown, heading, endLine, reply));
    }
    definitions.push({
      direction,
      line: heading.line,
      name: messageName(heading),
      operation: routedRow?.operation ?? operationName(operationHeading),
      path: file.path,
      reply
    });
  }
  return { diagnostics, definitions };
}

function parseMessageFile(file, routedRows) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return { diagnostics: scanned.diagnostics, definitions: [] };
  const markdown = scanned.value;
  const diagnostics = [];
  const definitions = [];
  const operations = markdown.headings.filter((heading) => heading.level === 2);
  for (let index = 0; index < operations.length; index += 1) {
    const heading = operations[index];
    const endLine = operations[index + 1]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
    const name = operationName(heading);
    const routedRow = routedRows.find((row) => row.operation === name);
    const parsed = parseMessageBlocks(file, markdown, heading, endLine, routedRow);
    diagnostics.push(...parsed.diagnostics);
    definitions.push(...parsed.definitions);
  }
  return { diagnostics, definitions };
}

export function validateCoreMessages(documentSet, routingFacts) {
  const rows = routingFacts.operations?.rows ?? [];
  const paths = [...new Set(rows.map((row) => row.channelPath))];
  const diagnostics = [];
  const definitions = [];
  for (const path of paths) {
    const file = documentSet.files.find((entry) => entry.path === path);
    if (file === undefined) continue;
    const parsed = parseMessageFile(file, rows.filter((row) => row.channelPath === path));
    diagnostics.push(...parsed.diagnostics);
    definitions.push(...parsed.definitions);
  }
  const groups = new Map();
  for (const definition of definitions) {
    const entries = groups.get(definition.operation) ?? [];
    entries.push(definition);
    groups.set(definition.operation, entries);
  }
  const byOperation = Object.fromEntries(groups);
  return {
    diagnostics,
    facts: {
      messageDefinitions: { byOperation }
    }
  };
}
