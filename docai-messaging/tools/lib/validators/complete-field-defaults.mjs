import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { parsePipeTable } from "../tables.mjs";

const RULE_ID = "DM-PROFILE-004";
const LOGICAL_TABLE_HEADERS = [
  ["Name", "Type", "Required", "Nullable", "Constraints / Meaning"],
  ["Name", "Type", "Presence", "Nullable", "Meaning"],
  ["Field", "Type", "Required", "Nullable", "Constraints / Meaning"],
  ["Field", "Type", "Presence", "Nullable", "Meaning"]
];
const ALLOWED_DEFAULTS = new Map([
  ["Required", new Set(["yes", "no"])],
  ["Presence", new Set(["always", "optional"])],
  ["Nullable", new Set(["yes", "no"])],
  ["Meaning", new Set(["none"])]
]);

function fieldDefaultsDiagnostic(file, line, message) {
  return diagnostic(RULE_ID, file.path, line, message);
}

function exactArray(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function extensionStart(header) {
  const index = header.findIndex((column) => column.startsWith("x-"));
  return index === -1 ? header.length : index;
}

function parseDefaults(text) {
  const prefix = "**field_defaults**: ";
  if (!text.startsWith(prefix)) return { entries: [], syntaxValid: false };
  const value = text.slice(prefix.length);
  if (value === "") return { entries: [], syntaxValid: false };
  const entries = value.split(" | ").map((part) => {
    const match = part.match(/^([^=]+)=([^=]+)$/);
    return match === null ? null : { column: match[1], value: match[2] };
  });
  return entries.some((entry) => entry === null)
    ? { entries: entries.filter((entry) => entry !== null), syntaxValid: false }
    : { entries, syntaxValid: true };
}

function tableAfter(lines, markerIndex, file) {
  const tableIndex = lines.findIndex((line, index) => (
    index > markerIndex && line.text !== ""
  ));
  if (tableIndex === -1 || lines[tableIndex].inFence || !/^ *\|/.test(lines[tableIndex].text)) {
    return { table: null, tableIndex };
  }
  const parsed = parsePipeTable(lines.slice(tableIndex).map((line) => ({
    text: line.text,
    file: file.path,
    line: line.line
  })));
  return { table: parsed.value, tableIndex };
}

function containingUnit(lines, markerIndex) {
  for (let index = markerIndex - 1; index >= 0; index -= 1) {
    if (lines[index].inFence) continue;
    const heading = lines[index].text.match(/^(#{1,6}) (.+)$/);
    if (heading === null) continue;
    return [4, 5].includes(heading[1].length) && ["Headers", "Payload"].includes(heading[2])
      ? heading[2]
      : null;
  }
  return null;
}

function candidateHeader(compactHeader, defaultColumns) {
  const standardEnd = extensionStart(compactHeader);
  if (compactHeader.slice(standardEnd).some((column) => !column.startsWith("x-"))) return null;
  const standardHeader = compactHeader.slice(0, standardEnd);
  const candidates = LOGICAL_TABLE_HEADERS.filter((logicalHeader) => exactArray(
    logicalHeader.filter((column) => !defaultColumns.has(column)),
    standardHeader
  ));
  if (candidates.length === 1) return candidates[0];
  const exactCandidates = LOGICAL_TABLE_HEADERS.filter((logicalHeader) => (
    exactArray(logicalHeader, standardHeader)
  ));
  return exactCandidates.length === 1 ? exactCandidates[0] : null;
}

function escapedCell(value) {
  return value.replace(/\|/g, "\\|");
}

function renderedTable(table, logicalHeader, defaults) {
  const standardEnd = extensionStart(table.header);
  const compactStandardHeader = table.header.slice(0, standardEnd);
  const extensionHeader = table.header.slice(standardEnd);
  const rows = table.rows.map((row) => {
    const compactValues = new Map(compactStandardHeader.map((column, index) => [
      column,
      row[index]
    ]));
    const logicalValues = logicalHeader.map((column) => {
      if (!defaults.has(column)) return compactValues.get(column);
      return column === "Meaning" ? "" : defaults.get(column);
    });
    return [...logicalValues, ...row.slice(standardEnd)];
  });
  const header = [...logicalHeader, ...extensionHeader];
  return [
    `| ${header.map(escapedCell).join(" | ")} |`,
    `|${header.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.map(escapedCell).join(" | ")} |`)
  ];
}

function expandFile(file) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) {
    return { file, diagnostics: [], facts: [] };
  }
  const sourceLines = file.content.split("\n");
  const lines = scanned.value.lines;
  const diagnostics = [];
  const facts = [];
  for (let markerIndex = 0; markerIndex < lines.length; markerIndex += 1) {
    const marker = lines[markerIndex];
    if (marker.inFence || !marker.text.startsWith("**field_defaults**")) continue;
    const parsedDefaults = parseDefaults(marker.text);
    const { table, tableIndex } = tableAfter(lines, markerIndex, file);
    const uniqueDefaults = new Map();
    for (const entry of parsedDefaults.entries) {
      if (!uniqueDefaults.has(entry.column)) uniqueDefaults.set(entry.column, entry.value);
    }
    const logicalHeader = table === null
      ? null
      : candidateHeader(table.header, new Set(uniqueDefaults.keys()));
    let valid = true;
    const fail = (message) => {
      diagnostics.push(fieldDefaultsDiagnostic(file, marker.line, message));
      valid = false;
    };

    if (file.metadata?.profile !== "compact") {
      fail("field_defaults is permitted only in the compact profile.");
    }
    if (!parsedDefaults.syntaxValid) {
      fail("field_defaults requires one or more exact column=value entries separated by ' | '.");
    }
    if (containingUnit(lines, markerIndex) === null || table === null) {
      fail("field_defaults must appear immediately before a Headers or Payload field table.");
    }

    const seen = new Set();
    for (const entry of parsedDefaults.entries) {
      if (seen.has(entry.column)) {
        fail(`field_defaults column '${entry.column}' appears more than once.`);
      }
      seen.add(entry.column);
      if (!ALLOWED_DEFAULTS.has(entry.column)) {
        fail(`field_defaults column '${entry.column}' is unknown.`);
      } else if (!ALLOWED_DEFAULTS.get(entry.column).has(entry.value)) {
        fail(`field_defaults value '${entry.column}=${entry.value}' is not permitted.`);
      }
    }

    if (table !== null && logicalHeader === null) {
      fail("field_defaults does not reconstruct one direction-correct logical field table.");
    }
    if (table !== null && logicalHeader !== null) {
      const logicalPositions = parsedDefaults.entries.map((entry) => (
        logicalHeader.indexOf(entry.column)
      ));
      if (logicalPositions.some((position) => position === -1)) {
        fail("field_defaults names a column that is not applicable to this logical table.");
      }
      if (logicalPositions.some((position, index) => (
        index > 0 && position <= logicalPositions[index - 1]
      ))) {
        fail("field_defaults columns must follow logical left-to-right table order.");
      }
      const standardEnd = extensionStart(table.header);
      const standardHeader = table.header.slice(0, standardEnd);
      if (parsedDefaults.entries.some((entry) => standardHeader.includes(entry.column))) {
        fail("A defaulted column must be omitted from the compact table.");
      }
      const meaning = parsedDefaults.entries.find((entry) => entry.column === "Meaning");
      if (meaning !== undefined && logicalHeader.at(-1) !== "Meaning") {
        fail("Meaning=none applies only when Meaning is the logical final column.");
      }
    }

    sourceLines[marker.line - 1] = "";
    if (table !== null && logicalHeader !== null) {
      const expanded = renderedTable(table, logicalHeader, uniqueDefaults);
      sourceLines.splice(table.startLine - 1, expanded.length, ...expanded);
    }
    if (valid) {
      facts.push({
        path: file.path,
        line: marker.line,
        columns: parsedDefaults.entries.map((entry) => ({ ...entry })),
        logicalHeader: [...logicalHeader]
      });
    }
    if (tableIndex !== -1) markerIndex = tableIndex;
  }
  return {
    file: sourceLines.join("\n") === file.content
      ? file
      : { ...file, content: sourceLines.join("\n") },
    diagnostics,
    facts
  };
}

export function expandFieldDefaultsFile(file) {
  return expandFile(file).file;
}

export function validateCompleteFieldDefaults(documentSet) {
  const expandedFiles = [];
  const diagnostics = [];
  const fieldDefaults = [];
  for (const file of documentSet.files) {
    const result = expandFile(file);
    expandedFiles.push(result.file);
    diagnostics.push(...result.diagnostics);
    fieldDefaults.push(...result.facts);
  }
  return {
    diagnostics,
    facts: { fieldDefaults },
    expandedDocumentSet: { ...documentSet, files: expandedFiles }
  };
}
