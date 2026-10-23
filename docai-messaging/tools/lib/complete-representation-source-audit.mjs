import { isDeepStrictEqual } from "node:util";
import { equalExactJson } from "./json-value.mjs";
import { findExampleAdapter } from "./validators/example-adapters.mjs";
import { canonicalRepresentationView } from "./validators/complete-profile-comparison.mjs";
import { extractSourceSection } from "./complete-source-sections.mjs";

const forms = new Map([
  ["r-csv-operation", "adapter-defined-structured"],
  ["r-json-original-operation", "structured-json"],
  ["r-json-reuse-operation", "structured-json"],
  ["r-raw-operation", "opaque-raw"],
  ["r-tagged-operation", "tagged-variants"],
  ["r-untagged-operation", "untagged-variants"]
]);
const schemaTarget = "application/vnd.aai.asyncapi+json;version=3.1.0";
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const onlyKeys = (value, allowed) => isRecord(value)
  && Object.keys(value).every((key) => allowed.includes(key));
const sortRows = (rows) => [...rows].sort((left, right) => (
  left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0
));

function schemaTable(schema, action) {
  if (!onlyKeys(schema, ["type", "additionalProperties", "required", "properties"])
      || schema.type !== "object" || schema.additionalProperties !== false
      || !isRecord(schema.properties)
      || !Array.isArray(schema.required) || new Set(schema.required).size !== schema.required.length
      || schema.required.some((name) => typeof name !== "string"
        || !Object.hasOwn(schema.properties, name))) return null;
  const required = (value) => action === "SEND" ? (value ? "yes" : "no")
    : (value ? "always" : "optional");
  const rows = [["$", "object", required(true), "no", "Additional properties are forbidden."]];
  for (const [name, field] of Object.entries(schema.properties)) {
    if (!/^[A-Za-z0-9_-]+$/.test(name)
        || !onlyKeys(field, ["type", "description", "const"])
        || field.type !== "string" || typeof field.description !== "string"
        || (Object.hasOwn(field, "const") && typeof field.const !== "string")) return null;
    let meaning = field.description;
    if (Object.hasOwn(field, "const")) {
      const value = JSON.stringify(field.const);
      const longest = [...value.matchAll(/`+/g)].reduce((length, match) => Math.max(length, match[0].length), 0);
      const delimiter = "`".repeat(longest + 1);
      meaning = `${delimiter}const=${value}${delimiter}; ${meaning}`;
    }
    rows.push([name, "string", required(schema.required.includes(name)), "no", meaning]);
  }
  return {
    header: ["Field", "Type", action === "SEND" ? "Required" : "Presence", "Nullable",
      action === "SEND" ? "Constraints / Meaning" : "Meaning"],
    rows: sortRows(rows)
  };
}

function payloadView(text, options) {
  if (typeof text !== "string") return null;
  const content = canonicalRepresentationView({
    path: "channels/representations.md", content: text
  }, 1, text.split("\n").length + 1, options);
  const isExample = (token) => typeof token === "object"
    && ["json-example", "adapter-example", "fence"].includes(token.type);
  return {
    tokens: content.filter((token) => !isExample(token)).map((token) => (
      token?.type === "table" ? { header: token.header, rows: sortRows(token.rows) } : token
    )),
    examples: content.filter(isExample)
  };
}

export function auditSyntheticRepresentations(source, exactSource, core, operationBody, options, check) {
  const entries = source.representations;
  check(Array.isArray(entries) && isDeepStrictEqual(entries.map((entry) => entry.operation).sort(),
    [...forms.keys()].sort()), "synthetic representation inventory");
  // Global source inventory owns declaration closure; placement policy owns files.
  const projected = [...forms.keys()].filter((name) =>
    Object.hasOwn(core.operationDefinitions.byName, name)).sort();
  check(isDeepStrictEqual(projected, [...forms.keys()].sort()), "projected representation inventory");
  const exactEntries = new Map((exactSource?.get("representations") ?? [])
    .map((entry) => [entry.get("operation"), entry]));
  for (const entry of entries ?? []) {
    const name = entry.operation;
    const form = forms.get(name);
    const variants = form === "tagged-variants" || form === "untagged-variants";
    const csv = form === "adapter-defined-structured";
    const raw = form === "opaque-raw";
    const keys = ["operation", "action", "channel", "message", "form", "mediaType", "task", "summary",
      entry.action === "SEND" ? "payloadRequired" : "payloadPresence"];
    if (raw) keys.push("description");
    else keys.push("payloadNullable", "schemaFormat", ...(variants ? ["variants",
      form === "tagged-variants" ? "discriminator" : "selectionRule"] : ["schema", "example"]));
    if (csv) keys.push("wireAdapter");
    const definition = core.operationDefinitions.byName[name];
    const messages = core.messageDefinitions.byOperation[name];
    check(form !== undefined && onlyKeys(entry, keys) && entry.form === form
      && definition?.action === entry.action && definition?.channel === entry.channel
      && isDeepStrictEqual(messages?.map((message) => [message.name, message.reply]), [[entry.message, false]]),
    `${name} representation identity/form`);
    const body = operationBody(name);
    const payload = extractSourceSection(body, "#### Payload");
    const actual = payloadView(payload, options);
    const expected = [entry.action === "SEND" ? `**payload_required**: ${entry.payloadRequired}`
      : `**payload_presence**: ${entry.payloadPresence}`, `**media_type**: ${entry.mediaType}`];
    if (raw) {
      check(typeof entry.description === "string" && entry.description.length > 0
        && isDeepStrictEqual(actual?.tokens, [...expected, entry.description])
        && actual?.examples.length === 0, `${name} representation raw contract`);
      continue;
    }
    check(entry.schemaFormat === schemaTarget && entry.payloadNullable === "no"
      && (csv ? entry.mediaType === "text/csv;charset=utf-8" : entry.mediaType === "application/json"),
    `${name} representation schema/wire target`);
    expected.push(`**payload_nullable**: ${entry.payloadNullable}`);
    const schemas = variants ? entry.variants : [entry];
    const sourceExact = exactEntries.get(name);
    const examples = variants ? sourceExact?.get("variants")?.map((variant) => variant.get("example"))
      : [sourceExact?.get("example")];
    if (form === "untagged-variants") expected.push(entry.selectionRule);
    check(!variants || (Array.isArray(schemas) && schemas.length > 0
      && (form !== "untagged-variants" || typeof entry.selectionRule === "string")),
    `${name} representation variant selection`);
    for (const [index, variant] of (Array.isArray(schemas) ? schemas : []).entries()) {
      if (variants) {
        const tagged = form === "tagged-variants";
        const marker = tagged ? `${entry.discriminator} = ${JSON.stringify(variant.value)}` : variant.label;
        expected.push(`**variant**: ${marker}`);
        check(onlyKeys(variant, [tagged ? "value" : "label", "schema", "example"])
          && (tagged ? Object.hasOwn(variant, "value")
            && variant.schema?.properties?.[entry.discriminator]?.const === variant.value
            : typeof variant.label === "string" && variant.label.length > 0),
        `${name} representation variant ${index} identity`);
      }
      const table = schemaTable(variant.schema, entry.action);
      expected.push(table);
      const tables = actual?.tokens.filter((token) => typeof token === "object");
      check(table !== null && isDeepStrictEqual(tables?.[index], table),
        `${name} representation ${variants ? `variant ${index} ` : ""}schema`);
    }
    check(isDeepStrictEqual(actual?.tokens, expected), `${name} representation contract`);
    const adapter = csv ? findExampleAdapter(options?.exampleAdapters, entry.mediaType, "csv") : null;
    if (csv) {
      check(adapter !== null && isDeepStrictEqual(entry.wireAdapter, {
        ruleVersion: adapter?.ruleVersion, fenceInfo: adapter?.fenceInfo,
        decodedValueModel: "one object from one unique header row and one data row"
      }), `${name} representation wire adapter`);
    }
    let examplesMatch = Array.isArray(examples) && examples.length > 0
      && actual?.examples.length === examples.length;
    if (examplesMatch) {
      examplesMatch = actual.examples.every((example, index) => (
        (csv ? example.type === "adapter-example" && adapter !== null
          && isDeepStrictEqual(example.adapter, {
            adapterClass: adapter.adapterClass, target: adapter.target, ruleVersion: adapter.ruleVersion
          }) : example.type === "json-example")
        && examples[index] !== undefined && equalExactJson(example.value, examples[index])
      ));
    }
    check(examplesMatch, `${name} representation example`);
  }
}
