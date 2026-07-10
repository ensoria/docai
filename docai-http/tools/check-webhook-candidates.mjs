#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "0.11.0";
const WEBHOOK_SECTIONS = ["Headers", "Payload", "Related"];
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "webhook-candidates", `v${SPEC_VERSION}`);
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
  if (stamp.profile !== "full") throw new Error("webhook candidate stamp profile must be full");
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

function sectionText(markdown, level, title) {
  const lines = sectionLines(markdown, level, title);
  if (!lines) throw new Error(`${title} section is missing`);
  return lines.join("\n");
}

function significantLines(lines) {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function tableRows(section, expectedHeader) {
  const lines = section.split(/\r?\n/);
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

function validateWebhookMarkdown(markdown) {
  const headings = headingRows(markdown);
  const title = headings.find((heading) => heading.level === 1);
  if (!title) throw new Error("webhook title is missing");

  const h2s = headings.filter((heading) => heading.level === 2);
  if (h2s.map((heading) => heading.title).join("|") !== WEBHOOK_SECTIONS.join("|")) {
    throw new Error(`webhook sections must be ${WEBHOOK_SECTIONS.join(", ")} in order`);
  }

  const payload = sectionText(markdown, 2, "Payload");
  const grouped = payload.includes("**variant**:");
  validateDeviationPlacement(markdown, grouped);
  validateHeaders(sectionText(markdown, 2, "Headers"), grouped);
  validatePayload(payload, grouped);
  validateRelated(sectionText(markdown, 2, "Related"), grouped);
}

function validateDeviationPlacement(markdown, grouped) {
  const lines = markdown.split(/\r?\n/);
  const headings = headingRows(markdown);
  const title = headings.find((heading) => heading.level === 1);
  const firstH2 = headings.find((heading) => heading.level === 2);
  lines.forEach((line, index) => {
    if (!line.trim().startsWith("**deviation**:")) return;
    if (index < title.line || (firstH2 && index > firstH2.line)) {
      throw new Error("webhook delivery deviation must appear after the intro description and before Headers");
    }
    const intro = significantLines(lines.slice(title.line + 1, index));
    if (intro.length === 0) throw new Error("webhook delivery deviation must appear after the intro description");
    if (grouped && /\bonly (for|when)\b.+\b(subscription|event|receiver)\b/i.test(line)) {
      throw new Error("grouped webhook cannot contain event-specific delivery deviation");
    }
  });
}

function validateHeaders(section, grouped) {
  if (section.trim() === "none") return;
  if (grouped && /\bonly (for|when)\b.+\b(event|subscription|payment)\b/i.test(section)) {
    throw new Error("grouped webhook cannot contain event-specific headers");
  }
  const rows = tableRows(section, ["Name", "Required", "Type", "Constraints / Meaning"]);
  rows.forEach((row) => {
    const meaning = row["Constraints / Meaning"];
    ["field line", "comma", "order", "example"].forEach((requiredTerm) => {
      if (!meaning.toLowerCase().includes(requiredTerm)) {
        throw new Error(`webhook header ${row.Name} must state ${requiredTerm} semantics`);
      }
    });
  });
}

function validatePayload(section, grouped) {
  const lines = significantLines(section.split(/\r?\n/));
  const markerOrder = ["**body_required**:", "**media_type**:", "**body_nullable**:"].map((marker) =>
    lines.findIndex((line) => line.startsWith(marker)),
  );
  if (markerOrder.some((index) => index < 0) || markerOrder.join("|") !== [...markerOrder].sort((a, b) => a - b).join("|")) {
    throw new Error("webhook payload must contain body_required, media_type, and body_nullable in order");
  }

  if (section.includes("| Field | Type | Required | Nullable |")) {
    throw new Error("webhook payload tables must use Presence, not Required");
  }

  if (grouped) {
    validateGroupedPayload(section);
  } else {
    validateSinglePayload(section);
  }
}

function validateSinglePayload(section) {
  if (!section.includes("```json")) throw new Error("webhook payload must contain a JSON example");
  const rows = tableRows(section, ["Field", "Type", "Presence", "Nullable", "Meaning"]);
  if (!rows.some((row) => /deduplicat|dedup/i.test(row.Meaning))) {
    throw new Error("webhook payload must identify a deduplication key or strategy");
  }
}

function validateGroupedPayload(section) {
  const firstVariant = section.indexOf("**variant**:");
  if (firstVariant < 0) throw new Error("grouped webhook payload must use variant blocks");
  if (section.slice(0, firstVariant).split(/\r?\n/).some((line) => line.trim().startsWith("|"))) {
    throw new Error("grouped webhook payload must not have an unlabeled common table before variants");
  }

  const variants = [...section.matchAll(/^\*\*variant\*\*: (.+)$/gm)];
  if (variants.length < 2) throw new Error("grouped webhook payload must contain at least two variants");
  variants.forEach((match, index) => {
    if (!match[1].includes("=")) throw new Error("grouped webhook variant must include an exact selection rule");
    const start = match.index;
    const end = variants[index + 1]?.index ?? section.length;
    const block = section.slice(start, end);
    if (!block.includes("```json")) throw new Error("each webhook variant must contain a JSON example");
    const rows = tableRows(block, ["Field", "Type", "Presence", "Nullable", "Meaning"]);
    if (!rows.some((row) => /deduplicat|dedup/i.test(row.Meaning))) {
      throw new Error("each grouped webhook variant must identify a deduplication key or strategy");
    }
  });
}

function validateRelated(section, grouped) {
  const text = section.trim();
  if (!text.includes("Triggered by:")) throw new Error("webhook Related must identify the triggering endpoint");
  if (grouped && /\bonly (for|when)\b.+\breceiver\b/i.test(text)) {
    throw new Error("grouped webhook cannot contain event-specific receiver requirements");
  }
}

function parseWebhookRows(indexMarkdown) {
  const section = sectionText(indexMarkdown, 2, "Webhooks");
  if (section.trim() === "none") return [];
  const rows = tableRows(section, ["Name", "Summary", "Details"]);
  rows.forEach((row) => {
    if (!/^webhooks\/[A-Za-z0-9._/-]+\.md$/.test(row.Details)) {
      throw new Error("webhook Details must be a webhooks/*.md path");
    }
  });
  return rows;
}

function parseEndpointRows(indexMarkdown) {
  const endpoints = sectionText(indexMarkdown, 2, "Endpoints");
  if (endpoints.trim() === "none") return [];

  const lines = endpoints.split(/\r?\n/);
  const rows = [];
  let resourcePath = null;
  for (let index = 0; index < lines.length; index += 1) {
    const resourceMatch = lines[index].match(/^### (.+)$/);
    if (resourceMatch) {
      resourcePath = resourceMatch[1].trim();
      continue;
    }
    const header = splitTableLine(lines[index]);
    const separator = splitTableLine(lines[index + 1] ?? "");
    if (!header || !separator?.every((cell) => /^-+$/.test(cell))) continue;
    const methodIndex = header.indexOf("Method");
    const pathIndex = header.indexOf("Path");
    const alsoReadIndex = header.indexOf("Also read");
    if (methodIndex < 0 || pathIndex < 0 || alsoReadIndex < 0) {
      throw new Error("endpoint table must include Method, Path, and Also read");
    }
    index += 2;
    for (; index < lines.length; index += 1) {
      const row = splitTableLine(lines[index]);
      if (!row) break;
      rows.push({
        resourcePath,
        method: row[methodIndex],
        endpointPath: row[pathIndex],
        alsoRead: row[alsoReadIndex] === "none" ? [] : row[alsoReadIndex].split(",").map((item) => item.trim()),
      });
    }
  }
  return rows;
}

function endpointBlock(resourceMarkdown, method, endpointPath) {
  const lines = resourceMarkdown.split(/\r?\n/);
  const headings = headingRows(resourceMarkdown);
  const heading = headings.find(
    (candidate) => candidate.level === 2 && candidate.title === `${method} ${endpointPath}`,
  );
  if (!heading) return null;
  const next = headings.find((candidate) => candidate.line > heading.line && candidate.level <= 2);
  return lines.slice(heading.line, next?.line).join("\n");
}

function validateWebhookReferences(indexMarkdown, resourceByPath, availableWebhookPaths) {
  parseWebhookRows(indexMarkdown).forEach((row) => {
    if (!availableWebhookPaths.has(row.Details)) throw new Error(`webhook Details target ${row.Details} is missing`);
  });

  parseEndpointRows(indexMarkdown).forEach((row) => {
    row.alsoRead
      .filter((target) => target.startsWith("webhooks/"))
      .forEach((webhookPath) => {
        if (!availableWebhookPaths.has(webhookPath)) throw new Error(`endpoint Also read target ${webhookPath} is missing`);
        const resourceMarkdown = resourceByPath[row.resourcePath];
        if (!resourceMarkdown) throw new Error(`resource file ${row.resourcePath} is missing`);
        const block = endpointBlock(resourceMarkdown, row.method, row.endpointPath);
        if (!block) throw new Error(`resource endpoint ${row.method} ${row.endpointPath} is missing`);
        const related = sectionText(block, 3, "Related");
        if (!related.includes(`Triggers webhook: ${webhookPath}`)) {
          throw new Error(`endpoint ${row.method} ${row.endpointPath} must reference Triggers webhook: ${webhookPath}`);
        }
      });
  });
}

function validateFullSet() {
  const fullDir = path.join(CANDIDATE_DIR, "valid", "full");
  const files = [
    "INDEX.md",
    "CONVENTIONS.md",
    path.join("resources", "payments.md"),
    path.join("webhooks", "payment-completed.md"),
    path.join("webhooks", "subscription-events.md"),
  ].map((file) => path.join(fullDir, file));
  const sourceFile = path.resolve(CANDIDATE_DIR, "..", "..", "webhook-candidate-openapi.yaml");
  [...files, sourceFile].forEach((file) => {
    if (!fs.existsSync(file)) fail(file, "required webhook-candidate file is missing");
  });
  if (failures.length > 0) return;

  const contents = Object.fromEntries(files.map((file) => [file, read(file)]));
  const stamps = Object.values(contents).map(validateStamp);
  if (new Set(stamps.map((stamp) => stamp.generated)).size !== 1) fail(fullDir, "full set generated values differ");
  if (new Set(stamps.map((stamp) => stamp.generation_id)).size !== 1) fail(fullDir, "full set generation_id values differ");
  if (new Set(stamps.map((stamp) => stamp.projection_id)).size !== 1) fail(fullDir, "full set projection_id values differ");

  [path.join("webhooks", "payment-completed.md"), path.join("webhooks", "subscription-events.md")].forEach((relativePath) => {
    const file = path.join(fullDir, relativePath);
    try {
      validateWebhookMarkdown(contents[file]);
    } catch (error) {
      fail(file, error.message);
    }
  });

  try {
    validateWebhookReferences(
      contents[path.join(fullDir, "INDEX.md")],
      { "resources/payments.md": contents[path.join(fullDir, "resources", "payments.md")] },
      new Set(["webhooks/payment-completed.md", "webhooks/subscription-events.md"]),
    );
  } catch (error) {
    fail(path.join(fullDir, "INDEX.md"), error.message);
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
      validateExpectedInvalid(file, fixtures);
      accepted = true;
    } catch {
      accepted = false;
    }
    if (accepted) fail(file, "checker accepted invalid webhook-candidate fixture");
  });
}

function validateExpectedInvalid(file, fixtures) {
  const name = path.basename(file);
  if (name === "endpoint-related-missing-webhook.md") {
    validateWebhookReferences(fixtures[0], { "resources/payments.md": fixtures[1] }, new Set(["webhooks/payment-completed.md"]));
    return;
  }
  if (name === "index-webhook-missing-details.md") {
    parseWebhookRows(fixtures[0]);
    return;
  }
  validateWebhookMarkdown(fixtures[0]);
}

validateFullSet();
validateFocusedInvalid();

if (failures.length > 0) {
  console.error("Webhook candidate fixture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Webhook candidate fixture check passed for ${path.relative(process.cwd(), CANDIDATE_DIR) || "."}`);
