#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "0.11.0";
const WORKFLOW_SECTIONS = ["Preconditions", "Steps", "State Transitions", "Failure and Recovery"];
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "workflow-candidates", `v${SPEC_VERSION}`);
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
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
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
  if (stamp.profile !== "full") throw new Error("workflow candidate stamp profile must be full");
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

function significantLines(lines) {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function hasWholeSectionReplacement(lines, title) {
  const content = significantLines(lines).filter((line) => !line.startsWith("**deviation**:"));
  return content.length === 1 && content[0].startsWith(`**unsupported**: replaces workflow ${title}:`);
}

function isEmptySentinel(lines) {
  const content = significantLines(lines).filter((line) => !line.startsWith("**deviation**:"));
  return content.length === 1 && ["none", "unknown"].includes(content[0]);
}

function validateWorkflowMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = headingRows(markdown);
  const title = headings.find((heading) => heading.level === 1);
  if (!title) throw new Error("workflow title is missing");

  const h2s = headings.filter((heading) => heading.level === 2);
  const actualSections = h2s.map((heading) => heading.title);
  if (actualSections.join("|") !== WORKFLOW_SECTIONS.join("|")) {
    throw new Error(`workflow sections must be ${WORKFLOW_SECTIONS.join(", ")} in order`);
  }

  validateWorkflowDeviationPlacement(markdown);
  validateWorkflowUnsupported(markdown);
  validateWorkflowSteps(markdown);
  validateWorkflowStateTransitions(markdown);
}

function validateWorkflowDeviationPlacement(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = headingRows(markdown);
  const firstH2 = headings.find((heading) => heading.level === 2);

  lines.forEach((line, index) => {
    if (!line.trim().startsWith("**deviation**:")) return;
    const enclosing = [...headings].reverse().find((heading) => heading.line < index && heading.level <= 2);
    if (!enclosing) throw new Error("workflow deviation appears outside workflow content");

    if (enclosing.level === 1) {
      if (firstH2 && index > firstH2.line) throw new Error("workflow-level deviation must appear before workflow sections");
      const intro = significantLines(lines.slice(enclosing.line + 1, index));
      if (intro.length === 0) throw new Error("workflow-level deviation must appear after the intro description");
      return;
    }

    const priorSectionContent = significantLines(lines.slice(enclosing.line + 1, index));
    if (priorSectionContent.length !== 0) {
      throw new Error("section-level workflow deviation must appear directly under the section heading");
    }
  });
}

function validateWorkflowUnsupported(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = headingRows(markdown);
  lines.forEach((line, index) => {
    const match = line.trim().match(/^\*\*unsupported\*\*: replaces ([^:]+): /);
    if (!match) return;
    const unit = match[1];
    const enclosing = [...headings].reverse().find((heading) => heading.line < index && heading.level <= 2);
    if (!enclosing || enclosing.level !== 2) {
      throw new Error("workflow replacement unsupported must appear inside a workflow section");
    }
    const expected = `workflow ${enclosing.title}`;
    if (!WORKFLOW_SECTIONS.includes(enclosing.title) || unit !== expected) {
      throw new Error(`workflow replacement unsupported unit must be ${expected}`);
    }
  });
}

function validateWorkflowSteps(markdown) {
  const lines = sectionLines(markdown, 2, "Steps");
  if (!lines) throw new Error("workflow Steps section is missing");
  if (hasWholeSectionReplacement(lines, "Steps") || isEmptySentinel(lines)) return;

  const steps = significantLines(lines).filter((line) => /^\d+\. /.test(line));
  if (steps.length === 0) throw new Error("workflow Steps must use a numbered list");
  steps.forEach((step) => {
    if (!/\b(Pass|Keep|Send|Use|Reuse|Submit|Provide|Carry)\b/.test(step)) {
      throw new Error("workflow step must describe values passed or retained");
    }
    if (!/\bIf\b/.test(step)) throw new Error("workflow step must describe its failure branch");
  });
}

