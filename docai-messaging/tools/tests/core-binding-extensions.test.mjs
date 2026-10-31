import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { validateCoreDocumentSet } from "../lib/validators/core.mjs";
import { check, copyCandidate, profiles, replace, mutateSource } from "./helpers/complete-contributor-fixture.mjs";

const baseline = loadDocumentSet(fileURLToPath(new URL("../../fixtures/core/v0.17.1/valid/full/", import.meta.url)));
const extension = "**x-z**: note\n\n**x-a**: second note\n**x-a**: second note";
const scopes = [
  ["operation", "### Operation Bindings", "Operation Bindings", "DM-OP-004"],
  ["channel", "### Channel", "channel Bindings", "DM-OP-004"],
  ["message", "#### Bindings", "message Bindings OrderCreated", "DM-MSG-002"],
  ["reply channel", "#### Channel", "reply channel Bindings", "DM-REPLY-002"],
  ["reply message", "##### Bindings", "reply message Bindings OrderAccepted", "DM-MSG-002"]
];
function diagnostics(scope, body, { collapsed = false, send = false } = {}) {
  const set = structuredClone(baseline);
  const file = set.files.find((entry) => entry.path === "channels/orders.md");
  const [, heading] = scope;
  const channel = scope[0].endsWith("channel");
  const original = channel ? `${heading}\n\n- Parameters: none\n- Bindings: none` : `${heading}\n\nnone`;
  assert.ok(file.content.includes(original), scope[0]);
  const replacement = channel
    ? `${heading}\n\n- Parameters: none\n${collapsed ? "- Bindings: none" : `${"#".repeat(heading.indexOf(" ") + 1)} Bindings\n\n${body}`}`
    : `${heading}\n\n${body}`;
  const start = send ? file.content.indexOf("## SEND ") : 0;
  assert.ok(start >= 0);
  file.content = file.content.slice(0, start) + file.content.slice(start)
    .replace(original, collapsed ? `${replacement}\n\n${body}` : replacement);
  for (const entry of set.files) {
    if (entry === file || entry.path === "INDEX.md") {
      if (body.includes("**unknown**:")) {
        entry.metadata.knowledge = "requires-input";
        entry.content = entry.content.replace("knowledge: complete", "knowledge: requires-input");
      }
      if (body.includes("**unsupported**:")) {
        entry.metadata.coverage = "requires-source";
        entry.content = entry.content.replace("coverage: complete", "coverage: requires-source");
      }
    }
    entry.bytes = Buffer.from(entry.content);
    entry.identityLine = entry.content.split("\n").findIndex((line) => line.startsWith("> docai-identity:")) + 1;
  }
  return validateCoreDocumentSet(set).diagnostics;
}

const spacedTable = " | Protocol | Property | Value / Rule | \n |---|---|---| \n | test | key | value | ";
for (const scope of scopes.filter(([name]) => name === "message" || name === "reply message")) {
  for (const prefix of ["\t", "\u00a0"]) test(`${scope[0]}: rejects non-ASCII-space table indentation ${JSON.stringify(prefix)}`, () => {
    const body = spacedTable.replace(/^ /gm, prefix);
    assert.ok(diagnostics(scope, body).some((entry) => entry.ruleId === scope[3]));
  });
  for (const [variant, body] of [
    ["missing separator", spacedTable.replace(" |---|---|---| \n", "")],
    ["wrong columns", spacedTable.replace("Protocol", "Other")],
    ["empty row value", spacedTable.replace("| value |", "|  |")],
    ["unmarked unknown", spacedTable.replace("| value |", "| unknown |")]
  ]) test(`${scope[0]}: rejects space-prefixed ${variant}`, () => {
    assert.ok(diagnostics(scope, body).some((entry) => entry.ruleId === scope[3]));
  });
  test(`${scope[0]}: space-prefixed table preserves unknown marker correspondence`, () => {
    assert.deepEqual(diagnostics(scope, spacedTable.replace("| value |", "| unknown |")
      + "\n**unknown**: protocol value requires authoritative input\n**x-a**: note"), []);
  });
}
test("SEND Message: accepts space-prefixed Bindings table", () => {
  assert.deepEqual(diagnostics(scopes[2], spacedTable + "\n**x-a**: note", { send: true }), []);
});

