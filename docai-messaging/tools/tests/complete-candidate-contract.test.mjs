import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { auditCompleteCandidateSources } from "../lib/complete-candidate-source-audit.mjs";
import { auditStorefrontPrimaryParameters } from "../lib/complete-storefront-message-audit.mjs";
import { parseExactJson } from "../lib/json-value.mjs";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../lib/complete-example-adapters.mjs";
import { candidate, profiles, copyCandidate, mutateSource, replace, check }
  from "./helpers/complete-contributor-fixture.mjs";

const manifestPath = "source/projection-input-manifest.json";
const manifest = () => JSON.parse(fs.readFileSync(path.join(candidate, manifestPath), "utf8"));
const sources = () => new Map(manifest().sources.map(s => [s.sourceId,
  JSON.parse(fs.readFileSync(path.join(candidate, "source", s.location), "utf8"))]));
function changeManifest(directory, mutate) {
  const file = path.join(directory, manifestPath);
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  mutate(value);
  fs.writeFileSync(file, JSON.stringify(value));
}
function renameApplication(directory, label) {
  mutateSource(directory, "storefront-behavior.json", s => { s.perspective = label; });
  changeManifest(directory, m => { m.perspective.application = m.perspective.sourceApplication = label; });
  for (const p of profiles) for (const relative of fs.readdirSync(path.join(directory, p), { recursive: true })) {
    if (relative.endsWith(".md")) replace(directory, `${p}/${relative}`, "perspective: storefront-service", `perspective: ${label}`);
  }
}

for (const channel of ["orderCommands", "orderEvents"]) {
  for (const [label, value] of [["nonempty", { tenant: { description: "Tenant" } }],
    ["null", null], ["array", []], ["scalar", "none"]]) {
    test(`primary Parameters reject ${channel} ${label} despite static address`, (t) => {
      const directory = copyCandidate(t);
      mutateSource(directory, "storefront.asyncapi.json", (s) => { s.channels[channel].parameters = value; });
      check(directory, 1, /storefront.*Parameters/i);
    });
  }
}

const newManifestMutations = [
  ["missing unchecked authority", (m) => { m.precedence = m.precedence.filter(e => e.factDomain !== "api-identity"); }],
  ["duplicate unchecked authority", (m) => { m.precedence.push(m.precedence[0]); }],
  ["reversed authority", (m) => { m.precedence[0].sourceOrder.reverse(); }],
  ["mode", (m) => { m.perspective.mode = "invert-actions"; }],
  ["source application", (m) => { m.perspective.sourceApplication = "other-service"; }],
  ["counterpart", (m) => { m.counterpartMappings.push({ operation: "sendCreateOrder" }); }],
  ["override", (m) => { m.stableNameOverrides.push({ operation: "sendCreateOrder", name: "other" }); }],
  ["unknown setting", (m) => { m.resolutionOverride = true; }],
  ["nested unknown setting", (m) => { m.perspective.resolutionOverride = true; }],
  ["publication unknown setting", (m) => { m.publicationPolicy.resolutionOverride = true; }],
  ["manifest version", (m) => { m.manifestVersion = "9.0.0"; }],
  ["projector version", (m) => { m.generator.version = "9.0.0"; }]
];
for (const [label, mutate] of newManifestMutations) {
  test(`manifest contract rejects freshly stamped ${label}`, (t) => {
    const directory = copyCandidate(t);
    changeManifest(directory, mutate);
    check(directory, 1, /manifest contract/i);
  });
}
for (const index of [0, 1, 2, 3, 4, 6, 7]) {
  test(`manifest contract rejects non-CSV adapter rule drift at ${index}`, (t) => {
    const directory = copyCandidate(t);
    changeManifest(directory, m => { m.adapters[index].ruleVersion = "unreviewed-rule"; });
    check(directory, 1, /manifest contract.*adapter/i);
  });
}
test("manifest contract rejects a source perspective conflict", (t) => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront-behavior.json", s => { s.perspective = "other-service"; });
  check(directory, 1, /manifest contract.*perspective/i);
});
test("manifest contract rejects native adapter target drift with matching catalog", (t) => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront.asyncapi.json", s => { s.asyncapi = "3.0.0"; });
  changeManifest(directory, m => { m.sources.find(s => s.sourceId === "storefront-asyncapi-3.1.0").specification = "AsyncAPI 3.0.0"; });
  for (const p of profiles) replace(directory, `${p}/indexes/sources-asyncapi.md`, "AsyncAPI 3.1.0", "AsyncAPI 3.0.0");
  check(directory, 1, /manifest contract.*adapter/i);
});

