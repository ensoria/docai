import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const CSV_ADAPTER_IDENTITY = {
  docaiMessaging: "0.17.1",
  publicationPolicy: {
    id: "docai-messaging-complete-fixture-publication",
    version: "1.0.0"
  },
  adapterClass: "payload-wire",
  target: "text/csv;charset=utf-8",
  ruleVersion: "complete-fixture-csv-1.0.0",
  fenceInfo: "csv"
};

function parseCsvRow(line) {
  const fields = [];
  let cursor = 0;
  while (cursor <= line.length) {
    let value = "";
    if (line[cursor] === "\"") {
      cursor += 1;
      let closed = false;
      while (cursor < line.length) {
        if (line[cursor] !== "\"") {
          value += line[cursor];
          cursor += 1;
          continue;
        }
        if (line[cursor + 1] === "\"") {
          value += "\"";
          cursor += 2;
          continue;
        }
        cursor += 1;
        closed = true;
        break;
      }
      if (!closed || (cursor < line.length && line[cursor] !== ",")) {
        throw new SyntaxError("CSV quoted fields require a closing quote followed by a delimiter or row end.");
      }
    } else {
      while (cursor < line.length && line[cursor] !== ",") {
        if (line[cursor] === "\"") {
          throw new SyntaxError("CSV quotes may appear only as a field delimiter.");
        }
        value += line[cursor];
        cursor += 1;
      }
    }
    fields.push(value);
    if (cursor === line.length) break;
    cursor += 1;
    if (cursor === line.length) {
      fields.push("");
      break;
    }
  }
  return fields;
}

function decodeCsvExample(source) {
  if (typeof source !== "string" || source.includes("\r")) {
    throw new SyntaxError("CSV examples use exact LF line boundaries.");
  }
  const rows = source.split("\n");
  if (rows.length !== 2) {
    throw new SyntaxError("CSV examples contain exactly one header row and one data row.");
  }
  const headers = parseCsvRow(rows[0]);
  const values = parseCsvRow(rows[1]);
  if (headers.some((header) => header === "")
    || new Set(headers).size !== headers.length
    || values.length !== headers.length) {
    throw new SyntaxError("CSV examples require unique non-empty headers and one value per header.");
  }
  return new Map(headers.map((header, index) => [header, values[index]]));
}

function exactPublicationScope(manifest) {
  return manifest?.docaiMessaging === CSV_ADAPTER_IDENTITY.docaiMessaging
    && manifest?.publicationPolicy?.id === CSV_ADAPTER_IDENTITY.publicationPolicy.id
    && manifest?.publicationPolicy?.version === CSV_ADAPTER_IDENTITY.publicationPolicy.version;
}

export function resolveTrustedCompleteExampleAdapters(manifest) {
  if (!exactPublicationScope(manifest) || !Array.isArray(manifest.adapters)) return [];
  const mappings = manifest.adapters.filter((entry) => (
    entry?.class === CSV_ADAPTER_IDENTITY.adapterClass
      && entry.target === CSV_ADAPTER_IDENTITY.target
  ));
  if (mappings.length !== 1
    || mappings[0].ruleVersion !== CSV_ADAPTER_IDENTITY.ruleVersion) return [];
  return [{
    adapterClass: CSV_ADAPTER_IDENTITY.adapterClass,
    target: CSV_ADAPTER_IDENTITY.target,
    ruleVersion: CSV_ADAPTER_IDENTITY.ruleVersion,
    fenceInfo: CSV_ADAPTER_IDENTITY.fenceInfo,
    decodeExample: decodeCsvExample
  }];
}

export function loadTrustedCompleteExampleAdapterOptions(candidatePath, documentSets = []) {
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  if (!fs.existsSync(manifestPath)) return {};
  const bytes = fs.readFileSync(manifestPath);
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError(`Complete candidate projection manifest is not valid UTF-8: ${manifestPath}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch {
    throw new TypeError(`Complete candidate projection manifest is not valid JSON: ${manifestPath}`);
  }
  const projectionDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  for (const documentSet of documentSets) {
    const root = documentSet.files.find((file) => file.path === "INDEX.md");
    if (root?.identity?.projection_digest !== projectionDigest) {
      throw new TypeError(
        `Complete candidate projection manifest digest does not match ${documentSet.rootDir}/INDEX.md.`
      );
    }
  }
  return { exampleAdapters: resolveTrustedCompleteExampleAdapters(manifest) };
}
