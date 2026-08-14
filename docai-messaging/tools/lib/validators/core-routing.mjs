import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { parseDocsPath } from "../paths.mjs";
import { parsePipeTable } from "../tables.mjs";
import { CONVENTION_HEADINGS } from "./core-conventions.mjs";

const OPERATION_COLUMNS = [
  "Action",
  "Channel",
  "Operation",
  "Message",
  "Task",
  "Summary",
  "Required context",
  "Supplemental context"
];
const ROUTING_DIMENSIONS = ["task", "action", "channel", "operation", "message"];
const ROUTING_NAME = /^[A-Za-z0-9._-]+$/;
const OPERATION_SHARD_COLUMNS = [
  "Tasks",
  "Actions",
  "First channel",
  "Last channel",
  "First operation",
  "Last operation",
  "First message",
  "Last message",
  "Summary",
  "Details"
];
const SOURCE_ID = /^[A-Za-z0-9._-]+$/;
const UNPROJECTED_SHARD_COLUMNS = ["Source refs", "Summary", "Details"];
const UNPROJECTED_PREFIXES = [
  ["unsupported", "**unsupported**: localized: source operation "],
  ["unknown", "**unknown**: source operation "]
];

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

function routingDiagnostic(ruleId, file, line, message) {
  return diagnostic(ruleId, file.path, line, message);
}

function sectionLines(markdown, headingText) {
  const heading = markdown.headings.find((entry) => entry.level === 2 && entry.text === headingText);
  if (heading === undefined) return [];
  const next = markdown.headings.find((entry) => entry.line > heading.line && entry.level <= 2);
  const identity = markdown.lines.find((entry) => (
    entry.line > heading.line && entry.text.startsWith("> docai-identity:")
  ));
  const endLine = next?.line ?? identity?.line ?? Number.MAX_SAFE_INTEGER;
  return markdown.lines.filter((entry) => entry.line > heading.line && entry.line < endLine);
}

