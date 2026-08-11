import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { parseDocsPath } from "../paths.mjs";
import { parsePipeTable } from "../tables.mjs";

const SOURCE_COLUMNS = [
  "ID",
  "Kind",
  "Specification",
  "API",
  "Contract version",
  "Location",
  "Revision"
];
const SOURCE_ID = /^[A-Za-z0-9._-]+$/;
const SOURCE_KIND = /^[a-z0-9._-]+$/;
const SHA256_REVISION = /^sha256:[0-9a-f]{64}$/;
const SOURCE_SHARD_COLUMNS = ["First ID", "Last ID", "Kinds", "Summary", "Details"];

function asciiCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "ascii"), Buffer.from(right, "ascii"));
}

function unicodeScalarCompare(left, right) {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0));
  const rightScalars = Array.from(right, (value) => value.codePointAt(0));
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index += 1) {
    if (leftScalars[index] !== rightScalars[index]) return leftScalars[index] - rightScalars[index];
  }
  return leftScalars.length - rightScalars.length;
}

function sourceDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file.path, line, message);
}

function sectionLines(markdown, headingText) {
  const heading = markdown.headings.find((entry) => entry.level === 2 && entry.text === headingText);
  if (heading === undefined) return [];
  const next = markdown.headings.find((entry) => entry.line > heading.line && entry.level <= 2);
  const endLine = next?.line ?? Number.MAX_SAFE_INTEGER;
  return markdown.lines.filter((entry) => entry.line > heading.line && entry.line < endLine);
}

function directTable(file, lines) {
  const first = lines.findIndex((entry) => entry.text !== "");
  if (first === -1) {
    return {
      diagnostics: [sourceDiagnostic("DM-SRC-001", file, file.identityLine ?? 1, "Sources requires a non-empty direct table.")],
      table: null,
      markers: []
    };
  }
  const parsed = parsePipeTable(lines.slice(first).map((entry) => ({
    text: entry.text,
    file: file.path,
    line: entry.line
  })));
  if (parsed.value === null) {
    return {
      diagnostics: [sourceDiagnostic("DM-SRC-001", file, lines[first].line, "Sources must contain a valid direct pipe table.")],
      table: null,
      markers: []
    };
  }
  const markers = lines.filter((entry) => entry.line > parsed.value.endLine && entry.text !== "");
  return { diagnostics: [], table: parsed.value, markers };
}

function sourceRows(file, table, markers) {
  const diagnostics = [];
  const standardHeader = table.header.slice(0, SOURCE_COLUMNS.length);
  const extensionHeader = table.header.slice(SOURCE_COLUMNS.length);
  const headerIsValid = JSON.stringify(standardHeader) === JSON.stringify(SOURCE_COLUMNS)
    && extensionHeader.every((column) => column.startsWith("x-"));
  if (!headerIsValid) {
    diagnostics.push(sourceDiagnostic(
      "DM-SRC-001",
      file,
      table.startLine,
      `Sources standard columns must begin with '${SOURCE_COLUMNS.join(" | ")}'.`
    ));
  }
  if (table.rows.length === 0) {
    diagnostics.push(sourceDiagnostic("DM-SRC-001", file, table.startLine, "Sources must contain at least one row."));
  }
  if (!headerIsValid) return { diagnostics, rows: [] };

  const rows = table.rows.map((cells, index) => ({
    id: cells[0],
    kind: cells[1],
    specification: cells[2],
    api: cells[3],
    contractVersion: cells[4],
    location: cells[5],
    revision: cells[6],
    file: file.path,
    line: table.startLine + index + 2
  }));
  const seenIds = new Set();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!SOURCE_ID.test(row.id) || row.id === "all" || seenIds.has(row.id)
      || (index > 0 && asciiCompare(rows[index - 1].id, row.id) >= 0)) {
      diagnostics.push(sourceDiagnostic(
        "DM-SRC-002",
        file,
        row.line,
        "Source IDs must be unique non-'all' IDs in strict ASCII lexical order."
      ));
    }
    seenIds.add(row.id);
    if (!SOURCE_KIND.test(row.kind)
      || [row.specification, row.api, row.contractVersion, row.location, row.revision]
        .some((value) => typeof value !== "string" || value === "")) {
      diagnostics.push(sourceDiagnostic(
        "DM-SRC-001",
        file,
        row.line,
        "Every Sources row requires a lowercase Kind and non-empty standard cells."
      ));
    }
    if (row.revision.startsWith("sha256:") && !SHA256_REVISION.test(row.revision)) {
      diagnostics.push(sourceDiagnostic(
        "DM-SRC-004",
        file,
        row.line,
        "A sha256 Revision must contain exactly 64 lowercase hexadecimal characters."
      ));
    }
  }

  const expectedMarkers = rows.flatMap((row) => {
    const expected = [];
    if (row.contractVersion === "unknown") {
      expected.push(`**unknown**: API contract version for source ${row.id} requires `);
    }
    if (row.api === "unknown") {
      expected.push(`**unknown**: API identity for source ${row.id} requires `);
    }
    return expected;
  }).sort(unicodeScalarCompare);
  const actualMarkers = markers
    .filter((entry) => entry.text.startsWith("**unknown**:"))
    .map((entry) => entry.text);
  const leadingMarkerGroup = markers.slice(0, expectedMarkers.length).map((entry) => entry.text);
  const markerOrder = [...actualMarkers].sort(unicodeScalarCompare);
  const markersMatch = expectedMarkers.length === actualMarkers.length
    && leadingMarkerGroup.length === expectedMarkers.length
    && leadingMarkerGroup.every((value, index) => value === actualMarkers[index])
    && expectedMarkers.every((prefix, index) => actualMarkers[index]?.startsWith(prefix)
      && actualMarkers[index].length > prefix.length)
    && actualMarkers.every((value, index) => value === markerOrder[index]);
  if (!markersMatch || (expectedMarkers.length > 0 && file.metadata?.knowledge !== "requires-input")) {
    diagnostics.push(sourceDiagnostic(
      "DM-SRC-003",
      file,
      markers[0]?.line ?? table.endLine,
      "Unknown API identity and contract version cells require their source-qualified canonical markers and knowledge propagation."
    ));
  }
  return { diagnostics, rows };
}

