import { diagnostic } from "../diagnostics.mjs";
import { equalExactJson, parseExactJson } from "../json-value.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { canonicalizeMediaType } from "../media-type.mjs";
import { validateSentenceLine } from "../sentence.mjs";
import { parsePipeTable } from "../tables.mjs";
import { validChannelAddress } from "./core-routing.mjs";

const MESSAGE_NAME = /^[A-Za-z0-9._-]+$/;
const FAILURE_SHAPE_LABEL = /^[a-z][a-z0-9_-]*$/;
const CONSTRAINT_KEYWORDS = [
  "const", "enum", "default", "default_annotation", "format", "format_annotation",
  "minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum", "multipleOf",
  "minLength", "maxLength", "pattern", "minItems", "maxItems", "uniqueItems",
  "minProperties", "maxProperties"
];
const SIMPLE_TYPES = new Set(["string", "int", "number", "bool", "null", "any", "object", "unknown"]);

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
  const unknownMarkers = markers.filter((marker) => marker.kind.type === "unknown");
  const hasUnknownMarker = unknownMarkers.length > 0;
  const unnamedKind = firstColumn === "Name" ? "header" : "field";
  const validMarkerOnlyUnknowns = unknownMarkers.every((marker) => (
    marker.text.startsWith(`**unknown**: additional unnamed ${unnamedKind} requires `)
      || (firstColumn === "Field" && marker.text.startsWith("**unknown**: valid example values require "))
  ));
  if (!validHeader(table.header, expected)
    || table.rows.length === 0
    || !validDirectionRows(table, direction, payloadNullable)
    || !validMarkerOrder(markers)
    || (hasUnknown ? !hasUnknownMarker : !validMarkerOnlyUnknowns)) {
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

function compactJson(source) {
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

function parseCompactJson(source) {
  if (!compactJson(source)) return null;
  try {
    return { value: parseExactJson(source) };
  } catch {
    return null;
  }
}

function validFieldPath(path) {
  if (path === "$") return true;
  let cursor = 0;
  if (path[cursor] === "$") {
    cursor += 1;
    while (path.startsWith("[]", cursor)) cursor += 2;
    if (cursor === path.length) return true;
    if (path[cursor] !== ".") return false;
    cursor += 1;
  }
  let needSegment = true;
  while (cursor < path.length) {
    if (!needSegment) {
      if (path.startsWith("[]", cursor)) {
        cursor += 2;
        continue;
      }
      if (path[cursor] !== ".") return false;
      cursor += 1;
      needSegment = true;
      continue;
    }
    let length = 0;
    if (path.startsWith("{key}", cursor)) {
      cursor += 5;
      needSegment = false;
      continue;
    }
    while (cursor < path.length) {
      const character = path[cursor];
      if (character === "\\") {
        if (cursor + 1 >= path.length || !/[\\.\[\]{}$]/.test(path[cursor + 1])) return false;
        cursor += 2;
        length += 1;
        continue;
      }
      if (character === "." || character === "[" || character === "{" || character === "$") break;
      if (character === "]" || character === "}" || character === "\r" || character === "\n") return false;
      cursor += 1;
      length += 1;
    }
    if (length === 0) return false;
    needSegment = false;
  }
  return !needSegment;
}

function validType(type) {
  let source = type;
  while (source.endsWith("[]")) source = source.slice(0, -2);
  while (source.startsWith("map<string, ") && source.endsWith(">")) {
    source = source.slice("map<string, ".length, -1);
    while (source.endsWith("[]")) source = source.slice(0, -2);
  }
  return SIMPLE_TYPES.has(source);
}

function codeSpanAt(source, start) {
  if (source[start] !== "`") return null;
  let delimiterLength = 1;
  while (source[start + delimiterLength] === "`") delimiterLength += 1;
  const delimiter = "`".repeat(delimiterLength);
  const end = source.indexOf(delimiter, start + delimiterLength);
  if (end === -1) return null;
  return {
    content: source.slice(start + delimiterLength, end),
    end: end + delimiterLength
  };
}

function parseConstraints(meaning) {
  const fragments = [];
  let cursor = 0;
  while (meaning[cursor] === "`") {
    const span = codeSpanAt(meaning, cursor);
    if (span === null) return { valid: false, fragments: [] };
    const equals = span.content.indexOf("=");
    if (equals <= 0) return { valid: false, fragments: [] };
    const keyword = span.content.slice(0, equals);
    const source = span.content.slice(equals + 1);
    const parsed = parseCompactJson(source);
    if (!CONSTRAINT_KEYWORDS.includes(keyword) || parsed === null) {
      return { valid: false, fragments: [] };
    }
    fragments.push({ keyword, source, value: parsed.value });
    cursor = span.end;
    if (meaning.slice(cursor, cursor + 2) === "; " && meaning[cursor + 2] === "`") {
      cursor += 2;
      continue;
    }
    break;
  }
  const order = fragments.map((fragment) => CONSTRAINT_KEYWORDS.indexOf(fragment.keyword));
  const unique = new Set(fragments.map((fragment) => fragment.keyword));
  const validOrder = order.every((rank, index) => index === 0 || order[index - 1] < rank);
  const laterFragment = /`(?:const|enum|default|default_annotation|format|format_annotation|minimum|exclusiveMinimum|maximum|exclusiveMaximum|multipleOf|minLength|maxLength|pattern|minItems|maxItems|uniqueItems|minProperties|maxProperties)=/.test(meaning.slice(cursor));
  const validValues = fragments.every((fragment) => {
    if (fragment.keyword === "enum") return Array.isArray(fragment.value) && fragment.value.length > 0;
    if (["format", "format_annotation", "pattern"].includes(fragment.keyword)) {
      return typeof fragment.value === "string";
    }
    if (["minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum"].includes(fragment.keyword)) {
      return exactNumber(fragment.value);
    }
    if (fragment.keyword === "multipleOf") return positiveExactNumber(fragment.value);
    if (["minLength", "maxLength", "minItems", "maxItems", "minProperties", "maxProperties"].includes(fragment.keyword)) {
      return nonNegativeInteger(fragment.value) !== null;
    }
    if (fragment.keyword === "uniqueItems") return fragment.value === true;
    return true;
  });
  const names = new Set(fragments.map((fragment) => fragment.keyword));
  const exclusivePairs = !(names.has("default") && names.has("default_annotation"))
    && !(names.has("format") && names.has("format_annotation"));
  return {
    valid: validOrder && unique.size === fragments.length && !laterFragment && validValues && exclusivePairs,
    fragments
  };
}

function fieldPathAncestors(path) {
  const ancestors = new Set();
  let cursor = 0;
  let prefix = "";
  while (cursor < path.length) {
    if (path[cursor] === "\\") {
      prefix += path.slice(cursor, cursor + 2);
      cursor += 2;
      continue;
    }
    if (path[cursor] === ".") {
      if (prefix !== "") ancestors.add(prefix);
      prefix += ".";
      cursor += 1;
      continue;
    }
    if (path.startsWith("[]", cursor)) {
      if (prefix !== "") ancestors.add(prefix);
      prefix += "[]";
      cursor += 2;
      continue;
    }
    if (path.startsWith("{key}", cursor)) {
      prefix += "{key}";
      cursor += 5;
      continue;
    }
    prefix += path[cursor];
    cursor += 1;
  }
  ancestors.delete(path);
  return [...ancestors];
}

function escapePathSegment(value) {
  return value.replace(/[\\.\[\]{}$]/g, "\\$&");
}

function examplePaths(value, path = null, paths = new Set()) {
  if (value instanceof Map) {
    for (const [name, child] of value) {
      const childPath = path === null ? escapePathSegment(name) : `${path}.${escapePathSegment(name)}`;
      paths.add(childPath);
      examplePaths(child, childPath, paths);
    }
    return paths;
  }
  if (Array.isArray(value)) {
    if (path === null) paths.add("$");
    const itemPath = path === null ? "$[]" : `${path}[]`;
    for (const child of value) {
      paths.add(itemPath);
      examplePaths(child, itemPath, paths);
    }
    return paths;
  }
  if (path === null) paths.add("$");
  return paths;
}

function fieldPathTokens(path) {
  if (path === "$") return [];
  let cursor = path.startsWith("$") ? 1 : 0;
  if (path[cursor] === ".") cursor += 1;
  const tokens = [];
  let segment = "";
  const flush = () => {
    if (segment !== "") tokens.push({ kind: "property", name: segment });
    segment = "";
  };
  while (cursor < path.length) {
    if (path[cursor] === "\\") {
      segment += path[cursor + 1];
      cursor += 2;
    } else if (path[cursor] === ".") {
      flush();
      cursor += 1;
    } else if (path.startsWith("[]", cursor)) {
      flush();
      tokens.push({ kind: "items" });
      cursor += 2;
    } else if (path.startsWith("{key}", cursor)) {
      flush();
      tokens.push({ kind: "values" });
      cursor += 5;
    } else {
      segment += path[cursor];
      cursor += 1;
    }
  }
  flush();
  return tokens;
}

function observeFieldPath(example, path) {
  const tokens = fieldPathTokens(path);
  if (tokens.length === 0) return { applicable: 1, present: 1, values: [example] };
  let contexts = [example];
  let applicable = 0;
  let present = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = [];
    applicable = 0;
    present = 0;
    if (token.kind === "property") {
      for (const context of contexts) {
        if (!(context instanceof Map)) continue;
        applicable += 1;
        if (context.has(token.name)) {
          present += 1;
          next.push(context.get(token.name));
        }
      }
    } else if (token.kind === "items") {
      for (const context of contexts) {
        if (!Array.isArray(context)) continue;
        applicable += context.length;
        present += context.length;
        next.push(...context);
      }
    } else {
      for (const context of contexts) {
        if (!(context instanceof Map)) continue;
        applicable += context.size;
        present += context.size;
        next.push(...context.values());
      }
    }
    contexts = index === tokens.length - 1 ? next : next.filter((value) => value !== null);
  }
  return { applicable, present, values: contexts };
}

function valueMatchesType(value, type, nullable) {
  if (value === null) return nullable === "yes";
  if (type === "any" || type === "unknown") return true;
  if (value instanceof Map) return type === "object" || type.startsWith("map<string, ");
  if (Array.isArray(value)) return type.endsWith("[]");
  if (typeof value === "string") return type === "string";
  if (typeof value === "boolean") return type === "bool";
  if (value !== null && typeof value === "object" && value.kind === "number") {
    return type === "number" || (type === "int" && value.exponent >= 0n);
  }
  return false;
}

function exactNumber(value) {
  return value !== null && typeof value === "object" && value.kind === "number";
}

function compareExactNumbers(left, right) {
  if (!exactNumber(left) || !exactNumber(right)) return null;
  if (left.sign !== right.sign) return left.sign < right.sign ? -1 : 1;
  if (left.sign === 0) return 0;
  const leftOrder = BigInt(left.coefficient.length) + left.exponent;
  const rightOrder = BigInt(right.coefficient.length) + right.exponent;
  let magnitude;
  if (leftOrder !== rightOrder) {
    magnitude = leftOrder < rightOrder ? -1 : 1;
  } else {
    const length = Math.max(left.coefficient.length, right.coefficient.length);
    magnitude = 0;
    for (let index = 0; index < length; index += 1) {
      const leftDigit = left.coefficient[index] ?? "0";
      const rightDigit = right.coefficient[index] ?? "0";
      if (leftDigit !== rightDigit) {
        magnitude = leftDigit < rightDigit ? -1 : 1;
        break;
      }
    }
  }
  return left.sign < 0 ? -magnitude : magnitude;
}

function positiveExactNumber(value) {
  return exactNumber(value) && value.sign > 0;
}

function exactMultipleOf(value, divisor) {
  if (!exactNumber(value) || !positiveExactNumber(divisor)) return false;
  if (value.sign === 0) return true;
  const exponentDifference = value.exponent - divisor.exponent;
  if (exponentDifference < 0n) return false;
  let numerator = BigInt(value.coefficient);
  let denominator = BigInt(divisor.coefficient);
  const gcd = (left, right) => {
    let a = left;
    let b = right;
    while (b !== 0n) [a, b] = [b, a % b];
    return a;
  };
  const common = gcd(numerator, denominator);
  numerator /= common;
  denominator /= common;
  let twos = 0n;
  let fives = 0n;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    twos += 1n;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    fives += 1n;
  }
  return denominator === 1n && twos <= exponentDifference && fives <= exponentDifference;
}

function nonNegativeInteger(value) {
  return exactNumber(value) && value.sign >= 0 && value.exponent >= 0n ? value : null;
}

function compareCountToExact(count, exact) {
  const value = count === 0
    ? { kind: "number", sign: 0, coefficient: "0", exponent: 0n }
    : { kind: "number", sign: 1, coefficient: String(count), exponent: 0n };
  return compareExactNumbers(value, exact);
}

function satisfiesConstraints(value, fragments) {
  for (const fragment of fragments) {
    const constraint = fragment.value;
    if (fragment.keyword === "const" && !equalExactJson(value, constraint)) return false;
    if (fragment.keyword === "enum") {
      if (!Array.isArray(constraint) || !constraint.some((entry) => equalExactJson(value, entry))) return false;
    }
    if (["minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum"].includes(fragment.keyword)) {
      const comparison = compareExactNumbers(value, constraint);
      if (comparison === null) return false;
      if (fragment.keyword === "minimum" && comparison < 0) return false;
      if (fragment.keyword === "exclusiveMinimum" && comparison <= 0) return false;
      if (fragment.keyword === "maximum" && comparison > 0) return false;
      if (fragment.keyword === "exclusiveMaximum" && comparison >= 0) return false;
    }
    if (fragment.keyword === "multipleOf" && !exactMultipleOf(value, constraint)) return false;
    if (["minLength", "maxLength"].includes(fragment.keyword)) {
      const limit = nonNegativeInteger(constraint);
      if (typeof value !== "string" || limit === null) return false;
      const length = Array.from(value).length;
      if (fragment.keyword === "minLength" && compareCountToExact(length, limit) < 0) return false;
      if (fragment.keyword === "maxLength" && compareCountToExact(length, limit) > 0) return false;
    }
    if (fragment.keyword === "pattern") {
      if (typeof value !== "string" || typeof constraint !== "string") return false;
      try {
        if (!new RegExp(constraint, "u").test(value)) return false;
      } catch {
        return false;
      }
    }
    if (["minItems", "maxItems"].includes(fragment.keyword)) {
      const limit = nonNegativeInteger(constraint);
      if (!Array.isArray(value) || limit === null) return false;
      if (fragment.keyword === "minItems" && compareCountToExact(value.length, limit) < 0) return false;
      if (fragment.keyword === "maxItems" && compareCountToExact(value.length, limit) > 0) return false;
    }
    if (fragment.keyword === "uniqueItems") {
      if (!Array.isArray(value) || constraint !== true) return false;
      for (let left = 0; left < value.length; left += 1) {
        for (let right = left + 1; right < value.length; right += 1) {
          if (equalExactJson(value[left], value[right])) return false;
        }
      }
    }
    if (["minProperties", "maxProperties"].includes(fragment.keyword)) {
      const limit = nonNegativeInteger(constraint);
      if (!(value instanceof Map) || limit === null) return false;
      if (fragment.keyword === "minProperties" && compareCountToExact(value.size, limit) < 0) return false;
      if (fragment.keyword === "maxProperties" && compareCountToExact(value.size, limit) > 0) return false;
    }
  }
  return true;
}

function constraintsCompatibleWithType(type, nullable, fragments) {
  const keywords = new Set(fragments.map((fragment) => fragment.keyword));
  const numeric = ["minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum", "multipleOf"];
  if (numeric.some((keyword) => keywords.has(keyword)) && !["int", "number", "any"].includes(type)) return false;
  if (["minLength", "maxLength", "pattern"].some((keyword) => keywords.has(keyword))
    && !["string", "any"].includes(type)) return false;
  if (["minItems", "maxItems", "uniqueItems"].some((keyword) => keywords.has(keyword))
    && type !== "any" && !type.endsWith("[]")) return false;
  if (["minProperties", "maxProperties"].some((keyword) => keywords.has(keyword))
    && type !== "any" && type !== "object" && !type.startsWith("map<string, ")) return false;
  for (const fragment of fragments) {
    if (["const", "default", "default_annotation"].includes(fragment.keyword)
      && !valueMatchesType(fragment.value, type, nullable)) return false;
    if (fragment.keyword === "enum"
      && !fragment.value.every((value) => valueMatchesType(value, type, nullable))) return false;
    if (fragment.keyword === "pattern") {
      try { new RegExp(fragment.value, "u"); } catch { return false; }
    }
  }
  return true;
}

function constraintsSatisfiable(fragments, nullable) {
  const byName = new Map(fragments.map((fragment) => [fragment.keyword, fragment]));
  const nullAllowedByConst = !byName.has("const") || byName.get("const").value === null;
  const nullAllowedByEnum = !byName.has("enum")
    || byName.get("enum").value.some((value) => value === null);
  if (nullable === "yes" && nullAllowedByConst && nullAllowedByEnum) return true;
  const lower = ["minimum", "exclusiveMinimum"].flatMap((name) => byName.has(name) ? [byName.get(name)] : []);
  const upper = ["maximum", "exclusiveMaximum"].flatMap((name) => byName.has(name) ? [byName.get(name)] : []);
  for (const minimum of lower) {
    for (const maximum of upper) {
      const comparison = compareExactNumbers(minimum.value, maximum.value);
      if (comparison > 0 || (comparison === 0
        && (minimum.keyword === "exclusiveMinimum" || maximum.keyword === "exclusiveMaximum"))) return false;
    }
  }
  for (const [minimumName, maximumName] of [
    ["minLength", "maxLength"],
    ["minItems", "maxItems"],
    ["minProperties", "maxProperties"]
  ]) {
    if (byName.has(minimumName) && byName.has(maximumName)
      && compareExactNumbers(byName.get(minimumName).value, byName.get(maximumName).value) > 0) return false;
  }
  const other = fragments.filter((fragment) => fragment.keyword !== "const");
  if (byName.has("const") && !satisfiesConstraints(byName.get("const").value, other)) return false;
  if (byName.has("enum")
    && !byName.get("enum").value.some((value) => satisfiesConstraints(
      value,
      fragments.filter((fragment) => !["enum", "const"].includes(fragment.keyword))
    ))) return false;
  return true;
}

function exampleFence(markdown, startLine, endLine) {
  const fences = markdown.fences.filter((fence) => fence.startLine > startLine && fence.endLine < endLine);
  if (fences.length !== 1) return null;
  const fence = fences[0];
  const content = markdown.lines
    .filter((line) => line.line > fence.startLine && line.line < fence.endLine)
    .map((line) => line.text)
    .join("\n");
  const longest = [...content.matchAll(/`+/g)].reduce((maximum, match) => Math.max(maximum, match[0].length), 0);
  if (fence.delimiterLength !== Math.max(3, longest + 1)) return null;
  return { ...fence, content };
}