function decodeIdentity(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function groupingKey(sourceId, identity) {
  return `${sourceId}\u0000${identity}`;
}

function parseUnprojectedMarker(file, entry, knownSourceIds, ruleId) {
  const matchedPrefix = UNPROJECTED_PREFIXES.find(([, prefix]) => entry.text.startsWith(prefix));
  if (matchedPrefix === undefined) {
    return {
      diagnostics: [routingDiagnostic(ruleId, file, entry.line, "Unprojected Operations accepts only canonical source-operation markers.")],
      marker: null
    };
  }
  const [dimension, prefix] = matchedPrefix;
  const remainder = entry.text.slice(prefix.length);
  const sourceEnd = remainder.indexOf(" ");
  const sourceId = sourceEnd === -1 ? "" : remainder.slice(0, sourceEnd);
  const lengthStart = sourceEnd + 1;
  const lengthEnd = remainder.indexOf(":", lengthStart);
  const lengthSource = lengthEnd === -1 ? "" : remainder.slice(lengthStart, lengthEnd);
  const validLength = /^(?:[1-9][0-9]*)$/.test(lengthSource);
  const identityLength = validLength ? Number(lengthSource) : 0;
  const identityAndReason = lengthEnd === -1 ? Buffer.alloc(0) : Buffer.from(remainder.slice(lengthEnd + 1), "utf8");
  const identityBytes = identityAndReason.subarray(0, identityLength);
  const delimiterAndReason = identityAndReason.subarray(identityLength);
  const identity = identityBytes.length === identityLength ? decodeIdentity(identityBytes) : null;
  const exactBoundary = identity !== null
    && Buffer.byteLength(identity, "utf8") === identityLength
    && delimiterAndReason[0] === 0x3a
    && delimiterAndReason[1] === 0x20;
  const reason = exactBoundary ? decodeIdentity(delimiterAndReason.subarray(2)) : null;
  const valid = SOURCE_ID.test(sourceId)
    && sourceId !== "all"
    && knownSourceIds.has(sourceId)
    && validLength
    && Number.isSafeInteger(identityLength)
    && identityLength > 0
    && identity !== null
    && identity !== ""
    && exactBoundary
    && reason !== null
    && reason !== "";
  if (!valid) {
    return {
      diagnostics: [routingDiagnostic(
        ruleId,
        file,
        entry.line,
        "An unprojected source-operation marker requires a catalog source ID, canonical positive UTF-8 byte length, exact ': ' delimiter, non-empty identity, and non-empty reason."
      )],
      marker: null
    };
  }
  return {
    diagnostics: [],
    marker: {
      dimension,
      sourceId,
      identity,
      reason,
      key: groupingKey(sourceId, identity),
      indexPath: file.path,
      line: entry.line
    }
  };
}

function groupUnprojectedMarkers(file, markers, ruleId) {
  const diagnostics = [];
  const byKey = new Map();
  for (const marker of markers) {
    let group = byKey.get(marker.key);
    if (group === undefined) {
      group = {
        key: marker.key,
        sourceId: marker.sourceId,
        identity: marker.identity,
        dimensions: [],
        markers: [],
        indexPath: marker.indexPath
      };
      byKey.set(marker.key, group);
    }
    if (group.dimensions.includes(marker.dimension)) {
      diagnostics.push(routingDiagnostic(
        ruleId,
        file,
        marker.line,
        `Grouping key '${marker.sourceId} ${marker.identity}' has more than one ${marker.dimension} marker.`
      ));
      continue;
    }
    group.dimensions.push(marker.dimension);
    group.markers.push(marker);
  }
  return { diagnostics, groups: [...byKey.values()] };
}

function parseDirectUnprojected(file, lines, knownSourceIds, ruleId) {
  const entries = lines.filter((entry) => entry.text !== "");
  if (entries.length === 0 || entries.some((entry) => entry.text === "none")) {
    return {
      diagnostics: [routingDiagnostic(
        ruleId,
        file,
        entries[0]?.line ?? file.identityLine ?? 1,
        "An emitted Unprojected Operations section must contain one or more canonical markers."
      )],
      markers: [],
      groups: []
    };
  }
  const diagnostics = [];
  const markers = [];
  for (const entry of entries) {
    const parsed = parseUnprojectedMarker(file, entry, knownSourceIds, ruleId);
    diagnostics.push(...parsed.diagnostics);
    if (parsed.marker !== null) markers.push(parsed.marker);
  }
  const grouped = groupUnprojectedMarkers(file, markers, ruleId);
  return { diagnostics: [...diagnostics, ...grouped.diagnostics], markers, groups: grouped.groups };
}

function completenessDiagnostics(file, markers, ruleId, { exact = false } = {}) {
  const hasUnsupported = markers.some((marker) => marker.dimension === "unsupported");
  const hasUnknown = markers.some((marker) => marker.dimension === "unknown");
  const coverageMatches = hasUnsupported
    ? file.metadata?.coverage === "requires-source"
    : !exact || file.metadata?.coverage === "complete";
  const knowledgeMatches = hasUnknown
    ? file.metadata?.knowledge === "requires-input"
    : !exact || file.metadata?.knowledge === "complete";
  if (coverageMatches && knowledgeMatches) return [];
  return [routingDiagnostic(
    ruleId,
    file,
    file.metadataLine,
    exact
      ? "Shard coverage and knowledge must exactly describe its unprojected markers."
      : "Root INDEX coverage and knowledge must aggregate its unprojected markers."
  )];
}

function shardSourceRefsDiagnostics(file, groups) {
  const sourceRefs = file.metadata?.source_refs;
  if (sourceRefs === "all") return [];
  const referencedIds = new Set(typeof sourceRefs === "string" ? sourceRefs.split(", ") : []);
  const missing = uniqueSorted(groups.map((group) => group.sourceId))
    .filter((sourceId) => !referencedIds.has(sourceId));
  if (missing.length === 0) return [];
  return [routingDiagnostic(
    "DM-IDX-009",
    file,
    file.metadataLine,
    `Unprojected-operation shard source_refs must include every marker source ID; missing ${missing.join(", ")}.`
  )];
}

function parseUnprojectedShardRoutes(root, lines, knownSourceIds) {
  const diagnostics = [];
  const nonEmpty = lines.filter((entry) => entry.text !== "");
  if (nonEmpty[0]?.text !== "### Unprojected Operation Shards") {
    return { diagnostics: [routingDiagnostic("DM-IDX-009", root, nonEmpty[0]?.line ?? root.identityLine, "Sharded Unprojected Operations must begin with its fixed level-three heading.")], routes: [] };
  }
  const tableEntries = nonEmpty.slice(1);
  const parsed = parsePipeTable(tableEntries.map((entry) => ({ text: entry.text, file: root.path, line: entry.line })));
  const validHeader = parsed.value !== null
    && UNPROJECTED_SHARD_COLUMNS.every((column, index) => parsed.value.header[index] === column)
    && parsed.value.header.slice(UNPROJECTED_SHARD_COLUMNS.length).every((column) => column.startsWith("x-"));
  if (!validHeader || parsed.value.rows.length === 0) {
    return { diagnostics: [routingDiagnostic("DM-IDX-009", root, tableEntries[0]?.line ?? nonEmpty[0].line, "Unprojected Operation Shards requires its canonical columns and at least one route.")], routes: [] };
  }
  const trailing = tableEntries.find((entry) => entry.line > parsed.value.endLine && entry.text !== "");
  if (trailing !== undefined) {
    diagnostics.push(routingDiagnostic("DM-IDX-009", root, trailing.line, "No content may follow the Unprojected Operation Shards table."));
  }
  const seenPaths = new Set();
  const routes = parsed.value.rows.map((cells, index) => {
    const line = parsed.value.startLine + index + 2;
    const sourceIds = parseSemicolonList(cells[0], { names: true, ordered: true });
    const summary = cells[1] ?? "";
    const shardPath = cells[2] ?? "";
    const parsedPath = parseDocsPath({ text: shardPath, file: root.path, line });
    const valid = sourceIds !== null
      && sourceIds.every((sourceId) => sourceId !== "all" && knownSourceIds.has(sourceId))
      && summary !== ""
      && parsedPath.value?.kind === "docs-root-relative"
      && !seenPaths.has(shardPath);
    if (!valid) {
      diagnostics.push(routingDiagnostic("DM-IDX-009", root, line, "Each unprojected shard route requires canonical known Source refs, a non-empty Summary, and a unique Details path."));
    }
    seenPaths.add(shardPath);
    return { sourceIds: sourceIds ?? [], summary, path: shardPath, line, markers: [], groups: [] };
  });
  return { diagnostics, routes };
}

function validateUnprojectedShardStructure(file, markdown) {
  const firstHeading = markdown.headings[0];
  const structural = markdown.headings.filter((entry) => entry.level <= 2);
  const valid = firstHeading?.level === 1
    && firstHeading.text === "Messaging Unprojected Operation Index"
    && structural.length === 2
    && structural[0] === firstHeading
    && structural[1]?.level === 2
    && structural[1]?.text === "Unprojected Operations";
  const preTitle = markdown.lines.find((entry) => entry.line > file.metadataLine && entry.line < (firstHeading?.line ?? Number.MAX_SAFE_INTEGER) && entry.text !== "");
  const titleBody = valid
    ? markdown.lines.find((entry) => entry.line > firstHeading.line && entry.line < structural[1].line && entry.text !== "")
    : undefined;
  if (valid && preTitle === undefined && titleBody === undefined) return [];
  return [routingDiagnostic(
    "DM-IDX-009",
    file,
    preTitle?.line ?? titleBody?.line ?? firstHeading?.line ?? file.metadataLine + 1,
    "An unprojected-operation shard must contain only '# Messaging Unprojected Operation Index' followed by '## Unprojected Operations'."
  )];
}

function loadUnprojectedShards(documentSet, root, routes, knownSourceIds, sourceResolutions) {
  const diagnostics = [];
  const filesByPath = new Map(documentSet.files.map((file) => [file.path, file]));
  const groups = [];
  for (const route of routes) {
    const file = filesByPath.get(route.path);
    if (file === undefined) {
      diagnostics.push(routingDiagnostic("DM-IDX-009", root, route.line, `Unprojected-operation shard '${route.path}' is missing.`));
      continue;
    }
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value === null) {
      diagnostics.push(routingDiagnostic("DM-IDX-009", file, scanned.diagnostics[0]?.line ?? 1, "Unprojected-operation shard Markdown is structurally invalid."));
      continue;
    }
    const structureDiagnostics = validateUnprojectedShardStructure(file, scanned.value);
    diagnostics.push(...structureDiagnostics);
    if (structureDiagnostics.length > 0) continue;
    const parsed = parseDirectUnprojected(file, sectionLines(scanned.value, "Unprojected Operations"), knownSourceIds, "DM-IDX-008");
    diagnostics.push(
      ...parsed.diagnostics,
      ...completenessDiagnostics(file, parsed.markers, "DM-IDX-009", { exact: true }),
      ...shardSourceRefsDiagnostics(file, parsed.groups)
    );
    if (parsed.groups.length === 0) {
      diagnostics.push(routingDiagnostic(
        "DM-IDX-009",
        file,
        scanned.value.headings[1]?.line ?? file.identityLine ?? 1,
        "An unprojected-operation shard must contain at least one grouping key."
      ));
    }
    route.markers = parsed.markers;
    route.groups = parsed.groups;
    const actualSourceIds = uniqueSorted(
      sourceResolutions[file.path]?.requestedIds ?? parsed.groups.map((group) => group.sourceId)
    );
    if (JSON.stringify(route.sourceIds) !== JSON.stringify(actualSourceIds)) {
      diagnostics.push(routingDiagnostic("DM-IDX-009", root, route.line, `Route Source refs for '${route.path}' must equal the shard's contributing source_refs scope.`));
    }
    groups.push(...parsed.groups);
  }
  const owners = new Map();
  for (const group of groups) {
    const owner = owners.get(group.key);
    if (owner !== undefined && owner !== group.indexPath) {
      diagnostics.push(diagnostic("DM-IDX-009", group.indexPath, group.markers[0]?.line ?? 1, `Grouping key '${group.sourceId} ${group.identity}' is split across '${owner}' and '${group.indexPath}'.`));
    } else {
      owners.set(group.key, group.indexPath);
    }
  }
  const listed = new Set(routes.map((route) => route.path));
  for (const file of documentSet.files) {
    if (listed.has(file.path)) continue;
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value?.headings[0]?.text === "Messaging Unprojected Operation Index") {
      diagnostics.push(routingDiagnostic("DM-IDX-009", file, scanned.value.headings[0].line, "Every unprojected-operation shard must be listed exactly once."));
    }
  }
  return { diagnostics, groups };
}

