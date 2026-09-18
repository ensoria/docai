import { diagnostic } from "../diagnostics.mjs";
import { validateDocumentSet } from "../document-set.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { parseDocsPath } from "../paths.mjs";
import { parsePipeTable } from "../tables.mjs";
import { validateCompleteReferenceMaterials } from "./complete-references.mjs";
import { validateCompleteWorkflowDefinitions } from "./complete-workflows.mjs";

const WORKFLOW_COLUMNS = ["Name", "Summary", "Details"];
const WORKFLOW_SHARD_COLUMNS = ["First name", "Last name", "Summary", "Details"];
const REFERENCE_OWNERSHIP_ROUTING_RULES = new Set([
  "DM-IDX-001",
  "DM-IDX-003",
  "DM-IDX-004",
  "DM-IDX-005",
  "DM-IDX-006",
  "DM-IDX-007"
]);

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

function workflowDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file?.path ?? "INDEX.md", line, message);
}

function sectionLines(markdown, heading, identityLine = Number.MAX_SAFE_INTEGER) {
  const next = markdown.headings.find((entry) => (
    entry.line > heading.line && entry.level <= heading.level
  ));
  const boundary = Math.min(next?.line ?? Number.MAX_SAFE_INTEGER, identityLine);
  return markdown.lines.filter((line) => (
    line.line > heading.line
      && line.line < boundary
      && !line.inFence
  ));
}

function firstContentIndex(lines) {
  return lines.findIndex((line) => line.text !== "");
}

function hasOnlyBlankContentAfter(lines, lineNumber) {
  return !lines.some((line) => line.line > lineNumber && line.text !== "");
}

function exactColumns(actual, expected) {
  return actual.length === expected.length
    && expected.every((column, index) => actual[index] === column);
}

function validWorkflowPath(source, file, line) {
  const parsed = parseDocsPath({ text: source, file: file.path, line });
  return parsed.value?.kind === "docs-root-relative"
    && source.startsWith("workflows/")
    && source.endsWith(".md");
}

function parseWorkflowRows(documentSet, file, lines) {
  const diagnostics = [];
  const first = firstContentIndex(lines);
  const parsed = first === -1
    ? { value: null }
    : parsePipeTable(lines.slice(first).map((line) => ({
      text: line.text,
      file: file.path,
      line: line.line
    })));
  if (parsed.value === null
    || !exactColumns(parsed.value.header, WORKFLOW_COLUMNS)
    || parsed.value.rows.length === 0) {
    return {
      diagnostics: [workflowDiagnostic(
        "DM-WF-001",
        file,
        lines[first]?.line ?? file.identityLine ?? 1,
        "Workflows requires a non-empty Name | Summary | Details table."
      )],
      rows: []
    };
  }
  if (!hasOnlyBlankContentAfter(lines, parsed.value.endLine)) {
    diagnostics.push(workflowDiagnostic(
      "DM-WF-001",
      file,
      lines.find((line) => line.line > parsed.value.endLine && line.text !== "").line,
      "No content may follow a direct Workflows table."
    ));
  }

  const seenNames = new Set();
  const seenDetails = new Set();
  let previousName = null;
  const filesByPath = new Set(documentSet.paths);
  const rows = parsed.value.rows.map((cells, index) => {
    const line = parsed.value.startLine + index + 2;
    const [name = "", summary = "", details = ""] = cells;
    const valid = name !== ""
      && summary !== ""
      && validWorkflowPath(details, file, line)
      && filesByPath.has(details)
      && !seenNames.has(name)
      && !seenDetails.has(details)
      && (previousName === null || scalarCompare(previousName, name) < 0);
    if (!valid) {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-002",
        file,
        line,
        "Workflow rows require unique non-empty scalar-ordered names, non-empty summaries, and unique existing workflow Details paths."
      ));
    }
    seenNames.add(name);
    seenDetails.add(details);
    previousName = name;
    return { name, summary, path: details, indexPath: file.path, line };
  });
  return { diagnostics, rows };
}