function parseSourceRefs(file) {
  const value = file.metadata?.source_refs;
  if (value === "all") return { value: "all", diagnostics: [] };
  if (typeof value !== "string" || value === "") {
    return {
      value: null,
      diagnostics: [sourceDiagnostic("DM-SRC-005", file, file.metadataLine, "source_refs must be 'all' or a non-empty canonical ID list.")]
    };
  }
  const ids = value.split(", ");
  const canonical = ids.join(", ") === value
    && ids.every((id) => SOURCE_ID.test(id) && id !== "all")
    && new Set(ids).size === ids.length
    && ids.every((id, index) => index === 0 || asciiCompare(ids[index - 1], id) < 0);
  if (!canonical) {
    return {
      value: null,
      diagnostics: [sourceDiagnostic("DM-SRC-005", file, file.metadataLine, "source_refs IDs must be unique and ASCII-ordered with the exact ', ' delimiter.")]
    };
  }
  return { value: ids, diagnostics: [] };
}

function resolveDirectSources(documentSet, rows) {
  const diagnostics = [];
  const sourceResolutions = {};
  const rowIds = rows.map((row) => row.id);
  const available = new Set(rowIds);
  for (const file of documentSet.files) {
    if (file.metadata === null) continue;
    const parsed = parseSourceRefs(file);
    diagnostics.push(...parsed.diagnostics);
    if (parsed.value === null) continue;
    if (file.path === "INDEX.md" && parsed.value !== "all") {
      diagnostics.push(sourceDiagnostic("DM-SRC-005", file, file.metadataLine, "Root INDEX source_refs must be 'all'."));
      continue;
    }
    const requestedIds = parsed.value === "all" ? rowIds : parsed.value;
    const missing = requestedIds.filter((id) => !available.has(id));
    if (missing.length > 0) {
      diagnostics.push(sourceDiagnostic(
        "DM-SRC-005",
        file,
        file.metadataLine,
        `source_refs IDs are absent from Sources: ${missing.join(", ")}.`
      ));
      continue;
    }
    sourceResolutions[file.path] = {
      requestedIds: [...requestedIds],
      resolvedIds: [...requestedIds],
      loadedPaths: ["INDEX.md"]
    };
  }
  return { diagnostics, sourceResolutions };
}

function canonicalKinds(value) {
  if (typeof value !== "string") return null;
  const kinds = value.split("; ");
  const valid = kinds.join("; ") === value
    && kinds.length > 0
    && kinds.every((kind) => SOURCE_KIND.test(kind))
    && new Set(kinds).size === kinds.length
    && kinds.every((kind, index) => index === 0 || asciiCompare(kinds[index - 1], kind) < 0);
  return valid ? kinds : null;
}

