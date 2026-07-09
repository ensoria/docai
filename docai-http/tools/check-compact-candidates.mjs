#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "0.11.0";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "compact-candidates", `v${SPEC_VERSION}`);
const CANDIDATE_DIR = path.resolve(process.argv[2] ?? DEFAULT_DIR);

const failures = [];

function fail(file, message) {
  failures.push(`${path.relative(process.cwd(), file)}: ${message}`);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function listMarkdownFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listMarkdownFiles(full) : [full];
    })
    .filter((file) => file.endsWith(".md"))
    .sort();
}

function relativeMarkdownFiles(dir) {
  return listMarkdownFiles(dir).map((file) => path.relative(dir, file));
}

function parseStamp(markdown) {
  const first = markdown.split(/\r?\n/, 1)[0] ?? "";
  if (!first.startsWith("> ")) throw new Error("missing metadata stamp");
  return Object.fromEntries(
    first
      .slice(2)
      .split(" | ")
      .map((pair) => {
        const sep = pair.indexOf(": ");
        if (sep < 0) throw new Error(`stamp pair lacks ': ': ${pair}`);
        return [pair.slice(0, sep), pair.slice(sep + 2)];
      }),
  );
}

function validateStamp(file, markdown, profile) {
  const stamp = parseStamp(markdown);
  if (stamp["docai-http"] !== SPEC_VERSION) throw new Error(`stamp version is not ${SPEC_VERSION}`);
  if (stamp.profile !== profile) throw new Error(`stamp profile should be ${profile}`);
  if (!stamp.generated || !stamp.generation_id || !stamp.projection_id) {
    throw new Error("stamp lacks generated, generation_id, or projection_id");
  }
  return stamp;
}

function validateProfileSet(setDir, profile) {
  const files = relativeMarkdownFiles(setDir);
  const stamps = files.map((file) => [file, validateStamp(path.join(setDir, file), read(path.join(setDir, file)), profile)]);
  const generated = new Set(stamps.map(([, stamp]) => stamp.generated));
  const generationIds = new Set(stamps.map(([, stamp]) => stamp.generation_id));
  const projectionIds = new Set(stamps.map(([, stamp]) => stamp.projection_id));
  if (generated.size !== 1) throw new Error(`${profile} set generated values differ`);
  if (generationIds.size !== 1) throw new Error(`${profile} set generation_id values differ`);
  if (projectionIds.size !== 1) throw new Error(`${profile} set projection_id values differ`);
  return { files, stamps, stamp: stamps[0][1] };
}

function validateProfileLink(file, markdown) {
  const stamp = parseStamp(markdown);
  const lines = markdown.split(/\r?\n/);
  const expected =
    stamp.profile === "full" ? "Compact set: " : stamp.profile === "compact" ? "Full set: " : null;
  if (!expected) throw new Error(`profile ${stamp.profile} cannot use a profile link`);
  if (!lines[1]?.startsWith(expected)) {
    throw new Error(`${stamp.profile} INDEX must place ${expected.trim()} directly after the metadata stamp`);
  }
  if (lines[1].slice(expected.length).trim() === "") throw new Error(`${expected.trim()} link lacks target`);
}

function validatePair() {
  const fullDir = path.join(CANDIDATE_DIR, "valid", "full");
  const compactDir = path.join(CANDIDATE_DIR, "valid", "compact");
  const full = validateProfileSet(fullDir, "full");
  const compact = validateProfileSet(compactDir, "compact");

  if (full.files.join("|") !== compact.files.join("|")) {
    throw new Error("full and compact sets have different docs-root-relative markdown paths");
  }
  if (full.stamp.projection_id !== compact.stamp.projection_id) {
    throw new Error("full and compact sets must share projection_id");
  }
  if (full.stamp.generation_id === compact.stamp.generation_id) {
    throw new Error("candidate fixture should demonstrate different full/compact generation_id values");
  }

  validateProfileLink(path.join(fullDir, "INDEX.md"), read(path.join(fullDir, "INDEX.md")));
  validateProfileLink(path.join(compactDir, "INDEX.md"), read(path.join(compactDir, "INDEX.md")));
  compareResourceTables(path.join(fullDir, "resources", "users.md"), path.join(compactDir, "resources", "users.md"));
}

function compareResourceTables(fullFile, compactFile) {
  const fullTables = parseTables(read(fullFile)).map((table) => logicalTable(table));
  const compactTables = parseTables(read(compactFile)).map((table) => logicalTable(table));
  const relevant = (table) => ["Field", "Name"].includes(table.header[0]);
  const fullRelevant = fullTables.filter(relevant);
  const compactRelevant = compactTables.filter(relevant);
  if (JSON.stringify(fullRelevant) !== JSON.stringify(compactRelevant)) {
    throw new Error("compact resource tables do not reconstruct to the matching full resource tables");
  }
}

function splitTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = [];
  let current = "";
  for (let i = 1; i < trimmed.length - 1; i += 1) {
    if (trimmed[i] === "|" && !isEscaped(trimmed, i)) {
      cells.push(current.trim().replace(/\\\|/g, "|"));
      current = "";
    } else {
      current += trimmed[i];
    }
  }
  cells.push(current.trim().replace(/\\\|/g, "|"));
  return cells;
}

function isEscaped(value, index) {
  let count = 0;
  for (let i = index - 1; i >= 0 && value[i] === "\\"; i -= 1) count += 1;
  return count % 2 === 1;
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
    tables.push({
      header,
      rows,
      line: i + 1,
      fieldDefaults: nearestFieldDefaults(lines, i),
    });
    i = j;
  }
  return tables;
}