function unprojectedRetrieval(groups, routes) {
  const sourceIds = uniqueSorted(routes.flatMap((route) => route.sourceIds));
  const exactBySourceId = {};
  for (const sourceId of sourceIds) {
    const selectedRoutes = routes.filter((route) => route.sourceIds.includes(sourceId));
    exactBySourceId[sourceId] = {
      selector: { sourceId },
      loadedIndexPaths: uniqueSorted(selectedRoutes.map((route) => route.path)),
      matchedGroupingKeys: uniqueSorted(
        selectedRoutes.flatMap((route) => route.groups)
          .map((group) => group.key)
      )
    };
  }
  return {
    exactBySourceId,
    semanticFallback: {
      selector: null,
      loadedIndexPaths: uniqueSorted(routes.map((route) => route.path)),
      matchedGroupingKeys: uniqueSorted(groups.map((group) => group.key))
    }
  };
}

export function validateCoreUnprojected(documentSet, root, markdown, sourceFacts) {
  const knownSourceIds = new Set(sourceFacts.sources?.rows.map((row) => row.id) ?? []);
  const heading = markdown.headings.find((entry) => entry.level === 2 && entry.text === "Unprojected Operations");
  if (heading === undefined) {
    return {
      diagnostics: [],
      facts: {
        unprojectedOperations: { form: "none", groups: [], shards: [] },
        unprojectedRetrieval: { exactBySourceId: {}, semanticFallback: { selector: null, loadedIndexPaths: [], matchedGroupingKeys: [] } }
      }
    };
  }
  const lines = sectionLines(markdown, "Unprojected Operations");
  const firstNonEmpty = lines.find((entry) => entry.text !== "");
  if (firstNonEmpty?.text === "### Unprojected Operation Shards") {
    const routed = parseUnprojectedShardRoutes(root, lines, knownSourceIds);
    const loaded = loadUnprojectedShards(
      documentSet,
      root,
      routed.routes,
      knownSourceIds,
      sourceFacts.sourceResolutions
    );
    const markers = loaded.groups.flatMap((group) => group.markers);
    return {
      diagnostics: [
        ...routed.diagnostics,
        ...loaded.diagnostics,
        ...completenessDiagnostics(root, markers, "DM-IDX-009")
      ],
      facts: {
        unprojectedOperations: { form: "sharded", groups: loaded.groups, shards: routed.routes },
        unprojectedRetrieval: unprojectedRetrieval(loaded.groups, routed.routes)
      }
    };
  }
  const parsed = parseDirectUnprojected(root, lines, knownSourceIds, "DM-IDX-008");
  const directRoute = { path: "INDEX.md", sourceIds: uniqueSorted(parsed.groups.map((group) => group.sourceId)), groups: parsed.groups };
  return {
    diagnostics: [...parsed.diagnostics, ...completenessDiagnostics(root, parsed.markers, "DM-IDX-008")],
    facts: {
      unprojectedOperations: { form: "direct", groups: parsed.groups, shards: [] },
      unprojectedRetrieval: unprojectedRetrieval(parsed.groups, [directRoute])
    }
  };
}