function parseSourceShardRoutes(root, lines) {
  const diagnostics = [];
  const headingIndex = lines.findIndex((entry) => entry.text !== "");
  if (headingIndex === -1 || lines[headingIndex].text !== "### Source Shards") {
    return {
      diagnostics: [sourceDiagnostic("DM-SRC-006", root, lines[headingIndex]?.line ?? root.identityLine, "Sharded Sources must begin with '### Source Shards'.")],
      routes: []
    };
  }
  const tableStart = lines.findIndex((entry, index) => index > headingIndex && entry.text !== "");
  if (tableStart === -1) {
    return {
      diagnostics: [sourceDiagnostic("DM-SRC-006", root, lines[headingIndex].line, "Source Shards requires a non-empty routing table.")],
      routes: []
    };
  }
  const parsed = parsePipeTable(lines.slice(tableStart).map((entry) => ({
    text: entry.text,
    file: root.path,
    line: entry.line
  })));
  if (parsed.value === null) {
    return {
      diagnostics: [sourceDiagnostic("DM-SRC-006", root, lines[tableStart].line, "Source Shards requires a valid routing table.")],
      routes: []
    };
  }
  const standardHeader = parsed.value.header.slice(0, SOURCE_SHARD_COLUMNS.length);
  const extensionHeader = parsed.value.header.slice(SOURCE_SHARD_COLUMNS.length);
  if (JSON.stringify(standardHeader) !== JSON.stringify(SOURCE_SHARD_COLUMNS)
    || extensionHeader.some((column) => !column.startsWith("x-"))) {
    diagnostics.push(sourceDiagnostic(
      "DM-SRC-006",
      root,
      parsed.value.startLine,
      `Source Shards standard columns must begin with '${SOURCE_SHARD_COLUMNS.join(" | ")}'.`
    ));
  }
  if (parsed.value.rows.length === 0) {
    diagnostics.push(sourceDiagnostic("DM-SRC-006", root, parsed.value.startLine, "Source Shards must list at least one non-empty shard."));
  }
  const seenPaths = new Set();
  const routes = parsed.value.rows.map((cells, index) => ({
    firstId: cells[0] ?? "",
    lastId: cells[1] ?? "",
    kinds: canonicalKinds(cells[2]),
    kindsSource: cells[2] ?? "",
    summary: cells[3] ?? "",
    path: cells[4] ?? "",
    line: parsed.value.startLine + index + 2,
    rows: [],
    sourceRefs: null
  }));
  for (const route of routes) {
    const parsedPath = parseDocsPath({ text: route.path, file: root.path, line: route.line });
    if (!SOURCE_ID.test(route.firstId) || route.firstId === "all"
      || !SOURCE_ID.test(route.lastId) || route.lastId === "all"
      || asciiCompare(route.firstId, route.lastId) > 0
      || route.kinds === null
      || route.summary === ""
      || parsedPath.value === null
      || parsedPath.value.kind !== "docs-root-relative"
      || seenPaths.has(route.path)) {
      diagnostics.push(sourceDiagnostic(
        "DM-SRC-006",
        root,
        route.line,
        "Each Source Shards row requires valid bounds, canonical Kinds, a summary, and a unique docs-root-relative Details path."
      ));
    }
    seenPaths.add(route.path);
  }
  return { diagnostics, routes };
}

function validateSourceShardStructure(file, markdown) {
  const firstHeading = markdown.headings[0];
  const structural = markdown.headings.filter((entry) => entry.level <= 2);
  const valid = firstHeading?.level === 1
    && firstHeading.text === "Messaging Source Index"
    && structural.length === 2
    && structural[0] === firstHeading
    && structural[1]?.level === 2
    && structural[1]?.text === "Sources";
  if (!valid) {
    return [sourceDiagnostic(
      "DM-SRC-006",
      file,
      firstHeading?.line ?? file.metadataLine + 1,
      "A source-index shard must contain only '# Messaging Source Index' followed by '## Sources'."
    )];
  }
  const preTitle = markdown.lines.find((entry) => (
    entry.line > file.metadataLine && entry.line < firstHeading.line && entry.text !== ""
  ));
  const titleBody = markdown.lines.find((entry) => (
    entry.line > firstHeading.line && entry.line < structural[1].line && entry.text !== ""
  ));
  if (preTitle !== undefined || titleBody !== undefined) {
    return [sourceDiagnostic(
      "DM-SRC-006",
      file,
      preTitle?.line ?? titleBody.line,
      "A source-index shard has no profile link, pre-title content, or title body."
    )];
  }
  const unexpectedHeading = markdown.headings.slice(2).find((entry) => (
    entry.level <= 3 && !(entry.level === 3 && entry.text.startsWith("x-"))
  ));
  if (unexpectedHeading !== undefined) {
    return [sourceDiagnostic(
      "DM-SRC-006",
      file,
      unexpectedHeading.line,
      "A source-index shard permits no additional standard heading after its direct Sources table."
    )];
  }
  return [];
}