const contract = await import("../lib/complete-manifest-contract.mjs").catch(() => ({}));
function shape(value) {
  assert.equal(typeof contract.auditCompleteManifestShape, "function");
  return contract.auditCompleteManifestShape(value);
}
for (const [label, mutate] of newManifestMutations) {
  test(`manifest shape detects ${label}`, () => {
    const m = manifest(); mutate(m); assert.ok(shape(m).length > 0);
  });
}
for (const domain of manifest().precedence.map(e => e.factDomain)) {
  for (const kind of ["missing", "duplicate", "unknown-source", "malformed"]) {
    test(`manifest shape rejects ${domain} ${kind}`, () => {
      const m = manifest(); const e = m.precedence.find(e => e.factDomain === domain);
      if (kind === "missing") m.precedence = m.precedence.filter(e => e.factDomain !== domain);
      if (kind === "duplicate") m.precedence.push(structuredClone(e));
      if (kind === "unknown-source") e.sourceOrder = ["uncataloged"];
      if (kind === "malformed") e.sourceOrder = null;
      assert.ok(shape(m).length > 0);
    });
  }
}
for (let index = 0; index < 8; index++) {
  for (const kind of ["missing", "duplicate", "rule", "target", "malformed"]) {
    test(`manifest shape rejects adapter ${index} ${kind}`, () => {
      const m = manifest();
      if (kind === "missing") m.adapters.splice(index, 1);
      if (kind === "duplicate") m.adapters.push(structuredClone(m.adapters[index]));
      if (kind === "rule") m.adapters[index].ruleVersion = "unreviewed";
      if (kind === "target") m.adapters[index].target = "unreviewed";
      if (kind === "malformed") m.adapters[index] = null;
      assert.ok(shape(m).length > 0);
    });
  }
}
for (const value of [null, [], {}, { sources: null }, { sources: [null] }]) {
  test(`manifest shape rejects malformed root ${JSON.stringify(value)}`, () => {
    assert.ok(shape(value).length > 0);
  });
}
test("manifest shape accepts reviewed values independent of declaration order", () => {
  const m = manifest(); m.sources.reverse(); m.adapters.reverse(); m.precedence.reverse();
  assert.deepEqual(shape(m), []);
});

