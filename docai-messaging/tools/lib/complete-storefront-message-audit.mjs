import { isDeepStrictEqual } from "node:util";
import { equalExactJson, parseExactJson } from "./json-value.mjs";
import { scanMarkdown } from "./markdown.mjs";
import { parsePipeTable } from "./tables.mjs";

// This is the finite schema vocabulary used by this candidate, not a schema adapter.
const constraints = ["const", "format", "minimum", "minLength", "pattern", "minItems"];
const types = new Map([
  ["object", "object"], ["string", "string"], ["integer", "int"],
  ["number", "number"], ["boolean", "bool"]
]);

function schemaRows(schema, direction, headers = false) {
  const rows = new Map();
  const visit = (node, name, required, headerRoot = false) => {
    if (!(node instanceof Map)) return false;
    const type = node.get("type");
    const keys = ["type", "description", ...constraints];
    if (type === "object") keys.push("properties", "required", "additionalProperties");
    if (type === "array") keys.push("items");
    if ([...node.keys()].some((key) => !keys.includes(key))) return false;
    if (headerRoot && constraints.some((key) => node.has(key))) return false;
    if (node.has("format") && node.get("format") !== "date-time") return false;
    const itemType = node.get("items")?.get?.("type");
    const visibleType = type === "array" && types.has(itemType)
      ? `${types.get(itemType)}[]` : types.get(type);
    if (!visibleType) return false;
    if (!headerRoot) {
      rows.set(name, {
        cells: [name, visibleType, direction === "SEND"
          ? (required ? "yes" : "no") : (required ? "always" : "optional"), "no"],
        fragments: constraints.filter((key) => node.has(key)).map((key) => [key, node.get(key)]),
        closed: type === "object"
      });
    }
    if (type === "object") {
      const properties = node.get("properties");
      const requiredNames = node.get("required") ?? [];
      if (node.get("additionalProperties") !== false || !(properties instanceof Map)
          || !Array.isArray(requiredNames) || new Set(requiredNames).size !== requiredNames.length
          || requiredNames.some((key) => !properties.has(key))) return false;
      for (const [key, child] of properties) {
        // Candidate field names need no path escaping; new syntax requires a policy review.
        if (!/^[A-Za-z0-9_-]+$/.test(key)) return false;
        const childName = headerRoot || name === "$" ? key : `${name}.${key}`;
        if (!visit(child, childName, requiredNames.includes(key))) return false;
      }
    } else if (type === "array" && !visit(node.get("items"), `${name}[]`, true)) {
      return false;
    }
    return true;
  };
  return schema?.get?.("type") === "object" && visit(schema, "$", true, headers) ? rows : null;
}

function meaningParts(meaning) {
  const fragments = [];
  let rest = meaning;
  while (rest.startsWith("`")) {
    const match = rest.match(/^`([^`]+)`(?:; |$)/);
    if (match === null) return null;
    const equals = match[1].indexOf("=");
    if (equals < 1) return null;
    try {
      fragments.push([match[1].slice(0, equals), parseExactJson(match[1].slice(equals + 1))]);
    } catch {
      return null;
    }
    rest = rest.slice(match[0].length);
  }
  return { fragments, prose: rest };
}

function matchesTable(lines, expected, direction, firstColumn) {
  if (expected === null || !lines?.length) return false;
  const parsed = parsePipeTable(lines.map((text, index) => ({
    text, file: "channels/orders.md", line: index + 1
  })));
  const table = parsed.value;
  const header = [firstColumn, "Type", direction === "SEND" ? "Required" : "Presence",
    "Nullable", direction === "SEND" ? "Constraints / Meaning" : "Meaning"];
  return parsed.diagnostics.length === 0 && table?.endLine === lines.length
    && isDeepStrictEqual(table.header.slice(0, 5), header) && table.rows.length === expected.size
    && new Set(table.rows.map((row) => row[0])).size === expected.size
    && table.rows.every((row) => {
      const source = expected.get(row[0]);
      const parts = meaningParts(row[4]);
      return source !== undefined && parts !== null
        && isDeepStrictEqual(row.slice(0, 4), source.cells)
        && parts.fragments.length === source.fragments.length
        && parts.fragments.every(([key, value], index) => (
          key === source.fragments[index][0] && equalExactJson(value, source.fragments[index][1])
        ))
        && (!source.closed || parts.prose === "Additional properties are forbidden.");
    });
}

function messageSections(set, definition) {
  const file = set.files.find((entry) => entry.path === definition?.path);
  const markdown = file && scanMarkdown(file.content).value;
  const message = markdown?.headings.find((heading) => heading.line === definition?.line);
  if (!message) return {};
  const messageEnd = markdown.headings.find((heading) => (
    heading.line > message.line && heading.level <= message.level
  ))?.line ?? markdown.lines.length + 1;
  return Object.fromEntries(["Headers", "Payload"].map((name) => {
    const heading = markdown.headings.find((entry) => entry.line > message.line
      && entry.line < messageEnd && entry.level === message.level + 1 && entry.text === name);
    if (!heading) return [name, null];
    const end = markdown.headings.find((entry) => entry.line > heading.line
      && entry.level <= heading.level)?.line ?? messageEnd;
    return [name, markdown.lines.filter((line) => line.line > heading.line && line.line < end)
      .map((line) => line.text).join("\n").trim()];
  }));
}

export function auditStorefrontMessageContracts(source, set, definitions, check) {
  const messages = source?.get("components")?.get("messages");
  for (const [operation, name, reply] of [
    ["receiveOrderCreated", "OrderCreated", false],
    ["sendCreateOrder", "CreateOrder", false],
    ["sendCreateOrder", "OrderAccepted", true]
  ]) {
    const message = messages?.get(name);
    const definition = definitions.byOperation[operation]?.find((entry) => entry.reply === reply);
    const direction = definition?.direction;
    const sections = messageSections(set, definition);
    const headerRows = schemaRows(message?.get("headers"), direction, true);
    check(message?.get("name") === definition?.name
      && matchesTable(sections.Headers?.split("\n"), headerRows, direction, "Name"),
    `storefront Message ${name} Headers schema`);
    const payloadRows = schemaRows(message?.get("payload"), direction);
    const payload = sections.Payload && scanMarkdown(sections.Payload).value;
    const outside = payload?.lines.filter((line) => line.text !== ""
      && !payload.fences.some((fence) => line.line >= fence.startLine && line.line <= fence.endLine))
      .map((line) => line.text);
    const expectedMarkers = [direction === "SEND" ? "**payload_required**: yes"
      : "**payload_presence**: always",
    `**media_type**: ${message?.get("contentType") ?? source?.get("defaultContentType")}`,
    "**payload_nullable**: no"];
    check(isDeepStrictEqual(outside?.slice(0, 3), expectedMarkers)
      && matchesTable(outside?.slice(3), payloadRows, direction, "Field"),
    `storefront Message ${name} Payload schema`);
    const examples = message?.get("examples");
    const fence = payload?.fences[0];
    let exampleMatches = false;
    if (payload?.fences.length === 1 && fence.info === "json"
        && examples?.length === 1 && examples[0] instanceof Map && examples[0].has("payload")) {
      try {
        const rendered = payload.lines.slice(fence.startLine, fence.endLine - 1)
          .map((line) => line.text).join("\n");
        exampleMatches = equalExactJson(parseExactJson(rendered), examples[0].get("payload"));
      } catch {
        // The ordinary document validator owns invalid JSON; the audit cannot certify it.
      }
    }
    check(exampleMatches, `storefront Message ${name} Payload example`);
  }
}
