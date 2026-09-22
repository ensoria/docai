import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { canonicalizeMediaType } from "../media-type.mjs";

const RULE_ID = "DM-PROFILE-005";
const NAME = "[A-Za-z0-9._-]+";
const SAME_AS = new RegExp(
  `^\\*\\*same_as\\*\\*: Operation (${NAME}) (Reply Message|Message) (${NAME}) Payload (.+)$`
);

function sameAsDiagnostic(file, line, message) {
  return diagnostic(RULE_ID, file.path, line, message);
}

function blockEndLine(markdown, heading, fallback) {
  return markdown.headings.find((candidate) => (
    candidate.line > heading.line && candidate.level <= heading.level
  ))?.line ?? fallback;
}

function operationName(heading) {
  return heading.text.match(/\(([^()]+)\)$/)?.[1] ?? null;
}

function messageName(heading) {
  return heading.text.startsWith("Message ")
    ? heading.text.slice("Message ".length)
    : null;
}

function oppositeDirection(direction) {
  return direction === "SEND" ? "RECEIVE" : direction === "RECEIVE" ? "SEND" : null;
}

function canonicalMediaType(value) {
  try {
    const canonical = canonicalizeMediaType(value);
    return canonical === value ? value : null;
  } catch {
    return null;
  }
}

function representationSources(file, startLine, endLine) {
  const lines = file.content.split("\n");
  let finalLine = endLine - 1;
  while (finalLine > startLine && lines[finalLine - 1] === "") finalLine -= 1;
  return lines.slice(startLine - 1, finalLine);
}

function payloadRepresentations(file, markdown) {
  const representations = [];
  const operations = markdown.headings.filter((heading) => heading.level === 2);
  for (let operationIndex = 0; operationIndex < operations.length; operationIndex += 1) {
    const operationHeading = operations[operationIndex];
    const operationEnd = operations[operationIndex + 1]?.line
      ?? file.identityLine
      ?? Number.MAX_SAFE_INTEGER;
    const operation = operationName(operationHeading);
    const operationDirection = operationHeading.text.match(/^(SEND|RECEIVE) /)?.[1] ?? null;
    const messages = markdown.headings.filter((heading) => (
      [3, 4].includes(heading.level)
        && heading.text.startsWith("Message ")
        && heading.line > operationHeading.line
        && heading.line < operationEnd
    ));
    for (const messageHeading of messages) {
      const messageEnd = blockEndLine(markdown, messageHeading, operationEnd);
      const payloadHeading = markdown.headings.find((heading) => (
        heading.level === messageHeading.level + 1
          && heading.text === "Payload"
          && heading.line > messageHeading.line
          && heading.line < messageEnd
      ));
      if (payloadHeading === undefined) continue;
      const payloadEnd = blockEndLine(markdown, payloadHeading, messageEnd);
      const markerLines = markdown.lines.filter((line) => (
        !line.inFence
          && line.line > payloadHeading.line
          && line.line < payloadEnd
          && (
            line.text.startsWith("**media_type**: ")
              || line.text.startsWith("**unsupported**: replaces payload representation ")
              || line.text.startsWith("**same_as**")
          )
      ));
      for (let markerIndex = 0; markerIndex < markerLines.length; markerIndex += 1) {
        const marker = markerLines[markerIndex];
        const endLine = markerLines[markerIndex + 1]?.line ?? payloadEnd;
        const reply = messageHeading.level === 4;
        representations.push({
          direction: reply ? oppositeDirection(operationDirection) : operationDirection,
          endLine,
          kind: marker.text.startsWith("**media_type**: ")
            ? "expanded"
            : marker.text.startsWith("**same_as**") ? "same-as" : "unsupported",
          line: marker.line,
          marker: marker.text,
          mediaType: marker.text.startsWith("**media_type**: ")
            ? canonicalMediaType(marker.text.slice("**media_type**: ".length))
            : null,
          message: messageName(messageHeading),
          operation,
          path: file.path,
          reply,
          sourceLines: representationSources(file, marker.line, endLine)
        });
      }
    }
  }
  return representations;
}

export function collectPayloadRepresentations(file) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  return scanned.value === null ? [] : payloadRepresentations(file, scanned.value);
}

function parsedReference(marker) {
  const match = marker.match(SAME_AS);
  if (match === null) return null;
  const mediaType = canonicalMediaType(match[4]);
  if (mediaType === null) return null;
  return {
    operation: match[1],
    reply: match[2] === "Reply Message",
    message: match[3],
    mediaType
  };
}

