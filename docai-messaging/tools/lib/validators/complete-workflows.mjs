import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { validateSentenceLine } from "../sentence.mjs";
import { parsePipeTable } from "../tables.mjs";

const SECTION_HEADINGS = [
  "Preconditions",
  "Steps",
  "State Transitions",
  "Failure and Recovery"
];

function workflowDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file.path, line, message);
}

function scalarCompare(left, right) {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0));
  const rightScalars = Array.from(right, (value) => value.codePointAt(0));
  for (let index = 0; index < Math.min(leftScalars.length, rightScalars.length); index += 1) {
    if (leftScalars[index] !== rightScalars[index]) {
      return leftScalars[index] - rightScalars[index];
    }
  }
  return leftScalars.length - rightScalars.length;
}

function contentLines(markdown, heading, endLine) {
  return markdown.lines.filter((line) => (
    line.line > heading.line
      && line.line < endLine
      && line.text !== ""
  ));
}

function splitDeviations(lines) {
  let index = 0;
  while (lines[index]?.text.startsWith("**deviation**: ")) index += 1;
  return {
    deviations: lines.slice(0, index).map((line) => line.text.slice("**deviation**: ".length)),
    core: lines.slice(index)
  };
}

function validDeviations(lines) {
  return lines.every((line, index) => (
    line.text.startsWith("**deviation**: ")
      && line.text.length > "**deviation**: ".length
      && (index === 0 || scalarCompare(lines[index - 1].text, line.text) < 0)
  ));
}

function operationReferences(text) {
  return text.match(/\b(?:SEND|RECEIVE) [^\s()]+ \([^()\n]+\)/g) ?? [];
}

function validOperationReferences(values, operationHeadings) {
  if (operationHeadings === null) return true;
  return values.flatMap(operationReferences).every((reference) => (
    operationHeadings.has(reference)
  ));
}

function expandedDiagnostic(file, heading, line, message) {
  return workflowDiagnostic(
    "DM-WF-006",
    file,
    line ?? heading.line,
    `Expanded workflow ${heading.text} ${message}`
  );
}

function parseSection(file, heading, lines, operationHeadings) {
  const split = splitDeviations(lines);
  const { core } = split;
  const deviations = split.deviations;
  const misplacedDeviation = core.find((line) => line.text.startsWith("**deviation**:"));
  const replacementPrefix = `**unsupported**: replaces workflow ${heading.text}: `;
  const validNone = core.length === 1 && core[0].text === "none";
  const validUnknown = core.length === 2
    && core[0].text === "unknown"
    && core[1].text.startsWith("**unknown**: ")
    && core[1].text.length > "**unknown**: ".length;
  const validUnsupported = core.length === 1
    && core[0].text.startsWith(replacementPrefix)
    && core[0].text.length > replacementPrefix.length;
  const incompleteToken = core.find((line) => (
    line.text === "none"
      || line.text === "unknown"
      || line.text.startsWith("**unknown**:")
      || line.text.startsWith("**unsupported**: replaces workflow ")
  ));
  const invalidState = core.length === 0
    || misplacedDeviation !== undefined
    || (!validNone && !validUnknown && !validUnsupported && incompleteToken !== undefined);
  if (!validDeviations(lines.slice(0, lines.length - core.length)) || invalidState) {
    return {
      diagnostics: [workflowDiagnostic(
        "DM-WF-005",
        file,
        misplacedDeviation?.line
          ?? incompleteToken?.line
          ?? lines[0]?.line
          ?? heading.line,
        `Workflow ${heading.text} requires ordered leading deviations followed by exactly one canonical none, unknown, replacement unsupported, or expanded core state.`
      )],
      section: null
    };
  }
  if (core.length === 1 && core[0].text === "none") {
    return { diagnostics: [], section: { state: "none", deviations } };
  }
  if (validUnknown) {
    return {
      diagnostics: [],
      section: {
        state: "unknown",
        deviations,
        reason: core[1].text.slice("**unknown**: ".length)
      }
    };
  }
  if (validUnsupported) {
    return {
      diagnostics: [],
      section: {
        state: "unsupported",
        deviations,
        reason: core[0].text.slice(replacementPrefix.length)
      }
    };
  }
  if (heading.text === "Preconditions" || heading.text === "Failure and Recovery") {
    const invalid = core.find((line) => (
      line.inFence || !/^- \S/.test(line.text)
    ));
    if (invalid !== undefined) {
      return {
        diagnostics: [expandedDiagnostic(
          file,
          heading,
          invalid.line,
          "must be a non-empty bullet list with every item on exactly one top-level '- ' source line."
        )],
        section: null
      };
    }
    return {
      diagnostics: [],
      section: {
        state: "expanded",
        deviations,
        items: core.map((line) => line.text.slice(2))
      }
    };
  }
  if (heading.text === "Steps") {
    const invalid = core.find((line) => (
      line.inFence || !/^[1-9][0-9]*\. \S/.test(line.text)
    ));
    if (invalid !== undefined
      || !validOperationReferences(core.map((line) => line.text), operationHeadings)) {
      return {
        diagnostics: [expandedDiagnostic(
          file,
          heading,
          invalid?.line ?? core[0]?.line,
          "must be a non-empty top-level numbered list whose written operation references exactly match defined operation headings."
        )],
        section: null
      };
    }
    return {
      diagnostics: [],
      section: {
        state: "expanded",
        deviations,
        steps: core.map((line) => line.text.replace(/^[1-9][0-9]*\. /, ""))
      }
    };
  }
  const table = parsePipeTable(core.map((line) => ({
    text: line.text,
    file: file.path,
    line: line.line
  })));
  const validTable = table.value !== null
    && table.value.header.length === 3
    && ["From", "Trigger", "To"].every((column, index) => (
      table.value.header[index] === column
    ))
    && table.value.rows.length > 0
    && table.value.rows.every((row) => row.every((cell) => cell !== ""))
    && table.value.endLine === core.at(-1)?.line
    && validOperationReferences(
      table.value.rows.map((row) => row[1] ?? ""),
      operationHeadings
    );
  if (!validTable) {
    return {
      diagnostics: [expandedDiagnostic(
        file,
        heading,
        core[0]?.line,
        "must be one non-empty From | Trigger | To table with non-empty cells and exact defined operation references."
      )],
      section: null
    };
  }
  return {
    diagnostics: [],
    section: {
      state: "expanded",
      deviations,
      rows: (table.value?.rows ?? []).map(([from, trigger, to]) => ({ from, trigger, to }))
    }
  };
}

