import { diagnostic } from "../diagnostics.mjs";
import { parseExactJson } from "../json-value.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { parsePipeTable } from "../tables.mjs";
import { hasObjectOpennessDefault, validateCommonFailureShapes } from "./core-messages.mjs";

export const CONVENTION_HEADINGS = [
  "Environments",
  "Protocols and Bindings",
  "Authentication",
  "Connection and Session",
  "Serialization",
  "Message Envelope",
  "Delivery Semantics",
  "Idempotency and Deduplication",
  "Ordering",
  "Error Handling",
  "Request-Reply",
  "Schema Evolution",
  "Data Representation",
  "Empty and Omitted Values",
  "Rate Limits and Quotas"
];

function conventionsDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file?.path ?? "CONVENTIONS.md", line, message);
}

function validateStructure(file, markdown) {
  const headings = markdown.headings.filter((heading) => heading.level <= 2);
  const expected = [
    { level: 1, text: "Messaging Conventions" },
    ...CONVENTION_HEADINGS.map((text) => ({ level: 2, text }))
  ];
  const mismatchIndex = expected.findIndex((entry, index) => (
    headings[index]?.level !== entry.level || headings[index]?.text !== entry.text
  ));
  const titleLine = headings[0]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  const contentBeforeTitle = markdown.lines.find((line) => (
    line.line > file.metadataLine
      && line.line < titleLine
      && line.text !== ""
  ));
  const firstSectionLine = headings[1]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  const titlePrelude = headings[0]?.level === 1 && headings[0]?.text === "Messaging Conventions"
    ? markdown.lines.find((line) => (
      line.line > headings[0].line
        && line.line < firstSectionLine
        && line.text !== ""
    ))
    : undefined;
  const valid = mismatchIndex === -1
    && headings.length === expected.length
    && contentBeforeTitle === undefined
    && titlePrelude === undefined;
  if (valid) return [];

  const mismatch = contentBeforeTitle
    ?? titlePrelude
    ?? headings[mismatchIndex === -1 ? expected.length : mismatchIndex]
    ?? headings.at(-1);
  return [conventionsDiagnostic(
    "DM-CONV-001",
    file,
    mismatch?.line ?? file.identityLine ?? 1,
    "CONVENTIONS.md must contain '# Messaging Conventions' followed by every fixed level-two convention heading exactly once and in canonical order, with no title-level prose."
  )];
}

function sectionLines(file, markdown, heading, nextHeading) {
  const endLine = nextHeading?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  return markdown.lines.filter((line) => (
    line.line > heading.line
      && line.line < endLine
      && !line.inFence
  ));
}

function sectionState(heading, lines) {
  const firstIndex = lines.findIndex((line) => line.text !== "");
  if (firstIndex === -1) return null;

  const first = lines[firstIndex];
  const nonEmpty = lines.filter((line) => line.text !== "");
  const firstShapeIndex = heading.text === "Error Handling"
    ? lines.findIndex((line) => line.text.startsWith("**message_shape**: "))
    : -1;
  const outerNonEmpty = (firstShapeIndex === -1 ? lines : lines.slice(0, firstShapeIndex))
    .filter((line) => line.text !== "");
  if (first.text === "none") {
    return nonEmpty.length === 1 ? { line: heading.line, state: "none" } : null;
  }
  if (first.text === "unknown") {
    const marker = lines[firstIndex + 1];
    const validMarker = marker?.text.startsWith("**unknown**: ")
      && marker.text.length > "**unknown**: ".length;
    return validMarker && nonEmpty.length === 2
      ? { line: heading.line, state: "unknown" }
      : null;
  }

  const replacementPrefix = `**unsupported**: replaces CONVENTIONS ${heading.text}: `;
  if (first.text.startsWith("**unsupported**:")) {
    return first.text.startsWith(replacementPrefix)
        && first.text.length > replacementPrefix.length
        && nonEmpty.length === 1
      ? { line: heading.line, state: "unsupported" }
      : null;
  }
  if (first.text.startsWith("**unknown**:")) return null;
  if (outerNonEmpty.some((line) => line.text === "none" || line.text === "unknown")) return null;
  if (outerNonEmpty.some((line) => line.text.startsWith("**unsupported**: replaces CONVENTIONS "))) {
    return null;
  }
  return { line: heading.line, state: "expanded" };
}

function validateStates(file, markdown) {
  const diagnostics = [];
  const sections = {};
  const headings = markdown.headings.filter((heading) => heading.level === 2);
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const state = sectionState(heading, sectionLines(file, markdown, heading, headings[index + 1]));
    if (state === null) {
      diagnostics.push(conventionsDiagnostic(
        "DM-CONV-002",
        file,
        heading.line,
        `CONVENTIONS '${heading.text}' must contain exactly one canonical none, whole-section unknown, replacement unsupported, or non-empty expanded state.`
      ));
      continue;
    }
    sections[heading.text] = state;
  }
  return { diagnostics, sections };
}