function validateWorkflowShardStructure(file, markdown) {
  const structural = markdown.headings.filter((heading) => heading.level <= 2);
  const title = structural[0];
  const workflows = structural[1];
  const preTitle = markdown.lines.find((line) => (
    line.line > file.metadataLine
      && line.line < (title?.line ?? Number.MAX_SAFE_INTEGER)
      && line.text !== ""
  ));
  const titleBody = markdown.lines.find((line) => (
    line.line > (title?.line ?? Number.MAX_SAFE_INTEGER)
      && line.line < (workflows?.line ?? Number.MAX_SAFE_INTEGER)
      && line.text !== ""
  ));
  const valid = title?.level === 1
    && title.text === "Messaging Workflow Index"
    && workflows?.level === 2
    && workflows.text === "Workflows"
    && structural.length === 2
    && preTitle === undefined
    && titleBody === undefined;
  return valid ? [] : [workflowDiagnostic(
    "DM-WF-003",
    file,
    preTitle?.line ?? titleBody?.line ?? title?.line ?? 1,
    "A workflow-index shard contains only '# Messaging Workflow Index' followed by '## Workflows'."
  )];
}

function parseWorkflowShardRoutes(root, lines) {
  const diagnostics = [];
  const first = firstContentIndex(lines);
  if (first === -1 || lines[first].text !== "### Workflow Shards") {
    return {
      diagnostics: [workflowDiagnostic(
        "DM-WF-001",
        root,
        lines[first]?.line ?? root.identityLine ?? 1,
        "Sharded Workflows begins with the exact '### Workflow Shards' heading."
      )],
      routes: []
    };
  }
  const tableLines = lines.slice(first + 1);
  const tableFirst = firstContentIndex(tableLines);
  const parsed = tableFirst === -1
    ? { value: null }
    : parsePipeTable(tableLines.slice(tableFirst).map((line) => ({
      text: line.text,
      file: root.path,
      line: line.line
    })));
  if (parsed.value === null
    || !exactColumns(parsed.value.header, WORKFLOW_SHARD_COLUMNS)
    || parsed.value.rows.length === 0) {
    return {
      diagnostics: [workflowDiagnostic(
        "DM-WF-003",
        root,
        tableLines[tableFirst]?.line ?? lines[first].line,
        "Workflow Shards requires a non-empty canonical routing table."
      )],
      routes: []
    };
  }
  if (!hasOnlyBlankContentAfter(lines, parsed.value.endLine)) {
    diagnostics.push(workflowDiagnostic(
      "DM-WF-003",
      root,
      lines.find((line) => line.line > parsed.value.endLine && line.text !== "").line,
      "No content may follow the Workflow Shards routing table."
    ));
  }

  const seenPaths = new Set();
  const routes = parsed.value.rows.map((cells, index) => {
    const line = parsed.value.startLine + index + 2;
    const [firstName = "", lastName = "", summary = "", details = ""] = cells;
    const parsedPath = parseDocsPath({ text: details, file: root.path, line });
    const valid = firstName !== ""
      && lastName !== ""
      && scalarCompare(firstName, lastName) <= 0
      && summary !== ""
      && parsedPath.value?.kind === "docs-root-relative"
      && details.startsWith("indexes/")
      && details.endsWith(".md")
      && !seenPaths.has(details);
    if (!valid) {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-003",
        root,
        line,
        "Workflow shard routes require valid inclusive name bounds, a summary, and a unique workflow-index Details path."
      ));
    }
    seenPaths.add(details);
    return { firstName, lastName, summary, path: details, line, rows: [] };
  });
  return { diagnostics, routes };
}

function routeBounds(rows) {
  const names = rows.map((row) => row.name).sort(scalarCompare);
  return [names[0], names.at(-1)];
}