function validateWorkflowStateTransitions(markdown) {
  const lines = sectionLines(markdown, 2, "State Transitions");
  if (!lines) throw new Error("workflow State Transitions section is missing");
  if (hasWholeSectionReplacement(lines, "State Transitions") || isEmptySentinel(lines)) return;

  const tableStart = lines.findIndex((line) => line.trim().startsWith("|"));
  if (tableStart < 0) throw new Error("workflow State Transitions must include a table");
  const header = splitTableLine(lines[tableStart]);
  const separator = splitTableLine(lines[tableStart + 1] ?? "");
  if (header?.join("|") !== "From|Endpoint / Event|To" || !separator?.every((cell) => /^-+$/.test(cell))) {
    throw new Error("workflow State Transitions table must use From | Endpoint / Event | To");
  }
  const rows = lines.slice(tableStart + 2).map(splitTableLine).filter(Boolean);
  if (rows.length === 0) throw new Error("workflow State Transitions table must contain at least one row");
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

function sectionText(markdown, level, title) {
  const lines = sectionLines(markdown, level, title);
  if (!lines) throw new Error(`${title} section is missing`);
  return lines.join("\n");
}

function parseWorkflowRows(indexMarkdown) {
  const section = sectionText(indexMarkdown, 2, "Workflows");
  if (section.trim() === "none") return [];
  const rows = tableRows(section, ["Name", "Summary", "Details"]);
  rows.forEach((row) => {
    if (!/^workflows\/[A-Za-z0-9._/-]+\.md$/.test(row.Details)) {
      throw new Error("workflow Details must be a workflows/*.md path");
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

function validateWorkflowReferences(indexMarkdown, resourceByPath, availableWorkflowPaths) {
  const workflowRows = parseWorkflowRows(indexMarkdown);
  workflowRows.forEach((row) => {
    if (!availableWorkflowPaths.has(row.Details)) throw new Error(`workflow Details target ${row.Details} is missing`);
  });

  parseEndpointRows(indexMarkdown).forEach((row) => {
    row.alsoRead
      .filter((target) => target.startsWith("workflows/"))
      .forEach((workflowPath) => {
        if (!availableWorkflowPaths.has(workflowPath)) throw new Error(`endpoint Also read target ${workflowPath} is missing`);
        const resourceMarkdown = resourceByPath[row.resourcePath];
        if (!resourceMarkdown) throw new Error(`resource file ${row.resourcePath} is missing`);
        const block = endpointBlock(resourceMarkdown, row.method, row.endpointPath);
        if (!block) throw new Error(`resource endpoint ${row.method} ${row.endpointPath} is missing`);
        const related = sectionText(block, 3, "Related");
        if (!related.includes(`Workflow: ${workflowPath}`)) {
          throw new Error(`endpoint ${row.method} ${row.endpointPath} must reference Workflow: ${workflowPath}`);
        }
      });
  });
}

function validateFullSet() {
  const fullDir = path.join(CANDIDATE_DIR, "valid", "full");
  const files = ["INDEX.md", "CONVENTIONS.md", path.join("resources", "checkout.md"), path.join("workflows", "checkout.md")].map(
    (file) => path.join(fullDir, file),
  );
  const sourceFile = path.resolve(CANDIDATE_DIR, "..", "..", "workflow-candidate-openapi.yaml");
  [...files, sourceFile].forEach((file) => {
    if (!fs.existsSync(file)) fail(file, "required workflow-candidate file is missing");
  });
  if (failures.length > 0) return;

  const contents = Object.fromEntries(files.map((file) => [file, read(file)]));
  const stamps = Object.values(contents).map(validateStamp);
  if (new Set(stamps.map((stamp) => stamp.generated)).size !== 1) fail(fullDir, "full set generated values differ");
  if (new Set(stamps.map((stamp) => stamp.generation_id)).size !== 1) fail(fullDir, "full set generation_id values differ");
  if (new Set(stamps.map((stamp) => stamp.projection_id)).size !== 1) fail(fullDir, "full set projection_id values differ");

  try {
    validateWorkflowMarkdown(contents[path.join(fullDir, "workflows", "checkout.md")]);
  } catch (error) {
    fail(path.join(fullDir, "workflows", "checkout.md"), error.message);
  }

  try {
    validateWorkflowReferences(
      contents[path.join(fullDir, "INDEX.md")],
      { "resources/checkout.md": contents[path.join(fullDir, "resources", "checkout.md")] },
      new Set(["workflows/checkout.md"]),
    );
  } catch (error) {
    fail(path.join(fullDir, "INDEX.md"), error.message);
  }
}

function validateFocusedValid() {
  listMarkdownFiles(path.join(CANDIDATE_DIR, "focused", "valid")).forEach((file) => {
    const fixtures = extractMarkdownFixtures(read(file));
    if (fixtures.length === 0) {
      fail(file, "valid focused fixture lacks markdown code fence");
      return;
    }
    fixtures.forEach((fixture) => {
      try {
        validateWorkflowMarkdown(fixture);
      } catch (error) {
        fail(file, `expected valid but failed: ${error.message}`);
      }
    });
  });
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
    if (accepted) fail(file, "checker accepted invalid workflow-candidate fixture");
  });
}

function validateExpectedInvalid(file, fixtures) {
  const name = path.basename(file);
  if (name === "endpoint-related-missing-workflow.md") {
    validateWorkflowReferences(fixtures[0], { "resources/checkout.md": fixtures[1] }, new Set(["workflows/checkout.md"]));
    return;
  }
  if (name === "index-workflow-missing-details.md") {
    parseWorkflowRows(fixtures[0]);
    return;
  }
  validateWorkflowMarkdown(fixtures[0]);
}

validateFullSet();
validateFocusedValid();
validateFocusedInvalid();

if (failures.length > 0) {
  console.error("Workflow candidate fixture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Workflow candidate fixture check passed for ${path.relative(process.cwd(), CANDIDATE_DIR) || "."}`);