test("candidate contract accepts the unchanged reviewed pair", t => { check(copyCandidate(t), 0); });
for (const channel of ["orderCommands", "orderEvents"]) {
  test(`primary Parameters accept an explicit empty map on ${channel}`, t => {
    const directory = copyCandidate(t);
    mutateSource(directory, "storefront.asyncapi.json", s => { s.channels[channel].parameters = {}; });
    check(directory, 0);
  });
}
test("primary Parameters accept headed known absence", t => {
  const directory = copyCandidate(t);
  for (const p of profiles) {
    const file = path.join(directory, p, "channels/orders.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8")
      .replace(/^(### Channel\n\n)- Parameters: none\n- Bindings: none/gm,
        "$1#### Parameters\n\nnone\n\n#### Bindings\n\nnone"));
  }
  check(directory, 0);
});
test("candidate contract accepts declaration order independent policy", t => {
  const directory = copyCandidate(t);
  changeManifest(directory, m => { m.sources.reverse(); m.precedence.reverse(); m.adapters.reverse(); });
  check(directory, 0);
});
test("candidate contract accepts a source-authorized application label change", t => {
  const directory = copyCandidate(t);
  renameApplication(directory, "renamed-storefront");
  check(directory, 0);
});
test("candidate contract accepts an aligned authoritative source fact update", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "complete-contexts.json", s => { s.operations["m-operation"].task = "middle updated task"; });
  for (const p of profiles) for (const file of ["INDEX.md", "indexes/operations-middle.md"]) {
    replace(directory, `${p}/${file}`, "middle task", "middle updated task");
  }
  check(directory, 0);
});
test("Reference source without final LF receives exactly one required final LF", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "complete-contexts.json", s => {
    const reference = s.referenceMaterials["middle-operations"];
    assert.ok(/[\r\n]$/.test(reference.rawContent));
    reference.rawContent = reference.rawContent.replace(/(?:\r?\n)+$/, "");
  });
  for (const p of profiles) replace(directory, `${p}/references/middle-operations.md`,
    "Café stays decomposed.\n\n", "Café stays decomposed.\n");
  check(directory, 0);
});
test("Reference rejects isolated removal of its source consumer", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "complete-contexts.json", s => { s.operations["m-operation"].supplementalContexts = []; });
  check(directory, 1, /context|Reference Material/i);
});
test("candidate contract preserves authoritative labels despite non-authority shadows", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront.asyncapi.json", s => { s.operations.receiveOrderCreated.task = "ignored shadow"; });
  mutateSource(directory, "storefront-behavior.json", s => { s.operationBehavior.receiveOrderCreated.summary = "Ignored shadow."; });
  check(directory, 0);
});
for (const [label, mutate] of [
  ["API identity", s => { s.schemaEvolution.logicalApi = "urn:conflicting:api"; }],
  ["API version", s => { s.schemaEvolution.contractVersion = "9.0.0"; }],
  ["protocol", s => { s.protocolsAndBindings.protocolVersion = "9.0.0"; }],
  ["authorization", s => { s.authorization.receiveOrderCreated = ["conflicting:scope"]; }],
  ["Reply", s => { s.requestReply.replyChannel = "other.reply"; }]
]) {
  test(`candidate contract rejects corroborating source ${label} conflict`, t => {
    const directory = copyCandidate(t);
    mutateSource(directory, "storefront-behavior.json", mutate);
    check(directory, 1, /authoritative source/i);
  });
}

for (const mutate of [
  m => { m.precedence.push({ factDomain: "unreviewed", sourceOrder: ["complete-contexts"] }); },
  m => { m.precedence = [null]; },
  m => { m.adapters = null; },
  m => { m.sources = [null]; },
  m => { m.sources[0].unreviewed = true; },
  m => { m.generator.unreviewed = true; },
  m => { m.publicationPolicy.version = "9.0.0"; }
]) {
  test(`manifest shape rejects unsupported settings ${mutate.toString()}`, () => {
    const m = manifest(); mutate(m); assert.ok(shape(m).length > 0);
  });
}
test("source contract rejects absent registries without throwing", () => {
  assert.ok(contract.auditCompleteManifestSources(manifest(), null).length > 0);
  assert.ok(contract.auditCompleteManifestSources(null, new Map()).length > 0);
  assert.ok(contract.auditCompleteManifestSources(manifest(), new Map()).length > 0);
});

test("manifest shape diagnoses a malformed non-string domain without coercion", () => {
  const m = manifest();
  m.precedence[0].factDomain = { toString: null };
  assert.ok(shape(m).length > 0);
});

test("manifest contract rejects a stale UTF-8 adapter after matching encoding prose changes", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront-behavior.json", s => {
    s.protocolsAndBindings.headerEncoding = "Kafka record headers encode each logical header as one base64 value.";
  });
  for (const p of profiles) replace(directory, `${p}/CONVENTIONS.md`,
    "Kafka record headers encode each logical header as one UTF-8 value",
    "Kafka record headers encode each logical header as one base64 value");
  check(directory, 1, /manifest contract.*header.encoding/i);
});

for (const [field, value] of [["protocol", "amqp"], ["headerEncoding", "Unknown encoding."],
  ["clientExposure", "Expose encoded bytes only."]]) {
  test(`source contract diagnoses unreviewed header adapter ${field}`, () => {
    const s = sources(); s.get("storefront-behavior").protocolsAndBindings[field] = value;
    assert.match(contract.auditCompleteManifestSources(manifest(), s).join("\n"), /header.encoding/);
  });
}
for (const sourceId of ["complete-contexts", "complete-representations", "storefront-asyncapi-3.1.0", "storefront-behavior"]) {
  for (const field of ["type", "specification"]) {
    test(`source contract rejects ${sourceId} binding ${field} drift`, () => {
      const m = manifest(); m.sources.find(e => e.sourceId === sourceId)[field] = "unreviewed";
      assert.match(contract.auditCompleteManifestSources(m, sources()).join("\n"), /binding type\/specification/);
    });
  }
}

