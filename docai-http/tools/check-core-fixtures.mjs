#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "0.11.0";
const STANDARD_KEYS = [
  "docai-http",
  "profile",
  "coverage",
  "knowledge",
  "generated",
  "generation_id",
  "projection_id",
  "source",
  "source_revision",
];

const CONVENTION_HEADINGS = [
  "Environments",
  "Versioning",
  "Authentication",
  "Browser Security",
  "Request Formats",
  "HTTP Semantics",
  "Errors",
  "Validation Errors",
  "Pagination",
  "List Operations",
  "Data Representation",
  "Empty and Omitted Values",
  "File Transfer",
  "Rate Limits",
  "Webhook Delivery",
];

const CORE_UNSUPPORTED_CONVENTION_HEADINGS = new Set(CONVENTION_HEADINGS);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CORE_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "core", `v${SPEC_VERSION}`);
const CORE_DIR = path.resolve(process.argv[2] ?? DEFAULT_CORE_DIR);

const failures = [];

function fail(file, message) {
  failures.push(`${path.relative(process.cwd(), file)}: ${message}`);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function listFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(full) : [full];
    })
    .sort();
}

function splitUnescapedPipePairs(value) {
  const pairs = [];
  let current = "";
  for (let i = 0; i < value.length; i += 1) {
    if (value.slice(i, i + 3) === " | " && !isEscaped(value, i)) {
      pairs.push(current);
      current = "";
      i += 2;
    } else {
      current += value[i];
    }
  }
  pairs.push(current);
  return pairs;
}

function isEscaped(value, index) {
  let count = 0;
  for (let i = index - 1; i >= 0 && value[i] === "\\"; i -= 1) count += 1;
  return count % 2 === 1;
}

function decodeStampValue(value) {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = value[i + 1];
    if (next !== "\\" && next !== "|") {
      throw new Error("unknown or trailing stamp escape");
    }
    out += next;
    i += 1;
  }
  return out;
}

function parseStamp(markdown) {
  const first = markdown.split(/\r?\n/, 1)[0] ?? "";
  if (!first.startsWith("> ")) return null;
  const rawPairs = splitUnescapedPipePairs(first.slice(2));
  const pairs = rawPairs.map((pair) => {
    const sep = pair.indexOf(": ");
    if (sep < 0) throw new Error(`stamp pair lacks ': ': ${pair}`);
    return [pair.slice(0, sep), decodeStampValue(pair.slice(sep + 2))];
  });

  const seen = new Map();
  pairs.forEach(([key, value]) => {
    if (seen.has(key)) throw new Error(`duplicate stamp key ${key}`);
    seen.set(key, value);
  });

  const sourceRevisionIndex = pairs.findIndex(([key]) => key === "source_revision");
  const required = STANDARD_KEYS.filter((key) => key !== "source_revision");
  required.forEach((key) => {
    if (!seen.has(key)) throw new Error(`missing stamp key ${key}`);
  });

  let expectedIndex = 0;
  for (const [key] of pairs) {
    if (key.startsWith("x-")) break;
    const expected = STANDARD_KEYS[expectedIndex];
    if (key !== expected) {
      if (expected === "source_revision" && key.startsWith("x-")) break;
      if (expected === "source_revision" && sourceRevisionIndex < 0) {
        expectedIndex += 1;
      }
      if (key !== STANDARD_KEYS[expectedIndex]) {
        throw new Error(`stamp key ${key} appears out of order`);
      }
    }
    expectedIndex += 1;
  }

  const firstExtension = pairs.findIndex(([key]) => key.startsWith("x-"));
  if (firstExtension >= 0) {
    pairs.slice(firstExtension).forEach(([key]) => {
      if (!key.startsWith("x-")) throw new Error(`standard key ${key} follows extension key`);
    });
  }

  if (seen.get("docai-http") !== SPEC_VERSION) throw new Error(`stamp version is not ${SPEC_VERSION}`);
  if (seen.get("profile") !== "full") throw new Error("core fixture stamp profile must be full");
  if (!["complete", "requires-source"].includes(seen.get("coverage"))) {
    throw new Error("invalid coverage value");
  }
  if (!["complete", "requires-input"].includes(seen.get("knowledge"))) {
    throw new Error("invalid knowledge value");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(seen.get("generated"))) {
    throw new Error("generated must be YYYY-MM-DD");
  }

  return Object.fromEntries(pairs);
}

function splitTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = [];
  let current = "";
  for (let i = 1; i < trimmed.length - 1; i += 1) {
    const ch = trimmed[i];
    if (ch === "|" && !isEscaped(trimmed, i)) {
      cells.push(current.trim().replace(/\\\|/g, "|"));
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim().replace(/\\\|/g, "|"));
  return cells;
}

function parseTables(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length; i += 1) {
    const header = splitTableLine(lines[i]);
    const separator = splitTableLine(lines[i + 1] ?? "");
    if (!header || !separator || !separator.every((cell) => /^-+$/.test(cell))) continue;
    const rows = [];
    let j = i + 2;
    for (; j < lines.length; j += 1) {
      const row = splitTableLine(lines[j]);
      if (!row) break;
      rows.push(row);
    }
    tables.push({ header, separator, rows, line: i + 1 });
    i = j;
  }
  return tables;
}

function headingSections(markdown, predicate) {
  const matches = [...markdown.matchAll(/^(#{1,6}) (.+)$/gm)];
  const sections = [];
  matches.forEach((match, index) => {
    const level = match[1].length;
    const title = match[2];
    if (!predicate(title, level)) return;
    const next = matches.slice(index + 1).find((candidate) => candidate[1].length <= level);
    const end = next?.index ?? markdown.length;
    sections.push({
      title,
      level,
      line: markdown.slice(0, match.index).split(/\r?\n/).length,
      text: markdown.slice(match.index, end),
    });
  });
  return sections;
}

function validateTables(file, markdown) {
  for (const table of parseTables(markdown)) {
    const width = table.header.length;
    if (table.separator.length !== width) throw new Error(`table at line ${table.line} has separator width mismatch`);
    table.rows.forEach((row, index) => {
      if (row.length !== width) throw new Error(`table at line ${table.line} row ${index + 1} has width mismatch`);
    });
  }
}

function validateFieldPaths(markdown) {
  const allowedEscapes = new Set(["\\", ".", "[", "]", "{", "}", "$"]);
  for (const table of parseTables(markdown)) {
    const fieldIndex = table.header.indexOf("Field");
    if (fieldIndex < 0) continue;
    for (const row of table.rows) {
      const field = row[fieldIndex];
      for (let i = 0; i < field.length; i += 1) {
        if (field[i] === "\\") {
          const next = field[i + 1];
          if (!allowedEscapes.has(next)) throw new Error(`invalid field-path escape in ${field}`);
          i += 1;
        }
      }
    }
  }
}

function validateTypes(markdown) {
  for (const table of parseTables(markdown)) {
    const typeIndex = table.header.indexOf("Type");
    if (typeIndex < 0) continue;
    for (const row of table.rows) {
      if (!isType(row[typeIndex])) throw new Error(`invalid type ${row[typeIndex]}`);
    }
  }
}

function validateConditionalRequiredness(markdown) {
  for (const table of parseTables(markdown)) {
    const requiredIndex = table.header.indexOf("Required");
    const constraintsIndex = table.header.indexOf("Constraints / Meaning");
    if (requiredIndex < 0 || constraintsIndex < 0) continue;
    for (const row of table.rows) {
      if (row[requiredIndex] !== "conditional") continue;
      if (!/\b(if|when|unless|required)\b/i.test(row[constraintsIndex])) {
        throw new Error(`conditional requiredness lacks exact condition in ${row[0]}`);
      }
    }
  }
}

function isType(value) {
  if (["string", "int", "float", "bool", "null", "any", "object", "file", "unknown"].includes(value)) {
    return true;
  }
  if (value.endsWith("[]")) return isType(value.slice(0, -2));
  const map = value.match(/^map<string, (.+)>$/);
  return Boolean(map && isType(map[1]));
}

function validateJsonExamples(markdown) {
  for (const match of markdown.matchAll(/^```json\r?\n([\s\S]*?)^```$/gm)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      throw new Error(`invalid JSON example: ${error.message}`);
    }
  }
}

function validateUnsupported(markdown) {
  const lines = markdown.split(/\r?\n/).filter((line) => line.startsWith("**unsupported**:"));
  for (const line of lines) {
    const value = line.slice("**unsupported**:".length).trim();
    if (value.startsWith("localized:")) continue;
    if (!value.startsWith("replaces ")) throw new Error("unsupported marker lacks canonical prefix");
    const separator = value.indexOf(": ", "replaces ".length);
    if (separator < 0) throw new Error("unsupported replacement lacks ': ' boundary");
    const unit = value.slice("replaces ".length, separator);
    const detail = value.slice(separator + 2).trim();
    if (!unit) throw new Error("unsupported replacement lacks unit");
    if (!detail) throw new Error("unsupported replacement lacks feature detail");
    validateCoreUnsupportedUnit(unit);
  }
}

function validateCoreUnsupportedUnit(unit) {
  const requestSubsections = new Set([
    "request Path Parameters",
    "request Query Parameters",
    "request Headers",
    "request Cookie Parameters",
    "request Body",
  ]);
  if (requestSubsections.has(unit) || unit === "Errors") return;

  let match = unit.match(/^structured parameter (Path Parameters|Query Parameters|Headers|Cookie Parameters) (.+)$/);
  if (match && match[2].trim()) return;

  match = unit.match(/^request representation (.+)$/);
  if (match && isJsonMediaType(match[1])) return;

  match = unit.match(/^Response (.+)$/);
  if (match && isStatus(match[1])) return;

  match = unit.match(/^response representation (.+) (.+)$/);
  if (match && isStatus(match[1]) && isJsonMediaType(match[2])) return;

  match = unit.match(/^CONVENTIONS (.+)$/);
  if (match && CORE_UNSUPPORTED_CONVENTION_HEADINGS.has(match[1])) return;

  match = unit.match(/^common error shape ([a-z][a-z0-9_-]*)$/);
  if (match) return;

  match = unit.match(/^inline error shape (.+) ([^ ]+) inline:([a-z][a-z0-9_-]*)$/);
  if (match && isStatus(match[1])) return;

  match = unit.match(/^common error representation ([a-z][a-z0-9_-]*) (.+)$/);
  if (match && isJsonMediaType(match[2])) return;

  match = unit.match(/^inline error representation (.+) ([^ ]+) inline:([a-z][a-z0-9_-]*) (.+)$/);
  if (match && isStatus(match[1]) && isJsonMediaType(match[4])) return;

  throw new Error(`unsupported replacement unit is outside the core checker scope: ${unit}`);
}

function isStatus(value) {
  return /^[1-5][0-9][0-9]$/.test(value) || /^[1-5]XX$/.test(value) || value === "default";
}

function isJsonMediaType(value) {
  const type = value.toLowerCase();
  if (type === "application/json") return true;
  const [essence] = type.split(";");
  return essence.startsWith("application/") && essence.endsWith("+json");
}

function errorShapeLabels(markdown) {
  return new Set([...markdown.matchAll(/^\*\*error_shape\*\*: ([a-z][a-z0-9_-]*)$/gm)].map((match) => match[1]));
}

function commonErrorRefs(markdown) {
  const refs = [];
  for (const table of parseTables(markdown)) {
    const shapeIndex = table.header.indexOf("Shape");
    if (shapeIndex < 0) continue;
    table.rows.forEach((row) => {
      const shape = row[shapeIndex];
      if (shape.startsWith("common:")) refs.push(shape.slice("common:".length));
    });
  }
  return refs;
}

function validateCommonErrorRefs(markdown, knownCommonShapes) {
  const refs = commonErrorRefs(markdown);
  if (refs.length === 0) return;
  if (!knownCommonShapes) throw new Error("common error references require CONVENTIONS.md shape context");
  for (const label of refs) {
    if (!knownCommonShapes.has(label)) {
      throw new Error(`common error shape ${label} is not defined in CONVENTIONS.md`);
    }
  }
}

function validateCoverageKnowledge(markdown, stamp, indexSummary) {
  if (!stamp) return;
  const unsupported = markdown.includes("**unsupported**:");
  const unknown = markdown.includes("**unknown**:");
  const expectCoverage = indexSummary?.coverage ?? (unsupported ? "requires-source" : "complete");
  const expectKnowledge = indexSummary?.knowledge ?? (unknown ? "requires-input" : "complete");
  if (stamp.coverage !== expectCoverage) throw new Error(`coverage ${stamp.coverage} should be ${expectCoverage}`);
  if (stamp.knowledge !== expectKnowledge) throw new Error(`knowledge ${stamp.knowledge} should be ${expectKnowledge}`);
}

function headings(markdown, level) {
  const prefix = "#".repeat(level);
  return [...markdown.matchAll(new RegExp(`^${prefix} (.+)$`, "gm"))].map((match) => match[1]);
}

function validateIndex(markdown) {
  if (!markdown.includes("# API Index")) return;
  const h2 = headings(markdown, 2);
  if (h2.join("|") !== "Endpoints|Workflows|Webhooks") throw new Error("INDEX sections must be Endpoints, Workflows, Webhooks");
  for (const table of parseTables(markdown)) {
    if (table.header[0] !== "Method") continue;
    if (table.header.join("|") !== "Method|Path|Task|Summary|Also read") {
      throw new Error("core INDEX endpoint table must use Method | Path | Task | Summary | Also read");
    }
    for (const row of table.rows) {
      if (row[1] === "unknown" || !row[1].startsWith("/")) throw new Error(`invalid INDEX path ${row[1]}`);
    }
  }
}

function indexEndpointRows(markdown) {
  const table = parseTables(markdown).find((candidate) => candidate.header.join("|") === "Method|Path|Task|Summary|Also read");
  if (!table) return [];
  return table.rows.map((row) => ({
    method: row[0],
    path: row[1],
    task: row[2],
    summary: row[3],
    alsoRead: row[4],
  }));
}

function validateConventions(markdown, requireAll) {
  if (!markdown.includes("# API Conventions") && !CONVENTION_HEADINGS.some((h) => markdown.includes(`## ${h}`))) return;
  const found = headings(markdown, 2).filter((h) => CONVENTION_HEADINGS.includes(h));
  const indexes = found.map((h) => CONVENTION_HEADINGS.indexOf(h));
  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] <= indexes[i - 1]) throw new Error("CONVENTIONS headings are out of order");
  }
  if (requireAll && found.join("|") !== CONVENTION_HEADINGS.join("|")) {
    throw new Error("CONVENTIONS.md is missing one or more fixed headings");
  }
}

