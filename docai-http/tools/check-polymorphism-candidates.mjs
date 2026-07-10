#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "0.11.0";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "polymorphism-candidates", `v${SPEC_VERSION}`);
const CANDIDATE_DIR = path.resolve(process.argv[2] ?? DEFAULT_DIR);

const failures = [];

function fail(file, message) {
  failures.push(`${path.relative(process.cwd(), file)}: ${message}`);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
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
  if (stamp.profile !== "full") throw new Error("polymorphism candidate stamp profile must be full");
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

function sectionMarkdown(markdown, level, title) {
  const lines = markdown.split(/\r?\n/);
  const headings = headingRows(markdown);
  const heading = headings.find((candidate) => candidate.level === level && candidate.title === title);
  if (!heading) return null;
  const next = headings.find((candidate) => candidate.line > heading.line && candidate.level <= level);
  return lines.slice(heading.line, next?.line).join("\n");
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

function variantBlocks(markdown) {
  const matches = [...markdown.matchAll(/^\*\*variant\*\*: (.+)$/gm)];
  return matches.map((match, index) => {
    const end = matches[index + 1]?.index ?? markdown.length;
    return {
      label: match[1],
      block: markdown.slice(match.index, end),
      index: match.index,
    };
  });
}

function validateRequestTaggedVariants(markdown) {
  const bodyLines = sectionLines(markdown, 4, "Body");
  if (!bodyLines) throw new Error("tagged variant request must include Body");
  const body = bodyLines.join("\n");
  const significant = bodyLines.map((line) => line.trim()).filter(Boolean);
  const markerOrder = ["**body_required**: yes", "**media_type**: application/json", "**body_nullable**: no"].map((marker) =>
    significant.findIndex((line) => line === marker),
  );
  if (markerOrder.some((index) => index < 0) || markerOrder.join("|") !== [...markerOrder].sort((a, b) => a - b).join("|")) {
    throw new Error("tagged variant request must contain body_required, media_type, and body_nullable in order");
  }

  const variants = variantBlocks(body);
  const labels = variants.map((variant) => variant.label).join("|");
  if (labels !== "type = bank|type = card") {
    throw new Error("tagged request variants must be ordered by discriminator value");
  }

  const beforeFirstVariant = body.slice(0, variants[0]?.index ?? body.length);
  if (beforeFirstVariant.includes("```json") || beforeFirstVariant.includes("| Field |")) {
    throw new Error("tagged request must not include an unlabeled common example or field table before variants");
  }

  const expectations = {
    bank: {
      fields: ["$", "type", "amount", "currency", "bank_account_id"],
      ownField: "bank_account_id",
      forbiddenField: "card_token",
    },
    card: {
      fields: ["$", "type", "amount", "currency", "card_token"],
      ownField: "card_token",
      forbiddenField: "bank_account_id",
    },
  };

  variants.forEach((variant) => {
    const value = variant.label.split(" = ")[1];
    const expectation = expectations[value];
    if (!expectation) throw new Error(`unexpected tagged variant ${variant.label}`);

    const sample = variant.block.match(/```json\r?\n([\s\S]*?)```/)?.[1];
    if (!sample) throw new Error(`variant ${value} must include a JSON example`);
    const parsed = JSON.parse(sample);
    if (parsed.type !== value) throw new Error(`variant ${value} example must match discriminator value`);
    ["amount", "currency", expectation.ownField].forEach((field) => {
      if (!(field in parsed)) throw new Error(`variant ${value} example must include ${field}`);
    });
    if (expectation.forbiddenField in parsed) {
      throw new Error(`variant ${value} example must not include ${expectation.forbiddenField}`);
    }

    const rows = tableRows(variant.block, ["Field", "Type", "Required", "Nullable", "Constraints / Meaning"]);
    const fields = rows.map((row) => row.Field).join("|");
    if (fields !== expectation.fields.join("|")) {
      throw new Error(`variant ${value} table must include complete common and variant-specific fields`);
    }
    rows.forEach((row) => {
      if (row.Required !== "yes" || row.Nullable !== "no") {
        throw new Error(`variant ${value} rows must be required and non-nullable in this fixture`);
      }
    });
    const type = rows.find((row) => row.Field === "type");
    if (!type["Constraints / Meaning"].includes("Discriminator")) {
      throw new Error(`variant ${value} type row must identify the discriminator`);
    }
    if (!type["Constraints / Meaning"].includes("bank") || !type["Constraints / Meaning"].includes("card")) {
      throw new Error(`variant ${value} discriminator row must list every allowed discriminator value`);
    }
    if (!type["Constraints / Meaning"].includes(`this variant is \`${value}\``)) {
      throw new Error(`variant ${value} discriminator row must identify the current variant`);
    }
  });
}

function validateUntaggedResponseVariants(markdown) {
  const responseLines = sectionLines(markdown, 3, "Response 200");
  if (!responseLines) throw new Error("untagged variant response must include Response 200");
  const response = responseLines.join("\n");
  const significant = responseLines.map((line) => line.trim()).filter(Boolean);
  const markerOrder = ["**body_presence**: always", "**media_type**: application/json", "**body_nullable**: no"].map((marker) =>
    significant.findIndex((line) => line === marker),
  );
  if (markerOrder.some((index) => index < 0) || markerOrder.join("|") !== [...markerOrder].sort((a, b) => a - b).join("|")) {
    throw new Error("untagged variant response must contain body_presence, media_type, and body_nullable in order");
  }

  const variants = variantBlocks(response);
  const labels = variants.map((variant) => variant.label).join("|");
  if (labels !== "bank account method|card method") {
    throw new Error("untagged response variants must use stable labels in lexical order");
  }

  const beforeFirstVariant = response.slice(0, variants[0]?.index ?? response.length);
  if (beforeFirstVariant.includes("```json") || beforeFirstVariant.includes("| Field |")) {
    throw new Error("untagged response must not include an unlabeled common example or field table before variants");
  }

  const expectations = {
    "bank account method": {
      selector: "bank_account_id",
      excluded: "card_last4",
      fields: ["$", "id", "label", "bank_account_id"],
      sampleId: "pm_01K0UNTAGBANK",
    },
    "card method": {
      selector: "card_last4",
      excluded: "bank_account_id",
      fields: ["$", "id", "label", "card_last4"],
      sampleId: "pm_01K0UNTAGCARD",
    },
  };

  variants.forEach((variant) => {
    const expectation = expectations[variant.label];
    if (!expectation) throw new Error(`unexpected untagged variant ${variant.label}`);
    if (!variant.block.includes(`Use this variant when the response has \`${expectation.selector}\``)) {
      throw new Error(`untagged variant ${variant.label} must include selection prose`);
    }
    if (!variant.block.includes(`never has \`${expectation.excluded}\``)) {
      throw new Error(`untagged variant ${variant.label} must state the excluded alternative field`);
    }

    const sample = variant.block.match(/```json\r?\n([\s\S]*?)```/)?.[1];
    if (!sample) throw new Error(`untagged variant ${variant.label} must include a JSON example`);
    const parsed = JSON.parse(sample);
    if (parsed.id !== expectation.sampleId) throw new Error(`untagged variant ${variant.label} example must use the expected ID`);
    if (!(expectation.selector in parsed)) throw new Error(`untagged variant ${variant.label} example must include ${expectation.selector}`);
    if (expectation.excluded in parsed) {
      throw new Error(`untagged variant ${variant.label} example must not include ${expectation.excluded}`);
    }

    const rows = tableRows(variant.block, ["Field", "Type", "Presence", "Nullable", "Meaning"]);
    const fields = rows.map((row) => row.Field).join("|");
    if (fields !== expectation.fields.join("|")) {
      throw new Error(`untagged variant ${variant.label} table must include complete common and variant-specific fields`);
    }
    rows.forEach((row) => {
      if (row.Presence !== "always" || row.Nullable !== "no") {
        throw new Error(`untagged variant ${variant.label} rows must be always present and non-nullable in this fixture`);
      }
    });
    const selector = rows.find((row) => row.Field === expectation.selector);
    if (!selector.Meaning.includes(`Present only for the ${variant.label} variant`)) {
      throw new Error(`untagged variant ${variant.label} selector row must identify the variant boundary`);
    }
  });
}

function validateCreatedPaymentResponse(markdown) {
  const responseLines = sectionLines(markdown, 3, "Response 201");
  if (!responseLines) throw new Error("payment endpoint must include Response 201");
  const response = responseLines.join("\n");
  const significant = responseLines.map((line) => line.trim()).filter(Boolean);
  const markerOrder = ["**body_presence**: always", "**media_type**: application/json", "**body_nullable**: no"].map((marker) =>
    significant.findIndex((line) => line === marker),
  );
  if (markerOrder.some((index) => index < 0) || markerOrder.join("|") !== [...markerOrder].sort((a, b) => a - b).join("|")) {
    throw new Error("payment response must contain body_presence, media_type, and body_nullable in order");
  }
  const rows = tableRows(response, ["Field", "Type", "Presence", "Nullable", "Meaning"]);
  if (rows.map((row) => row.Field).join("|") !== "$|payment_id|status") {
    throw new Error("payment response field table must document payment_id and status");
  }
}

function validateFullSet() {
  const fullDir = path.join(CANDIDATE_DIR, "valid", "full");
  const files = [
    "INDEX.md",
    "CONVENTIONS.md",
    path.join("resources", "payments.md"),
  ].map((file) => path.join(fullDir, file));
  const sourceFile = path.resolve(CANDIDATE_DIR, "..", "..", "polymorphism-candidate-openapi.yaml");
  [...files, sourceFile].forEach((file) => {
    if (!fs.existsSync(file)) fail(file, "required polymorphism candidate file is missing");
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
    const resourceHeadings = endpointHeadings(contents[path.join(fullDir, "resources", "payments.md")]).sort().join("|");
    if (indexed !== resourceHeadings) {
      throw new Error("INDEX endpoint rows must match resource endpoint headings");
    }
  } catch (error) {
    fail(indexFile, error.message);
  }

  try {
    const payments = contents[path.join(fullDir, "resources", "payments.md")];
    const taggedEndpoint = sectionMarkdown(payments, 2, "POST /payments");
    const untaggedEndpoint = sectionMarkdown(payments, 2, "GET /payment-methods/{id}");
    if (!taggedEndpoint) throw new Error("tagged payment endpoint is missing");
    if (!untaggedEndpoint) throw new Error("untagged payment method endpoint is missing");
    validateRequestTaggedVariants(taggedEndpoint);
    validateUntaggedResponseVariants(untaggedEndpoint);
    validateCreatedPaymentResponse(taggedEndpoint);
  } catch (error) {
    fail(path.join(fullDir, "resources", "payments.md"), error.message);
  }
}

validateFullSet();

if (failures.length > 0) {
  console.error("Polymorphism candidate fixture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Polymorphism candidate fixture check passed for ${path.relative(process.cwd(), CANDIDATE_DIR) || "."}`);
