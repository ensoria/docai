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

function validateFormUrlencodedBody(markdown) {
  const bodyLines = sectionLines(markdown, 4, "Body");
  if (!bodyLines) throw new Error("form-urlencoded request must include a Body subsection");
  const body = bodyLines.join("\n");
  const significant = bodyLines.map((line) => line.trim()).filter(Boolean);

  const markerOrder = [
    "**body_required**: yes",
    "**media_type**: application/x-www-form-urlencoded;charset=UTF-8",
    "**body_nullable**: no",
  ].map((marker) => significant.findIndex((line) => line === marker));
  if (markerOrder.some((index) => index < 0) || markerOrder.join("|") !== [...markerOrder].sort((a, b) => a - b).join("|")) {
    throw new Error("form-urlencoded body must contain body_required, media_type with UTF-8 charset, and body_nullable in order");
  }

  const sample = body.match(/```http\r?\n([\s\S]*?)```/)?.[1];
  if (!sample) throw new Error("form-urlencoded body must include an http sample fragment");
  if (!sample.includes("Content-Type: application/x-www-form-urlencoded; charset=UTF-8")) {
    throw new Error("form-urlencoded sample must show UTF-8 Content-Type");
  }
  if (!sample.includes("q=quarterly+statement")) {
    throw new Error("form-urlencoded sample must show space encoding as plus");
  }
  if (!sample.includes("tag=finance&tag=quarterly")) {
    throw new Error("form-urlencoded sample must show repeated field values");
  }

  const lowerBody = body.toLowerCase();
  if (!lowerBody.includes("utf-8 before percent-encoding")) {
    throw new Error("form-urlencoded prose must state the character encoding before percent-encoding");
  }
  if (!lowerBody.includes("spaces as `+`")) {
    throw new Error("form-urlencoded prose must state space encoding");
  }
  if (!lowerBody.includes("repeating the `tag` field once per value")) {
    throw new Error("form-urlencoded prose must state the repeated-field rule");
  }
  if (!lowerBody.includes("order is not significant")) {
    throw new Error("form-urlencoded prose must state repeated-field order significance");
  }

  const rows = tableRows(body, ["Field", "Type", "Required", "Nullable", "Constraints / Meaning"]);
  const q = rows.find((row) => row.Field === "q");
  if (!q) throw new Error("form-urlencoded body must document the q field");
  if (!q["Constraints / Meaning"].includes("UTF-8 before percent-encoding")) {
    throw new Error("form-urlencoded q field must state character encoding");
  }
  if (!q["Constraints / Meaning"].includes("spaces use `+`")) {
    throw new Error("form-urlencoded q field must state space encoding");
  }

  const tag = rows.find((row) => row.Field === "tag");
  if (!tag) throw new Error("form-urlencoded body must document the repeated tag field");
  if (tag.Type !== "string[]") throw new Error("form-urlencoded repeated field must use an array type");
  const tagMeaning = tag["Constraints / Meaning"];
  if (!tagMeaning.includes("repeat the field once per value")) {
    throw new Error("form-urlencoded repeated field must state repeat-key encoding");
  }
  if (!tagMeaning.includes("order is not significant")) {
    throw new Error("form-urlencoded repeated field must state order significance");
  }
  if (!tagMeaning.includes("omit the field when the list is empty")) {
    throw new Error("form-urlencoded repeated field must state empty-list behavior");
  }
}