function sameIdentity(representation, identity) {
  return representation.operation === identity.operation
    && representation.reply === identity.reply
    && representation.message === identity.message
    && representation.mediaType === identity.mediaType;
}

function eligibleExpandedTarget(target) {
  const content = target.sourceLines.filter((line) => line !== "");
  return /^\*\*payload_nullable\*\*: (?:yes|no)$/.test(content[1] ?? "")
    && !content.some((line) => (
      line === "unknown"
        || line.startsWith("**unknown**:")
        || line.startsWith("**unsupported**:")
        || line.startsWith("**same_as**:")
    ));
}

function analyzeFile(file) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return { diagnostics: [], facts: [], replacements: [] };
  const representations = payloadRepresentations(file, scanned.value);
  const diagnostics = [];
  const facts = [];
  const replacements = [];
  const allMarkers = scanned.value.lines.filter((line) => (
    !line.inFence && line.text.startsWith("**same_as**")
  ));
  for (const marker of allMarkers) {
    const representation = representations.find((entry) => entry.line === marker.line);
    const reference = parsedReference(marker.text);
    const fallbackTarget = representations.filter((entry) => (
      entry.kind === "expanded" && entry.line < marker.line
    )).at(-1);
    let valid = true;
    const fail = (message) => {
      diagnostics.push(sameAsDiagnostic(file, marker.line, message));
      valid = false;
    };
    if (file.metadata?.profile !== "compact") {
      fail("same_as is permitted only in the compact profile.");
    }
    if (representation === undefined) {
      fail("same_as must replace one complete representation inside a Message Payload.");
      replacements.push({ line: marker.line, sourceLines: ["none"] });
      continue;
    }
    if (reference === null) {
      fail("same_as requires one exact Operation, primary or Reply Message, Payload, and canonical media-type target.");
      if (fallbackTarget !== undefined) {
        replacements.push({ line: marker.line, sourceLines: fallbackTarget.sourceLines });
      }
      continue;
    }
    const exactTarget = representations.find((entry) => (
      entry.kind === "expanded"
        && sameIdentity(entry, reference)
    ));
    let target = exactTarget;
    if (target === undefined || target.line >= marker.line) {
      fail("same_as must resolve to an earlier expanded representation in the same channel file.");
      target ??= fallbackTarget;
    }
    if (target === undefined) continue;
    if (!eligibleExpandedTarget(target)) {
      fail("same_as targets must be complete structured representations without raw, unknown, unsupported, or nested same_as content.");
    }
    if (target.direction !== representation.direction) {
      fail("same_as targets and references must use the same Required or Presence direction semantics.");
    }
    if (file.metadata?.["x-retrieval-unit"] !== "channel-file") {
      fail("same_as requires x-retrieval-unit: channel-file on its compact channel file.");
    }
    if (representation.sourceLines.filter((line) => line !== "").length !== 1) {
      fail("same_as replaces the complete representation and cannot have adjacent representation content.");
    }
    replacements.push({ line: marker.line, sourceLines: target.sourceLines });
    if (valid) {
      facts.push({
        path: file.path,
        line: marker.line,
        reference: {
          operation: representation.operation,
          message: representation.message,
          reply: representation.reply,
          mediaType: reference.mediaType
        },
        target: { ...reference, line: target.line }
      });
    }
  }
  return { diagnostics, facts, replacements };
}

function expandFile(file, replacements) {
  if (replacements.length === 0) return file;
  const lines = file.content.split("\n");
  let addedLines = 0;
  for (const replacement of [...replacements].sort((left, right) => right.line - left.line)) {
    lines.splice(replacement.line - 1, 1, ...replacement.sourceLines);
    addedLines += replacement.sourceLines.length - 1;
  }
  return {
    ...file,
    content: lines.join("\n"),
    identityLine: file.identityLine === undefined
      ? undefined
      : file.identityLine + addedLines
  };
}

export function expandSameAsFile(file) {
  const analyzed = analyzeFile(file);
  return expandFile(file, analyzed.replacements);
}

export function validateCompleteSameAs(documentSet) {
  const diagnostics = [];
  const sameAs = [];
  const files = documentSet.files.map((file) => {
    const analyzed = analyzeFile(file);
    diagnostics.push(...analyzed.diagnostics);
    sameAs.push(...analyzed.facts);
    return expandFile(file, analyzed.replacements);
  });
  return {
    diagnostics,
    facts: { sameAs },
    expandedDocumentSet: { ...documentSet, files }
  };
}