export function evaluateUnprojectedSourceExpectations(cases) {
  const collisions = new Set();
  const owners = new Map();
  for (const entry of cases) {
    if (!entry.sourceId || !entry.operationIdentity) continue;
    const key = groupingKey(entry.sourceId, entry.operationIdentity);
    if (owners.has(key) && owners.get(key) !== entry.sourceOperationId) collisions.add(key);
    else owners.set(key, entry.sourceOperationId);
  }
  return cases.map((entry) => {
    const key = entry.sourceId && entry.operationIdentity
      ? groupingKey(entry.sourceId, entry.operationIdentity)
      : null;
    if (key !== null && collisions.has(key)) {
      return { sourceOperationId: entry.sourceOperationId, expectation: "generation-failure", reason: "grouping-key-collision" };
    }
    if (!entry.operationIdentity) {
      return { sourceOperationId: entry.sourceOperationId, expectation: "generation-failure", reason: "publication-safe-operation-identity-unavailable" };
    }
    if (!entry.publicationSafeLocation) {
      return { sourceOperationId: entry.sourceOperationId, expectation: "generation-failure", reason: "publication-safe-source-location-unavailable" };
    }
    if (entry.sensitiveFeatureClass !== undefined) {
      if (!["routing-critical", "operation-defining"].includes(entry.sensitiveFeatureClass)) {
        return {
          sourceOperationId: entry.sourceOperationId,
          expectation: "generation-failure",
          reason: "canonical-sensitive-feature-class-unavailable"
        };
      }
      const sensitiveValue = typeof entry.sensitiveValue === "string" && entry.sensitiveValue !== ""
        ? entry.sensitiveValue
        : null;
      if (sensitiveValue !== null && entry.operationIdentity.includes(sensitiveValue)) {
        return {
          sourceOperationId: entry.sourceOperationId,
          expectation: "generation-failure",
          reason: "publication-safe-operation-identity-unavailable"
        };
      }
      if (sensitiveValue !== null && entry.publicationSafeLocation.includes(sensitiveValue)) {
        return {
          sourceOperationId: entry.sourceOperationId,
          expectation: "generation-failure",
          reason: "publication-safe-source-location-unavailable"
        };
      }
      return {
        sourceOperationId: entry.sourceOperationId,
        expectation: "emit-unsupported",
        reason: `sensitive ${entry.sensitiveFeatureClass} value withheld at ${entry.publicationSafeLocation}`,
        prohibitedValues: [entry.sensitiveValue].filter((value) => value !== undefined)
      };
    }
    return { sourceOperationId: entry.sourceOperationId, expectation: "emit-marker" };
  });
}

export function validateUnprojectedSourceExpectations(cases, { file = "source-input.json" } = {}) {
  const expectations = evaluateUnprojectedSourceExpectations(cases);
  const failures = expectations.filter((entry) => entry.expectation === "generation-failure");
  const diagnostics = failures.length === 0
    ? []
    : [diagnostic(
      "DM-IDX-008",
      file,
      1,
      `Unprojected source inputs contain ${failures.length} generation-stopping publication-safety or grouping conflict(s).`
    )];
  return {
    diagnostics,
    facts: { unprojectedSourceExpectations: expectations }
  };
}

function validOperationHeader(header) {
  if (!OPERATION_COLUMNS.every((column, index) => header[index] === column)) return false;
  let cursor = OPERATION_COLUMNS.length;
  if (header[cursor] === "Conventions") cursor += 1;
  return header.slice(cursor).every((column) => column.startsWith("x-"));
}

export function validChannelAddress(value) {
  if (typeof value !== "string" || value === "" || /[\t-\r ]/.test(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "{") {
      const end = value.indexOf("}", index + 1);
      if (end === -1) return false;
      const parameter = value.slice(index + 1, end);
      if (parameter === "" || /[/{\}\t-\r ]/.test(parameter)) return false;
      index = end;
    } else if (value[index] === "}") {
      return false;
    }
  }
  return true;
}

function parseSemicolonList(value, { names = false, ordered = false } = {}) {
  if (typeof value !== "string" || value === "") return null;
  const entries = value.split("; ");
  if (entries.join("; ") !== value
    || entries.some((entry) => entry === "")
    || new Set(entries).size !== entries.length
    || (names && entries.some((entry) => !ROUTING_NAME.test(entry)))
    || (ordered && entries.some((entry, index) => index > 0 && asciiCompare(entries[index - 1], entry) >= 0))) {
    return null;
  }
  return entries;
}

function parseMessages(value) {
  const entries = parseSemicolonList(value);
  if (entries === null) return null;
  const primary = [];
  const replies = [];
  let sawReply = false;
  for (const entry of entries) {
    if (entry.startsWith("reply:")) {
      sawReply = true;
      const name = entry.slice("reply:".length);
      if (!ROUTING_NAME.test(name)) return null;
      replies.push(name);
    } else {
      if (sawReply || !ROUTING_NAME.test(entry)) return null;
      primary.push(entry);
    }
  }
  const names = [...primary, ...replies];
  if (primary.length === 0
    || new Set(names).size !== names.length
    || primary.some((entry, index) => index > 0 && asciiCompare(primary[index - 1], entry) >= 0)
    || replies.some((entry, index) => index > 0 && asciiCompare(replies[index - 1], entry) >= 0)) {
    return null;
  }
  return entries;
}