function validateRawBinaryUpload(markdown) {
  const headers = sectionLines(markdown, 4, "Headers")?.join("\n");
  if (!headers) throw new Error("raw binary upload must document request headers");
  const headerRows = tableRows(headers, ["Name", "Required", "Type", "Constraints / Meaning"]);
  const digest = headerRows.find((row) => row.Name === "Digest");
  if (!digest) throw new Error("raw binary upload must document the Digest request header");
  if (digest.Required !== "yes") throw new Error("raw binary upload Digest header must be required");
  const digestMeaning = digest["Constraints / Meaning"];
  ["sha-256", "exact body bytes", "single field line", "not comma-combinable", "order not significant", "example"].forEach((requiredText) => {
    if (!digestMeaning.includes(requiredText)) throw new Error(`raw binary upload Digest header must state ${requiredText}`);
  });

  const bodyLines = sectionLines(markdown, 4, "Body");
  if (!bodyLines) throw new Error("raw binary upload must include a Body subsection");
  const body = bodyLines.join("\n");
  const significant = bodyLines.map((line) => line.trim()).filter(Boolean);
  const markerOrder = ["**body_required**: yes", "**media_type**: image/png"].map((marker) =>
    significant.findIndex((line) => line === marker),
  );
  if (markerOrder.some((index) => index < 0) || markerOrder.join("|") !== [...markerOrder].sort((a, b) => a - b).join("|")) {
    throw new Error("raw binary upload must contain body_required and media_type image/png in order");
  }
  if (significant.some((line) => line.startsWith("**body_nullable**:"))) {
    throw new Error("raw binary upload must not use body_nullable");
  }

  const sample = body.match(/```http\r?\n([\s\S]*?)```/)?.[1];
  if (!sample) throw new Error("raw binary upload must include an http sample fragment");
  if (!sample.includes("Content-Type: image/png")) throw new Error("raw binary upload sample must show Content-Type");
  if (!sample.includes("Content-Length: 524288")) throw new Error("raw binary upload sample must show Content-Length");
  if (!sample.includes("Digest: sha-256=")) throw new Error("raw binary upload sample must show Digest");
  if (!sample.includes("maximum 2097152 bytes")) throw new Error("raw binary upload sample must show the size limit");

  const lowerBody = body.toLowerCase();
  if (!lowerBody.includes("raw binary png bytes")) throw new Error("raw binary upload prose must identify raw binary PNG bytes");
  if (!body.includes("no multipart wrapper")) throw new Error("raw binary upload prose must state there is no multipart wrapper");
  if (!body.includes("Maximum size is 2097152 bytes")) throw new Error("raw binary upload prose must state maximum size");
  if (!body.includes("Digest") || !body.includes("exact body bytes") || !body.includes("SHA-256")) {
    throw new Error("raw binary upload prose must state integrity metadata");
  }
}

function validateRawBinaryDownload(markdown) {
  const responseLines = sectionLines(markdown, 3, "Response 200");
  if (!responseLines) throw new Error("raw binary download must include Response 200");
  const response = responseLines.join("\n");
  const significant = responseLines.map((line) => line.trim()).filter(Boolean);
  const markerOrder = ["**body_presence**: always", "**media_type**: image/png"].map((marker) =>
    significant.findIndex((line) => line === marker),
  );
  if (markerOrder.some((index) => index < 0) || markerOrder.join("|") !== [...markerOrder].sort((a, b) => a - b).join("|")) {
    throw new Error("raw binary download must contain body_presence and media_type image/png in order");
  }
  if (significant.some((line) => line.startsWith("**body_nullable**:"))) {
    throw new Error("raw binary download must not use body_nullable");
  }

  const sample = response.match(/```http\r?\n([\s\S]*?)```/)?.[1];
  if (!sample) throw new Error("raw binary download must include an http sample fragment");
  if (!sample.includes("Content-Type: image/png")) throw new Error("raw binary download sample must show Content-Type");
  if (!sample.includes('Content-Disposition: attachment; filename="avatar.png"')) {
    throw new Error("raw binary download sample must show filename metadata");
  }
  if (!sample.includes("Content-Length: 524288")) throw new Error("raw binary download sample must show Content-Length");
  if (!sample.includes("Digest: sha-256=")) throw new Error("raw binary download sample must show Digest");
  if (!sample.includes("maximum 2097152 bytes")) throw new Error("raw binary download sample must show the size limit");

  if (!response.includes("Filename is obtained from the `Content-Disposition` header")) {
    throw new Error("raw binary download prose must state how the filename is obtained");
  }
  if (!response.includes("Maximum size is 2097152 bytes")) throw new Error("raw binary download prose must state maximum size");
  if (!response.includes("Verify the `Digest` header") || !response.includes("exact response body bytes") || !response.includes("SHA-256")) {
    throw new Error("raw binary download prose must state integrity verification");
  }

  const headerSection = sectionLines(response, 4, "Response Headers")?.join("\n");
  if (!headerSection) throw new Error("raw binary download must document response headers");
  const rows = tableRows(headerSection, ["Name", "Type", "Presence", "Meaning"]);
  const byName = new Map(rows.map((row) => [row.Name, row]));
  ["Content-Disposition", "Content-Length", "Digest"].forEach((name) => {
    if (!byName.has(name)) throw new Error(`raw binary download response headers must include ${name}`);
  });
  if (!byName.get("Content-Disposition").Meaning.includes("filename")) {
    throw new Error("raw binary download Content-Disposition must document filename");
  }
  if (!byName.get("Content-Length").Meaning.includes("maximum is 2097152")) {
    throw new Error("raw binary download Content-Length must document size limit");
  }
  const digestMeaning = byName.get("Digest").Meaning;
  if (!digestMeaning.includes("sha-256") || !digestMeaning.includes("exact response body bytes") || !digestMeaning.includes("verify")) {
    throw new Error("raw binary download Digest header must document integrity verification");
  }
}