function validateRoutedWorkflowRows(documentSet, root, routes) {
  const diagnostics = [];
  const filesByPath = new Map(documentSet.files.map((file) => [file.path, file]));
  const loadedPaths = new Set();
  const rows = [];
  for (const route of routes) {
    if (loadedPaths.has(route.path)) continue;
    loadedPaths.add(route.path);
    const file = filesByPath.get(route.path);
    if (file === undefined) {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-003",
        root,
        route.line,
        `Workflow shard '${route.path}' is missing from the document set.`
      ));
      continue;
    }
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value === null) {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-003",
        file,
        scanned.diagnostics[0]?.line ?? 1,
        "Workflow shard Markdown is structurally invalid."
      ));
      continue;
    }
    const structureDiagnostics = validateWorkflowShardStructure(file, scanned.value);
    diagnostics.push(...structureDiagnostics);
    if (structureDiagnostics.length > 0) continue;
    const heading = scanned.value.headings.find((entry) => (
      entry.level === 2 && entry.text === "Workflows"
    ));
    const parsed = parseWorkflowRows(
      documentSet,
      file,
      sectionLines(scanned.value, heading, file.identityLine ?? Number.MAX_SAFE_INTEGER)
    );
    diagnostics.push(...parsed.diagnostics.map((entry) => (
      entry.ruleId === "DM-WF-001" ? { ...entry, ruleId: "DM-WF-003" } : entry
    )));
    route.rows = parsed.rows;
    if (route.rows.length === 0) {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-003",
        root,
        route.line,
        `Workflow shard '${route.path}' must not be empty.`
      ));
    } else {
      const [firstName, lastName] = routeBounds(route.rows);
      if (route.firstName !== firstName || route.lastName !== lastName) {
        diagnostics.push(workflowDiagnostic(
          "DM-WF-003",
          root,
          route.line,
          `Workflow shard route '${route.path}' must equal its actual inclusive name bounds.`
        ));
      }
    }
    rows.push(...route.rows);
  }

  return { diagnostics, rows };
}

function validateUnlistedWorkflowShards(documentSet, listedPaths) {
  const diagnostics = [];
  const listed = new Set(listedPaths);
  for (const file of documentSet.files) {
    if (listed.has(file.path)) continue;
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value?.headings[0]?.text === "Messaging Workflow Index") {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-003",
        file,
        scanned.value.headings[0].line,
        "Every workflow-index shard must be listed exactly once in root Workflow Shards."
      ));
    }
  }
  return diagnostics;
}

function validateGlobalWorkflowRows(documentSet, rows, { checkDuplicates = true } = {}) {
  const diagnostics = [];
  const names = new Set();
  const paths = new Set();
  for (const row of rows) {
    if (checkDuplicates && (names.has(row.name) || paths.has(row.path))) {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-002",
        { path: row.indexPath },
        row.line,
        "Workflow names and Details paths must be unique across the complete document set."
      ));
    }
    names.add(row.name);
    paths.add(row.path);
  }
  const workflowPaths = documentSet.paths.filter((entry) => (
    entry.startsWith("workflows/") && entry.endsWith(".md")
  ));
  for (const workflowPath of workflowPaths) {
    if (!paths.has(workflowPath)) {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-002",
        { path: workflowPath },
        1,
        "Every workflow file must appear in exactly one direct or sharded Workflows row."
      ));
    }
  }
  return diagnostics;
}

function workflowTrace(rows, loadedIndexPaths, selector, falsePositiveIndexPaths = []) {
  return {
    selector,
    loadedIndexPaths: [...new Set(loadedIndexPaths)].sort(),
    falsePositiveIndexPaths: [...new Set(falsePositiveIndexPaths)].sort(),
    matchedWorkflowNames: rows.map((row) => row.name).sort(scalarCompare),
    loadedWorkflowPaths: rows.map((row) => row.path).sort()
  };
}

function directWorkflowRetrieval(rows) {
  return {
    exact: Object.fromEntries(rows.map((row) => [
      row.name,
      workflowTrace([row], ["INDEX.md"], { name: row.name })
    ])),
    semanticFallback: workflowTrace(rows, ["INDEX.md"], null)
  };
}

function nameInRoute(name, route) {
  return scalarCompare(route.firstName, name) <= 0
    && scalarCompare(name, route.lastName) <= 0;
}

function shardedWorkflowRetrieval(rows, routes) {
  const exact = {};
  for (const row of [...rows].sort((left, right) => scalarCompare(left.name, right.name))) {
    const loadedRoutes = routes.filter((route) => nameInRoute(row.name, route));
    const matches = loadedRoutes.flatMap((route) => route.rows)
      .filter((candidate) => candidate.name === row.name);
    const falsePositives = loadedRoutes
      .filter((route) => !route.rows.some((candidate) => candidate.name === row.name))
      .map((route) => route.path);
    exact[row.name] = workflowTrace(
      matches,
      loadedRoutes.map((route) => route.path),
      { name: row.name },
      falsePositives
    );
  }
  return {
    exact,
    semanticFallback: workflowTrace(rows, routes.map((route) => route.path), null)
  };
}