function endpointBlocks(markdown) {
  const matches = [...markdown.matchAll(/^## ([A-Z]+) (\/\S*)$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? markdown.length;
    return { method: match[1], path: match[2], text: markdown.slice(start, end) };
  });
}

function validateEndpointSectionOrder(markdown) {
  for (const block of endpointBlocks(markdown)) {
    const h3 = headings(block.text, 3);
    if (!h3.includes("Errors") && !h3.includes("Related")) continue;
    const responseIndexes = h3
      .map((h, index) => [h, index])
      .filter(([h]) => h.startsWith("Response "))
      .map(([, index]) => index);
    if (responseIndexes.length === 0) throw new Error(`${block.method} ${block.path} has no response section`);
    const expected = [
      h3.indexOf("Behavior"),
      h3.indexOf("Request"),
      Math.min(...responseIndexes),
      h3.indexOf("Errors"),
      h3.indexOf("Related"),
    ];
    if (expected.some((index) => index < 0)) throw new Error(`${block.method} ${block.path} is missing a required section`);
    for (let i = 1; i < expected.length; i += 1) {
      if (expected[i] <= expected[i - 1]) throw new Error(`${block.method} ${block.path} sections are out of order`);
    }
  }
}

function validateRequestSubsectionOrder(markdown) {
  const names = ["Path Parameters", "Query Parameters", "Headers", "Cookie Parameters", "Body"];
  for (const block of endpointBlocks(markdown)) {
    if (!block.text.includes("### Response ") || !block.text.includes("### Errors")) continue;
    const request = section(block.text, "### Request");
    if (!request) continue;
    const found = [];
    for (const match of request.matchAll(/^(#### (Path Parameters|Query Parameters|Headers|Cookie Parameters|Body)|- (Path Parameters|Query Parameters|Headers|Cookie Parameters|Body): none)$/gm)) {
      found.push({
        name: match[2] ?? match[3],
        collapsed: Boolean(match[3]),
      });
    }
    if (found.length === 0) throw new Error(`${block.method} ${block.path} request has no request subsections`);
    if (found.map((item) => item.name).join("|") !== names.join("|")) {
      throw new Error(`${block.method} ${block.path} request subsections are out of order or incomplete`);
    }
    const firstHeading = found.findIndex((item) => !item.collapsed);
    if (firstHeading >= 0 && found.slice(firstHeading + 1).some((item) => item.collapsed)) {
      throw new Error(`${block.method} ${block.path} collapses a request subsection after a heading subsection`);
    }
  }
}

function validatePathParameters(markdown) {
  for (const block of endpointBlocks(markdown)) {
    const vars = [...block.path.matchAll(/\{([^}/{}\s]+)\}/g)].map((match) => match[1]).sort();
    const request = section(block.text, "### Request");
    if (!request) continue;
    const pathSection = section(request, "#### Path Parameters");
    if (vars.length === 0) {
      if (pathSection && !pathSection.includes("none")) {
        const table = parseTables(pathSection).find((candidate) => candidate.header[0] === "Name");
        if (table && table.rows.length > 0) throw new Error(`${block.method} ${block.path} has extra path parameters`);
      }
      continue;
    }
    if (!pathSection) throw new Error(`${block.method} ${block.path} lacks Path Parameters section`);
    const table = parseTables(pathSection).find((candidate) => candidate.header[0] === "Name");
    if (!table) throw new Error(`${block.method} ${block.path} lacks path parameter table`);
    const names = table.rows.map((row) => row[0]).sort();
    if (names.join("|") !== vars.join("|")) {
      throw new Error(`${block.method} ${block.path} path parameters ${names.join(",")} do not match ${vars.join(",")}`);
    }
  }
}

function section(markdown, heading) {
  const start = markdown.indexOf(`${heading}\n`);
  if (start < 0) return null;
  const level = heading.match(/^#+/)[0].length;
  const rest = markdown.slice(start);
  const boundary = new RegExp(`\\n#{1,${level}} `, "m");
  const match = boundary.exec(rest.slice(heading.length + 1));
  return match ? rest.slice(0, heading.length + 1 + match.index) : rest;
}

function validateResponseStatusOrder(markdown) {
  const blocks = endpointBlocks(markdown);
  const scopes = blocks.length > 0 ? blocks.map((block) => block.text) : [markdown];
  for (const scope of scopes) {
    const statuses = [...scope.matchAll(/^### Response (.+)$/gm)].map((match) => match[1]);
    let previous = -1;
    for (const status of statuses) {
      const current = statusSortKey(status);
      if (current < previous) throw new Error("response statuses are out of order");
      previous = current;
    }
  }
}

function validateBodyMarkerOrder(markdown) {
  headingSections(markdown, (title) => title === "Body").forEach((body) => {
    validateBodyRepresentationMarkers(body.text, `${body.title} at line ${body.line}`, "body_required");
  });
  headingSections(markdown, (title) => title.startsWith("Response ")).forEach((response) => {
    validateBodyRepresentationMarkers(response.text, `${response.title} at line ${response.line}`, "body_presence");
  });

  const shapeMatches = [...markdown.matchAll(/^\*\*error_shape\*\*: .+$/gm)];
  shapeMatches.forEach((match, index) => {
    const nextShape = shapeMatches[index + 1]?.index ?? markdown.length;
    const nextH3 = markdown.slice(match.index + match[0].length).search(/\n#{1,3} /);
    const end = nextH3 >= 0 ? Math.min(nextShape, match.index + match[0].length + nextH3) : nextShape;
    const text = markdown.slice(match.index, end);
    validateBodyRepresentationMarkers(text, `error shape at line ${markdown.slice(0, match.index).split(/\r?\n/).length}`, "body_presence");
  });
}

function validateBodyRepresentationMarkers(text, label, presenceMarker) {
  const markers = [...text.matchAll(/^\*\*(body_required|body_presence|media_type|body_nullable)\*\*: .+$/gm)].map((match) => ({
    name: match[1],
  }));
  if (markers.length === 0) return;

  const presenceIndex = markers.findIndex((marker) => marker.name === presenceMarker);
  const firstMediaIndex = markers.findIndex((marker) => marker.name === "media_type");
  const firstNullableIndex = markers.findIndex((marker) => marker.name === "body_nullable");

  if (firstMediaIndex >= 0) {
    if (presenceIndex < 0) throw new Error(`${label} representation lacks ${presenceMarker}`);
    if (presenceIndex > firstMediaIndex) throw new Error(`${label} has ${presenceMarker} after media_type`);
  }
  if (firstNullableIndex >= 0 && (firstMediaIndex < 0 || firstNullableIndex < firstMediaIndex)) {
    throw new Error(`${label} has body_nullable before media_type`);
  }

  markers.forEach((marker, index) => {
    if (marker.name !== "media_type") return;
    const next = markers[index + 1];
    if (!next || next.name !== "body_nullable") {
      throw new Error(`${label} media_type is not followed by body_nullable`);
    }
  });
}

function validateBodylessResponseHeaders(markdown) {
  for (const response of headingSections(markdown, (title) => title.startsWith("Response "))) {
    const body = response.text.split(/\r?\n/).slice(1).find((line) => line.trim() !== "");
    if (body !== "none") continue;
    if (!/^#### Response Headers$/m.test(response.text) && !/^- Response Headers: none$/m.test(response.text)) {
      throw new Error(`${response.title} lacks response headers after body-less response`);
    }
  }
}

function validateBodylessRequestBodies(markdown) {
  for (const body of headingSections(markdown, (title) => title === "Body")) {
    const firstContent = body.text.split(/\r?\n/).slice(1).find((line) => line.trim() !== "");
    if (firstContent !== "none") continue;
    if (/^\*\*body_required\*\*: /m.test(body.text) || /^\*\*media_type\*\*: /m.test(body.text) || /^\*\*body_nullable\*\*: /m.test(body.text)) {
      throw new Error(`${body.title} at line ${body.line} has body markers after body-less request`);
    }
  }
}

function statusSortKey(status) {
  if (/^[1-5][0-9][0-9]$/.test(status)) return Number(status);
  if (/^[1-5]XX$/.test(status)) return 1000 + Number(status[0]);
  if (status === "default") return 2000;
  throw new Error(`invalid response status ${status}`);
}

function validateErrorShapes(markdown) {
  for (const table of parseTables(markdown)) {
    const statusIndex = table.header.indexOf("Status");
    const codeIndex = table.header.indexOf("code");
    const shapeIndex = table.header.indexOf("Shape");
    if (statusIndex < 0 || codeIndex < 0 || shapeIndex < 0) continue;
    for (const row of table.rows) {
      const shape = row[shapeIndex];
      if (shape.startsWith("inline:")) {
        const label = shape.slice("inline:".length);
        const inlineLabel = `${row[statusIndex]} ${row[codeIndex]} inline:${label}:`;
        const position = markdown.indexOf(inlineLabel);
        if (position < 0) throw new Error(`missing inline error label ${inlineLabel}`);
        const after = markdown.slice(position + inlineLabel.length);
        const shapeMatch = after.match(/\*\*error_shape\*\*: ([^\n]+)/);
        if (!shapeMatch || shapeMatch[1] !== label) throw new Error(`inline error shape ${label} does not match following error_shape`);
      } else if (!["none", "unknown"].includes(shape) && !shape.startsWith("common:")) {
        if (!markdown.includes(`**error_shape**: ${shape}`)) throw new Error(`missing common error shape ${shape}`);
      }
    }
  }
}

function validateUnknownMarkers(markdown) {
  const hasUnknownValue = /\|\s*unknown\s*\||\*\*body_(?:required|presence|nullable)\*\*: unknown|\*\*media_type\*\*: unknown/.test(markdown);
  if (hasUnknownValue && !markdown.includes("**unknown**:")) throw new Error("unknown value lacks unknown marker");
}

function validateDeprecatedIndexSummaries(markdown) {
  const rows = indexEndpointRows(markdown);
  if (rows.length === 0) return;
  for (const block of endpointBlocks(markdown)) {
    if (!/^\*\*deprecated\*\*: /m.test(block.text)) continue;
    const row = rows.find((candidate) => candidate.method === block.method && candidate.path === block.path);
    if (!row) continue;
    if (!row.summary.startsWith("(deprecated)")) {
      throw new Error(`${block.method} ${block.path} is deprecated but INDEX summary lacks (deprecated) prefix`);
    }
  }
}

function extractMarkdownFixture(markdown) {
  const match = markdown.match(/^(`{3,4})[a-zA-Z-]*\n([\s\S]*?)^\1$/m);
  return match ? match[2] : markdown;
}

function validateCoreMarkdown(file, markdown, options = {}) {
  const errors = [];
  const run = (fn) => {
    try {
      fn();
    } catch (error) {
      errors.push(error.message);
    }
  };

  let stamp = null;
  run(() => {
    stamp = parseStamp(markdown);
  });
  run(() => validateTables(file, markdown));
  run(() => validateFieldPaths(markdown));
  run(() => validateTypes(markdown));
  run(() => validateConditionalRequiredness(markdown));
  run(() => validateJsonExamples(markdown));
  run(() => validateUnsupported(markdown));
  run(() => validateCommonErrorRefs(markdown, options.commonErrorShapes));
  run(() => validateCoverageKnowledge(markdown, stamp, options.indexSummary));
  run(() => validateIndex(markdown));
  run(() => validateConventions(markdown, options.requireAllConventions ?? false));
  run(() => validateEndpointSectionOrder(markdown));
  run(() => validateRequestSubsectionOrder(markdown));
  run(() => validatePathParameters(markdown));
  run(() => validateResponseStatusOrder(markdown));
  run(() => validateBodyMarkerOrder(markdown));
  run(() => validateBodylessResponseHeaders(markdown));
  run(() => validateBodylessRequestBodies(markdown));
  run(() => validateErrorShapes(markdown));
  run(() => validateUnknownMarkers(markdown));
  run(() => validateDeprecatedIndexSummaries(markdown));
  return errors;
}

function validateFullSet() {
  const fullDir = path.join(CORE_DIR, "valid", "full");
  const files = ["INDEX.md", "CONVENTIONS.md", path.join("resources", "users.md")].map((file) => path.join(fullDir, file));
  const sourceFile = path.resolve(CORE_DIR, "..", "..", "core-openapi.yaml");
  files.forEach((file) => {
    if (!fs.existsSync(file)) fail(file, "required full-set file is missing");
  });
  if (!fs.existsSync(sourceFile)) fail(sourceFile, "required source OpenAPI fixture is missing");
  if (failures.length > 0) return;

  const contents = Object.fromEntries(files.map((file) => [file, read(file)]));
  const setText = Object.values(contents).join("\n");
  const commonShapes = errorShapeLabels(contents[files[1]]);
  const indexSummary = {
    coverage: setText.includes("**unsupported**:") ? "requires-source" : "complete",
    knowledge: setText.includes("**unknown**:") ? "requires-input" : "complete",
  };

  const stamps = [];
  for (const [file, markdown] of Object.entries(contents)) {
    const stamp = parseStamp(markdown);
    stamps.push([file, stamp]);
  }
  const generated = new Set(stamps.map(([, stamp]) => stamp.generated));
  const generationIds = new Set(stamps.map(([, stamp]) => stamp.generation_id));
  const projectionIds = new Set(stamps.map(([, stamp]) => stamp.projection_id));
  if (generated.size !== 1 || generationIds.size !== 1 || projectionIds.size !== 1) {
    fail(fullDir, "full-set metadata generated/generation_id/projection_id values must match");
  }

  for (const [file, markdown] of Object.entries(contents)) {
    const errors = validateCoreMarkdown(file, markdown, {
      indexSummary: file.endsWith("INDEX.md") ? indexSummary : undefined,
      requireAllConventions: file.endsWith("CONVENTIONS.md"),
      commonErrorShapes: file.endsWith(path.join("resources", "users.md")) ? commonShapes : undefined,
    });
    errors.forEach((error) => fail(file, error));
  }

  const indexRows = indexEndpointRows(contents[files[0]])
    .map((row) => `${row.method} ${row.path}`)
    .sort();
  const resourceHeadings = endpointBlocks(contents[files[2]])
    .map((block) => `${block.method} ${block.path}`)
    .sort();
  if (!indexRows || indexRows.join("|") !== resourceHeadings.join("|")) {
    fail(files[0], "INDEX endpoint rows must match resource endpoint headings");
  }
}

function validateFocused() {
  const validFiles = listFiles(path.join(CORE_DIR, "focused", "valid")).filter((file) => file.endsWith(".md"));
  const invalidFiles = listFiles(path.join(CORE_DIR, "focused", "invalid")).filter((file) => file.endsWith(".md"));

  for (const file of validFiles) {
    const markdown = extractMarkdownFixture(read(file));
    const errors = validateCoreMarkdown(file, markdown);
    errors.forEach((error) => fail(file, `expected valid but failed: ${error}`));
  }

  for (const file of invalidFiles) {
    const markdown = extractMarkdownFixture(read(file));
    const errors = validateCoreMarkdown(file, markdown);
    if (errors.length === 0) fail(file, "expected invalid but checker accepted it");
  }
}

validateFullSet();
validateFocused();

if (failures.length > 0) {
  console.error("Core fixture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Core fixture check passed for ${path.relative(process.cwd(), CORE_DIR) || "."}`);