function indexEndpointRows(markdown) {
  const endpoints = sectionLines(markdown, 2, "Endpoints")?.join("\n") ?? "";
  const lines = endpoints.split(/\r?\n/);
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = splitTableLine(lines[index]);
    const separator = splitTableLine(lines[index + 1] ?? "");
    if (!header || !separator?.every((cell) => /^-+$/.test(cell))) continue;
    if (header.join("|") !== "Method|Path|Task|Summary|Also read") {
      throw new Error("endpoint table header must be Method | Path | Task | Summary | Also read");
    }
    index += 2;
    for (; index < lines.length; index += 1) {
      const row = splitTableLine(lines[index]);
      if (!row) break;
      rows.push(`${row[0]} ${row[1]}`);
    }
  }
  return rows;
}

function endpointHeadings(markdown) {
  return headingRows(markdown)
    .filter((heading) => heading.level === 2 && /^[A-Z]+ /.test(heading.title))
    .map((heading) => heading.title);
}

function validateFullSet() {
  const fullDir = path.join(CANDIDATE_DIR, "valid", "full");
  const files = [
    "INDEX.md",
    "CONVENTIONS.md",
    path.join("resources", "binary.md"),
    path.join("resources", "forms.md"),
    path.join("resources", "uploads.md"),
  ].map((file) =>
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
  try {
    const indexed = indexEndpointRows(contents[indexFile]).sort().join("|");
    const resourceHeadings = [
      path.join(fullDir, "resources", "binary.md"),
      path.join(fullDir, "resources", "forms.md"),
      path.join(fullDir, "resources", "uploads.md"),
    ]
      .flatMap((file) => endpointHeadings(contents[file]))
      .sort()
      .join("|");
    if (indexed !== resourceHeadings) {
      throw new Error("INDEX endpoint rows must match resource endpoint headings");
    }
  } catch (error) {
    fail(indexFile, error.message);
  }

  try {
    validateRawBinaryUpload(contents[path.join(fullDir, "resources", "binary.md")]);
    validateRawBinaryDownload(contents[path.join(fullDir, "resources", "binary.md")]);
  } catch (error) {
    fail(path.join(fullDir, "resources", "binary.md"), error.message);
  }

  try {
    validateFormUrlencodedBody(contents[path.join(fullDir, "resources", "forms.md")]);
  } catch (error) {
    fail(path.join(fullDir, "resources", "forms.md"), error.message);
  }

  try {
    validateMultipartBody(contents[path.join(fullDir, "resources", "uploads.md")]);
  } catch (error) {
    fail(path.join(fullDir, "resources", "uploads.md"), error.message);
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
      const name = path.basename(file);
      if (name.startsWith("form-urlencoded-")) {
        validateFormUrlencodedBody(fixtures[0]);
      } else if (name.startsWith("raw-binary-download-")) {
        validateRawBinaryDownload(fixtures[0]);
      } else if (name.startsWith("raw-binary-upload-")) {
        validateRawBinaryUpload(fixtures[0]);
      } else {
        validateMultipartBody(fixtures[0]);
      }
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
