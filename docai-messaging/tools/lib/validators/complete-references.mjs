import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";

function referenceDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file.path, line, message);
}

function referenceConsumers(coreFacts, referencePath) {
  return (coreFacts?.operations?.rows ?? [])
    .filter((row) => row.supplementalContexts.includes(referencePath))
    .map((row) => row.operation)
    .sort();
}

function rawLines(text) {
  const lines = [];
  let start = 0;
  let line = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n" && text[index] !== "\r") continue;
    const length = text[index] === "\r" && text[index + 1] === "\n" ? 2 : 1;
    lines.push({
      line,
      start,
      after: index + length,
      text: text.slice(start, index)
    });
    index += length - 1;
    start = index + 1;
    line += 1;
  }
  lines.push({ line, start, after: text.length, text: text.slice(start) });
  return lines;
}

function longestBacktickRun(content) {
  return [...content.matchAll(/`+/g)].reduce((maximum, match) => (
    Math.max(maximum, match[0].length)
  ), 0);
}

function parseReferenceMaterial(file, coreFacts) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) {
    return {
      diagnostics: [referenceDiagnostic(
        "DM-REF-002",
        file,
        scanned.diagnostics[0]?.line ?? 1,
        "Reference Material requires exactly one closed canonical content fence."
      )],
      referenceMaterial: null
    };
  }
  const markdown = scanned.value;
  const withinFence = (line) => markdown.fences.some((fence) => (
    line >= fence.startLine && line <= fence.endLine
  ));
  const outside = markdown.lines.filter((line) => (
    line.line > file.metadataLine
      && line.line < (file.identityLine ?? Number.MAX_SAFE_INTEGER)
      && line.text !== ""
      && !withinFence(line.line)
  ));
  const expected = [
    ["# Reference Material", 1],
    ["**instruction_authority**: none", null],
    ["## Content", 2]
  ];
  const validStructure = outside.length === expected.length
    && expected.every(([text, level], index) => (
      outside[index]?.text === text
        && (level === null || markdown.headings.some((heading) => (
          heading.line === outside[index].line && heading.level === level
        )))
    ));
  if (!validStructure) {
    return {
      diagnostics: [referenceDiagnostic(
        "DM-REF-001",
        file,
        outside.find((line, index) => line.text !== expected[index]?.[0])?.line
          ?? outside[0]?.line
          ?? file.identityLine
          ?? 1,
        "Reference Material contains only its fixed title, instruction-authority marker, Content heading, and one fenced content block."
      )],
      referenceMaterial: null
    };
  }
  const fence = markdown.fences[0];
  const contentHeading = outside[2];
  const sourceLines = rawLines(file.content);
  const opening = fence === undefined ? undefined : sourceLines[fence.startLine - 1];
  const closing = fence === undefined ? undefined : sourceLines[fence.endLine - 1];
  const content = opening === undefined || closing === undefined
    ? null
    : file.content.slice(opening.after, closing.start);
  const delimiter = fence === undefined ? "" : "`".repeat(fence.delimiterLength);
  const validFence = markdown.fences.length === 1
    && fence !== undefined
    && fence.startLine > contentHeading.line
    && fence.endLine < (file.identityLine ?? Number.MAX_SAFE_INTEGER)
    && ["", "markdown", "text"].includes(fence.info)
    && opening?.text === `${delimiter}${fence.info}`
    && closing?.text === delimiter
    && content !== null
    && content.endsWith("\n")
    && !content.includes("\r")
    && !content.startsWith("\uFEFF")
    && fence.delimiterLength === Math.max(4, longestBacktickRun(content) + 1);
  if (!validFence) {
    return {
      diagnostics: [referenceDiagnostic(
        "DM-REF-002",
        file,
        fence?.startLine ?? contentHeading.line,
        "Reference Material requires one normalized UTF-8 content block with canonical info, LF endings, no leading BOM, and a minimal backtick delimiter of at least four."
      )],
      referenceMaterial: null
    };
  }
  return {
    diagnostics: [],
    referenceMaterial: {
      path: file.path,
      info: fence.info,
      delimiterLength: fence.delimiterLength,
      content,
      consumerOperations: referenceConsumers(coreFacts, file.path)
    }
  };
}

export function validateCompleteReferenceMaterials(
  documentSet,
  coreFacts,
  { enforceOwnership = true } = {}
) {
  const diagnostics = [];
  const referenceMaterials = [];
  for (const file of documentSet.files.filter((entry) => entry.path.startsWith("references/"))) {
    const parsed = parseReferenceMaterial(file, coreFacts);
    diagnostics.push(...parsed.diagnostics);
    if (parsed.referenceMaterial !== null) {
      referenceMaterials.push(parsed.referenceMaterial);
      if (enforceOwnership && parsed.referenceMaterial.consumerOperations.length === 0) {
        diagnostics.push(referenceDiagnostic(
          "DM-REF-003",
          file,
          1,
          "Every Reference Material file must be supplemental context for at least one operation."
        ));
      }
    }
  }
  return { diagnostics, facts: { referenceMaterials } };
}