function validateCompleteWorkflowRouting(documentSet) {
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  const emptyFacts = {
    workflows: null,
    workflowRetrieval: null
  };
  if (root === undefined) return { diagnostics: [], facts: emptyFacts };
  const scanned = scanMarkdown({ text: root.content, file: root.path });
  if (scanned.value === null) return { diagnostics: [], facts: emptyFacts };
  const heading = scanned.value.headings.find((entry) => (
    entry.level === 2 && entry.text === "Workflows"
  ));
  if (heading === undefined) return { diagnostics: [], facts: emptyFacts };
  const lines = sectionLines(
    scanned.value,
    heading,
    root.identityLine ?? Number.MAX_SAFE_INTEGER
  );
  const first = firstContentIndex(lines);
  if (first !== -1 && lines[first].text === "none") {
    const diagnostics = [];
    if (!hasOnlyBlankContentAfter(lines, lines[first].line)) {
      diagnostics.push(workflowDiagnostic(
        "DM-WF-001",
        root,
        lines.find((line) => line.line > lines[first].line && line.text !== "").line,
        "Workflows 'none' must be the section's only content."
      ));
    }
    diagnostics.push(...validateGlobalWorkflowRows(documentSet, [], { checkDuplicates: false }));
    diagnostics.push(...validateUnlistedWorkflowShards(documentSet, []));
    return {
      diagnostics,
      facts: {
        workflows: { form: "none", rows: [], shards: [] },
        workflowRetrieval: { exact: {}, semanticFallback: workflowTrace([], ["INDEX.md"], null) }
      }
    };
  }

  if (first !== -1 && lines[first].text === "### Workflow Shards") {
    const routed = parseWorkflowShardRoutes(root, lines);
    const loaded = validateRoutedWorkflowRows(documentSet, root, routed.routes);
    return {
      diagnostics: [
        ...routed.diagnostics,
        ...loaded.diagnostics,
        ...validateGlobalWorkflowRows(documentSet, loaded.rows),
        ...validateUnlistedWorkflowShards(
          documentSet,
          routed.routes.map((route) => route.path)
        )
      ],
      facts: {
        workflows: { form: "sharded", rows: loaded.rows, shards: routed.routes },
        workflowRetrieval: shardedWorkflowRetrieval(loaded.rows, routed.routes)
      }
    };
  }

  const parsed = parseWorkflowRows(documentSet, root, lines);
  return {
    diagnostics: [
      ...parsed.diagnostics,
      ...validateGlobalWorkflowRows(documentSet, parsed.rows, { checkDuplicates: false }),
      ...validateUnlistedWorkflowShards(documentSet, [])
    ],
    facts: {
      workflows: { form: "direct", rows: parsed.rows, shards: [] },
      workflowRetrieval: directWorkflowRetrieval(parsed.rows)
    }
  };
}

export function validateCompleteDocumentSet(documentSet, options = {}) {
  const base = validateDocumentSet(documentSet, options);
  const workflows = validateCompleteWorkflowRouting(documentSet);
  const workflowDefinitions = workflows.diagnostics.length === 0
    ? validateCompleteWorkflowDefinitions(
      documentSet,
      workflows.facts.workflows,
      base.facts.core
    )
    : { diagnostics: [], facts: { workflowDefinitions: null } };
  const referenceMaterials = validateCompleteReferenceMaterials(
    documentSet,
    base.facts.core,
    {
      enforceOwnership: !base.diagnostics.some((entry) => (
        REFERENCE_OWNERSHIP_ROUTING_RULES.has(entry.ruleId)
      ))
    }
  );
  return {
    diagnostics: [
      ...base.diagnostics,
      ...workflows.diagnostics,
      ...workflowDefinitions.diagnostics,
      ...referenceMaterials.diagnostics
    ],
    facts: {
      ...base.facts,
      complete: {
        ...workflows.facts,
        ...workflowDefinitions.facts,
        ...referenceMaterials.facts
      }
    }
  };
}
