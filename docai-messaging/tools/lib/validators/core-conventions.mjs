import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";

const CONVENTION_HEADINGS = [
  "Environments",
  "Protocols and Bindings",
  "Authentication",
  "Connection and Session",
  "Serialization",
  "Message Envelope",
  "Delivery Semantics",
  "Idempotency and Deduplication",
  "Ordering",
  "Error Handling",
  "Request-Reply",
  "Schema Evolution",
  "Data Representation",
  "Empty and Omitted Values",
  "Rate Limits and Quotas"
];

function conventionsDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file?.path ?? "CONVENTIONS.md", line, message);
}

function validateStructure(file, markdown) {
  const headings = markdown.headings.filter((heading) => heading.level <= 2);
  const expected = [
    { level: 1, text: "Messaging Conventions" },
    ...CONVENTION_HEADINGS.map((text) => ({ level: 2, text }))
  ];
  const mismatchIndex = expected.findIndex((entry, index) => (
    headings[index]?.level !== entry.level || headings[index]?.text !== entry.text
  ));
  const titleLine = headings[0]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  const contentBeforeTitle = markdown.lines.find((line) => (
    line.line > file.metadataLine
      && line.line < titleLine
      && line.text !== ""
  ));
  const firstSectionLine = headings[1]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  const titlePrelude = headings[0]?.level === 1 && headings[0]?.text === "Messaging Conventions"
    ? markdown.lines.find((line) => (
      line.line > headings[0].line
        && line.line < firstSectionLine
        && line.text !== ""
    ))
    : undefined;
  const valid = mismatchIndex === -1
    && headings.length === expected.length
    && contentBeforeTitle === undefined
    && titlePrelude === undefined;
  if (valid) return [];

  const mismatch = contentBeforeTitle
    ?? titlePrelude
    ?? headings[mismatchIndex === -1 ? expected.length : mismatchIndex]
    ?? headings.at(-1);
  return [conventionsDiagnostic(
    "DM-CONV-001",
    file,
    mismatch?.line ?? file.identityLine ?? 1,
    "CONVENTIONS.md must contain '# Messaging Conventions' followed by every fixed level-two convention heading exactly once and in canonical order, with no title-level prose."
  )];
}

function sectionLines(file, markdown, heading, nextHeading) {
  const endLine = nextHeading?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
  return markdown.lines.filter((line) => (
    line.line > heading.line
      && line.line < endLine
      && !line.inFence
  ));
}

function sectionState(heading, lines) {
  const firstIndex = lines.findIndex((line) => line.text !== "");
  if (firstIndex === -1) return null;

  const first = lines[firstIndex];
  const nonEmpty = lines.filter((line) => line.text !== "");
  if (first.text === "none") {
    return nonEmpty.length === 1 ? { line: heading.line, state: "none" } : null;
  }
  if (first.text === "unknown") {
    const marker = lines[firstIndex + 1];
    const validMarker = marker?.text.startsWith("**unknown**: ")
      && marker.text.length > "**unknown**: ".length;
    return validMarker && nonEmpty.length === 2
      ? { line: heading.line, state: "unknown" }
      : null;
  }

  const replacementPrefix = `**unsupported**: replaces CONVENTIONS ${heading.text}: `;
  if (first.text.startsWith("**unsupported**:")) {
    return first.text.startsWith(replacementPrefix)
        && first.text.length > replacementPrefix.length
        && nonEmpty.length === 1
      ? { line: heading.line, state: "unsupported" }
      : null;
  }
  if (first.text.startsWith("**unknown**:")) return null;
  if (nonEmpty.some((line) => line.text === "none" || line.text === "unknown")) return null;
  if (nonEmpty.some((line) => line.text.startsWith("**unsupported**: replaces CONVENTIONS "))) {
    return null;
  }
  return { line: heading.line, state: "expanded" };
}

function validateStates(file, markdown) {
  const diagnostics = [];
  const sections = {};
  const headings = markdown.headings.filter((heading) => heading.level === 2);
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const state = sectionState(heading, sectionLines(file, markdown, heading, headings[index + 1]));
    if (state === null) {
      diagnostics.push(conventionsDiagnostic(
        "DM-CONV-002",
        file,
        heading.line,
        `CONVENTIONS '${heading.text}' must contain exactly one canonical none, whole-section unknown, replacement unsupported, or non-empty expanded state.`
      ));
      continue;
    }
    sections[heading.text] = state;
  }
  return { diagnostics, sections };
}

export function validateCoreConventions(documentSet) {
  const file = documentSet.files.find((entry) => entry.path === "CONVENTIONS.md");
  if (file === undefined) {
    return {
      diagnostics: [conventionsDiagnostic(
        "DM-CONV-001",
        null,
        1,
        "A Compatibility Core document set requires CONVENTIONS.md."
      )],
      facts: { conventions: null }
    };
  }

  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) {
    return { diagnostics: scanned.diagnostics, facts: { conventions: null } };
  }
  const structureDiagnostics = validateStructure(file, scanned.value);
  if (structureDiagnostics.length > 0) {
    return { diagnostics: structureDiagnostics, facts: { conventions: null } };
  }

  const states = validateStates(file, scanned.value);
  return {
    diagnostics: states.diagnostics,
    facts: {
      conventions: {
        path: file.path,
        sections: states.sections
      }
    }
  };
}
