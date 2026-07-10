#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "0.11.0";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "non-json-candidates", `v${SPEC_VERSION}`);
const CANDIDATE_DIR = path.resolve(process.argv[2] ?? DEFAULT_DIR);

const failures = [];

function fail(file, message) {
  failures.push(`${path.relative(process.cwd(), file)}: ${message}`);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listMarkdownFiles(full) : [full];
    })
    .filter((file) => file.endsWith(".md"))
    .sort();
}

function extractMarkdownFixtures(markdown) {
  return [...markdown.matchAll(/^(`{3,4})markdown\r?\n([\s\S]*?)^\1$/gm)].map((match) => match[2]);
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

function validateStamp(markdown) {
  const stamp = parseStamp(markdown);
  if (stamp["docai-http"] !== SPEC_VERSION) throw new Error(`stamp version is not ${SPEC_VERSION}`);
  if (stamp.profile !== "full") throw new Error("non-JSON candidate stamp profile must be full");
  if (!stamp.generated || !stamp.generation_id || !stamp.projection_id) {
    throw new Error("stamp lacks generated, generation_id, or projection_id");
  }
  return stamp;
}

function headingRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line, index) => {
      const match = line.match(/^(#{1,6}) (.+)$/);
      return match ? { level: match[1].length, title: match[2].trim(), line: index } : null;
    })
    .filter(Boolean);
}

function sectionLines(markdown, level, title) {
  const lines = markdown.split(/\r?\n/);
  const headings = headingRows(markdown);
  const heading = headings.find((candidate) => candidate.level === level && candidate.title === title);
  if (!heading) return null;
  const next = headings.find((candidate) => candidate.line > heading.line && candidate.level <= level);
  return lines.slice(heading.line + 1, next?.line);
}

function splitTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = [];
  let current = "";
  for (let index = 1; index < trimmed.length - 1; index += 1) {
    if (trimmed[index] === "|" && trimmed[index - 1] !== "\\") {
      cells.push(current.trim().replace(/\\\|/g, "|"));
      current = "";
    } else {
      current += trimmed[index];
    }
  }
  cells.push(current.trim().replace(/\\\|/g, "|"));
  return cells;
}

function tableRows(markdown, expectedHeader) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim().startsWith("|"));
  if (headerIndex < 0) throw new Error(`missing ${expectedHeader.join(" | ")} table`);
  const header = splitTableLine(lines[headerIndex]);
  const separator = splitTableLine(lines[headerIndex + 1] ?? "");
  if (header?.join("|") !== expectedHeader.join("|") || !separator?.every((cell) => /^-+$/.test(cell))) {
    throw new Error(`table header must be ${expectedHeader.join(" | ")}`);
  }

  const rows = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const row = splitTableLine(lines[index]);
    if (!row) break;
    rows.push(Object.fromEntries(expectedHeader.map((column, cellIndex) => [column, row[cellIndex] ?? ""])));
  }
  return rows;
}

function validateMultipartBody(markdown) {
  const bodyLines = sectionLines(markdown, 4, "Body");
  if (!bodyLines) throw new Error("multipart request must include a Body subsection");
  const body = bodyLines.join("\n");
  const significant = bodyLines.map((line) => line.trim()).filter(Boolean);

  const markerOrder = ["**body_required**: yes", "**media_type**: multipart/form-data", "**body_nullable**: no"].map((marker) =>
    significant.findIndex((line) => line === marker),
  );
  if (markerOrder.some((index) => index < 0) || markerOrder.join("|") !== [...markerOrder].sort((a, b) => a - b).join("|")) {
    throw new Error("multipart body must contain body_required, media_type multipart/form-data, and body_nullable in order");
  }

  const sample = body.match(/```http\r?\n([\s\S]*?)```/)?.[1];
  if (!sample) throw new Error("multipart body must include an http sample fragment");
  if (!sample.includes("Content-Type: multipart/form-data; boundary=<generated by HTTP library>")) {
    throw new Error("multipart sample must show boundary delegated to the HTTP library");
  }
  if (!sample.includes('Content-Disposition: form-data; name="document"; filename=')) {
    throw new Error("multipart sample must show the file part filename");
  }
  if (!sample.includes("Content-Type: application/pdf")) {
    throw new Error("multipart sample must show a file part Content-Type");
  }
  if (!sample.includes("maximum 10485760 bytes")) {
    throw new Error("multipart sample must show the file size limit");
  }

  const lowerBody = body.toLowerCase();
  if (!lowerBody.includes("delegate multipart boundary construction to the http library")) {
    throw new Error("multipart prose must delegate boundary construction to the HTTP library");
  }
  if (!lowerBody.includes("must not hard-code")) {
    throw new Error("multipart prose must tell callers not to hard-code the sample boundary");
  }

  const rows = tableRows(body, ["Field", "Type", "Required", "Nullable", "Constraints / Meaning"]);
  const document = rows.find((row) => row.Field === "document");
  if (!document) throw new Error("multipart body must document the file part");
  if (document.Type !== "file") throw new Error("multipart file part must use type file");
  if (document.Required !== "yes" || document.Nullable !== "no") {
    throw new Error("multipart file part must be required and non-nullable in this fixture");
  }

  const meaning = document["Constraints / Meaning"];
  [
    "filename is required",
    "Content-Type",
    "application/pdf",
    "image/png",
    "maximum size",
    "10485760",
  ].forEach((requiredText) => {
    if (!meaning.includes(requiredText)) throw new Error(`multipart file part must state ${requiredText}`);
  });

  const metadata = rows.find((row) => row.Field === "metadata");
  if (!metadata) throw new Error("multipart body must document the JSON metadata part");
  const metadataMeaning = metadata["Constraints / Meaning"];
  if (!metadataMeaning.includes("Content-Type is `application/json`")) {
    throw new Error("multipart JSON part must state its part Content-Type");
  }
  if (!metadataMeaning.includes("maximum serialized size is 4096 bytes")) {
    throw new Error("multipart JSON part must state its size limit");
  }
}

function indexEndpointRows(markdown) {
  const endpoints = sectionLines(markdown, 2, "Endpoints")?.join("\n") ?? "";
  const rows = tableRows(endpoints, ["Method", "Path", "Task", "Summary", "Also read"]);
  return rows.map((row) => `${row.Method} ${row.Path}`);
}

function endpointHeadings(markdown) {
  return headingRows(markdown)
    .filter((heading) => heading.level === 2 && /^[A-Z]+ /.test(heading.title))
    .map((heading) => heading.title);
}

function validateFullSet() {
  const fullDir = path.join(CANDIDATE_DIR, "valid", "full");
  const files = ["INDEX.md", "CONVENTIONS.md", path.join("resources", "uploads.md")].map((file) =>
    path.join(fullDir, file),
  );
  const sourceFile = path.resolve(CANDIDATE_DIR, "..", "..", "non-json-candidate-openapi.yaml");
  [...files, sourceFile].forEach((file) => {
    if (!fs.existsSync(file)) fail(file, "required non-JSON candidate file is missing");
  });
  if (failures.length > 0) return;

  const contents = Object.fromEntries(files.map((file) => [file, read(file)]));
  const stamps = Object.values(contents).map(validateStamp);
  if (new Set(stamps.map((stamp) => stamp.generated)).size !== 1) fail(fullDir, "full set generated values differ");
  if (new Set(stamps.map((stamp) => stamp.generation_id)).size !== 1) fail(fullDir, "full set generation_id values differ");
  if (new Set(stamps.map((stamp) => stamp.projection_id)).size !== 1) fail(fullDir, "full set projection_id values differ");

  const indexFile = path.join(fullDir, "INDEX.md");
  const resourceFile = path.join(fullDir, "resources", "uploads.md");
  try {
    if (indexEndpointRows(contents[indexFile]).join("|") !== endpointHeadings(contents[resourceFile]).join("|")) {
      throw new Error("INDEX endpoint rows must match resource endpoint headings");
    }
  } catch (error) {
    fail(indexFile, error.message);
  }

  try {
    validateMultipartBody(contents[resourceFile]);
  } catch (error) {
    fail(resourceFile, error.message);
  }
}

function validateFocusedInvalid() {
  listMarkdownFiles(path.join(CANDIDATE_DIR, "focused", "invalid")).forEach((file) => {
    const fixtures = extractMarkdownFixtures(read(file));
    if (fixtures.length === 0) {
      fail(file, "invalid focused fixture lacks markdown code fence");
      return;
    }
    let accepted = false;
    try {
      validateMultipartBody(fixtures[0]);
      accepted = true;
    } catch {
      accepted = false;
    }
    if (accepted) fail(file, "checker accepted invalid non-JSON candidate fixture");
  });
}

validateFullSet();
validateFocusedInvalid();

if (failures.length > 0) {
  console.error("Non-JSON candidate fixture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Non-JSON candidate fixture check passed for ${path.relative(process.cwd(), CANDIDATE_DIR) || "."}`);
