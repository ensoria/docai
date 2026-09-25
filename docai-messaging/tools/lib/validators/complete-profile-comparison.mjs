import { isDeepStrictEqual } from "node:util";
import { parseExactJson } from "../json-value.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { parsePipeTable } from "../tables.mjs";
import { expandFieldDefaultsFile } from "./complete-field-defaults.mjs";
import { expandSameAsFile } from "./complete-same-as.mjs";
import { findExampleAdapter } from "./example-adapters.mjs";

const STANDARD_METADATA_KEYS = [
  "docai-messaging",
  "profile",
  "perspective",
  "coverage",
  "knowledge",
  "source_refs"
];

function normalizedMetadata(file) {
  return STANDARD_METADATA_KEYS.map((key) => [
    key,
    key === "profile" ? "full" : file.metadata[key]
  ]);
}

function extensionHeading(line) {
  if (line.inFence) return null;
  const match = line.text.match(/^(#{1,6}) (x-.+)$/);
  return match === null ? null : match[1].length;
}

function extensionMarker(line) {
  return !line.inFence && /^\*\*x-[A-Za-z0-9._-]+\*\*: .+$/.test(line.text);
}

function tableAt(lines, index, file) {
  if (lines[index].inFence || !/^ *\|/.test(lines[index].text)) return null;
  const parsed = parsePipeTable(lines.slice(index).map((line) => ({
    text: line.text,
    file: file.path,
    line: line.line
  })));
  return parsed.value;
}

function standardTable(table) {
  let standardColumns = table.header.length;
  while (standardColumns > 0 && table.header[standardColumns - 1].startsWith("x-")) {
    standardColumns -= 1;
  }
  return {
    type: "table",
    header: table.header.slice(0, standardColumns),
    rows: table.rows.map((row) => row.slice(0, standardColumns))
  };
}

function normalizedLine(text) {
  if (/^#{1,6} /.test(text)
    || /^\*\*[^*]+\*\*:/.test(text)
    || /^(?:none|unknown) *$/.test(text)) return text;
  return text.replace(/ +$/, "");
}

function normalizedContent(file, {
  afterLine = file.metadataLine,
  beforeLine = file.identityLine,
  exampleAdapters = []
} = {}) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return [];
  const fencesByStart = new Map(scanned.value.fences.map((fence) => [fence.startLine, fence]));
  const lines = scanned.value.lines.filter((line) => (
    line.line > afterLine && line.line < beforeLine
  ));
  const content = [];
  let skippedHeadingLevel = null;
  let representationMediaType = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.inFence ? null : line.text.match(/^(#{1,6}) /);
    if (heading !== null) representationMediaType = null;
    if (skippedHeadingLevel !== null) {
      if (heading === null || heading[1].length > skippedHeadingLevel) continue;
      skippedHeadingLevel = null;
    }
    const extensionLevel = extensionHeading(line);
    if (extensionLevel !== null) {
      skippedHeadingLevel = extensionLevel;
      continue;
    }
    if (extensionMarker(line)) continue;
    if (!line.inFence && line.text.startsWith("**media_type**: ")) {
      representationMediaType = line.text.slice("**media_type**: ".length);
    }

    const fence = fencesByStart.get(line.line);
    if (fence !== undefined) {
      const fenceLines = lines.filter((entry) => (
        entry.line > fence.startLine && entry.line < fence.endLine
      ));
      if (fence.info === "json") {
        content.push({
          type: "json-example",
          value: parseExactJson(fenceLines.map((entry) => entry.text).join("\n"))
        });
      } else {
        const adapter = findExampleAdapter(
          exampleAdapters,
          representationMediaType,
          fence.info
        );
        content.push(adapter === null
          ? {
            type: "fence",
            info: fence.info,
            content: fenceLines.map((entry) => entry.text)
          }
          : {
            type: "adapter-example",
            adapter: {
              adapterClass: adapter.adapterClass,
              target: adapter.target,
              ruleVersion: adapter.ruleVersion
            },
            value: adapter.decodeExample(fenceLines.map((entry) => entry.text).join("\n"))
          });
      }
      while (lines[index + 1]?.line <= fence.endLine) index += 1;
      continue;
    }

    const table = tableAt(lines, index, file);
    if (table !== null) {
      content.push(standardTable(table));
      while (lines[index + 1]?.line <= table.endLine) index += 1;
      continue;
    }

    const text = normalizedLine(line.text);
    const rootProfileLink = file.path === "INDEX.md" && /^(?:Full|Compact) set: /.test(text);
    if (text !== "" && !rootProfileLink) content.push(text);
  }
  return content;
}

export function canonicalRepresentationView(file, startLine, endLine, options = {}) {
  return normalizedContent(file, {
    afterLine: startLine - 1,
    beforeLine: endLine,
    exampleAdapters: options.exampleAdapters
  });
}

export function expandedComparisonView(file, options = {}) {
  const expandedFile = expandSameAsFile(expandFieldDefaultsFile(file));
  return {
    metadata: normalizedMetadata(expandedFile),
    content: normalizedContent(expandedFile, { exampleAdapters: options.exampleAdapters })
  };
}

export function compareExpandedProfileFiles(fullFile, compactFile, options = {}) {
  return isDeepStrictEqual(
    expandedComparisonView(fullFile, options),
    expandedComparisonView(compactFile, options)
  );
}
