import { diagnostic } from "./diagnostics.mjs";

function sourceLine(input, index) {
  if (typeof input === "string") return { text: input, file: "<input>", line: index + 1 };
  return { text: input.text, file: input.file ?? "<input>", line: input.line ?? index + 1 };
}

function failure(source, message) {
  return {
    value: null,
    diagnostics: [diagnostic("DM-PARSE-TABLE", source.file, source.line, message)]
  };
}

function trimAsciiSpaces(value) {
  return value.replace(/^ +/, "").replace(/ +$/, "");
}

function pipeIsEscaped(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function hasRowBoundaries(text) {
  const trimmed = trimAsciiSpaces(text);
  return trimmed.startsWith("|")
    && trimmed.endsWith("|")
    && !pipeIsEscaped(trimmed, trimmed.length - 1);
}

function parseRow(source) {
  const text = trimAsciiSpaces(source.text);
  if (!text.startsWith("|")) return { error: "Pipe-table row is missing its leading boundary pipe." };
  if (!text.endsWith("|") || pipeIsEscaped(text, text.length - 1)) {
    return { error: "Pipe-table row is missing its trailing boundary pipe." };
  }

  const boundaries = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "|" && !pipeIsEscaped(text, index)) boundaries.push(index);
  }
  const cells = [];
  for (let index = 1; index < boundaries.length; index += 1) {
    const rawCell = text.slice(boundaries[index - 1] + 1, boundaries[index]);
    cells.push(trimAsciiSpaces(rawCell).replace(/\\\|/g, "|"));
  }
  return { cells };
}

export function parsePipeTable(inputs) {
  const lines = Array.isArray(inputs) ? inputs.map(sourceLine) : [];
  const fallback = lines[0] ?? { file: "<input>", line: 1 };
  if (lines.length < 2) return failure(fallback, "Pipe table requires a header and separator row.");

  const header = parseRow(lines[0]);
  if (header.error) return failure(lines[0], header.error);
  const separator = parseRow(lines[1]);
  if (separator.error) return failure(lines[1], separator.error);
  if (separator.cells.length !== header.cells.length || separator.cells.some((cell) => cell !== "---")) {
    return failure(lines[1], "Pipe table requires an exact separator row with one '---' cell per column.");
  }

  const rows = [];
  let endLine = lines[1].line;
  for (const line of lines.slice(2)) {
    if (!hasRowBoundaries(line.text)) break;
    const row = parseRow(line);
    if (row.cells.length !== separator.cells.length) {
      return failure(line, "Pipe-table body row has a different column count from the separator row.");
    }
    rows.push(row.cells);
    endLine = line.line;
  }

  return {
    value: {
      header: header.cells,
      rows,
      startLine: lines[0].line,
      endLine
    },
    diagnostics: []
  };
}