function contextKindAllowed(relativePath, kind) {
  if (kind === "required") return relativePath.startsWith("workflows/");
  return relativePath.startsWith("workflows/") || relativePath.startsWith("references/");
}

function parseContextList(documentSet, file, line, value, kind) {
  if (value === "none") return { diagnostics: [], paths: [] };
  const diagnostics = [];
  const paths = typeof value === "string" ? value.split(", ") : [];
  const canonical = paths.length > 0
    && paths.join(", ") === value
    && new Set(paths).size === paths.length
    && paths.every((entry, index) => index === 0 || asciiCompare(paths[index - 1], entry) < 0);
  if (!canonical) {
    diagnostics.push(routingDiagnostic(
      "DM-IDX-005",
      file,
      line,
      "Context paths must be unique, ASCII-ordered, and separated by the exact ', ' delimiter."
    ));
    return { diagnostics, paths: [] };
  }

  const available = new Set(documentSet.paths);
  for (const relativePath of paths) {
    const parsed = parseDocsPath({ text: relativePath, file: file.path, line });
    if (parsed.value === null
      || parsed.value.kind !== "docs-root-relative"
      || parsed.value.sentinelCollision
      || !contextKindAllowed(relativePath, kind)
      || !available.has(relativePath)) {
      diagnostics.push(routingDiagnostic(
        "DM-IDX-005",
        file,
        line,
        kind === "required"
          ? "Required context paths must name existing workflow files."
          : "Supplemental context paths must name existing workflow or Reference Material files."
      ));
    }
  }
  return { diagnostics, paths };
}

function operationRow(documentSet, file, table, cells, rowIndex, channelPath) {
  const diagnostics = [];
  const line = table.startLine + rowIndex + 2;
  const [action, channel, operation, message, task, summary, required, supplemental] = cells;
  const conventionsCell = table.header[8] === "Conventions" ? cells[8] : "all";
  const conventionEntries = conventionsCell.split(", ");
  const conventions = conventionsCell === "all" || conventionsCell === "none"
    ? conventionsCell
    : conventionEntries.length > 0
      && conventionEntries.join(", ") === conventionsCell
      && new Set(conventionEntries).size === conventionEntries.length
      && conventionEntries.every((entry) => CONVENTION_HEADINGS.includes(entry))
      ? conventionEntries
      : null;
  const messages = parseMessages(message);
  const tasks = parseSemicolonList(task);
  if (!["SEND", "RECEIVE"].includes(action)
    || !validChannelAddress(channel)
    || !ROUTING_NAME.test(operation ?? "")
    || messages === null
    || tasks === null
    || conventions === null
    || summary === ""
    || tasks?.includes(summary)) {
    diagnostics.push(routingDiagnostic(
      "DM-IDX-004",
      file,
      line,
      "Operation rows require a valid action, channel, unique name, canonical messages and tasks, and non-empty summary."
    ));
  }

  const requiredContexts = parseContextList(documentSet, file, line, required, "required");
  const supplementalContexts = parseContextList(documentSet, file, line, supplemental, "supplemental");
  diagnostics.push(...requiredContexts.diagnostics, ...supplementalContexts.diagnostics);
  if (requiredContexts.paths.some((entry) => supplementalContexts.paths.includes(entry))) {
    diagnostics.push(routingDiagnostic(
      "DM-IDX-005",
      file,
      line,
      "A context path must not occur in both Required context and Supplemental context."
    ));
  }

  return {
    diagnostics,
    row: {
      action,
      channel,
      operation,
      messages: messages ?? [],
      tasks: tasks ?? [],
      summary,
      requiredContexts: requiredContexts.paths,
      supplementalContexts: supplementalContexts.paths,
      conventions,
      channelPath,
      indexPath: file.path,
      line
    }
  };
}

function parseChannelGroups(documentSet, file, lines) {
  const diagnostics = [];
  const rows = [];
  const nonEmpty = lines.filter((entry) => entry.text !== "");
  if (nonEmpty.length === 1 && nonEmpty[0].text === "none") {
    return { diagnostics, rows };
  }
  if (nonEmpty.length === 0 || nonEmpty[0].text === "none") {
    diagnostics.push(routingDiagnostic("DM-IDX-003", file, nonEmpty[0]?.line ?? file.identityLine, "Operations must be 'none' or non-empty channel subsections."));
    return { diagnostics, rows };
  }

  const headings = lines.filter((entry) => entry.text.startsWith("### "));
  if (headings.length === 0 || headings[0].line !== nonEmpty[0].line) {
    diagnostics.push(routingDiagnostic("DM-IDX-003", file, nonEmpty[0].line, "Flat Operations must begin with a channel-file level-three heading."));
    return { diagnostics, rows };
  }
  const seenChannelPaths = new Set();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextLine = headings[index + 1]?.line ?? Number.MAX_SAFE_INTEGER;
    const channelPath = heading.text.slice(4);
    const parsedPath = parseDocsPath({ text: channelPath, file: file.path, line: heading.line });
    if (parsedPath.value === null
      || parsedPath.value.kind !== "docs-root-relative"
      || !channelPath.startsWith("channels/")
      || !documentSet.paths.includes(channelPath)
      || seenChannelPaths.has(channelPath)) {
      diagnostics.push(routingDiagnostic(
        "DM-IDX-003",
        file,
        heading.line,
        "Each operation subsection must name one unique existing channel file."
      ));
    }
    seenChannelPaths.add(channelPath);

    const body = lines.filter((entry) => entry.line > heading.line && entry.line < nextLine);
    const tableStart = body.findIndex((entry) => entry.text !== "");
    if (tableStart === -1) {
      diagnostics.push(routingDiagnostic("DM-IDX-003", file, heading.line, "Each operation channel subsection requires a non-empty operation table."));
      continue;
    }
    const parsedTable = parsePipeTable(body.slice(tableStart).map((entry) => ({
      text: entry.text,
      file: file.path,
      line: entry.line
    })));
    if (parsedTable.value === null
      || !validOperationHeader(parsedTable.value.header)
      || parsedTable.value.rows.length === 0) {
      diagnostics.push(routingDiagnostic("DM-IDX-003", file, body[tableStart].line, "Operation tables require the canonical columns and at least one row."));
      continue;
    }
    const trailing = body.find((entry) => entry.line > parsedTable.value.endLine && entry.text !== "");
    if (trailing !== undefined) {
      diagnostics.push(routingDiagnostic("DM-IDX-003", file, trailing.line, "No content may follow an operation table inside its channel subsection."));
    }
    for (let rowIndex = 0; rowIndex < parsedTable.value.rows.length; rowIndex += 1) {
      const parsedRow = operationRow(
        documentSet,
        file,
        parsedTable.value,
        parsedTable.value.rows[rowIndex],
        rowIndex,
        channelPath
      );
      diagnostics.push(...parsedRow.diagnostics);
      rows.push(parsedRow.row);
    }
  }
  return { diagnostics, rows };
}