function parseWorkflowFile(file, operationHeadings) {
  const scanned = scanMarkdown({ text: file.content, file: file.path });
  if (scanned.value === null) return { diagnostics: scanned.diagnostics, definition: null };
  const markdown = scanned.value;
  const structural = markdown.headings.filter((heading) => heading.level <= 2);
  const wrapper = markdown.lines.find((line) => (
    line.line > file.metadataLine
      && line.line < (structural[0]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER)
      && line.text !== ""
  ));
  const validStructure = wrapper === undefined
    && structural.length === SECTION_HEADINGS.length + 1
    && structural[0]?.level === 1
    && structural[0].text !== ""
    && SECTION_HEADINGS.every((text, index) => (
      structural[index + 1]?.level === 2
        && structural[index + 1].text === text
    ));
  if (!validStructure) {
    return {
      diagnostics: [workflowDiagnostic(
        "DM-WF-004",
        file,
        wrapper?.line ?? structural.find((heading, index) => (
          index === 0
            ? heading.level !== 1
            : heading.level !== 2 || heading.text !== SECTION_HEADINGS[index - 1]
        ))?.line ?? file.identityLine ?? 1,
        "A workflow requires one non-empty title and Preconditions, Steps, State Transitions, and Failure and Recovery in fixed order."
      )],
      definition: null
    };
  }
  const [title, ...sections] = structural;
  const preconditions = sections[0];
  const leading = contentLines(markdown, title, preconditions.line);
  const introduction = leading[0]?.text ?? "";
  const misplaced = leading.slice(1).find((line) => (
    !line.text.startsWith("**deviation**: ")
  ));
  const introResult = validateSentenceLine({
    text: introduction,
    file: file.path,
    line: leading[0]?.line ?? title.line
  }, 1, 2);
  if (introResult.value === null || misplaced !== undefined) {
    return {
      diagnostics: [workflowDiagnostic(
        "DM-WF-004",
        file,
        misplaced?.line ?? leading[0]?.line ?? title.line,
        "A workflow title is followed by exactly one non-empty source line containing one or two purpose-and-outcome sentences."
      )],
      definition: null
    };
  }
  const wholeDeviationLines = leading.slice(1);
  if (!validDeviations(wholeDeviationLines)) {
    return {
      diagnostics: [workflowDiagnostic(
        "DM-WF-005",
        file,
        wholeDeviationLines[0]?.line ?? title.line,
        "Whole-workflow deviations must be non-empty, Unicode-scalar ordered, and grouped between the introduction and Preconditions."
      )],
      definition: null
    };
  }
  const deviations = leading.slice(1).map((line) => (
    line.text.slice("**deviation**: ".length)
  ));
  const diagnostics = [];
  const parsedSections = {};
  for (let index = 0; index < sections.length; index += 1) {
    const heading = sections[index];
    const nextLine = sections[index + 1]?.line ?? file.identityLine ?? Number.MAX_SAFE_INTEGER;
    const parsed = parseSection(
      file,
      heading,
      contentLines(markdown, heading, nextLine),
      operationHeadings
    );
    diagnostics.push(...parsed.diagnostics);
    if (parsed.section !== null) parsedSections[heading.text] = parsed.section;
  }
  if (diagnostics.length > 0) {
    return { diagnostics, definition: null };
  }
  return {
    diagnostics,
    definition: {
      path: file.path,
      title: title.text,
      introduction,
      deviations,
      sections: parsedSections
    }
  };
}

export function validateCompleteWorkflowDefinitions(documentSet, workflowFacts, coreFacts) {
  const diagnostics = [];
  const definitions = [];
  const operationDefinitions = coreFacts?.operationDefinitions?.byName;
  const operationHeadings = operationDefinitions !== null
    && typeof operationDefinitions === "object"
    ? new Set(Object.values(operationDefinitions).map((entry) => (
      `${entry.action} ${entry.channel} (${entry.name})`
    )))
    : null;
  const paths = [...new Set((workflowFacts?.rows ?? []).map((row) => row.path))];
  for (const workflowPath of paths) {
    const file = documentSet.files.find((entry) => entry.path === workflowPath);
    if (file === undefined) continue;
    const parsed = parseWorkflowFile(file, operationHeadings);
    diagnostics.push(...parsed.diagnostics);
    if (parsed.definition !== null) definitions.push(parsed.definition);
  }
  return { diagnostics, facts: { workflowDefinitions: definitions } };
}
