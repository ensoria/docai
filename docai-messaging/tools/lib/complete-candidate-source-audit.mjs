import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateCompleteDocumentSet } from "./validators/complete.mjs";
import { validateCompleteFieldDefaults } from "./validators/complete-field-defaults.mjs";
import { validateCompleteSameAs } from "./validators/complete-same-as.mjs";
import { parsePipeTable } from "./tables.mjs";

const sourceFiles = new Map([
  ["complete-contexts", "complete-contexts.json"],
  ["complete-representations", "complete-representations.json"],
  ["storefront-asyncapi-3.1.0", "storefront.asyncapi.json"],
  ["storefront-behavior", "storefront-behavior.json"]
]);

function section(text, heading) {
  if (typeof text !== "string") return null;
  const lines = text.split("\n");
  const start = lines.indexOf(heading);
  if (start < 0) return null;
  const level = heading.match(/^#+/)[0].length;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#+ /.test(line) && line.match(/^#+/)[0].length <= level);
  return (end < 0 ? rest : rest.slice(0, end))
    .filter((line) => !line.startsWith("> docai-identity:"))
    .join("\n").trim();
}

function fieldTables(text) {
  if (typeof text !== "string") return [];
  return [...text.matchAll(/^\| Field \|[^\n]*\n(?:\|[^\n]*\n?)+/gm)].map(([table]) => {
    const parsed = parsePipeTable(table.trimEnd().split("\n").map((line, index) => ({
      text: line, file: "representation", line: index + 1
    })));
    return parsed.diagnostics.length === 0 ? parsed.value.rows : null;
  });
}

function expectedVariantRows(entry, variant) {
  const schema = variant.schema;
  if (schema?.type !== "object" || schema.additionalProperties !== false
      || !Array.isArray(schema.required) || !schema.properties) return null;
  const presence = entry.action === "SEND" ? "yes" : "always";
  const properties = Object.entries(schema.properties);
  if (properties.some(([name, field]) => !schema.required.includes(name)
      || field.type !== "string" || typeof field.description !== "string")) return null;
  return [
    ["$", "object", presence, "no", "Additional properties are forbidden."],
    ...properties.map(([name, field]) => [
      name, field.type, presence, "no",
      Object.hasOwn(field, "const")
        ? `\`const=${JSON.stringify(field.const)}\`; ${field.description}`
        : field.description
    ])
  ];
}

export function auditCompleteCandidateSources(candidatePath, documentSets, options) {
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.generator?.id !== "docai-messaging-complete-fixture-projector") {
    return ["generator identity differs from the complete candidate projection policy"];
  }

  const issues = [];
  const sources = new Map();
  for (const [id, filename] of sourceFiles) {
    const entries = manifest.sources?.filter((entry) => entry.sourceId === id) ?? [];
    if (entries.length !== 1 || entries[0].location !== filename) {
      issues.push(`${id}: expected exactly one ${filename} source binding`);
      continue;
    }
    const sourcePath = path.join(candidatePath, "source", filename);
    if (!fs.existsSync(sourcePath)) {
      issues.push(`${id}: source file is missing`);
      continue;
    }
    const bytes = fs.readFileSync(sourcePath);
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (entries[0].sha256 !== digest) {
      issues.push(`${id}: source digest differs from the projection manifest`);
      continue;
    }
    try {
      sources.set(id, JSON.parse(bytes.toString("utf8")));
    } catch {
      issues.push(`${id}: source JSON is invalid`);
    }
  }
  if (issues.length > 0) return issues;

  const contexts = sources.get("complete-contexts");
  const representations = sources.get("complete-representations");
  const asyncapi = sources.get("storefront-asyncapi-3.1.0");
  const behavior = sources.get("storefront-behavior");
  for (const [profile, set] of Object.entries(documentSets)) {
    const result = validateCompleteDocumentSet(set, options);
    const expanded = validateCompleteSameAs(validateCompleteFieldDefaults(set).expandedDocumentSet)
      .expandedDocumentSet;
    const check = (condition, label) => {
      if (!condition) issues.push(`${profile}: ${label} differs from authoritative source`);
    };
    const operationBody = (name) => {
      const definition = result.facts.core.operationDefinitions.byName[name];
      const file = expanded.files.find((entry) => entry.path === definition?.path);
      return section(file?.content, `## ${definition?.action} ${definition?.channel} (${name})`);
    };
    for (const file of set.files) {
      check(file.metadata.perspective === manifest.perspective.application,
        `${file.path} perspective`);
      check(file.metadata["docai-messaging"] === manifest.docaiMessaging,
        `${file.path} DocAI Messaging version`);
    }
    for (const [name, operation] of Object.entries(asyncapi.operations)) {
      const route = result.facts.core.operations.rows.find((row) => row.operation === name);
      const channelKey = operation.channel?.$ref?.split("/").at(-1);
      const messageKey = operation.messages?.[0]?.$ref?.split("/").at(-1);
      const messageRef = asyncapi.channels[channelKey]?.messages?.[messageKey]?.$ref;
      const messageName = messageRef?.split("/").at(-1);
      check(route?.action === operation.action.toUpperCase()
        && route?.channel === asyncapi.channels[channelKey]?.address,
      `${name} operation route`);
      check(route?.summary === operation.summary, `${name} Summary`);
      check(isDeepStrictEqual(result.facts.core.messageDefinitions.byOperation[name]
        ?.filter((message) => !message.reply).map((message) => message.name), [messageName]),
      `${name} Message identity`);
      check(operationBody(name)?.split("\n\n")[0] === behavior.operationBehavior[name]?.purpose,
        `${name} purpose`);
    }
    for (const [name, operation] of Object.entries(contexts.operations)) {
      const definition = result.facts.core.operationDefinitions.byName[name];
      const body = operationBody(name);
      check(definition?.action === operation.action && definition?.channel === operation.channel,
        `${name} operation route`);
      check(isDeepStrictEqual(result.facts.core.messageDefinitions.byOperation[name]?.map((m) => m.name),
        [operation.message]), `${name} Message identity`);
      check(section(body, "#### Payload") === operation.payload, `${name} Payload`);
    }
    for (const source of [contexts, representations]) {
      const entries = source.representations ?? Object.entries(source.operations)
        .map(([operation, facts]) => ({ operation, ...facts }));
      const policy = source.operationDefaults;
      for (const entry of entries) {
        const name = entry.operation;
        const contract = source.operationContracts?.[name] ?? entry;
        const body = operationBody(name);
        check(body?.split("\n\n")[0] === contract.purpose, `${name} purpose`);
        check(section(body, "### Behavior") === Object.entries(policy.behavior)
          .map(([key, value]) => `- ${key}: ${value}`).join("\n"), `${name} Behavior`);
        for (const [heading, value] of [
          ["### Operation Bindings", policy.operationBindings],
          ["#### Headers", policy.headers], ["#### Bindings", policy.messageBindings],
          ["### Reply", policy.reply], ["### Failure Handling", policy.failureHandling]
        ]) {
          check(value === "none" && section(body, heading) === value, `${name} ${heading.slice(4)}`);
        }
        check(section(body, "### Channel")
          === `- Parameters: ${policy.channelParameters}\n- Bindings: ${policy.channelBindings}`,
        `${name} Channel`);
      }
    }
    for (const id of ["alpha-delivery", "alpha-observability"]) {
      const source = contexts.workflows[id];
      const actual = result.facts.complete.workflowDefinitions
        .find((workflow) => workflow.path === `workflows/${id}.md`);
      check(actual?.introduction === source.purpose, `${id} introduction`);
      check(isDeepStrictEqual(actual?.sections.Preconditions.items, source.preconditions),
        `${id} Preconditions`);
      check(isDeepStrictEqual(actual?.sections.Steps.steps,
        source.steps.map((step, index) => `${step} -- ${source.stepAnnotations[index]}`)),
      `${id} Steps`);
      check(isDeepStrictEqual(actual?.sections["State Transitions"].rows, source.transitions),
        `${id} State Transitions`);
      check(isDeepStrictEqual(actual?.sections["Failure and Recovery"].items, source.failureRecovery),
        `${id} Failure and Recovery`);
    }
    for (const entry of representations.representations.filter((item) => item.variants)) {
      const actual = fieldTables(operationBody(entry.operation));
      check(actual.length === entry.variants.length, `${entry.operation} variant count`);
      for (const [index, variant] of entry.variants.entries()) {
        check(isDeepStrictEqual(actual[index], expectedVariantRows(entry, variant)),
          `${entry.operation} variant ${index} schema`);
      }
    }
    for (const entry of representations.representations.filter((item) => item.schema)) {
      check(entry.schema.additionalProperties === false
        && isDeepStrictEqual(fieldTables(operationBody(entry.operation))[0]?.[0],
          ["$", "object", "yes", "no", "Additional properties are forbidden."]),
      `${entry.operation} closed root`);
    }
  }
  return issues;
}
