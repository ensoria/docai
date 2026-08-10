import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSetDigest,
  deriveShortId,
  parseIdentityTrailer
} from "../lib/identity.mjs";

const SET_DIGEST = "sha256:813b7cf8b838a5e3ba2fa494405bbf061bd1c6c0f693077d7349fd4c4d45dd2b";
const SET_ID = "b32:qe5xz6fyhcs6horpuskeaw57ay";
const PROJECTION_DIGEST = "sha256:17b223a4bf668cc9e2fcef034fb8c83e2655055de8736737619b76a4a1d666d0";
const PROJECTION_ID = "b32:c6zchjf7m2gmtyx454bu7ogihy";

function rootDocument({
  setId = SET_ID,
  projectionId = PROJECTION_ID,
  setDigest = SET_DIGEST,
  projectionDigest = PROJECTION_DIGEST,
  body = "# Messaging Index"
} = {}) {
  return [
    "> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all",
    "",
    body,
    "",
    `> docai-identity: set_id: ${setId} | projection_id: ${projectionId} | set_digest: ${setDigest} | projection_digest: ${projectionDigest}`,
    ""
  ].join("\n");
}

function childDocument({ setId = SET_ID, projectionId = PROJECTION_ID, body = "# Conventions" } = {}) {
  return [
    "> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all",
    "",
    body,
    "",
    `> docai-identity: set_id: ${setId} | projection_id: ${projectionId}`,
    ""
  ].join("\n");
}

test("derives the README short IDs from the first 128 digest bits", () => {
  assert.equal(deriveShortId(SET_DIGEST), SET_ID);
  assert.equal(deriveShortId(PROJECTION_DIGEST), PROJECTION_ID);
});

test("rejects a full digest outside the exact sha256 form", () => {
  for (const digest of [
    SET_DIGEST.slice(0, -1),
    SET_DIGEST.toUpperCase(),
    SET_DIGEST.replace("sha256:", "sha512:")
  ]) {
    assert.throws(() => deriveShortId(digest), /sha256/);
  }
});

test("computes the byte-exact length-prefixed single-file digest vector", () => {
  const digest = computeSetDigest([{ path: "INDEX.md", content: rootDocument() }]);
  assert.equal(digest, "sha256:623088f180a3aa24a6a93c239a569a57cbe7d089218c05be3eb6a58f7fdbb00d");
});

test("preserves UTF-8 BOM bytes in the direct byte-level set digest vector", () => {
  const bytes = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(rootDocument(), "utf8")
  ]);
  assert.equal(
    computeSetDigest([{ path: "INDEX.md", bytes }]),
    "sha256:b183fe4f857a3c903960c55a3246ba9982886465d6972687e9a18e71ecb64447"
  );
});

test("replaces only set identity handles with SELF before hashing", () => {
  const original = computeSetDigest([{ path: "INDEX.md", content: rootDocument() }]);
  const changedHandles = computeSetDigest([{
    path: "INDEX.md",
    content: rootDocument({
      setId: "b32:aaaaaaaaaaaaaaaaaaaaaaaaaa",
      setDigest: `sha256:${"0".repeat(64)}`
    })
  }]);
  const changedProjection = computeSetDigest([{
    path: "INDEX.md",
    content: rootDocument({ projectionId: "b32:aaaaaaaaaaaaaaaaaaaaaaaaaa" })
  }]);
  const changedBodyLookalike = computeSetDigest([{
    path: "INDEX.md",
    content: rootDocument({ body: "set_id: b32:aaaaaaaaaaaaaaaaaaaaaaaaaa" })
  }]);

  assert.equal(changedHandles, original);
  assert.notEqual(changedProjection, original);
  assert.notEqual(changedBodyLookalike, original);
});

test("sorts paths by ASCII bytes and binds file membership, names, and content", () => {
  const files = [
    { path: "INDEX.md", content: rootDocument() },
    { path: "channels/z.md", content: childDocument({ body: "# Z" }) },
    { path: "channels/A.md", content: childDocument({ body: "# A" }) }
  ];
  const baseline = computeSetDigest(files);

  assert.equal(computeSetDigest(files.toReversed()), baseline);
  assert.notEqual(computeSetDigest(files.slice(0, 2)), baseline);
  assert.notEqual(computeSetDigest([...files, {
    path: "workflows/new.md",
    content: childDocument({ body: "# New" })
  }]), baseline);
  assert.notEqual(computeSetDigest(files.map((file) => (
    file.path === "channels/A.md" ? { ...file, path: "channels/B.md" } : file
  ))), baseline);
  assert.notEqual(computeSetDigest(files.map((file) => (
    file.path === "channels/A.md" ? { ...file, content: file.content.replace("# A", "# Changed") } : file
  ))), baseline);
});

test("parses only the fixed root and non-root identity trailer shapes", () => {
  const child = parseIdentityTrailer(
    `> docai-identity: set_id: ${SET_ID} | projection_id: ${PROJECTION_ID}`,
    { root: false }
  );
  const root = parseIdentityTrailer(
    `> docai-identity: set_id: ${SET_ID} | projection_id: ${PROJECTION_ID} | set_digest: ${SET_DIGEST} | projection_digest: ${PROJECTION_DIGEST}`,
    { root: true }
  );

  assert.deepEqual(child.diagnostics, []);
  assert.deepEqual(root.diagnostics, []);
  assert.equal(root.value.set_digest, SET_DIGEST);
  assert.equal(parseIdentityTrailer(rootDocument().trimEnd().split("\n").at(-1), { root: false }).value, null);
  assert.equal(parseIdentityTrailer(childDocument().trimEnd().split("\n").at(-1), { root: true }).value, null);
});