function loadSourceShards(documentSet, root, routes) {
  const diagnostics = [];
  const filesByPath = new Map(documentSet.files.map((file) => [file.path, file]));
  const allRows = [];
  const ownerById = new Map();
  for (const route of routes) {
    const file = filesByPath.get(route.path);
    if (file === undefined) {
      diagnostics.push(sourceDiagnostic("DM-SRC-006", root, route.line, `Source shard '${route.path}' is missing from the document set.`));
      continue;
    }
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value === null) {
      diagnostics.push(sourceDiagnostic("DM-SRC-006", file, scanned.diagnostics[0]?.line ?? 1, "Source shard Markdown is structurally invalid."));
      continue;
    }
    const structureDiagnostics = validateSourceShardStructure(file, scanned.value);
    diagnostics.push(...structureDiagnostics);
    if (structureDiagnostics.length > 0) continue;
    const parsed = directTable(file, sectionLines(scanned.value, "Sources"));
    diagnostics.push(...parsed.diagnostics);
    if (parsed.table === null) continue;
    const catalog = sourceRows(file, parsed.table, parsed.markers);
    diagnostics.push(...catalog.diagnostics);
    route.rows = catalog.rows;

    const refs = parseSourceRefs(file);
    diagnostics.push(...refs.diagnostics);
    route.sourceRefs = refs.value;
    if (refs.value !== null && refs.value !== "all") {
      const declared = new Set(refs.value);
      const omitted = route.rows.filter((row) => !declared.has(row.id));
      if (omitted.length > 0) {
        diagnostics.push(sourceDiagnostic(
          "DM-SRC-005",
          file,
          file.metadataLine,
          `A source shard's source_refs must include every row ID; missing ${omitted.map((row) => row.id).join(", ")}.`
        ));
      }
    }

    if (route.rows.length === 0) {
      diagnostics.push(sourceDiagnostic("DM-SRC-006", file, parsed.table.startLine, "A listed source shard must not be empty."));
      continue;
    }
    const actualFirst = route.rows[0].id;
    const actualLast = route.rows.at(-1).id;
    const actualKinds = [...new Set(route.rows.map((row) => row.kind))].sort(asciiCompare);
    if (route.firstId !== actualFirst || route.lastId !== actualLast
      || JSON.stringify(route.kinds) !== JSON.stringify(actualKinds)) {
      diagnostics.push(sourceDiagnostic(
        "DM-SRC-006",
        root,
        route.line,
        `Source shard bounds and Kinds must equal its actual rows in '${route.path}'.`
      ));
    }
    for (const row of route.rows) {
      if (ownerById.has(row.id)) {
        diagnostics.push(sourceDiagnostic(
          "DM-SRC-007",
          file,
          row.line,
          `Source ID '${row.id}' appears in both '${ownerById.get(row.id)}' and '${file.path}'.`
        ));
      } else {
        ownerById.set(row.id, file.path);
      }
      allRows.push(row);
    }
  }

  const listed = new Set(routes.map((route) => route.path));
  for (const file of documentSet.files) {
    if (listed.has(file.path) || !file.path.startsWith("indexes/")) continue;
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value?.headings[0]?.text === "Messaging Source Index") {
      diagnostics.push(sourceDiagnostic("DM-SRC-006", file, scanned.value.headings[0].line, "Every source-index shard must be listed exactly once in root Source Shards."));
    }
  }
  allRows.sort((left, right) => asciiCompare(left.id, right.id));
  return { diagnostics, rows: allRows };
}

function idInRoute(id, route) {
  return asciiCompare(route.firstId, id) <= 0 && asciiCompare(id, route.lastId) <= 0;
}