function statesObjectOpenness(meaning) {
  if (/additional properties (?:are )?forbidden/i.test(meaning)) return true;
  const allowed = meaning.match(/additional properties (?:are )?allowed(.*)$/i);
  return allowed !== null
    && /(?:string|int|number|bool|null|any|object|map<string, [^>]+>)(?: values?)?/i.test(allowed[1]);
}

function tableFollowingFence(markdown, fence, endLine) {
  const lines = sourceLines(markdown, fence.endLine, endLine);
  const first = lines.findIndex((line) => line.text !== "");
  if (first === -1) return null;
  return tableAt(lines, first);
}

function validateFields(table, example, operation, message, formatUses, objectOpennessDefault = false, payloadNullable = null) {
  if (table === null) return false;
  const rowsByPath = new Map();
  for (const row of table.rows) {
    if (!validFieldPath(row[0]) || !validType(row[1]) || rowsByPath.has(row[0])) return false;
    if (row[1] === "null" && row[3] !== "yes") return false;
    if (!objectOpennessDefault && row[1] === "object" && !statesObjectOpenness(row[4])) return false;
    const constraints = parseConstraints(row[4]);
    if (!constraints.valid
      || !constraintsCompatibleWithType(row[1], row[3], constraints.fragments)
      || !constraintsSatisfiable(constraints.fragments, row[3])) return false;
    for (const fragment of constraints.fragments) {
      if (["format", "format_annotation"].includes(fragment.keyword)) {
        if (typeof fragment.value !== "string") return false;
        formatUses.push({
          format: fragment.source,
          operation,
          message,
          role: fragment.keyword === "format" ? "constraint" : "annotation"
        });
      }
    }
    rowsByPath.set(row[0], { row, constraints });
  }
  for (const [path] of rowsByPath) {
    for (const ancestor of fieldPathAncestors(path)) {
      const entry = rowsByPath.get(ancestor);
      if (entry === undefined) return false;
      const followedByItems = path.startsWith(`${ancestor}[]`);
      const followedByKeys = path.startsWith(`${ancestor}{key}`);
      if (followedByItems && !entry.row[1].endsWith("[]")) return false;
      if (followedByKeys && !entry.row[1].startsWith("map<string, ") && entry.row[1] !== "object") return false;
      if (!followedByItems && !followedByKeys
        && entry.row[1] !== "object"
        && !entry.row[1].startsWith("map<string, ")) return false;
    }
  }
  if (example === undefined) return true;
  if (example === null && payloadNullable !== "yes") return false;
  if (![...examplePaths(example)].every((path) => rowsByPath.has(path))) return false;
  for (const [path, entry] of rowsByPath) {
    const observed = observeFieldPath(example, path);
    const mandatory = entry.row[2] === "yes" || entry.row[2] === "always";
    if (mandatory && observed.present !== observed.applicable) return false;
    for (const value of observed.values) {
      if (!valueMatchesType(value, entry.row[1], entry.row[3])) return false;
      if (value !== null && !satisfiesConstraints(value, entry.constraints.fragments)) return false;
    }
  }
  return true;
}