export function validateCoreConventions(documentSet) {
  const file = documentSet.files.find((entry) => entry.path === "CONVENTIONS.md");
  if (file === undefined) {
    return {
      diagnostics: [conventionsDiagnostic(
        "DM-CONV-001",
        null,
        1,
        "A Compatibility Core document set requires CONVENTIONS.md."
      )],
      facts: { conventions: null }
    };
  }

  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) {
    return { diagnostics: scanned.diagnostics, facts: { conventions: null } };
  }
  const structureDiagnostics = validateStructure(file, scanned.value);
  if (structureDiagnostics.length > 0) {
    return { diagnostics: structureDiagnostics, facts: { conventions: null } };
  }

  const states = validateStates(file, scanned.value);
  const failureShapes = validateCommonFailureShapes(
    file,
    scanned.value,
    hasObjectOpennessDefault(documentSet)
  );
  return {
    diagnostics: [...states.diagnostics, ...failureShapes.diagnostics],
    facts: {
      conventions: {
        failureShapes: failureShapes.definitions,
        path: file.path,
        sections: states.sections
      }
    }
  };
}

function scalarCompare(left, right) {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0));
  const rightScalars = Array.from(right, (value) => value.codePointAt(0));
  for (let index = 0; index < Math.min(leftScalars.length, rightScalars.length); index += 1) {
    if (leftScalars[index] !== rightScalars[index]) return leftScalars[index] - rightScalars[index];
  }
  return leftScalars.length - rightScalars.length;
}

function compactJsonString(source) {
  let value;
  try { value = parseExactJson(source); } catch { return false; }
  if (typeof value !== "string") return false;
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
      return false;
    }
  }
  return true;
}

function formatUses(messageFacts) {
  const messageUses = Object.values(messageFacts?.messageDefinitions?.byOperation ?? {})
    .flatMap((definitions) => definitions)
    .flatMap((definition) => (definition.formatUses ?? []).map((use) => ({
      ...use,
      path: definition.path
    })));
  const failureShapes = messageFacts?.failureShapes ?? {};
  const shapeUses = [...(failureShapes.common ?? []), ...(failureShapes.inline ?? [])]
    .flatMap((definition) => (definition.formatUses ?? []).map((use) => ({
      ...use,
      operation: definition.operation,
      path: definition.path
    })));
  const commonByLabel = new Map((failureShapes.common ?? []).map((definition) => (
    [definition.label, definition]
  )));
  const referencedCommonUses = (failureShapes.commonReferences ?? []).flatMap((reference) => {
    const definition = commonByLabel.get(reference.label);
    return (definition?.formatUses ?? []).map((use) => ({
      ...use,
      operation: reference.operation,
      path: definition.path
    }));
  });
  return [...messageUses, ...shapeUses, ...referencedCommonUses];
}

function cellFormatFragments(cell) {
  const fragments = [];
  let cursor = 0;
  while (cursor < cell.length) {
    const start = cell.indexOf("`", cursor);
    if (start === -1) break;
    let delimiterLength = 1;
    while (cell[start + delimiterLength] === "`") delimiterLength += 1;
    const delimiter = "`".repeat(delimiterLength);
    const end = cell.indexOf(delimiter, start + delimiterLength);
    if (end === -1) break;
    const content = cell.slice(start + delimiterLength, end);
    for (const keyword of ["format", "format_annotation"]) {
      const prefix = `${keyword}=`;
      if (content.startsWith(prefix)) {
        fragments.push({
          format: content.slice(prefix.length),
          role: keyword === "format" ? "constraint" : "annotation"
        });
      }
    }
    cursor = end + delimiterLength;
  }
  return fragments;
}

function scannedFormatUses(documentSet, routingFacts) {
  const uses = [];
  const rows = routingFacts.operations?.rows ?? [];
  const eligiblePaths = new Set(rows.flatMap((row) => [row.channelPath, ...row.requiredContexts]));
  for (const file of documentSet.files) {
    if (!eligiblePaths.has(file.path)) continue;
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value === null) continue;
    const lines = scanned.value.lines.filter((line) => !line.inFence);
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].text.trimStart().startsWith("|")) continue;
      const table = parsePipeTable(lines.slice(index)).value;
      if (table === null) continue;
      const operationHeading = [...scanned.value.headings]
        .reverse()
        .find((heading) => heading.level === 2 && heading.line < table.startLine);
      const operation = operationHeading?.text.match(/\(([^()]+)\)$/)?.[1] ?? null;
      const meaningIndex = table.header.findIndex((cell) => (
        cell === "Constraints / Meaning" || cell === "Meaning"
      ));
      if (meaningIndex === -1) {
        while (lines[index + 1]?.line <= table.endLine) index += 1;
        continue;
      }
      for (const row of table.rows) {
        for (const fragment of cellFormatFragments(row[meaningIndex])) {
          uses.push({ ...fragment, operation, path: file.path });
        }
      }
      while (lines[index + 1]?.line <= table.endLine) index += 1;
    }
  }
  return uses;
}