function validateUniqueOperations(rows) {
  const diagnostics = [];
  const owners = new Map();
  for (const row of rows) {
    if (owners.has(row.operation)) {
      diagnostics.push(diagnostic(
        "DM-IDX-004",
        row.indexPath,
        row.line,
        `Operation name '${row.operation}' also appears in '${owners.get(row.operation)}'.`
      ));
    } else {
      owners.set(row.operation, row.indexPath);
    }
  }
  return diagnostics;
}

function validateUniqueChannelSubsections(rows) {
  const diagnostics = [];
  const owners = new Map();
  const reported = new Set();
  for (const row of rows) {
    const owner = owners.get(row.channelPath);
    if (owner !== undefined && owner !== row.indexPath && !reported.has(row.channelPath)) {
      diagnostics.push(diagnostic(
        "DM-IDX-003",
        row.indexPath,
        row.line,
        `Channel file '${row.channelPath}' has operation subsections in both '${owner}' and '${row.indexPath}'.`
      ));
      reported.add(row.channelPath);
    } else if (owner === undefined) {
      owners.set(row.channelPath, row.indexPath);
    }
  }
  return diagnostics;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(asciiCompare);
}

function selectedRows(rows, dimension, value) {
  if (dimension === "task") return rows.filter((row) => row.tasks.includes(value));
  if (dimension === "message") return rows.filter((row) => row.messages.includes(value));
  return rows.filter((row) => row[dimension] === value);
}

function sourceTrace(rows, sourceResolutions, loadedIndexPaths, selector, falsePositiveIndexPaths = []) {
  const channelPaths = uniqueSorted(rows.map((row) => row.channelPath));
  const requiredContextPaths = uniqueSorted(rows.flatMap((row) => row.requiredContexts));
  const supplementalContextPaths = uniqueSorted(rows.flatMap((row) => row.supplementalContexts));
  const provenancePaths = ["CONVENTIONS.md", ...channelPaths, ...requiredContextPaths];
  const resolutions = provenancePaths
    .map((entry) => sourceResolutions[entry])
    .filter((entry) => entry !== undefined);
  return {
    selector,
    loadedIndexPaths: uniqueSorted(loadedIndexPaths),
    falsePositiveIndexPaths: uniqueSorted(falsePositiveIndexPaths),
    matchedOperationNames: uniqueSorted(rows.map((row) => row.operation)),
    loadedChannelPaths: channelPaths,
    requiredContextPaths,
    supplementalContextPaths,
    sourceIds: uniqueSorted(resolutions.flatMap((entry) => entry.requestedIds)),
    loadedSourceIndexPaths: uniqueSorted(resolutions.flatMap((entry) => entry.loadedPaths))
  };
}

function flatRetrieval(rows, sourceResolutions) {
  const exact = Object.fromEntries(ROUTING_DIMENSIONS.map((dimension) => [dimension, {}]));
  for (const dimension of ROUTING_DIMENSIONS) {
    const values = dimension === "task"
      ? rows.flatMap((row) => row.tasks)
      : dimension === "message"
        ? rows.flatMap((row) => row.messages)
        : rows.map((row) => row[dimension]);
    for (const value of uniqueSorted(values)) {
      const matches = selectedRows(rows, dimension, value);
      exact[dimension][value] = sourceTrace(matches, sourceResolutions, ["INDEX.md"], { [dimension]: value });
    }
  }
  return {
    exact,
    semanticFallback: sourceTrace(rows, sourceResolutions, ["INDEX.md"], null)
  };
}

function parseOrderedTasks(value) {
  if (typeof value !== "string" || value === "") return null;
  const tasks = value.split("; ");
  const valid = tasks.join("; ") === value
    && tasks.every((task) => task !== "")
    && new Set(tasks).size === tasks.length
    && tasks.every((task, index) => index === 0 || unicodeScalarCompare(tasks[index - 1], task) < 0);
  return valid ? tasks : null;
}

function parseRouteActions(value) {
  if (value === "SEND") return ["SEND"];
  if (value === "RECEIVE") return ["RECEIVE"];
  if (value === "SEND; RECEIVE") return ["SEND", "RECEIVE"];
  return null;
}