test("binding extension baseline is valid", () => assert.deepEqual(validateCoreDocumentSet(baseline).diagnostics, []));
for (const scope of scopes) {
  const [name, , unit, rule] = scope;
  for (const [state, body] of [
    ["none", "none"],
    ["unknown", "unknown\n**unknown**: binding facts unavailable"],
    ["replacement", `**unsupported**: replaces ${unit}: custom protocol`]
  ]) {
    test(`${name}: trailing extensions preserve ${state}`, () => {
      assert.deepEqual(diagnostics(scope, body), [], "core state itself is valid");
      assert.deepEqual(diagnostics(scope, `${body}\n\n${extension}`), []);
    });
  }
  test(`${name}: leading deviations and trailing extensions retain scope`, () => {
    assert.deepEqual(diagnostics(scope, `**deviation**: a note\nnone\n${extension}`), []);
  });
  test(`${name}: ordered contiguous table extensions remain valid`, () => {
    assert.deepEqual(diagnostics(scope, "| Protocol | Property | Value / Rule |\n|---|---|---|\n| test | key | value |\n**x-a**: note\n**x-z**: note"), []);
  });
  for (const [placement, tail] of [
    ["reversed", "\n**x-z**: note\n**x-a**: note"],
    ["nonadjacent", "\n\n**x-a**: note"]
  ]) {
    test(`${name}: ASCII-space-prefixed table rejects ${placement} extension tail`, () => {
      const body = " | Protocol | Property | Value / Rule | \n |---|---|---| \n | test | key | value | " + tail;
      assert.ok(diagnostics(scope, body).some((entry) => entry.ruleId === rule));
    });
  }
  {
    test(`${name}: ASCII-space-prefixed table retains ordered adjacent extension tail`, () => {
      assert.deepEqual(diagnostics(scope, " | Protocol | Property | Value / Rule | \n |---|---|---| \n | test | key | value | \n**x-a**: note\n**x-z**: note"), []);
    });
  }
  for (const [nameSuffix, body] of [
    ["early extension", "**x-a**: note\nnone"],
    ["missing core", "**x-a**: note"],
    ["split unknown", "unknown\n**x-a**: note\n**unknown**: missing facts"],
    ["nonadjacent unknown", "unknown\n\n**unknown**: missing facts\n**x-a**: note"],
    ["wrong replacement", "**unsupported**: replaces other Bindings: custom protocol\n**x-a**: note"],
    ["additional core", "none\n**x-a**: note\nnone"],
    ["empty marker", "none\n**x-a**: "],
    ["unordered table markers", "| Protocol | Property | Value / Rule |\n|---|---|---|\n| test | key | value |\n**x-z**: note\n**x-a**: note"],
    ["nonadjacent table marker", "| Protocol | Property | Value / Rule |\n|---|---|---|\n| test | key | value |\n\n**x-a**: note"]
  ]) {
    test(`${name}: rejects ${nameSuffix}`, () => {
      assert.ok(diagnostics(scope, body).some((entry) => entry.ruleId === rule), JSON.stringify(diagnostics(scope, body)));
    });
  }
  if (name.endsWith("channel")) {
    test(`${name}: collapsed Bindings allow trailing extensions`, () => {
      assert.deepEqual(diagnostics(scope, extension, { collapsed: true }), []);
    });
    test(`${name}: collapsed Bindings reject core after extension`, () => {
      const result = diagnostics(scope, "**x-a**: note\nnone", { collapsed: true });
      assert.ok(result.some((entry) => entry.ruleId === rule), JSON.stringify(result));
    });
  }
}

