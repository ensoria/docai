import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { restampDocumentSet } from "../restamp-document-set.mjs";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const checkerPath = fileURLToPath(new URL("../check-complete-fixtures.mjs", import.meta.url));
const sourceCandidatePath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/focused/valid/operations-profile-path-parity-valid/",
  import.meta.url
));
const sourceManifestPath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/source/projection-input-manifest.json",
  import.meta.url
));
const defaultCandidatePath = fileURLToPath(new URL(
  "../../fixtures/complete-candidates/v0.17.1/",
  import.meta.url
));

function runChecker(arguments_ = []) {
  return spawnSync(process.execPath, [checkerPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
}

function directorySnapshot(directory, relative = "") {
  const snapshot = {};
  for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
    const entryPath = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      Object.assign(snapshot, directorySnapshot(directory, entryPath));
    } else {
      snapshot[entryPath] = fs.readFileSync(path.join(directory, entryPath));
    }
  }
  return snapshot;
}

function restampCandidate(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-checker-"));
  const candidatePath = path.join(temporaryRoot, "candidate");
  const manifestPath = path.join(temporaryRoot, "projection-input-manifest.json");
  fs.cpSync(sourceCandidatePath, candidatePath, { recursive: true });
  fs.copyFileSync(sourceManifestPath, manifestPath);
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  return { candidatePath, manifestPath };
}

function replaceExactlyOnce(filePath, from, to) {
  const source = fs.readFileSync(filePath, "utf8");
  assert.equal(source.split(from).length - 1, 1, `${from} must occur exactly once`);
  fs.writeFileSync(filePath, source.replace(from, to));
}

function copyVersionedCandidate(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-source-"));
  const candidatePath = path.join(temporaryRoot, "candidate");
  fs.cpSync(defaultCandidatePath, candidatePath, { recursive: true });
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  return candidatePath;
}

function rebindAndRestamp(candidatePath, sourceName) {
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const source = manifest.sources.find((entry) => entry.location === sourceName);
  assert.notEqual(source, undefined);
  source.sha256 = `sha256:${createHash("sha256")
    .update(fs.readFileSync(path.join(candidatePath, "source", sourceName)))
    .digest("hex")}`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
}