function canonicalMediaType(value) {
  if (value === "unknown") return null;
  try {
    const canonical = canonicalizeMediaType(value);
    return canonical === value ? canonical : null;
  } catch {
    return null;
  }
}

function directJsonMediaType(mediaType) {
  const base = mediaType.split(";", 1)[0];
  const slash = base.indexOf("/");
  return !mediaType.includes(";")
    && (base === "application/json" || (slash !== -1 && base.slice(slash + 1).endsWith("+json")));
}

function structuredRepresentationMediaType(mediaType) {
  const base = mediaType.split(";", 1)[0];
  const subtype = base.slice(base.indexOf("/") + 1);
  return directJsonMediaType(mediaType)
    || base === "application/json"
    || subtype.endsWith("+json")
    || base.startsWith("text/")
    || subtype.endsWith("+xml")
    || subtype.endsWith("+yaml")
    || [
      "xml", "yaml", "x-yaml", "csv", "cbor", "msgpack", "protobuf", "avro",
      "ndjson", "x-ndjson", "x-www-form-urlencoded"
    ].includes(subtype);
}

function representationReplacementMediaType(text, name) {
  const prefix = `**unsupported**: replaces payload representation ${name} `;
  if (!text.startsWith(prefix)) return null;
  const source = text.slice(prefix.length);
  const lengthMatch = source.match(/^([1-9][0-9]*):/);
  if (lengthMatch === null) return null;
  const byteLength = Number(lengthMatch[1]);
  const remainder = source.slice(lengthMatch[0].length);
  let cursor = 0;
  let consumed = 0;
  while (cursor < remainder.length && consumed < byteLength) {
    const character = String.fromCodePoint(remainder.codePointAt(cursor));
    consumed += Buffer.byteLength(character, "utf8");
    cursor += character.length;
  }
  if (consumed !== byteLength || !remainder.slice(cursor).startsWith(": ")) return null;
  const mediaType = remainder.slice(0, cursor);
  return canonicalMediaType(mediaType) !== null && remainder.slice(cursor + 2).length > 0
    ? mediaType
    : null;
}

function payloadDiagnostic(ruleId, file, line, message) {
  return [messageDiagnostic(ruleId, file, line, message)];
}

function nonEmptyMarker(text, prefix) {
  return text?.startsWith(prefix) && text.length > prefix.length;
}