function resolveShardedSourceRefs(file, parsedRefs, routes, allRows) {
  const diagnostics = [];
  const allIds = allRows.map((row) => row.id);
  const requestedIds = parsedRefs === "all" ? allIds : parsedRefs;
  const unresolved = new Set(requestedIds);
  const resolved = new Set();
  const loaded = new Set();

  while (unresolved.size > 0) {
    const candidates = routes.filter((route) => (
      !loaded.has(route.path) && [...unresolved].some((id) => idInRoute(id, route))
    ));
    if (candidates.length === 0) break;
    for (const route of candidates) {
      loaded.add(route.path);
      for (const row of route.rows) resolved.add(row.id);
    }
    for (const id of resolved) unresolved.delete(id);
    for (const route of candidates) {
      const contributors = route.sourceRefs === "all" ? allIds : (route.sourceRefs ?? []);
      for (const id of contributors) {
        if (!resolved.has(id)) unresolved.add(id);
      }
    }
  }

  if (unresolved.size > 0 || requestedIds.some((id) => !resolved.has(id))) {
    const missing = [...new Set([
      ...unresolved,
      ...requestedIds.filter((id) => !resolved.has(id))
    ])].sort(asciiCompare);
    diagnostics.push(sourceDiagnostic(
      "DM-SRC-007",
      file,
      file.metadataLine,
      `source_refs fixed-point resolution did not find exactly one row for: ${missing.join(", ")}.`
    ));
  }
  return {
    diagnostics,
    resolution: {
      requestedIds: [...requestedIds],
      resolvedIds: [...resolved].sort(asciiCompare),
      loadedPaths: [...loaded].sort(asciiCompare)
    }
  };
}

function resolveShardedSources(documentSet, routes, rows) {
  const diagnostics = [];
  const sourceResolutions = {};
  for (const file of documentSet.files) {
    if (file.metadata === null) continue;
    const refs = parseSourceRefs(file);
    diagnostics.push(...refs.diagnostics);
    if (refs.value === null) continue;
    if (file.path === "INDEX.md" && refs.value !== "all") {
      diagnostics.push(sourceDiagnostic("DM-SRC-005", file, file.metadataLine, "Root INDEX source_refs must be 'all'."));
      continue;
    }
    const resolved = resolveShardedSourceRefs(file, refs.value, routes, rows);
    diagnostics.push(...resolved.diagnostics);
    sourceResolutions[file.path] = resolved.resolution;
  }
  return { diagnostics, sourceResolutions };
}

function validateShardedSources(documentSet, root, lines) {
  const routed = parseSourceShardRoutes(root, lines);
  const loaded = loadSourceShards(documentSet, root, routed.routes);
  const resolved = resolveShardedSources(documentSet, routed.routes, loaded.rows);
  if (loaded.rows.some((row) => row.api === "unknown" || row.contractVersion === "unknown")
    && root.metadata?.knowledge !== "requires-input") {
    loaded.diagnostics.push(sourceDiagnostic(
      "DM-SRC-003",
      root,
      root.metadataLine,
      "Root INDEX knowledge must aggregate unknown API facts from source shards."
    ));
  }
  return {
    diagnostics: [...routed.diagnostics, ...loaded.diagnostics, ...resolved.diagnostics],
    facts: {
      sources: { form: "sharded", rows: loaded.rows, shards: routed.routes },
      sourceResolutions: resolved.sourceResolutions
    }
  };
}

export function validateCoreSources(documentSet, root, markdown) {
  const lines = sectionLines(markdown, "Sources");
  const firstNonEmpty = lines.find((entry) => entry.text !== "");
  if (firstNonEmpty?.text === "### Source Shards") {
    return validateShardedSources(documentSet, root, lines);
  }

  const parsed = directTable(root, lines);
  if (parsed.table === null) {
    return {
      diagnostics: parsed.diagnostics,
      facts: { sources: { form: "direct", rows: [] }, sourceResolutions: {} }
    };
  }
  const catalog = sourceRows(root, parsed.table, parsed.markers);
  const resolved = resolveDirectSources(documentSet, catalog.rows);
  return {
    diagnostics: [...parsed.diagnostics, ...catalog.diagnostics, ...resolved.diagnostics],
    facts: {
      sources: { form: "direct", rows: catalog.rows },
      sourceResolutions: resolved.sourceResolutions
    }
  };
}