export function validateCoreFormatCatalog(documentSet, routingFacts, messageFacts) {
  const combinedUses = [...formatUses(messageFacts), ...scannedFormatUses(documentSet, routingFacts)];
  const uses = combinedUses.filter((use, index) => combinedUses.findIndex((candidate) => (
    candidate.format === use.format
      && candidate.role === use.role
      && candidate.operation === use.operation
      && candidate.path === use.path
  )) === index);
  if (uses.length === 0) return { diagnostics: [], facts: { formats: [] } };
  const file = documentSet.files.find((entry) => entry.path === "CONVENTIONS.md");
  if (file === undefined) {
    return { diagnostics: [conventionsDiagnostic("DM-CONV-003", null, 1, "Format fragments require a Data Representation catalog.")], facts: { formats: [] } };
  }
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return { diagnostics: [], facts: { formats: [] } };
  const heading = scanned.value.headings.find((entry) => entry.level === 2 && entry.text === "Data Representation");
  const next = scanned.value.headings.find((entry) => entry.level <= 2 && entry.line > (heading?.line ?? Number.MAX_SAFE_INTEGER));
  const lines = heading === undefined ? [] : sectionLines(file, scanned.value, heading, next);
  const first = lines.findIndex((line) => line.text !== "");
  const table = first === -1 ? null : parsePipeTable(lines.slice(first)).value;
  const diagnostics = [];
  const rows = [];
  if (table === null
    || table.header.length !== 3
    || !["Format", "Role", "Meaning"].every((cell, index) => table.header[index] === cell)
    || table.rows.length === 0) {
    diagnostics.push(conventionsDiagnostic(
      "DM-CONV-003",
      file,
      lines[first]?.line ?? heading?.line ?? 1,
      "Expanded Data Representation must begin with one non-empty Format | Role | Meaning table when format fragments are used."
    ));
  } else {
    const additionalFormatTable = lines.some((line, index) => {
      if (line.line <= table.endLine || !line.text.trimStart().startsWith("|")) return false;
      const parsed = parsePipeTable(lines.slice(index)).value;
      return parsed !== null
        && parsed.header.length === 3
        && ["Format", "Role", "Meaning"].every((cell, column) => parsed.header[column] === cell);
    });
    if (additionalFormatTable) {
      diagnostics.push(conventionsDiagnostic(
        "DM-CONV-003",
        file,
        table.endLine + 1,
        "Data Representation contains exactly one Format catalog table."
      ));
    }
    const keys = new Set();
    let previous = null;
    const meanings = new Map();
    for (const row of table.rows) {
      const [format, role, meaning] = row;
      const key = `${format}\u0000${role}`;
      const ordered = previous === null
        || scalarCompare(previous.format, format) < 0
        || (previous.format === format && previous.role < role);
      if (!compactJsonString(format)
        || !["constraint", "annotation"].includes(role)
        || meaning === ""
        || keys.has(key)
        || !ordered) {
        diagnostics.push(conventionsDiagnostic(
          "DM-CONV-003",
          file,
          table.startLine,
          "Format catalog rows require compact JSON-string identities, canonical roles, complete meanings, uniqueness, and canonical ordering."
        ));
        break;
      }
      keys.add(key);
      rows.push({ format, role, meaning });
      const priorMeaning = meanings.get(format);
      if (priorMeaning !== undefined && priorMeaning === meaning) {
        diagnostics.push(conventionsDiagnostic(
          "DM-CONV-003",
          file,
          table.startLine,
          "Constraint and annotation roles for one Format must state their behavioral distinction."
        ));
      }
      meanings.set(format, meaning);
      previous = { format, role };
    }
  }
  for (const use of uses) {
    if (rows.filter((row) => row.format === use.format && row.role === use.role).length !== 1) {
      diagnostics.push(conventionsDiagnostic(
        "DM-CONV-003",
        file,
        heading?.line ?? 1,
        `Format fragment ${use.format} (${use.role}) must resolve to exactly one Data Representation row.`
      ));
    }
    const affectedRows = (routingFacts.operations?.rows ?? []).filter((row) => (
      row.operation === use.operation || row.requiredContexts.includes(use.path)
    ));
    for (const routed of affectedRows) {
      if (routed.conventions !== "all"
        && !(Array.isArray(routed.conventions) && routed.conventions.includes("Data Representation"))) {
        diagnostics.push(conventionsDiagnostic(
          "DM-CONV-003",
          file,
          heading?.line ?? 1,
          `Operation '${routed.operation}' or one of its required workflows uses a format fragment but its selective convention dependency closure omits Data Representation.`
        ));
      }
    }
  }
  return { diagnostics, facts: { formats: rows } };
}