function validateVariantBlocks(file, markdown, region, direction, operation, message, formatUses, objectOpennessDefault, payloadNullable) {
  const markers = region.filter((line) => line.text.startsWith("**variant**: "));
  if (markers.length === 0) return { diagnostics: [], valid: false };
  const diagnostics = [];
  const identities = [];
  let taggedKind = null;
  let taggedDiscriminator = null;
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const value = marker.text.slice("**variant**: ".length);
    const delimiter = value.indexOf(" = ");
    const tagged = delimiter !== -1;
    if (taggedKind === null) taggedKind = tagged;
    const invalidAsciiBoundary = !tagged && (value.startsWith(" ") || value.endsWith(" "));
    if (taggedKind !== tagged || value === "" || invalidAsciiBoundary) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, marker.line, "Variant markers must use one canonical tagged or untagged form."));
      continue;
    }
    let discriminator = null;
    let discriminatorValue = null;
    let identity = value;
    if (tagged) {
      discriminator = value.slice(0, delimiter);
      const source = value.slice(delimiter + 3);
      const parsed = parseCompactJson(source);
      identity = source;
      if (!validFieldPath(discriminator) || discriminator.includes(" = ") || parsed === null) {
        diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, marker.line, "Tagged variants require a valid field path and compact exact JSON value."));
        continue;
      }
      if (taggedDiscriminator === null) taggedDiscriminator = discriminator;
      else if (taggedDiscriminator !== discriminator) {
        diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, marker.line, "Every tagged variant block in one representation uses the same discriminator field path."));
      }
      discriminatorValue = parsed.value;
    } else if (value.includes(" = ")) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, marker.line, "An invalid tagged marker cannot fall back to an untagged label."));
      continue;
    }
    identities.push(identity);
    const blockEnd = markers[index + 1]?.line ?? region.at(-1).line + 1;
    const fence = exampleFence(markdown, marker.line, blockEnd);
    const table = fence === null ? null : tableFollowingFence(markdown, fence, blockEnd);
    let example = null;
    if (fence !== null && fence.info === "json") {
      try { example = parseExactJson(fence.content); } catch { example = null; }
    }
    if (fence === null || example === null || table === null) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, marker.line, "Every variant requires one complete adapter-correct example and field table."));
      continue;
    }
    if (region.some((line) => line.line > table.endLine && line.line < blockEnd && line.text.startsWith("|"))) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, table.endLine + 1, "A variant contains exactly one field table."));
    }
    if (!validateFields(table, example, operation, message, formatUses, objectOpennessDefault, payloadNullable)) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-005", file, table.startLine, "Variant examples and field tables require valid paths, types, constraints, openness, and complete example coverage."));
    }
    if (tagged) {
      const row = table.rows.find((entry) => entry[0] === discriminator);
      const constFragment = row === undefined
        ? null
        : parseConstraints(row[4]).fragments.find((fragment) => fragment.keyword === "const");
      if (constFragment === undefined || constFragment === null
        || !equalExactJson(constFragment.value, discriminatorValue)) {
        diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, marker.line, "A tagged variant discriminator row requires an exactly equal const fragment."));
      }
    }
  }
  if (identities.some((identity, index) => index > 0
    && unicodeScalarCompare(identities[index - 1], identity) >= 0)) {
    diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, markers[0].line, "Variant blocks must be unique and ordered by their canonical identity."));
  }
  return { diagnostics, valid: true };
}

function validateExpandedRepresentation(file, markdown, region, direction, operation, name, formatUses, objectOpennessDefault) {
  const diagnostics = [];
  const mediaLine = region[0];
  const mediaType = canonicalMediaType(mediaLine.text.slice("**media_type**: ".length));
  if (mediaType === null) {
    return { diagnostics: payloadDiagnostic("DM-MSG-004", file, mediaLine.line, "Payload media types must be concrete canonical RFC 9110 media types."), mediaType: null };
  }
  const content = region.slice(1).filter((line) => line.text !== "");
  if (!content[0]?.text.startsWith("**payload_nullable**: ")) {
    const rawValid = !structuredRepresentationMediaType(mediaType)
      && content.length > 0
      && content.every((line) => !line.text.startsWith("**") && !line.text.startsWith("|") && !line.text.startsWith("```"))
      && validateSentenceLine({ text: content.map((line) => line.text).join(" "), file: file.path, line: content[0]?.line ?? mediaLine.line }, 1, 2).value !== null;
    if (!rawValid) diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, mediaLine.line, "A raw payload requires canonical media-type-plus-prose form; structured representations require nullability, example, and table."));
    return { diagnostics, mediaType };
  }
  const nullableLine = content[0];
  const nullable = nullableLine.text.slice("**payload_nullable**: ".length);
  if (!["yes", "no", "unknown"].includes(nullable)) {
    diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, nullableLine.line, "payload_nullable must be yes, no, or unknown."));
    return { diagnostics, mediaType };
  }
  let cursor = 1;
  if (nullable === "unknown") {
    const marker = content[cursor];
    if (marker?.line !== nullableLine.line + 1 || !nonEmptyMarker(marker.text, "**unknown**: ")) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, nullableLine.line, "Unknown payload nullability requires its immediately adjacent key-local marker."));
      return { diagnostics, mediaType };
    }
    cursor += 1;
  }
  const remaining = content.slice(cursor);
  if (remaining[0]?.text === "unknown") {
    const marker = remaining[1];
    if (remaining.length !== 2 || marker?.line !== remaining[0].line + 1
      || !nonEmptyMarker(marker.text, "**unknown**: payload field collection requires ")) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, remaining[0].line, "Representation-local field unknown requires its exclusive canonical two-line form."));
    }
    return { diagnostics, mediaType };
  }
  if (remaining[0]?.text.startsWith("|")) {
    const table = tableAt(remaining, 0);
    const markers = table === null ? [] : postTableMarkers(remaining, table);
    const collectionMarker = markers.find((marker) => nonEmptyMarker(marker.text, "**unknown**: additional unnamed field requires "));
    const consumed = markers.at(-1)?.line ?? table?.endLine;
    if (table === null || collectionMarker === undefined
      || remaining.some((line) => line.line > consumed)
      || !validateFields(table, undefined, operation, name, formatUses, objectOpennessDefault)) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, remaining[0].line, "A named-sibling example omission requires one field table and its immediate additional-unnamed-field marker."));
    }
    return { diagnostics, mediaType };
  }
  const variants = validateVariantBlocks(file, markdown, remaining, direction, operation, name, formatUses, objectOpennessDefault, nullable);
  if (variants.valid) {
    diagnostics.push(...variants.diagnostics);
    const firstVariant = remaining.findIndex((line) => line.text.startsWith("**variant**: "));
    if (remaining.slice(0, firstVariant).some((line) => line.text.startsWith("```") || line.text.startsWith("|"))) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, remaining[0]?.line ?? nullableLine.line, "A polymorphic representation has no unlabeled example or common field table."));
    }
    return { diagnostics, mediaType };
  }
  const regionEnd = region.at(-1)?.line + 1 ?? nullableLine.line + 1;
  const fence = exampleFence(markdown, nullableLine.line, regionEnd);
  const table = fence === null ? null : tableFollowingFence(markdown, fence, regionEnd);
  let example = null;
  if (fence === null
    || remaining[0]?.line !== fence.startLine
    || fence.info !== "json"
    || !directJsonMediaType(mediaType)
    || table === null) {
    diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, nullableLine.line, "A complete structured representation requires one adapter-correct concrete example followed by its field table."));
    return { diagnostics, mediaType };
  }
  if (region.some((line) => line.line > table.endLine && line.text.startsWith("|"))) {
    diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, table.endLine + 1, "A structured representation contains exactly one field table."));
  }
  const collectionMarker = postTableMarkers(region, table).find((marker) => (
    nonEmptyMarker(marker.text, "**unknown**: additional unnamed field requires ")
  ));
  if (collectionMarker !== undefined) {
    diagnostics.push(...payloadDiagnostic(
      "DM-MSG-004",
      file,
      collectionMarker.line,
      "An additional-unnamed-field marker requires the canonical field table without an example."
    ));
  }
  try { example = parseExactJson(fence.content); } catch {
    diagnostics.push(...payloadDiagnostic("DM-MSG-005", file, fence.startLine, "A JSON payload example must parse exactly without duplicate object names or numeric narrowing."));
    return { diagnostics, mediaType };
  }
  if (example === null && nullable !== "yes") {
    diagnostics.push(...payloadDiagnostic("DM-MSG-005", file, fence.startLine, "A null root example requires payload_nullable=yes."));
  } else if (!validateFields(table, example, operation, name, formatUses, objectOpennessDefault, nullable)) {
    diagnostics.push(...payloadDiagnostic("DM-MSG-005", file, table.startLine, "Payload examples and field tables require valid paths, types, constraints, openness, and complete example coverage."));
  }
  return { diagnostics, mediaType };
}