for (const replyChannel of [false, true]) test(`Complete profiles: fresh identities, ordinary validation and read-only source gate (reply Channel extension=${replyChannel})`, (t) => {
  const directory = copyCandidate(t);
  for (const profile of profiles) {
    const file = path.join(directory, profile, "channels/orders.md");
    const original = fs.readFileSync(file, "utf8");
    let matches = 0;
    const changed = original.replace(/(?:^#{3,5} (?:Operation )?Bindings\n\nnone|^- Bindings: none)$/gm, (match) => {
      matches += 1;
      return `${match}\n\n${extension}`;
    });
    assert.equal(matches, 8, `${profile}: all primary and reply binding scopes`);
    const reply = "#### Channel\n\n- Parameters: none\n- Bindings: none";
    assert.equal(changed.split(`${reply}\n\n${extension}`).length - 1, 1);
    fs.writeFileSync(file, replyChannel ? changed : changed.replace(`${reply}\n\n${extension}`, reply));
  }
  check(directory, 0);
});

const emptyReplyChannel = "#### Channel\n\n- Parameters: none\n- Bindings: none";
for (const parameterHeaded of [false, true]) for (const bindingHeaded of [false, true]) {
  test(`Reply Channel source comparison: empty headed forms (${parameterHeaded}, ${bindingHeaded}) with trailing extensions`, (t) => {
    const directory = copyCandidate(t);
    const parameters = parameterHeaded ? "##### Parameters\n\nnone" : "- Parameters: none";
    const bindings = bindingHeaded ? "##### Bindings\n\nnone" : "- Bindings: none";
    for (const profile of profiles) replace(directory, `${profile}/channels/orders.md`, emptyReplyChannel,
      `#### Channel\n\n${parameters}\n\n${bindings}\n\n${extension}`);
    check(directory, 0);
  });
}
test("Reply Channel source comparison: ignores a full-only trailing extension", (t) => {
  const directory = copyCandidate(t);
  replace(directory, "full/channels/orders.md", emptyReplyChannel, `${emptyReplyChannel}\n\n${extension}`);
  check(directory, 0);
});
for (const field of ["parameters", "bindings"]) {
  test(`Reply Channel source comparison: trailing extension cannot hide source ${field}`, (t) => {
    const directory = copyCandidate(t);
    mutateSource(directory, "storefront.asyncapi.json", (source) => {
      const ref = source.operations.sendCreateOrder.reply.channel.$ref;
      const channel = ref.slice(2).split("/").reduce((value, key) => value[key], source);
      channel[field] = field === "bindings" ? { kafka: { bindingVersion: "0.5.0" } }
        : { tenant: { description: "Known tenant routing fact", enum: ["storefront"] } };
    });
    for (const profile of profiles) replace(directory, `${profile}/channels/orders.md`, emptyReplyChannel,
      `${emptyReplyChannel}\n\n${extension}`);
    check(directory, 1, /Reply Channel differs from authoritative source/);
  });
}
test("Reply Channel source comparison: trailing extension cannot hide projected bindings", (t) => {
  const directory = copyCandidate(t);
  for (const profile of profiles) replace(directory, `${profile}/channels/orders.md`, emptyReplyChannel,
    `#### Channel\n\n- Parameters: none\n\n##### Bindings\n\n${spacedTable}\n**x-a**: note`);
  check(directory, 1, /Reply Channel differs from authoritative source/);
});
for (const [heading, message, count] of [["####", "OrderCreated", 2], ["#####", "OrderAccepted", 1]]) {
  test(`Complete ${message}: space-prefixed Bindings are ordinary-valid but cannot invent a source contract`, (t) => {
    const directory = copyCandidate(t);
    for (const profile of profiles) {
      const file = path.join(directory, profile, "channels/orders.md");
      const content = fs.readFileSync(file, "utf8");
      const anchor = `${heading} Bindings\n\nnone\n\n${heading} Payload`;
      assert.equal(content.split(anchor).length - 1, count);
      fs.writeFileSync(file, content.replace(anchor,
        `${heading} Bindings\n\n${spacedTable}\n**x-a**: note\n\n${heading} Payload`));
    }
    check(directory, 1, new RegExp(`storefront Message ${message} Bindings differs from authoritative source`));
  });
}