test("rejects candidate source bytes outside the manifest digest even when profiles agree", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  replaceExactlyOnce(
    path.join(candidatePath, "source", "complete-contexts.json"),
    "Publish the payload-free alpha control signal.",
    "Publish an altered payload-free alpha control signal."
  );
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /complete-contexts.*source digest/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects a restamped versioned candidate with a different generator identity", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.generator.id = "different-projector";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /generator identity/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects a manifest Sources revision that differs from the bound source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.sources.find((entry) => entry.sourceId === "complete-contexts").revision = "fixture-2";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /complete-contexts.*Sources.*Revision/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects an undeclared fifth source binding in the candidate manifest", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.sources.push({
    ...manifest.sources.find((entry) => entry.sourceId === "storefront-behavior"),
    sourceId: "unexpected-fifth-source"
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /unexpected source binding/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects matching profile Sources rows that disagree with the bound source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "indexes", "sources-contexts-behavior.md"),
      "| complete-contexts | behavior-configuration | none | none | none | complete-contexts.json | fixture-1 |",
      "| complete-contexts | behavior-configuration | none | none | none | complete-contexts.json | fixture-2 |"
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /complete-contexts.*Sources.*revision/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects an unrelated source_ref on a Sources shard after both profiles are restamped", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "indexes", "sources-asyncapi.md"),
      "source_refs: storefront-asyncapi-3.1.0",
      "source_refs: complete-contexts, storefront-asyncapi-3.1.0"
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /sources-asyncapi\.md.*source_refs/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [label, file, from, to, mismatch] of [
  ["primary Message identity", "complete-contexts.json", '"message": "a-message"',
    '"message": "a-renamed-message"', /a-operation.*Message/i],
  ["expanded Workflow precondition", "complete-contexts.json",
    "Caller-local alpha event data is validated", "Caller-local alpha event data is not validated",
    /alpha-delivery.*Preconditions/i],
  ["variant field meaning", "complete-representations.json",
    '"description": "Archival reason"', '"description": "Altered archival reason"',
    /r-untagged-operation.*variant/i],
  ["known absence", "complete-contexts.json",
    '"failureHandling": "none"', '"failureHandling": "unknown"',
    /failure handling/i],
  ["storefront operation summary", "storefront.asyncapi.json",
    '"summary": "Submit an order and receive its acceptance reply."',
    '"summary": "Submit a changed order and receive its acceptance reply."',
    /sendCreateOrder.*Summary/i]
]) {
  test(`rejects a restamped pair that disagrees with source ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", file), from, to);
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, mismatch);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [heading, from, to] of [
  ["Connection and Session",
    "Reconnect with bounded exponential backoff from 100 milliseconds to 10 seconds.",
    "Reconnect with bounded exponential backoff from 200 milliseconds to 10 seconds."],
  ["Data Representation", '"role": "constraint"', '"role": "annotation"'],
  ["Empty and Omitted Values",
    "Only fields not listed as required may be omitted.",
    "All fields may be omitted."],
  ["Rate Limits and Quotas", '"applies": false', '"applies": true']
]) {
  test(`rejects stale ${heading} after behavior source rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(
      path.join(candidatePath, "source", "storefront-behavior.json"), from, to
    );
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`CONVENTIONS.*${heading}`, "i"));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [heading, file, from, to] of [
  ["Environments", "storefront.asyncapi.json",
    '"host": "broker.example.invalid:9092"', '"host": "broker.changed.example.invalid:9092"'],
  ["Environments", "storefront-behavior.json",
    "Use the production server for this corpus scenario.",
    "Use the production server only for this corpus scenario."],
  ["Protocols and Bindings", "storefront-behavior.json",
    '"protocolVersion": "3.6.0"', '"protocolVersion": "3.7.0"'],
  ["Protocols and Bindings", "storefront.asyncapi.json",
    '"protocolVersion": "3.6.0"', '"protocolVersion": "3.7.0"'],
  ["Serialization", "storefront-behavior.json",
    '"wireMediaType": "application/json"',
    '"wireMediaType": "application/cloudevents+json"'],
  ["Serialization", "storefront.asyncapi.json",
    '"defaultContentType": "application/json"',
    '"defaultContentType": "application/cloudevents+json"']
]) {
  test(`rejects stale ${heading} after ${file} rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", file), from, to);
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`CONVENTIONS.*${heading}`, "i"));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const messageName of ["CreateOrder", "OrderAccepted"]) {
  test(`rejects Serialization when selected AsyncAPI ${messageName} content type differs`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    assert.notEqual(source.components.messages[messageName], undefined);
    source.components.messages[messageName].contentType = "application/cloudevents+json";
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Serialization/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Protocols and Bindings prose unsupported by either source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "and clients expose logical headers by their documented names.",
      "and clients expose logical headers by their documented names. All headers are encrypted."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Protocols and Bindings/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [label, file, mutate] of [
  ["behavior scheme", "storefront-behavior.json", (source) => {
    source.authentication.scheme = "changedOAuth";
  }],
  ["behavior credential acquisition", "storefront-behavior.json", (source) => {
    source.authentication.credentialAcquisition = "Obtain a token from a separate authorization service.";
  }],
  ["behavior credential rotation", "storefront-behavior.json", (source) => {
    source.authentication.credentialRotation = "Acquire a replacement token two minutes before expiry.";
  }],
  ["AsyncAPI token URL", "storefront.asyncapi.json", (source) => {
    source.operations.sendCreateOrder.security[0].flows.clientCredentials.tokenUrl
      = "https://auth.changed.example.invalid/oauth/token";
  }],
  ["AsyncAPI operation scope", "storefront.asyncapi.json", (source) => {
    source.operations.sendCreateOrder.security[0].scopes = ["orders:read"];
  }],
  ["behavior operation scope", "storefront-behavior.json", (source) => {
    source.authorization.sendCreateOrder = ["orders:read"];
  }]
]) {
  test(`rejects stale Authentication after ${label} rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", file);
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    mutate(source);
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Authentication/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Authentication prose unsupported by either source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "and acquire a replacement token before the current token expires.",
      "and acquire a replacement token before the current token expires. Share it across tenants."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Authentication/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [fact, from, to] of [
  ["retry action",
    "Negative-acknowledge retryable failures; reject non-retryable failures.",
    "Negative-acknowledge all failures; reject none."],
  ["maximum delivery attempts", '"maxDeliveryAttempts": 5', '"maxDeliveryAttempts": 6'],
  ["dead-letter channel", '"deadLetterChannel": "orders.dead-letter"',
    '"deadLetterChannel": "orders.changed-dead-letter"'],
  ["terminal action",
    "Publish the failed envelope and diagnostic code to the dead-letter channel.",
    "Publish only the diagnostic code to the dead-letter channel."]
]) {
  test(`rejects stale Error Handling after ${fact} source rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(
      path.join(candidatePath, "source", "storefront-behavior.json"), from, to
    );
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Error Handling/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Error Handling prose unsupported by the behavior source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "publish the failed envelope and diagnostic code to `orders.dead-letter`.",
      "publish the failed envelope and diagnostic code to `orders.dead-letter`. Discard every retry."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Error Handling/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [fact, file, from, to] of [
  ["behavior reply channel", "storefront-behavior.json",
    '"replyChannel": "orders.replies"', '"replyChannel": "orders.changed-replies"'],
  ["behavior correlation", "storefront-behavior.json",
    "The reply correlation-id equals the command correlation-id.",
    "The reply correlation-id differs from the command correlation-id."],
  ["behavior timeout", "storefront-behavior.json",
    '"timeout": "5 seconds"', '"timeout": "7 seconds"'],
  ["behavior timeout meaning", "storefront-behavior.json",
    "command outcome is unknown to the caller.", "command outcome is known to the caller."],
  ["AsyncAPI reply channel address", "storefront.asyncapi.json",
    '"address": "orders.replies"', '"address": "orders.changed-replies"']
]) {
  test(`rejects stale Request-Reply after ${fact} source rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", file), from, to);
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Request-Reply/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Request-Reply prose unsupported by either source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "the command outcome is unknown to the caller.",
      "the command outcome is unknown to the caller. Retry with a new correlation-id."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Request-Reply/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects matching Ordering prose that disagrees with the behavior source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "There is no ordering guarantee across distinct `orderId` values.",
      "There is an ordering guarantee across distinct `orderId` values."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Ordering/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects unsourced Data Representation prose after the format table", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      '| "date-time" | constraint | An RFC 3339 date-time string with an explicit offset. |',
      '| "date-time" | constraint | An RFC 3339 date-time string with an explicit offset. |\n\nAll formats are optional.'
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Data Representation/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [heading, from, to] of [
  ["Delivery Semantics",
    "A redelivery retains the original message-id.",
    "A redelivery retains the original message-id and sequence."],
  ["Idempotency and Deduplication",
    '"scope": "per storefront tenant"',
    '"scope": "per storefront region"']
]) {
  test(`rejects stale ${heading} after behavior source rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", "storefront-behavior.json"), from, to);
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`CONVENTIONS.*${heading}`, "i"));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Message Envelope prose unsupported by the behavior source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "Use `message-id` as the message identifier, `correlation-id` as the correlation identifier, and `reply-to` as the reply address.",
      "Use `message-id` as the message identifier, `correlation-id` as the correlation identifier, and `reply-to` as the reply address. All messages are encrypted."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Message Envelope/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("checks one whole-set complete full and compact pair without modifying it", (t) => {
  const { candidatePath } = restampCandidate(t);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    "Complete fixture check passed: 7 paths, full/compact pair equivalent.\n"
  );
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("checks the versioned complete candidate by default without modifying it", () => {
  const before = fs.existsSync(defaultCandidatePath)
    ? directorySnapshot(defaultCandidatePath)
    : null;

  const result = runChecker();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.match(
    result.stdout,
    /^Complete fixture check passed: \d+ paths, full\/compact pair equivalent\.\n$/
  );
  assert.notEqual(before, null, "the versioned complete candidate exists");
  assert.deepEqual(directorySnapshot(defaultCandidatePath), before);
});

test("rejects a restamped complete pair with a compact contract mismatch", (t) => {
  const { candidatePath, manifestPath } = restampCandidate(t);
  replaceExactlyOnce(
    path.join(candidatePath, "compact", "channels", "alpha.md"),
    "Documents the selected messaging operation.",
    "Documents a different selected messaging operation."
  );
  restampDocumentSet(path.join(candidatePath, "compact"), manifestPath, { write: true });
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /DM-PROFILE-003 compact\/channels\/alpha\.md:1 /);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects an invalid complete-checker argument count", () => {
  const result = runChecker(["first", "second"]);

  assert.equal(result.status, 1, result.stdout);
  assert.equal(
    result.stderr,
    "Usage: node docai-messaging/tools/check-complete-fixtures.mjs [candidate-root]\n"
  );
});

test("rejects a candidate root without both profile roots", (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-checker-"));
  fs.mkdirSync(path.join(temporaryRoot, "full"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const result = runChecker([temporaryRoot]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Complete candidate requires full and compact document-set roots/);
});