test("source audit diagnoses a null manifest without an accidental TypeError", t => {
  const directory = copyCandidate(t);
  fs.writeFileSync(path.join(directory, manifestPath), "null");
  assert.match(auditCompleteCandidateSources(directory, {}, {}).join("\n"), /generator identity/);
});
for (const missing of ["operation", "channel", "unresolved reference"]) {
  test(`primary Parameters do not interpret ${missing} as absence`, () => {
    const source = parseExactJson(fs.readFileSync(path.join(candidate, "source/storefront.asyncapi.json"), "utf8"));
    if (missing === "operation") source.get("operations").delete("sendCreateOrder");
    if (missing === "channel") source.get("channels").delete("orderCommands");
    if (missing === "unresolved reference") source.get("operations").get("sendCreateOrder")
      .set("channel", new Map([["$ref", "#/channels/missing"]]));
    const set = loadDocumentSet(path.join(candidate, "full"));
    const options = loadTrustedCompleteExampleAdapterOptions(candidate, [set]);
    const { facts } = validateCompleteDocumentSet(set, options);
    const issues = [];
    auditStorefrontPrimaryParameters(source, set, facts.core, (ok, label) => { if (!ok) issues.push(label); });
    assert.deepEqual(issues, ["storefront operation sendCreateOrder primary Channel Parameters"]);
  });
}

for (const label of ["\u00a0storefront", "storefront\u00a0"]) {
  test(`application labels preserve non-ASCII edge whitespace ${JSON.stringify(label)}`, t => {
    const directory = copyCandidate(t); renameApplication(directory, label); check(directory, 0);
  });
}
for (const label of ["", " storefront", "storefront ", null]) {
  test(`application labels reject invalid ASCII boundary ${JSON.stringify(label)}`, () => {
    const m = manifest(); m.perspective.application = m.perspective.sourceApplication = label;
    assert.match(shape(m).join("\n"), /perspective/);
  });
}
test("wire adapter rejects source/output UTF-16 agreement under the unchanged UTF-8 rule", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront-behavior.json", s => { s.serialization.encoding = "UTF-16 JSON"; });
  for (const p of profiles) replace(directory, `${p}/CONVENTIONS.md`, "Use UTF-8 JSON", "Use UTF-16 JSON");
  check(directory, 1, /manifest contract.*payload.wire/i);
});
test("wire adapter rejects an exact source target change without a descriptor change", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront.asyncapi.json", s => {
    s.defaultContentType = "application/vnd.order+json";
    for (const m of Object.values(s.components.messages)) m.contentType = "application/vnd.order+json";
  });
  mutateSource(directory, "storefront-behavior.json", s => { s.serialization.wireMediaType = "application/vnd.order+json"; });
  for (const p of profiles) for (const file of ["CONVENTIONS.md", "channels/orders.md"]) {
    const f = path.join(directory, p, file);
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replaceAll("application/json", "application/vnd.order+json"));
  }
  check(directory, 1, /manifest contract.*payload.wire/i);
});
test("wire adapter rejects null selected contentType rather than silently using a default", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront.asyncapi.json", s => { s.components.messages.CreateOrder.contentType = null; });
  check(directory, 1, /CONVENTIONS.*Serialization/i);
});
test("wire target guard resolves omitted contentType without broadening the source renderer", () => {
  const s = sources();
  for (const m of Object.values(s.get("storefront-asyncapi-3.1.0").components.messages)) delete m.contentType;
  assert.deepEqual(contract.auditCompleteManifestSources(manifest(), s), []);
});
test("wire adapter does not require support for an unused source component", t => {
  const directory = copyCandidate(t);
  mutateSource(directory, "storefront.asyncapi.json", s => {
    s.components.messages.Unused = { name: "Unused", contentType: "application/unmapped", payload: {} };
  });
  check(directory, 0);
});