function nearestFieldDefaults(lines, tableLineIndex) {
  for (let i = tableLineIndex - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) continue;
    return line.startsWith("**field_defaults**:") ? line.slice("**field_defaults**:".length).trim() : null;
  }
  return null;
}

function logicalTable(table) {
  if (!table.fieldDefaults) return { header: table.header, rows: table.rows };
  const defaults = parseFieldDefaults(table.fieldDefaults);
  const fullHeader = inferFullHeader(table, defaults);
  const defaultMap = new Map(defaults);
  defaults.forEach(([column, value]) => {
    if (!fullHeader.includes(column)) {
      throw new Error(`field_defaults column ${column} does not apply to table at line ${table.line}`);
    }
    if (table.header.includes(column)) {
      throw new Error(`field_defaults column ${column} is still present in table at line ${table.line}`);
    }
    if (value === "unknown") throw new Error(`field_defaults column ${column} cannot default unknown`);
  });
  const expectedHeader = fullHeader.filter((column) => !defaultMap.has(column));
  if (table.header.join("|") !== expectedHeader.join("|")) {
    throw new Error(`table at line ${table.line} does not match field_defaults-reconstructed header`);
  }
  return {
    header: fullHeader,
    rows: table.rows.map((row) => {
      const compactValues = new Map(table.header.map((column, index) => [column, row[index]]));
      return fullHeader.map((column) => defaultMap.get(column) ?? compactValues.get(column));
    }),
  };
}

function parseFieldDefaults(value) {
  return value.split(" | ").map((pair) => {
    const [column, defaultValue, extra] = pair.split("=");
    if (!column || !defaultValue || extra !== undefined) throw new Error(`invalid field_defaults pair ${pair}`);
    validateFieldDefault(column, defaultValue);
    return [column, defaultValue];
  });
}

function validateFieldDefault(column, value) {
  const valid = {
    Required: new Set(["yes", "no"]),
    Presence: new Set(["always"]),
    Nullable: new Set(["yes", "no"]),
    Meaning: new Set(["none"]),
  };
  if (!valid[column]) throw new Error(`unknown field_defaults column ${column}`);
  if (!valid[column].has(value)) throw new Error(`invalid field_defaults value ${column}=${value}`);
}

function inferFullHeader(table, defaults) {
  const columns = new Set([...table.header, ...defaults.map(([column]) => column)]);
  if (table.header[0] === "Field" && (columns.has("Required") || columns.has("Constraints / Meaning"))) {
    return ["Field", "Type", "Required", "Nullable", "Constraints / Meaning"];
  }
  if (table.header[0] === "Field") return ["Field", "Type", "Presence", "Nullable", "Meaning"];
  if (table.header[0] === "Name" && columns.has("Presence")) return ["Name", "Type", "Presence", "Meaning"];
  if (table.header[0] === "Name" && columns.has("Required")) return ["Name", "Type", "Required", "Constraints / Meaning"];
  throw new Error(`cannot infer field_defaults table shape at line ${table.line}`);
}

function validateCompactMarkdown(markdown) {
  parseTables(markdown).forEach((table) => {
    if (table.fieldDefaults) logicalTable(table);
  });
}

function extractMarkdownFixtures(markdown) {
  return [...markdown.matchAll(/^(`{3,4})markdown\r?\n([\s\S]*?)^\1$/gm)].map((match) => match[2]);
}

function validateFocusedInvalid() {
  const invalidDir = path.join(CANDIDATE_DIR, "focused", "invalid");
  const files = listMarkdownFiles(invalidDir);
  files.forEach((file) => {
    const markdown = read(file);
    const fixtures = extractMarkdownFixtures(markdown);
    if (fixtures.length === 0) {
      fail(file, "invalid fixture lacks markdown code fence");
      return;
    }
    let accepted = false;
    try {
      validateExpectedInvalid(file, fixtures);
      accepted = true;
    } catch {
      accepted = false;
    }
    if (accepted) fail(file, "checker accepted invalid compact-candidate fixture");
  });
}

function validateExpectedInvalid(file, fixtures) {
  const name = path.basename(file);
  if (name.startsWith("profile-link-")) {
    validateProfileLink(file, fixtures[0]);
    return;
  }
  if (name === "projection-id-mismatch-between-profiles.md") {
    const full = parseStamp(fixtures[0]);
    const compact = parseStamp(fixtures[1]);
    if (full.projection_id !== compact.projection_id) throw new Error("projection_id mismatch");
    return;
  }
  if (name === "generation-id-mismatch-within-profile-set.md") {
    const stamps = fixtures.map((fixture) => parseStamp(fixture));
    if (new Set(stamps.map((stamp) => stamp.generation_id)).size !== 1) throw new Error("generation_id mismatch");
    return;
  }
  if (name === "projection-id-mismatch-within-profile-set.md") {
    const stamps = fixtures.map((fixture) => parseStamp(fixture));
    if (new Set(stamps.map((stamp) => stamp.projection_id)).size !== 1) throw new Error("projection_id mismatch");
    return;
  }
  if (name.startsWith("field-defaults-")) {
    validateCompactMarkdown(fixtures[0]);
    return;
  }
  throw new Error(`unknown invalid fixture type ${name}`);
}

try {
  validatePair();
} catch (error) {
  fail(CANDIDATE_DIR, error.message);
}

validateFocusedInvalid();

if (failures.length > 0) {
  console.error("Compact candidate fixture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Compact candidate fixture check passed for ${path.relative(process.cwd(), CANDIDATE_DIR) || "."}`);
