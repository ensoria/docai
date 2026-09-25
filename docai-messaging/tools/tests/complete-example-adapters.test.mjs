import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveTrustedCompleteExampleAdapters
} from "../lib/complete-example-adapters.mjs";
import { loadDocumentSet, validateDocumentSet } from "../lib/document-set.mjs";
import { restampDocumentSet } from "../restamp-document-set.mjs";

const candidatePath = fileURLToPath(new URL(
  "../../fixtures/complete-candidates/v0.17.1/",
  import.meta.url
));
const failureFixturePath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/focused/valid/failure-actions-and-shapes-valid/",
  import.meta.url
));

const mapping = {
  class: "payload-wire",
  ruleVersion: "complete-fixture-csv-1.0.0",
  target: "text/csv;charset=utf-8"
};

function manifest(overrides = {}) {
  return {
    docaiMessaging: "0.17.1",
    publicationPolicy: {
      id: "docai-messaging-complete-fixture-publication",
      version: "1.0.0"
    },
    adapters: [mapping],
    ...overrides
  };
}

test("resolves the exact trusted CSV mapping and normalizes full and compact examples", () => {
  const adapters = resolveTrustedCompleteExampleAdapters(manifest());

  assert.equal(adapters.length, 1);
  assert.deepEqual({
    adapterClass: adapters[0].adapterClass,
    target: adapters[0].target,
    ruleVersion: adapters[0].ruleVersion,
    fenceInfo: adapters[0].fenceInfo
  }, {
    adapterClass: "payload-wire",
    target: "text/csv;charset=utf-8",
    ruleVersion: "complete-fixture-csv-1.0.0",
    fenceInfo: "csv"
  });
  const expected = new Map([["event_id", "evt_03"], ["status", "created"]]);
  assert.deepEqual(
    adapters[0].decodeExample("event_id,status\n\"evt_03\",\"created\""),
    expected
  );
  assert.deepEqual(
    adapters[0].decodeExample("event_id,status\nevt_03,created"),
    expected
  );
});

test("does not trust a CSV rule outside its exact publication mapping", () => {
  assert.deepEqual(resolveTrustedCompleteExampleAdapters(manifest({
    docaiMessaging: "0.17.2"
  })), []);
  assert.deepEqual(resolveTrustedCompleteExampleAdapters(manifest({
    publicationPolicy: {
      id: "docai-messaging-complete-fixture-publication",
      version: "1.0.1"
    }
  })), []);
  assert.deepEqual(resolveTrustedCompleteExampleAdapters(manifest({
    adapters: [{ ...mapping, ruleVersion: "complete-fixture-csv-1.0.1" }]
  })), []);
  assert.deepEqual(resolveTrustedCompleteExampleAdapters(manifest({
    adapters: [mapping, { ...mapping }]
  })), []);
});

test("rejects CSV examples that do not decode to one unique-header record", () => {
  const [adapter] = resolveTrustedCompleteExampleAdapters(manifest());

  for (const source of [
    "event_id,event_id\nevt_03,created",
    "event_id,status\nevt_03",
    "event_id,status\n\"evt_03,created",
    "event_id,status\nevt_03,created\nextra,row"
  ]) {
    assert.throws(() => adapter.decodeExample(source), SyntaxError, source);
  }
});

test("restamps a document set with the trusted adapter declared by its explicit manifest", (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-csv-restamp-"));
  const documentRoot = path.join(temporaryRoot, "full");
  const manifestPath = path.join(temporaryRoot, "projection-input-manifest.json");
  fs.cpSync(path.join(candidatePath, "full"), documentRoot, { recursive: true });
  fs.copyFileSync(
    path.join(candidatePath, "source", "projection-input-manifest.json"),
    manifestPath
  );
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const channelPath = path.join(documentRoot, "channels", "representations.md");
  const source = fs.readFileSync(channelPath, "utf8");
  assert.equal(source.split('"evt_03","created"').length - 1, 1);
  fs.writeFileSync(channelPath, source.replace('"evt_03","created"', "evt_03,created"));

  const restamped = restampDocumentSet(documentRoot, manifestPath, { write: true });
  assert.equal(restamped.changed, true);
  const result = validateDocumentSet(loadDocumentSet(documentRoot), {
    wholeSet: true,
    exampleAdapters: resolveTrustedCompleteExampleAdapters(manifest())
  });
  assert.deepEqual(result.diagnostics, []);
});

test("applies an explicit example adapter to an inline failure-shape payload", () => {
  const documentSet = loadDocumentSet(failureFixturePath);
  const channel = documentSet.files.find((file) => file.path === "channels/failures.md");
  const from = [
    "**message_shape**: malformed-payload",
    "",
    "- Headers: none",
    "- Bindings: none",
    "#### Payload",
    "",
    "none"
  ].join("\n");
  const to = [
    "**message_shape**: malformed-payload",
    "",
    "- Headers: none",
    "- Bindings: none",
    "#### Payload",
    "",
    "**payload_presence**: always",
    "",
    "**media_type**: text/csv;charset=utf-8",
    "",
    "**payload_nullable**: no",
    "",
    "```csv",
    "event_id,status",
    "evt_03,created",
    "```",
    "",
    "| Field | Type | Presence | Nullable | Meaning |",
    "|---|---|---|---|---|",
    "| event_id | string | always | no | Synthetic event identifier |",
    "| status | string | always | no | Lifecycle status |"
  ].join("\n");
  assert.notEqual(channel, undefined);
  assert.equal(channel.content.split(from).length - 1, 1);
  channel.content = channel.content.replace(from, to);
  channel.bytes = Buffer.from(channel.content, "utf8");
  channel.identityLine += to.split("\n").length - from.split("\n").length;

  const result = validateDocumentSet(documentSet, {
    wholeSet: false,
    exampleAdapters: resolveTrustedCompleteExampleAdapters(manifest())
  });

  assert.deepEqual(result.diagnostics, []);
});