function validatePayload(file, markdown, message, direction, endLine, reply, operation, objectOpennessDefault) {
  const level = message.level + 1;
  const payload = markdown.headings.find((heading) => (
    heading.level === level && heading.text === "Payload"
      && heading.line > message.line && heading.line < endLine
  ));
  if (payload === undefined) return { diagnostics: [], formatUses: [] };
  const lines = markdown.lines.filter((line) => line.line > payload.line && line.line < endLine);
  const visible = lines.filter((line) => !line.inFence && line.text !== "");
  let cursor = 0;
  while (visible[cursor]?.text.startsWith("**deviation**: ")) cursor += 1;
  const core = visible.slice(cursor);
  if (core.length === 1 && core[0].text === "none") return { diagnostics: [], formatUses: [] };
  const expectedMarker = direction === "SEND" ? "**payload_required**: " : "**payload_presence**: ";
  const first = core[0];
  if (first === undefined || !first.text.startsWith(expectedMarker)) {
    return { diagnostics: payloadDiagnostic("DM-MSG-004", file, first?.line ?? payload.line, "A non-empty Payload begins with its direction-correct whole-payload marker."), formatUses: [] };
  }
  const value = first.text.slice(expectedMarker.length);
  const validValue = direction === "SEND"
    ? ["yes", "no", "unknown"].includes(value)
    : value !== ""
      && value === value.trim()
      && !/^(?:\*\*|#|\||```|- )/.test(value)
      && !["conditional", "none", "yes", "no"].includes(value);
  if (!validValue) {
    return { diagnostics: payloadDiagnostic("DM-MSG-004", file, first.line, "The whole-payload marker has a canonical direction-correct value."), formatUses: [] };
  }
  let index = 1;
  if (value === "unknown") {
    const marker = core[index];
    if (marker?.line !== first.line + 1 || !nonEmptyMarker(marker.text, "**unknown**: ")) {
      return { diagnostics: payloadDiagnostic("DM-MSG-004", file, first.line, "Unknown whole-payload state requires its immediately adjacent key-local marker."), formatUses: [] };
    }
    index += 1;
  }
  const remaining = core.slice(index);
  if (remaining[0]?.text === "unknown") {
    const marker = remaining[1];
    const valid = remaining.length === 2 && marker?.line === remaining[0].line + 1
      && nonEmptyMarker(marker.text, "**unknown**: payload representation set requires ");
    return {
      diagnostics: valid ? [] : payloadDiagnostic("DM-MSG-004", file, remaining[0].line, "Whole-payload representation unknown requires its exclusive canonical two-line form."),
      formatUses: []
    };
  }
  const payloadReplacement = `${reply ? "reply message" : "message"} Payload ${messageName(message)}`;
  const payloadReplacementPrefix = `**unsupported**: replaces ${payloadReplacement}: `;
  if (remaining[0]?.text.startsWith("**unsupported**: replaces ")
    && !remaining[0].text.startsWith("**unsupported**: replaces payload representation ")) {
    const valid = remaining.length === 1 && remaining[0].text.startsWith(payloadReplacementPrefix)
      && remaining[0].text.length > payloadReplacementPrefix.length;
    return { diagnostics: valid ? [] : payloadDiagnostic("DM-MSG-004", file, remaining[0].line, "Payload replacement must name its exact containing Message Payload unit."), formatUses: [] };
  }
  const markerIndices = [];
  for (let position = 0; position < remaining.length; position += 1) {
    if (remaining[position].text.startsWith("**media_type**: ")
      || remaining[position].text.startsWith("**unsupported**: replaces payload representation ")) {
      markerIndices.push(position);
    }
  }
  if (markerIndices.length === 0) {
    return { diagnostics: payloadDiagnostic("DM-MSG-004", file, remaining[0]?.line ?? first.line, "A known non-empty Payload requires at least one representation."), formatUses: [] };
  }
  const diagnostics = [];
  const formatUses = [];
  const mediaTypes = [];
  const leading = remaining.slice(0, markerIndices[0]);
  for (let marker = 0; marker < markerIndices.length; marker += 1) {
    const start = markerIndices[marker];
    const finish = markerIndices[marker + 1] ?? remaining.length;
    const region = remaining.slice(start, finish);
    if (region[0].text.startsWith("**unsupported**:")) {
      const mediaType = representationReplacementMediaType(region[0].text, messageName(message));
      if (region.length !== 1 || mediaType === null) {
        diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, region[0].line, "Representation replacement uses the exact message name, UTF-8 byte length, canonical media type, and reason delimiter."));
      } else {
        mediaTypes.push(mediaType);
      }
      continue;
    }
    const parsed = validateExpandedRepresentation(file, markdown, region, direction, operation, messageName(message), formatUses, objectOpennessDefault);
    diagnostics.push(...parsed.diagnostics);
    if (parsed.mediaType !== null) mediaTypes.push(parsed.mediaType);
  }
  if (new Set(mediaTypes).size !== mediaTypes.length) {
    diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, remaining[markerIndices[0]].line, "Concrete media types are unique within one Payload."));
  }
  if (mediaTypes.length > 1) {
    const selection = leading.map((line) => line.text).join(" ");
    if (!/sender/i.test(selection) || !/select/i.test(selection)
      || !/receiver/i.test(selection) || !/(?:branch|wire (?:format|media type))/i.test(selection)) {
      diagnostics.push(...payloadDiagnostic("DM-MSG-006", file, leading[0]?.line ?? first.line, "Multiple media types require explicit sender selection and receiver wire-format branching prose."));
    }
  } else if (leading.length > 0) {
    diagnostics.push(...payloadDiagnostic("DM-MSG-004", file, leading[0].line, "Payload representation prose must occur only in a structurally assigned position."));
  }
  return { diagnostics, formatUses };
}

function canonicalUnitState(lines, {
  bindingTable = false,
  collectionUnknownPrefix = null,
  replacementUnit
} = {}) {
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
  const unknownMarkers = markers.filter((marker) => marker.kind.type === "unknown");
  const hasUnknownCell = table.rows.some((row) => row.includes("unknown"));
  const collectionOnlyUnknowns = collectionUnknownPrefix !== null
    && unknownMarkers.every((marker) => (
      marker.text.startsWith(collectionUnknownPrefix)
        && marker.text.length > collectionUnknownPrefix.length
    ));
  if (core.some((line) => line.line > consumedLine)
    || table.rows.some((row) => row.some((cell, index) => (
      cell === "" && (bindingTable || index !== 4)
    )))
    || !validMarkerOrder(markers)
    || (hasUnknownCell
      ? unknownMarkers.length === 0
      : unknownMarkers.length > 0 && !collectionOnlyUnknowns)) return null;
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
      collectionUnknownPrefix: entry.name === "Headers"
        ? "**unknown**: additional unnamed header requires "
        : null,
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

function validLeadingDeviations(lines) {
  if (lines.some((line) => (
    !line.text.startsWith("**deviation**: ")
      || line.text.length <= "**deviation**: ".length
  ))) return false;
  return lines.every((line, index) => (
    index === 0 || unicodeScalarCompare(lines[index - 1].text, line.text) < 0
  ));
}

function replyState(markdown, heading, endLine) {
  const lines = nonEmptyLines(sourceLines(markdown, heading.line, endLine));
  let index = 0;
  while (lines[index]?.text.startsWith("**deviation**:")) index += 1;
  const deviations = lines.slice(0, index);
  const core = lines.slice(index);
  if (!validLeadingDeviations(deviations)) return { state: "invalid", lines, core };
  if (core.length === 1 && core[0].text === "none") return { state: "none", lines, core };
  const unknownPrefixes = [
    "**unknown**: reply message set requires ",
    "**unknown**: reply message identity requires ",
    "**unknown**: reply channel requires ",
    "**unknown**: reply message selection rules require "
  ];
  if (core.length === 2
    && core[0].text === "unknown"
    && core[1].line === core[0].line + 1
    && unknownPrefixes.some((prefix) => (
      core[1].text.startsWith(prefix) && core[1].text.length > prefix.length
    ))) {
    return { state: "unknown", lines, core };
  }
  const replacement = "**unsupported**: replaces Reply: ";
  if (core.length === 1
    && core[0].text.startsWith(replacement)
    && core[0].text.length > replacement.length) {
    return { state: "unsupported", lines, core };
  }
  if (/^- (?:channel|correlation|timeout):/.test(core[0]?.text ?? "")) {
    return { state: "expanded", lines, core };
  }
  return { state: "invalid", lines, core };
}

function addressParameters(address) {
  return [...new Set([...address.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]))];
}

function sameUnorderedNames(actual, expected) {
  const left = [...actual].sort(unicodeScalarCompare);
  const right = [...expected].sort(unicodeScalarCompare);
  return sameNames(left, right);
}

