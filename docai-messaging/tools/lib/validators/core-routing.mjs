import { diagnostic } from "../diagnostics.mjs";
import { scanMarkdown } from "../markdown.mjs";
import { parseDocsPath } from "../paths.mjs";
import { parsePipeTable } from "../tables.mjs";

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

function validOperationHeader(header) {
  if (!OPERATION_COLUMNS.every((column, index) => header[index] === column)) return false;
  let cursor = OPERATION_COLUMNS.length;
  if (header[cursor] === "Conventions") cursor += 1;
  return header.slice(cursor).every((column) => column.startsWith("x-"));
}

function validChannelAddress(value) {
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
  const messages = parseMessages(message);
  const tasks = parseSemicolonList(task);
  if (!["SEND", "RECEIVE"].includes(action)
    || !validChannelAddress(channel)
    || !ROUTING_NAME.test(operation ?? "")
    || messages === null
    || tasks === null
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