function validMessageRoutingValue(value) {
  if (typeof value !== "string" || value === "") return false;
  if (value.startsWith("reply:")) return ROUTING_NAME.test(value.slice("reply:".length));
  return ROUTING_NAME.test(value);
}

function validShardHeader(header) {
  return OPERATION_SHARD_COLUMNS.every((column, index) => header[index] === column)
    && header.slice(OPERATION_SHARD_COLUMNS.length).every((column) => column.startsWith("x-"));
}

function parseOperationShardRoutes(root, lines) {
  const diagnostics = [];
  const first = lines.findIndex((entry) => entry.text !== "");
  if (first === -1) {
    return {
      diagnostics: [routingDiagnostic("DM-IDX-006", root, root.identityLine ?? 1, "Operation Shards requires a non-empty routing table.")],
      routes: []
    };
  }
  const parsed = parsePipeTable(lines.slice(first).map((entry) => ({
    text: entry.text,
    file: root.path,
    line: entry.line
  })));
  if (parsed.value === null || !validShardHeader(parsed.value.header) || parsed.value.rows.length === 0) {
    return {
      diagnostics: [routingDiagnostic("DM-IDX-006", root, lines[first].line, "Operation Shards requires its canonical columns and at least one route.")],
      routes: []
    };
  }
  const trailing = lines.find((entry) => entry.line > parsed.value.endLine && entry.text !== "");
  if (trailing !== undefined) {
    diagnostics.push(routingDiagnostic(
      "DM-IDX-006",
      root,
      trailing.line,
      "No content may follow the root Operation Shards routing table."
    ));
  }

  const seenPaths = new Set();
  const routes = parsed.value.rows.map((cells, index) => {
    const line = parsed.value.startLine + index + 2;
    const route = {
      tasks: parseOrderedTasks(cells[0]),
      tasksSource: cells[0] ?? "",
      actions: parseRouteActions(cells[1]),
      actionsSource: cells[1] ?? "",
      firstChannel: cells[2] ?? "",
      lastChannel: cells[3] ?? "",
      firstOperation: cells[4] ?? "",
      lastOperation: cells[5] ?? "",
      firstMessage: cells[6] ?? "",
      lastMessage: cells[7] ?? "",
      summary: cells[8] ?? "",
      path: cells[9] ?? "",
      line,
      rows: []
    };
    const parsedPath = parseDocsPath({ text: route.path, file: root.path, line });
    const valid = route.tasks !== null
      && route.actions !== null
      && validChannelAddress(route.firstChannel)
      && validChannelAddress(route.lastChannel)
      && unicodeScalarCompare(route.firstChannel, route.lastChannel) <= 0
      && ROUTING_NAME.test(route.firstOperation)
      && ROUTING_NAME.test(route.lastOperation)
      && asciiCompare(route.firstOperation, route.lastOperation) <= 0
      && validMessageRoutingValue(route.firstMessage)
      && validMessageRoutingValue(route.lastMessage)
      && asciiCompare(route.firstMessage, route.lastMessage) <= 0
      && route.summary !== ""
      && parsedPath.value?.kind === "docs-root-relative"
      && !seenPaths.has(route.path);
    if (!valid) {
      diagnostics.push(routingDiagnostic(
        "DM-IDX-006",
        root,
        line,
        "Each Operation Shards route requires canonical tasks/actions, valid inclusive bounds, a summary, and a unique Details path."
      ));
    }
    seenPaths.add(route.path);
    return route;
  });
  return { diagnostics, routes };
}

function validateOperationShardStructure(file, markdown) {
  const firstHeading = markdown.headings[0];
  const structural = markdown.headings.filter((entry) => entry.level <= 2);
  const valid = firstHeading?.level === 1
    && firstHeading.text === "Messaging Operation Index"
    && structural.length === 2
    && structural[0] === firstHeading
    && structural[1]?.level === 2
    && structural[1]?.text === "Operations";
  if (!valid) {
    return [routingDiagnostic(
      "DM-IDX-006",
      file,
      firstHeading?.line ?? file.metadataLine + 1,
      "An operation-index shard must contain '# Messaging Operation Index' followed only by '## Operations'."
    )];
  }
  const preTitle = markdown.lines.find((entry) => (
    entry.line > file.metadataLine && entry.line < firstHeading.line && entry.text !== ""
  ));
  const titleBody = markdown.lines.find((entry) => (
    entry.line > firstHeading.line && entry.line < structural[1].line && entry.text !== ""
  ));
  if (preTitle !== undefined || titleBody !== undefined) {
    return [routingDiagnostic(
      "DM-IDX-006",
      file,
      preTitle?.line ?? titleBody.line,
      "An operation-index shard has no profile link, pre-title content, or title body."
    )];
  }
  return [];
}

function exactRouteTasks(rows) {
  return [...new Set(rows.flatMap((row) => row.tasks))].sort(unicodeScalarCompare);
}

function exactRouteActions(rows) {
  const actions = new Set(rows.map((row) => row.action));
  return ["SEND", "RECEIVE"].filter((action) => actions.has(action));
}

function routeBounds(rows, field, compare) {
  const values = rows.flatMap((row) => field === "messages" ? row.messages : [row[field]]).sort(compare);
  return [values[0], values.at(-1)];
}

