import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../lib/complete-example-adapters.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { validateCompleteFieldDefaults } from "../lib/validators/complete-field-defaults.mjs";
import { validateCompleteSameAs } from "../lib/validators/complete-same-as.mjs";
import { parsePipeTable } from "../lib/tables.mjs";

const root = fileURLToPath(new URL("../../fixtures/complete-candidates/v0.17.1/", import.meta.url));
const readSource = (name) => JSON.parse(fs.readFileSync(path.join(root, "source", name), "utf8"));
const contexts = readSource("complete-contexts.json");
const representations = readSource("complete-representations.json");
const storefrontBehavior = readSource("storefront-behavior.json");

// These assertions compare independent source facts with the parsed/materialized
// output, so equal omissions in full and compact cannot satisfy the audit.
function section(text, heading) {
  const lines = text.split("\n");
  const start = lines.indexOf(heading);
  assert.notEqual(start, -1, heading);
  const level = heading.match(/^#+/)[0].length;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#+ /.test(line) && line.match(/^#+/)[0].length <= level);
  return (end < 0 ? rest : rest.slice(0, end))
    .filter((line) => !line.startsWith("> docai-identity:"))
    .join("\n").trim();
}

function tables(text) {
  return [...text.matchAll(/^\| Field \|[^\n]*\n(?:\|[^\n]*\n?)+/gm)].map(([table]) => {
    const parsed = parsePipeTable(table.trimEnd().split("\n").map((text, i) => ({
      text, file: "representation", line: i + 1
    })));
    assert.deepEqual(parsed.diagnostics, []);
    return parsed.value.rows;
  });
}

for (const profile of ["full", "compact"]) {
  const set = loadDocumentSet(path.join(root, profile));
  const result = validateCompleteDocumentSet(set, loadTrustedCompleteExampleAdapterOptions(root, [set]));
  const expanded = validateCompleteSameAs(validateCompleteFieldDefaults(set).expandedDocumentSet)
    .expandedDocumentSet;
  const operationBody = (name) => {
    const definition = result.facts.core.operationDefinitions.byName[name];
    assert.ok(definition, name);
    const file = expanded.files.find((entry) => entry.path === definition.path);
    return section(file.content, `## ${definition.action} ${definition.channel} (${name})`);
  };

  test(`${profile} storefront reply purpose preserves the acceptance-versus-fulfillment boundary`, () => {
    const source = storefrontBehavior.operationBehavior.sendCreateOrder;
    assert.equal(operationBody("sendCreateOrder").split("\n\n")[0],
      `${source.purpose} ${source.reply}`);
  });

  test(`${profile} synthetic message identities and empty payloads have explicit source authority`, () => {
    assert.deepEqual(result.diagnostics, []);
    for (const [name, operation] of Object.entries(contexts.operations)) {
      assert.equal(typeof operation.message, "string", `${name} primary identity`);
      assert.equal(operation.payload, "none", `${name} known payload absence`);
      assert.deepEqual(result.facts.core.messageDefinitions.byOperation[name].map((m) => m.name),
        [operation.message]);
      assert.equal(section(operationBody(name), "#### Payload"), operation.payload);
    }
  });

  test(`${profile} synthetic operation absence and purpose follow an explicit scoped policy`, () => {
    for (const source of [contexts, representations]) {
      assert.ok(source.operationDefaults, `${source.sourceId} known-absence policy`);
      const policy = source.operationDefaults;
      const entries = source.representations ?? Object.entries(source.operations)
        .map(([operation, facts]) => ({ operation, ...facts }));
      for (const entry of entries) {
        const contract = source.operationContracts?.[entry.operation] ?? entry;
        assert.equal(typeof contract.purpose, "string", `${entry.operation} purpose`);
        const body = operationBody(entry.operation);
        assert.equal(body.split("\n\n")[0], contract.purpose);
        assert.equal(section(body, "### Behavior"), Object.entries(policy.behavior)
          .map(([key, value]) => `- ${key}: ${value}`).join("\n"));
        for (const [heading, value] of [
          ["### Operation Bindings", policy.operationBindings],
          ["#### Headers", policy.headers], ["#### Bindings", policy.messageBindings],
          ["### Reply", policy.reply], ["### Failure Handling", policy.failureHandling]
        ]) {
          assert.equal(value, "none", `${entry.operation} ${heading} authoritative absence`);
          assert.equal(section(body, heading), value);
        }
        assert.equal(section(body, "### Channel"),
          `- Parameters: ${policy.channelParameters}\n- Bindings: ${policy.channelBindings}`);
      }
    }
  });

  test(`${profile} expanded workflow coordination facts come from source`, () => {
    for (const id of ["alpha-delivery", "alpha-observability"]) {
      const source = contexts.workflows[id];
      assert.ok(source.preconditions, `${id} preconditions`);
      assert.ok(source.stepAnnotations, `${id} carried values`);
      assert.ok(source.transitions, `${id} state model`);
      assert.ok(source.failureRecovery, `${id} recovery`);
      assert.equal(source.stepAnnotations.length, source.steps.length);
      const actual = result.facts.complete.workflowDefinitions.find((w) => w.path === `workflows/${id}.md`);
      assert.equal(actual.introduction, source.purpose);
      assert.deepEqual(actual.sections.Preconditions.items, source.preconditions);
      assert.deepEqual(actual.sections.Steps.steps,
        source.steps.map((step, i) => `${step} -- ${source.stepAnnotations[i]}`));
      assert.deepEqual(actual.sections["State Transitions"].rows, source.transitions);
      assert.deepEqual(actual.sections["Failure and Recovery"].items, source.failureRecovery);
    }
  });

  test(`${profile} variant field contracts are explicit schemas rather than inferred examples`, () => {
    for (const entry of representations.representations.filter((r) => r.variants)) {
      assert.equal(entry.schemaFormat, "application/vnd.aai.asyncapi+json;version=3.1.0");
      const actual = tables(operationBody(entry.operation));
      assert.equal(actual.length, entry.variants.length);
      for (const [i, variant] of entry.variants.entries()) {
        assert.ok(variant.schema, `${entry.operation} variant ${i} schema`);
        const schema = variant.schema;
        assert.equal(schema.type, "object");
        assert.equal(schema.additionalProperties, false);
        const required = entry.action === "SEND" ? "yes" : "always";
        assert.deepEqual(actual[i], [
          ["$", "object", required, "no", "Additional properties are forbidden."],
          ...Object.entries(schema.properties).map(([name, field]) => {
            assert.ok(schema.required.includes(name));
            assert.equal(field.type, "string");
            assert.equal(typeof field.description, "string");
            const meaning = Object.hasOwn(field, "const")
              ? `\`const=${JSON.stringify(field.const)}\`; ${field.description}` : field.description;
            return [name, field.type, required, "no", meaning];
          })
        ]);
      }
    }
  });

  test(`${profile} projects closed decoded-object roots for CSV and reusable JSON`, () => {
    for (const entry of representations.representations.filter((r) => r.schema)) {
      assert.equal(entry.schema.additionalProperties, false);
      assert.deepEqual(tables(operationBody(entry.operation))[0][0],
        ["$", "object", "yes", "no", "Additional properties are forbidden."], entry.operation);
    }
  });

  test(`${profile} closed representation roots reject additional decoded properties`, () => {
    const csvRow = profile === "full" ? '"evt_03","created"' : "evt_03,created";
    const examples = [
      [`event_id,status\n${csvRow}`, `event_id,status,extra\n${csvRow},unexpected`],
      ['{"kind":"created","id":"evt_01"}', '{"kind":"created","id":"evt_01","extra":true}'],
      ['{"reason":"expired"}', '{"reason":"expired","extra":true}']
    ];
    for (const [before, after] of examples) {
      const mutated = loadDocumentSet(path.join(root, profile));
      const file = mutated.files.find((f) => f.path === "channels/representations.md");
      assert.equal(file.content.split(before).length, 2);
      file.content = file.content.replace(before, after);
      file.bytes = Buffer.from(file.content);
      const checked = validateCompleteDocumentSet(mutated, {
        ...loadTrustedCompleteExampleAdapterOptions(root, [mutated]), wholeSet: false
      });
      assert.deepEqual([...new Set(checked.diagnostics.map((d) => d.ruleId))], ["DM-MSG-005"]);
    }
  });
}