function replyChannelUnitState(lines, { parameter, replacementUnit }) {
  const content = nonEmptyLines(lines);
  let index = 0;
  while (content[index]?.text.startsWith("**deviation**:")) index += 1;
  if (!validLeadingDeviations(content.slice(0, index))) return null;
  const core = content.slice(index);
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
  const table = tableAt(core, 0);
  if (table === null || table.rows.length === 0) return null;
  const expectedHeader = parameter
    ? ["Name", "Type", "Constraints / Meaning"]
    : ["Protocol", "Property", "Value / Rule"];
  const markers = postTableMarkers(core, table);
  const consumedLine = markers.at(-1)?.line ?? table.endLine;
  const unknownMarkers = markers.filter((marker) => marker.kind.type === "unknown");
  const hasUnknown = table.rows.some((row) => row.includes("unknown"));
  const collectionMarkers = parameter && unknownMarkers.every((marker) => (
    marker.text.startsWith("**unknown**: additional unnamed parameter requires ")
      && marker.text.length > "**unknown**: additional unnamed parameter requires ".length
  ));
  if (!validHeader(table.header, expectedHeader)
    || table.rows.some((row) => row.some((cell) => cell === ""))
    || core.some((line) => line.line > consumedLine)
    || !validMarkerOrder(markers)
    || (hasUnknown ? unknownMarkers.length === 0 : unknownMarkers.length > 0 && !collectionMarkers)) {
    return null;
  }
  return { state: "expanded", table };
}

function replyChannelEntries(markdown, channelHeading, channelEnd) {
  const lines = sourceLines(markdown, channelHeading.line, channelEnd);
  const directHeadings = markdown.headings.filter((heading) => (
    heading.level === 5
      && heading.line > channelHeading.line
      && heading.line < channelEnd
  ));
  const entries = [
    ...directHeadings.map((heading) => ({
      collapsed: false,
      heading,
      line: heading.line,
      name: heading.text
    })),
    ...lines.flatMap((line) => {
      const matched = line.text.match(/^- (Parameters|Bindings): none$/);
      return matched === null ? [] : [{ collapsed: true, heading: null, line: line.line, name: matched[1] }];
    })
  ].sort((left, right) => left.line - right.line);
  if (entries.length !== 2
    || entries[0]?.name !== "Parameters"
    || entries[1]?.name !== "Bindings"
    || directHeadings.some((heading) => !["Parameters", "Bindings"].includes(heading.text))) {
    return null;
  }
  const leading = nonEmptyLines(lines.filter((line) => line.line < entries[0].line));
  if (!validLeadingDeviations(leading)) return null;

  const states = [];
  let firstNonEmpty = false;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    let state;
    if (entry.collapsed) {
      if (firstNonEmpty) return null;
      state = { state: "none", table: null };
    } else {
      const nextLine = entries[index + 1]?.line ?? channelEnd;
      const content = lines.filter((line) => line.line > entry.line && line.line < nextLine);
      state = replyChannelUnitState(content, {
        parameter: entry.name === "Parameters",
        replacementUnit: entry.name === "Parameters"
          ? "reply channel Parameters"
          : "reply channel Bindings"
      });
      if (state === null) return null;
    }
    if (state.state !== "none") firstNonEmpty = true;
    states.push(state);
  }
  return { parameters: states[0], bindings: states[1] };
}

function validateExpandedReply(file, markdown, replyHeading, replyEnd, routedRow, state) {
  const core = state.core;
  const channelHeading = markdown.headings.find((heading) => (
    heading.level === 4
      && heading.text === "Channel"
      && heading.line > replyHeading.line
      && heading.line < replyEnd
  ));
  const directHeadings = markdown.headings.filter((heading) => (
    heading.level === 4
      && heading.line > replyHeading.line
      && heading.line < replyEnd
  ));
  if (channelHeading === undefined
    || directHeadings[0] !== channelHeading
    || directHeadings.some((heading, index) => (
      index > 0 && !heading.text.startsWith("Message ")
    ))) {
    return [messageDiagnostic(
      "DM-REPLY-002",
      file,
      directHeadings[0]?.line ?? replyHeading.line,
      "Expanded Reply requires one Channel followed only by its reply Message sections."
    )];
  }

  const preChannel = core.filter((line) => line.line < channelHeading.line);
  const keys = ["channel", "correlation", "timeout"];
  const values = [];
  for (let index = 0; index < keys.length; index += 1) {
    const matched = preChannel[index]?.text.match(new RegExp(`^- ${keys[index]}: (.+)$`));
    if (matched === null || matched === undefined) {
      return [messageDiagnostic(
        "DM-REPLY-002",
        file,
        preChannel[index]?.line ?? replyHeading.line,
        "Expanded Reply requires non-empty channel, correlation, and timeout keys exactly once and in order."
      )];
    }
    values.push(matched[1]);
  }
  const markers = preChannel.slice(keys.length);
  const markerLinesValid = markers.length === 0 || (
    markers[0].line === preChannel[2].line + 1
      && markers.every((line, index) => (
        line.text.startsWith("**unknown**: ")
          && line.text.length > "**unknown**: ".length
          && (index === 0 || line.line === markers[index - 1].line + 1)
      ))
  );
  const unknownValues = values.filter((value) => value === "unknown").length;
  const dynamicPrefix = values[0].startsWith("dynamic -- ");
  const dynamic = dynamicPrefix && values[0].length > "dynamic -- ".length;
  const staticChannel = !dynamicPrefix
    && values[0] !== "dynamic"
    && values[0] !== "unknown"
    && validChannelAddress(values[0]);
  if ((!dynamic && !staticChannel)
    || values[1] === "none"
    || (values[2] === "none" && routedRow?.action !== "RECEIVE")
    || !markerLinesValid
    || (unknownValues > 0) !== (markers.length > 0)) {
    return [messageDiagnostic(
      "DM-REPLY-002",
      file,
      preChannel[0]?.line ?? replyHeading.line,
      "Reply keys require an established static or dynamic channel, correlation, direction-correct timeout, and markers for key-local unknown values."
    )];
  }

  const channelEnd = directHeadings[1]?.line ?? replyEnd;
  const channel = replyChannelEntries(markdown, channelHeading, channelEnd);
  if (channel === null) {
    return [messageDiagnostic(
      "DM-REPLY-002",
      file,
      channelHeading.line,
      "Reply Channel requires Parameters then Bindings with canonical states, leading-empty collapse, and reply-scoped replacement units."
    )];
  }
  const actualParameters = channel.parameters.table?.rows.map((row) => row[0]) ?? [];
  const expectedParameters = dynamic ? [] : addressParameters(values[0]);
  const parameterStateValid = dynamic
    ? channel.parameters.state === "none"
    : channel.parameters.state === "expanded"
      ? new Set(actualParameters).size === actualParameters.length
        && sameUnorderedNames(actualParameters, expectedParameters)
      : channel.parameters.state === "none"
        ? expectedParameters.length === 0
        : expectedParameters.length > 0;
  if (!parameterStateValid) {
    return [messageDiagnostic(
      "DM-REPLY-002",
      file,
      channelHeading.line,
      "Reply Channel Parameters must exactly cover a static address or be none for a dynamic address."
    )];
  }
  return [];
}

function validateReply(file, markdown, operationHeading, operationEnd, routedRow, replies) {
  const replyHeading = markdown.headings.find((heading) => (
    heading.level === 3
      && heading.text === "Reply"
      && heading.line > operationHeading.line
      && heading.line < operationEnd
  ));
  if (replyHeading === undefined) return { diagnostics: [], state: "invalid" };
  const replyEnd = blockEndLine(markdown, replyHeading, operationEnd);
  const state = replyState(markdown, replyHeading, replyEnd);
  const diagnostics = [];
  if (state.state === "invalid") {
    diagnostics.push(messageDiagnostic(
      "DM-REPLY-001",
      file,
      state.core[0]?.line ?? replyHeading.line,
      "Reply requires ordered leading deviations followed by exactly one none, whole-section unknown, replacement unsupported, or expanded core state."
    ));
  } else if (state.state === "expanded") {
    diagnostics.push(...validateExpandedReply(
      file,
      markdown,
      replyHeading,
      replyEnd,
      routedRow,
      state
    ));
  }

  const expectedReplies = (routedRow?.messages ?? [])
    .filter((name) => name.startsWith("reply:"))
    .map((name) => name.slice("reply:".length));
  const actualReplies = replies.map(messageName);
  const selectionInvalid = state.state === "expanded"
    && replies.length > 1
    && replies.some((heading) => validateSelectionAndReplacement(
      file,
      markdown,
      heading,
      blockEndLine(markdown, heading, replyEnd),
      replies.length,
      true
    ).length > 0);
  const routingInvalid = state.state === "expanded"
    ? replies.length === 0 || !sameNames(actualReplies, expectedReplies)
    : expectedReplies.length !== 0;
  if (routingInvalid || selectionInvalid) {
    diagnostics.push(messageDiagnostic(
      "DM-REPLY-003",
      file,
      replies[0]?.line ?? replyHeading.line,
      "Only an expanded Reply contributes its exact selected reply Message set to INDEX routing, and every multi-message selection must remain observable."
    ));
  }
  return { diagnostics, state: state.state };
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

function remapDiagnostics(diagnostics, ruleId) {
  return diagnostics.map((entry) => ({ ...entry, ruleId }));
}

function failureShapeMarkers(markdown, startLine, endLine) {
  return markdown.lines.flatMap((line) => {
    if (line.inFence
      || line.line <= startLine
      || line.line >= endLine
      || !line.text.startsWith("**message_shape**")) return [];
    const matched = line.text.match(/^\*\*message_shape\*\*: (.*)$/);
    return [{ label: matched?.[1] ?? "", line: line.line }];
  });
}

function failureShapeFormatUses(markdown, startLine, endLine, operation, label) {
  const lines = sourceLines(markdown, startLine, endLine);
  const uses = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].text.trimStart().startsWith("|")) continue;
    const table = tableAt(lines, index);
    if (table === null) continue;
    const meaningIndex = table.header.findIndex((cell) => (
      cell === "Meaning" || cell === "Constraints / Meaning"
    ));
    if (meaningIndex !== -1) {
      for (const row of table.rows) {
        const constraints = parseConstraints(row[meaningIndex]);
        for (const fragment of constraints.fragments) {
          if (!["format", "format_annotation"].includes(fragment.keyword)) continue;
          uses.push({
            format: fragment.source,
            message: label,
            operation,
            role: fragment.keyword === "format" ? "constraint" : "annotation"
          });
        }
      }
    }
    while (lines[index + 1]?.line <= table.endLine) index += 1;
  }
  return uses;
}

