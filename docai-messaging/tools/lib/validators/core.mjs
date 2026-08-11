import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { parseDocsPath } from "../paths.mjs";
import { validateCoreRouting, validateCoreUnprojected } from "./core-routing.mjs";
import { validateCoreSources } from "./core-sources.mjs";

function indexDiagnostic(ruleId, root, line, message) {
  return diagnostic(ruleId, root.path, line, message);
}

function validateProfileLink(root, markdown) {
  if (root.metadata === null) return { diagnostics: [], profileLink: null };

  const firstHeadingLine = markdown.headings[0]?.line ?? root.identityLine ?? Number.MAX_SAFE_INTEGER;
  const prelude = markdown.lines.filter((entry) => (
    entry.line > root.metadataLine
      && entry.line < firstHeadingLine
      && entry.text !== ""
  ));
  const fullProfile = root.metadata.profile === "full";
  const expectedLabel = fullProfile ? "Compact set:" : "Full set:";
  const required = !fullProfile;

  if (prelude.length === 0 && !required) return { diagnostics: [], profileLink: null };
  if (prelude.length !== 1 || !prelude[0].text.startsWith(`${expectedLabel} `)) {
    return {
      diagnostics: [indexDiagnostic(
        "DM-IDX-002",
        root,
        prelude[0]?.line ?? root.metadataLine + 1,
        fullProfile
          ? "A full root INDEX may contain only one optional 'Compact set:' profile link before its title."
          : "A non-full root INDEX requires exactly one 'Full set:' profile link before its title."
      )],
      profileLink: null
    };
  }

  const linkLine = prelude[0];
  const pathSource = linkLine.text.slice(expectedLabel.length + 1);
  const parsed = parseDocsPath({ text: pathSource, file: root.path, line: linkLine.line });
  if (parsed.value === null || parsed.value.kind !== "profile-link") {
    return {
      diagnostics: [indexDiagnostic(
        "DM-IDX-002",
        root,
        linkLine.line,
        `${expectedLabel} must use the profile-link relative-directory grammar.`
      )],
      profileLink: null
    };
  }
  return { diagnostics: [], profileLink: parsed.value.path };
}

function validateRootStructure(root, markdown) {
  const headings = markdown.headings.filter((heading) => heading.level <= 2);
  const firstHeading = markdown.headings[0];
  const titleIsFirstHeading = firstHeading?.level === 1 && firstHeading.text === "Messaging Index";
  const titleBodyLine = titleIsFirstHeading && headings[1] !== undefined
    ? markdown.lines.find((entry) => (
      entry.line > firstHeading.line
        && entry.line < headings[1].line
        && entry.text !== ""
    ))
    : undefined;
  const operationHeading = headings[2]?.text;
  const operationIsValid = operationHeading === "Operations" || operationHeading === "Operation Shards";
  const hasUnprojected = headings.length === 5 && headings[4]?.text === "Unprojected Operations";
  const valid = titleIsFirstHeading
    && titleBodyLine === undefined
    && headings[0]?.level === 1
    && headings[0]?.text === "Messaging Index"
    && headings[1]?.level === 2
    && headings[1]?.text === "Sources"
    && headings[2]?.level === 2
    && operationIsValid
    && headings[3]?.level === 2
    && headings[3]?.text === "Workflows"
    && (headings.length === 4 || hasUnprojected);

  if (!valid) {
    const expected = "# Messaging Index, ## Sources, exactly one of ## Operations or ## Operation Shards, ## Workflows, then optional ## Unprojected Operations";
    const observed = markdown.headings.length === 0
      ? "none"
      : markdown.headings.map((heading) => `${"#".repeat(heading.level)} ${heading.text}`).join(" -> ");
    const structuralMismatch = headings.find((heading, index) => {
      if (index === 0) return heading.level !== 1 || heading.text !== "Messaging Index";
      if (index === 1) return heading.level !== 2 || heading.text !== "Sources";
      if (index === 2) return heading.level !== 2 || !["Operations", "Operation Shards"].includes(heading.text);
      if (index === 3) return heading.level !== 2 || heading.text !== "Workflows";
      if (index === 4) return heading.level !== 2 || heading.text !== "Unprojected Operations";
      return true;
    });
    const mismatch = titleIsFirstHeading
      ? [titleBodyLine, structuralMismatch]
        .filter((entry) => entry !== undefined)
        .sort((left, right) => left.line - right.line)[0]
      : firstHeading;
    return {
      diagnostics: [indexDiagnostic(
        "DM-IDX-001",
        root,
        mismatch?.line ?? root.identityLine ?? 1,
        `Root INDEX headings must be ordered as ${expected}; observed ${observed}.`
      )],
      operationRouting: null,
      hasUnprojected: false
    };
  }

  return {
    diagnostics: [],
    operationRouting: operationHeading === "Operations" ? "flat" : "sharded",
    hasUnprojected
  };
}

export function validateCoreDocumentSet(documentSet) {
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  const facts = {
    profileLink: null,
    operationRouting: null,
    hasUnprojectedOperations: false,
    sources: null,
    sourceResolutions: {},
    operations: null,
    operationRetrieval: null,
    unprojectedOperations: null,
    unprojectedRetrieval: null
  };
  if (root === undefined) return { diagnostics: [], facts };

  const scanned = scanMarkdown({ text: root.content, file: root.path });
  if (scanned.value === null) return { diagnostics: scanned.diagnostics, facts };

  const profile = validateProfileLink(root, scanned.value);
  const structure = validateRootStructure(root, scanned.value);
  facts.profileLink = profile.profileLink;
  facts.operationRouting = structure.operationRouting;
  facts.hasUnprojectedOperations = structure.hasUnprojected;
  const sources = structure.diagnostics.length === 0
    ? validateCoreSources(documentSet, root, scanned.value)
    : { diagnostics: [], facts: { sources: null, sourceResolutions: {} } };
  facts.sources = sources.facts.sources;
  facts.sourceResolutions = sources.facts.sourceResolutions;
  const routing = structure.diagnostics.length === 0
    ? validateCoreRouting(documentSet, root, scanned.value, sources.facts)
    : { diagnostics: [], facts: { operations: null, operationRetrieval: null } };
  facts.operations = routing.facts.operations;
  facts.operationRetrieval = routing.facts.operationRetrieval;
  const unprojected = structure.diagnostics.length === 0
    ? validateCoreUnprojected(documentSet, root, scanned.value, sources.facts)
    : { diagnostics: [], facts: { unprojectedOperations: null, unprojectedRetrieval: null } };
  facts.unprojectedOperations = unprojected.facts.unprojectedOperations;
  facts.unprojectedRetrieval = unprojected.facts.unprojectedRetrieval;
  return {
    diagnostics: [
      ...profile.diagnostics,
      ...structure.diagnostics,
      ...sources.diagnostics,
      ...routing.diagnostics,
      ...unprojected.diagnostics
    ],
    facts
  };
}