function validateRouteAgainstRows(root, route) {
  if (route.rows.length === 0) {
    return [routingDiagnostic("DM-IDX-006", root, route.line, `Operation shard '${route.path}' must not be empty.`)];
  }
  const [firstChannel, lastChannel] = routeBounds(route.rows, "channel", unicodeScalarCompare);
  const [firstOperation, lastOperation] = routeBounds(route.rows, "operation", asciiCompare);
  const [firstMessage, lastMessage] = routeBounds(route.rows, "messages", asciiCompare);
  const matches = JSON.stringify(route.tasks) === JSON.stringify(exactRouteTasks(route.rows))
    && JSON.stringify(route.actions) === JSON.stringify(exactRouteActions(route.rows))
    && route.firstChannel === firstChannel
    && route.lastChannel === lastChannel
    && route.firstOperation === firstOperation
    && route.lastOperation === lastOperation
    && route.firstMessage === firstMessage
    && route.lastMessage === lastMessage;
  return matches ? [] : [routingDiagnostic(
    "DM-IDX-006",
    root,
    route.line,
    `Operation shard route '${route.path}' must equal its actual Tasks, Actions, and inclusive routing bounds.`
  )];
}

function loadOperationShards(documentSet, root, routes) {
  const diagnostics = [];
  const filesByPath = new Map(documentSet.files.map((file) => [file.path, file]));
  const rows = [];
  for (const route of routes) {
    const file = filesByPath.get(route.path);
    if (file === undefined) {
      diagnostics.push(routingDiagnostic("DM-IDX-006", root, route.line, `Operation shard '${route.path}' is missing from the document set.`));
      continue;
    }
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value === null) {
      diagnostics.push(routingDiagnostic("DM-IDX-006", file, scanned.diagnostics[0]?.line ?? 1, "Operation shard Markdown is structurally invalid."));
      continue;
    }
    const structureDiagnostics = validateOperationShardStructure(file, scanned.value);
    diagnostics.push(...structureDiagnostics);
    if (structureDiagnostics.length > 0) continue;
    const parsed = parseChannelGroups(documentSet, file, sectionLines(scanned.value, "Operations"));
    diagnostics.push(...parsed.diagnostics);
    route.rows = parsed.rows;
    diagnostics.push(...validateRouteAgainstRows(root, route));
    rows.push(...parsed.rows);
  }

  const listed = new Set(routes.map((route) => route.path));
  for (const file of documentSet.files) {
    if (listed.has(file.path)) continue;
    const scanned = scanMarkdown({ text: file.content, file: file.path });
    if (scanned.value?.headings[0]?.text === "Messaging Operation Index") {
      diagnostics.push(routingDiagnostic(
        "DM-IDX-006",
        file,
        scanned.value.headings[0].line,
        "Every operation-index shard must be listed exactly once in root Operation Shards."
      ));
    }
  }
  return { diagnostics, rows };
}

function valueInRoute(route, dimension, value) {
  if (dimension === "task") return route.tasks?.includes(value) ?? false;
  if (dimension === "action") return route.actions?.includes(value) ?? false;
  if (dimension === "channel") {
    return unicodeScalarCompare(route.firstChannel, value) <= 0
      && unicodeScalarCompare(value, route.lastChannel) <= 0;
  }
  if (dimension === "operation") {
    return asciiCompare(route.firstOperation, value) <= 0
      && asciiCompare(value, route.lastOperation) <= 0;
  }
  return asciiCompare(route.firstMessage, value) <= 0
    && asciiCompare(value, route.lastMessage) <= 0;
}

function shardedRetrieval(rows, routes, sourceResolutions) {
  const exact = Object.fromEntries(ROUTING_DIMENSIONS.map((dimension) => [dimension, {}]));
  for (const dimension of ROUTING_DIMENSIONS) {
    const values = dimension === "task"
      ? rows.flatMap((row) => row.tasks)
      : dimension === "message"
        ? rows.flatMap((row) => row.messages)
        : rows.map((row) => row[dimension]);
    const compare = dimension === "task" || dimension === "channel" ? unicodeScalarCompare : asciiCompare;
    for (const value of [...new Set(values)].sort(compare)) {
      const loadedRoutes = routes.filter((route) => valueInRoute(route, dimension, value));
      const matches = selectedRows(loadedRoutes.flatMap((route) => route.rows), dimension, value);
      const falsePositives = loadedRoutes
        .filter((route) => selectedRows(route.rows, dimension, value).length === 0)
        .map((route) => route.path);
      exact[dimension][value] = sourceTrace(
        matches,
        sourceResolutions,
        loadedRoutes.map((route) => route.path),
        { [dimension]: value },
        falsePositives
      );
    }
  }
  return {
    exact,
    semanticFallback: sourceTrace(rows, sourceResolutions, routes.map((route) => route.path), null)
  };
}

export function validateCoreRouting(documentSet, root, markdown, sourceFacts) {
  const form = markdown.headings.some((entry) => entry.level === 2 && entry.text === "Operation Shards")
    ? "sharded"
    : "flat";
  if (form === "sharded") {
    const routed = parseOperationShardRoutes(root, sectionLines(markdown, "Operation Shards"));
    const loaded = loadOperationShards(documentSet, root, routed.routes);
    return {
      diagnostics: [
        ...routed.diagnostics,
        ...loaded.diagnostics,
        ...validateUniqueChannelSubsections(loaded.rows),
        ...validateUniqueOperations(loaded.rows)
      ],
      facts: {
        operations: { form, rows: loaded.rows, shards: routed.routes },
        operationRetrieval: shardedRetrieval(
          loaded.rows,
          routed.routes,
          sourceFacts.sourceResolutions
        )
      }
    };
  }

  const parsed = parseChannelGroups(documentSet, root, sectionLines(markdown, "Operations"));
  const diagnostics = [
    ...parsed.diagnostics,
    ...validateUniqueChannelSubsections(parsed.rows),
    ...validateUniqueOperations(parsed.rows)
  ];
  return {
    diagnostics,
    facts: {
      operations: { form, rows: parsed.rows, shards: [] },
      operationRetrieval: flatRetrieval(parsed.rows, sourceFacts.sourceResolutions)
    }
  };
}