function validateFailureShape(file, markdown, marker, endLine, ruleId, operation, objectOpennessDefault) {
  const diagnostics = [];
  const lines = sourceLines(markdown, marker.line, endLine);
  const content = nonEmptyLines(lines);
  const replacementPrefix = `**unsupported**: replaces failure shape ${marker.label}: `;
  const replacement = content[0]?.text.startsWith("**unsupported**: replaces ") ?? false;
  if (!FAILURE_SHAPE_LABEL.test(marker.label)) {
    diagnostics.push(messageDiagnostic(
      ruleId,
      file,
      marker.line,
      "A failure-shape label starts with a lowercase ASCII letter and contains only lowercase letters, digits, underscores, or hyphens."
    ));
  }
  if (replacement) {
    const blank = markdown.lines.find((line) => line.line === marker.line + 1);
    const valid = content.length === 1
      && content[0].line === marker.line + 2
      && blank?.text === ""
      && content[0].text.startsWith(replacementPrefix)
      && content[0].text.length > replacementPrefix.length;
    if (!valid) {
      diagnostics.push(messageDiagnostic(
        ruleId,
        file,
        content[0]?.line ?? marker.line,
        "A replacement failure shape contains only its exact matching replacement marker after one blank line."
      ));
    }
    return {
      definition: {
        formatUses: [],
        label: marker.label,
        line: marker.line,
        operation,
        path: file.path,
        replacement: true
      },
      diagnostics
    };
  }

  const firstStructure = content.findIndex((line) => (
    /^#### (Headers|Bindings|Payload)$/.test(line.text)
      || /^- (Headers|Bindings|Payload): none$/.test(line.text)
  ));
  if (firstStructure !== 0
    || content.some((line) => line.text.startsWith("**deviation**: "))
    || content.some((line) => line.text.startsWith("**unsupported**: replaces "))) {
    diagnostics.push(messageDiagnostic(
      ruleId,
      file,
      content[0]?.line ?? marker.line,
      "An expanded failure shape begins directly with its shared Headers, Bindings, and Payload grammar and carries no deviation or replacement marker."
    ));
  }

  const pseudoMessage = { level: 3, line: marker.line, text: `Message ${marker.label}` };
  diagnostics.push(...remapDiagnostics(
    validateMessageStructure(file, markdown, pseudoMessage, endLine, false),
    ruleId
  ));
  diagnostics.push(...remapDiagnostics(
    validateMessageTables(file, markdown, pseudoMessage, "RECEIVE", endLine),
    ruleId
  ));
  const payload = validatePayload(
    file,
    markdown,
    pseudoMessage,
    "RECEIVE",
    endLine,
    false,
    operation,
    objectOpennessDefault
  );
  diagnostics.push(...remapDiagnostics(payload.diagnostics, ruleId));
  const formatUses = failureShapeFormatUses(
    markdown,
    marker.line,
    endLine,
    operation,
    marker.label
  );
  return {
    definition: {
      formatUses,
      label: marker.label,
      line: marker.line,
      operation,
      path: file.path,
      replacement: false
    },
    diagnostics
  };
}

export function validateCommonFailureShapes(file, markdown, objectOpennessDefault) {
  const errorHeading = markdown.headings.find((heading) => (
    heading.level === 2 && heading.text === "Error Handling"
  ));
  const errorEnd = errorHeading === undefined
    ? file.identityLine ?? Number.MAX_SAFE_INTEGER
    : markdown.headings.find((heading) => (
      heading.line > errorHeading.line && heading.level <= errorHeading.level
    ))?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  const allMarkers = failureShapeMarkers(
    markdown,
    file.metadataLine ?? 0,
    file.identityLine ?? Number.MAX_SAFE_INTEGER
  );
  const commonMarkers = errorHeading === undefined ? [] : allMarkers.filter((marker) => (
    marker.line > errorHeading.line && marker.line < errorEnd
  ));
  const diagnostics = [];
  const definitions = [];
  for (const marker of allMarkers.filter((entry) => !commonMarkers.includes(entry))) {
    diagnostics.push(messageDiagnostic(
      "DM-CONV-004",
      file,
      marker.line,
      "Common failure shapes may appear only inside CONVENTIONS Error Handling."
    ));
  }
  for (let index = 0; index < commonMarkers.length; index += 1) {
    const marker = commonMarkers[index];
    const parsed = validateFailureShape(
      file,
      markdown,
      marker,
      commonMarkers[index + 1]?.line ?? errorEnd,
      "DM-CONV-004",
      null,
      objectOpennessDefault
    );
    diagnostics.push(...parsed.diagnostics);
    definitions.push(parsed.definition);
  }
  const counts = new Map();
  for (const definition of definitions) {
    counts.set(definition.label, (counts.get(definition.label) ?? 0) + 1);
  }
  for (const definition of definitions.filter((entry) => counts.get(entry.label) !== 1)) {
    diagnostics.push(messageDiagnostic(
      "DM-CONV-004",
      file,
      definition.line,
      "Every common failure-shape label is unique across CONVENTIONS Error Handling."
    ));
  }
  return { definitions, diagnostics };
}

function actionDescribesRecovery(value) {
  const nextAction = /\b(?:acknowledge|nack|negative(?:ly)? acknowledge|reject|discard|drop|quarantine|retry|resend|re-process|reprocess|route|dead-letter|escalate|report|mark|return|continue|stop|preserve|inspect)\b/i.test(value);
  const recovery = /\b(?:state|failed|processed|unprocessed|unresolved|discard|drop|quarantine|retry|resend|re-process|reprocess|dead-letter|escalate|continue|stop|preserve|inspect)\b/i.test(value);
  return nextAction && recovery;
}

function failureHandlingState(markdown, heading, endLine) {
  const lines = nonEmptyLines(sourceLines(markdown, heading.line, endLine));
  let index = 0;
  while (lines[index]?.text.startsWith("**deviation**:")) index += 1;
  const deviations = lines.slice(0, index);
  const core = lines.slice(index);
  if (!validLeadingDeviations(deviations)) return { core, lines, state: "invalid" };
  if (core.length === 1 && core[0].text === "none") return { core, lines, state: "none" };
  if (core.length === 2
    && core[0].text === "unknown"
    && core[1].line === core[0].line + 1
    && core[1].text.startsWith("**unknown**: ")
    && core[1].text.length > "**unknown**: ".length) {
    return { core, lines, state: "unknown" };
  }
  const replacementPrefix = "**unsupported**: replaces Failure Handling: ";
  if (core.length === 1
    && core[0].text.startsWith(replacementPrefix)
    && core[0].text.length > replacementPrefix.length) {
    return { core, lines, state: "unsupported" };
  }
  if (core[0]?.text.startsWith("|")) return { core, lines, state: "expanded" };
  return { core, lines, state: "invalid" };
}

function validateFailureHandling(
  file,
  markdown,
  operationHeading,
  operationEnd,
  operation,
  commonShapes,
  objectOpennessDefault
) {
  const heading = markdown.headings.find((entry) => (
    entry.level === 3
      && entry.text === "Failure Handling"
      && entry.line > operationHeading.line
      && entry.line < operationEnd
  ));
  if (heading === undefined) return { commonReferences: [], definitions: [], diagnostics: [] };
  const endLine = blockEndLine(markdown, heading, operationEnd);
  const state = failureHandlingState(markdown, heading, endLine);
  if (state.state === "invalid") {
    return {
      commonReferences: [],
      definitions: [],
      diagnostics: [messageDiagnostic(
        "DM-FAIL-001",
        file,
        state.core[0]?.line ?? heading.line,
        "Failure Handling requires ordered leading deviations followed by exactly one none, whole-section unknown, replacement unsupported, or expanded table state."
      )]
    };
  }
  if (state.state !== "expanded") {
    return { commonReferences: [], definitions: [], diagnostics: [] };
  }

  const table = tableAt(state.core, 0);
  const markers = table === null ? [] : postTableMarkers(state.core, table);
  const consumedLine = markers.at(-1)?.line ?? table?.endLine;
  const shapeMarkers = failureShapeMarkers(markdown, consumedLine ?? heading.line, endLine);
  const firstShapeLine = shapeMarkers[0]?.line ?? endLine;
  const tailContent = table === null ? [] : nonEmptyLines(sourceLines(markdown, consumedLine, firstShapeLine));
  const expected = ["Failure", "Signal", "Condition", "Action"];
  const tableValid = table !== null
    && validHeader(table.header, expected)
    && table.rows.length > 0
    && table.rows.every((row) => row.slice(0, expected.length).every((cell) => cell !== ""))
    && new Set(table.rows.map((row) => row[0])).size === table.rows.length
    && table.rows.every((row) => actionDescribesRecovery(row[3]))
    && tailContent.length === 0
    && validMarkerOrder(markers)
    && (table.rows.some((row) => row.includes("unknown"))
      ? markers.some((marker) => marker.kind.type === "unknown")
      : markers.every((marker) => marker.kind.type !== "unknown"));
  const diagnostics = [];
  if (!tableValid) {
    diagnostics.push(messageDiagnostic(
      "DM-FAIL-002",
      file,
      table?.startLine ?? state.core[0]?.line ?? heading.line,
      "Expanded Failure Handling requires its canonical non-empty table, unique failures, complete recovery actions, and canonical post-table markers."
    ));
  }

  const commonCounts = new Map();
  for (const shape of commonShapes) {
    commonCounts.set(shape.label, (commonCounts.get(shape.label) ?? 0) + 1);
  }
  const commonReferences = [];
  const inlineFirstUse = [];
  let referencesValid = table !== null;
  for (const row of table?.rows ?? []) {
    const signal = row[1];
    const reference = signal.match(/^(common|inline):([a-z][a-z0-9_-]*)$/);
    if (reference === null) {
      if (signal.includes("common:") || signal.includes("inline:")) referencesValid = false;
      continue;
    }
    const [, kind, label] = reference;
    if (kind === "common") {
      commonReferences.push({ label, operation });
      if (commonCounts.get(label) !== 1) referencesValid = false;
    } else if (!inlineFirstUse.includes(label)) {
      inlineFirstUse.push(label);
    }
  }
  if (!sameNames(shapeMarkers.map((marker) => marker.label), inlineFirstUse)) referencesValid = false;
  if (!referencesValid) {
    diagnostics.push(messageDiagnostic(
      "DM-FAIL-002",
      file,
      table?.startLine ?? heading.line,
      "Failure shape references use exact whole Signal cells and resolve exactly once, with inline definitions in first-use order."
    ));
  }

  const definitions = [];
  for (let index = 0; index < shapeMarkers.length; index += 1) {
    const parsed = validateFailureShape(
      file,
      markdown,
      shapeMarkers[index],
      shapeMarkers[index + 1]?.line ?? endLine,
      "DM-FAIL-003",
      operation,
      objectOpennessDefault
    );
    diagnostics.push(...parsed.diagnostics);
    definitions.push(parsed.definition);
  }
  return { commonReferences, definitions, diagnostics };
}

function parseMessageBlocks(
  file,
  markdown,
  operationHeading,
  operationEnd,
  routedRow,
  objectOpennessDefault,
  commonShapes
) {
  const diagnostics = [];
  const definitions = [];
  const operation = routedRow?.operation ?? operationName(operationHeading);
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
  const reply = validateReply(
    file,
    markdown,
    operationHeading,
    operationEnd,
    routedRow,
    replies
  );
  diagnostics.push(...reply.diagnostics);
  diagnostics.push(...validateMessageIdentity(
    file,
    markdown,
    operationHeading,
    operationEnd,
    routedRow,
    primary,
    replies
  ));
  const failures = validateFailureHandling(
    file,
    markdown,
    operationHeading,
    operationEnd,
    operation,
    commonShapes,
    objectOpennessDefault
  );
  diagnostics.push(...failures.diagnostics);

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
    const payload = isReplacement || !["SEND", "RECEIVE"].includes(direction)
      ? { diagnostics: [], formatUses: [] }
      : validatePayload(
        file,
        markdown,
        heading,
        direction,
        endLine,
        reply,
        operation,
        objectOpennessDefault
      );
    diagnostics.push(...payload.diagnostics);
    definitions.push({
      direction,
      formatUses: payload.formatUses,
      line: heading.line,
      name: messageName(heading),
      operation,
      path: file.path,
      reply
    });
  }
  return {
    commonReferences: failures.commonReferences,
    diagnostics,
    failureShapes: failures.definitions,
    definitions
  };
}

function parseMessageFile(file, routedRows, objectOpennessDefault, commonShapes) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) {
    return { commonReferences: [], diagnostics: scanned.diagnostics, failureShapes: [], definitions: [] };
  }
  const markdown = scanned.value;
  const diagnostics = [];
  const definitions = [];
  const failureShapes = [];
  const commonReferences = [];
  const operations = markdown.headings.filter((heading) => heading.level === 2);
  for (let index = 0; index < operations.length; index += 1) {
    const heading = operations[index];
    const endLine = operations[index + 1]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
    const name = operationName(heading);
    const routedRow = routedRows.find((row) => row.operation === name);
    const parsed = parseMessageBlocks(
      file,
      markdown,
      heading,
      endLine,
      routedRow,
      objectOpennessDefault,
      commonShapes
    );
    diagnostics.push(...parsed.diagnostics);
    definitions.push(...parsed.definitions);
    failureShapes.push(...parsed.failureShapes);
    commonReferences.push(...parsed.commonReferences);
  }
  return { commonReferences, diagnostics, failureShapes, definitions };
}

export function hasObjectOpennessDefault(documentSet) {
  const file = documentSet.files.find((entry) => entry.path === "CONVENTIONS.md");
  if (file === undefined) return false;
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return false;
  const heading = scanned.value.headings.find((entry) => entry.level === 2 && entry.text === "Data Representation");
  if (heading === undefined) return false;
  const endLine = scanned.value.headings.find((entry) => entry.level <= 2 && entry.line > heading.line)?.line
    ?? file.identityLine
    ?? Number.MAX_SAFE_INTEGER;
  const content = sourceLines(scanned.value, heading.line, endLine).map((line) => line.text).join("\n");
  return /additional properties[^\n]*forbidden[^\n]*by default|forbid[^\n]*additional properties[^\n]*by default/i.test(content)
    || /additional properties[^\n]*allowed[^\n]*(?:string|int|number|bool|null|any|object|map<string, [^>]+>)[^\n]*by default|allow[^\n]*additional properties[^\n]*(?:string|int|number|bool|null|any|object|map<string, [^>]+>)[^\n]*by default/i.test(content);
}

export function validateCoreMessages(documentSet, routingFacts, conventionFacts = {}) {
  const rows = routingFacts.operations?.rows ?? [];
  const paths = [...new Set(rows.map((row) => row.channelPath))];
  const diagnostics = [];
  const definitions = [];
  const failureShapes = [];
  const commonReferences = [];
  const commonShapes = conventionFacts.conventions?.failureShapes ?? [];
  const objectOpennessDefault = hasObjectOpennessDefault(documentSet);
  for (const path of paths) {
    const file = documentSet.files.find((entry) => entry.path === path);
    if (file === undefined) continue;
    const parsed = parseMessageFile(
      file,
      rows.filter((row) => row.channelPath === path),
      objectOpennessDefault,
      commonShapes
    );
    diagnostics.push(...parsed.diagnostics);
    definitions.push(...parsed.definitions);
    failureShapes.push(...parsed.failureShapes);
    commonReferences.push(...parsed.commonReferences);
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
      failureShapes: {
        common: commonShapes,
        commonReferences,
        inline: failureShapes
      },
      messageDefinitions: { byOperation }
    }
  };
}
