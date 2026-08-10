import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeMediaType } from "../lib/media-type.mjs";

test("canonicalizes type, subtype, parameter names, order, and RFC empty entries", () => {
  const fixtures = [
    ["Application/Vnd.Example+JSON;Z=Last;a=First", "application/vnd.example+json;a=First;z=Last"],
    ["text/plain;note=Token", "text/plain;note=Token"],
    ["text/plain;note=\"Token\"", "text/plain;note=Token"],
    [String.raw`text/plain;note="a\ b"`, "text/plain;note=\"a b\""],
    ["text/plain;", "text/plain"],
    ["text/plain ; ;charset=utf-8; ", "text/plain;charset=utf-8"]
  ];

  for (const [source, expected] of fixtures) {
    assert.equal(canonicalizeMediaType(source), expected, source);
  }
});

test("rejects invalid parameter delimiters, duplicate names, malformed UTF-16, and trailing escapes", () => {
  const fixtures = [
    "text/plain;charset =utf-8",
    "text/plain;charset= utf-8",
    "text/plain;Charset=utf-8;charset=ascii",
    'text/plain;note="\uD800"',
    "text/plain;note=\"trailing\\"
  ];

  for (const source of fixtures) {
    assert.throws(() => canonicalizeMediaType(source), SyntaxError, source);
  }
});

test("parses quoted values as UTF-8 octets and reports their exact canonical byte lengths", () => {
  const multibyte = canonicalizeMediaType('application/json;title="雪: café"');
  assert.equal(multibyte, 'application/json;title="雪: café"');
  assert.equal(Buffer.byteLength(multibyte, "utf8"), 35);

  const paired = canonicalizeMediaType(String.raw`application/json;title="雪\é"`);
  assert.equal(paired, 'application/json;title="雪é"');
  assert.equal(Buffer.byteLength(paired, "utf8"), 30);
});

test("preserves canonically distinct Unicode normalization forms", () => {
  const composed = canonicalizeMediaType('application/json;title="é"');
  const decomposed = canonicalizeMediaType('application/json;title="é"');

  assert.equal(composed, 'application/json;title="é"');
  assert.equal(decomposed, 'application/json;title="é"');
  assert.notEqual(composed, decomposed);
  assert.equal(Buffer.byteLength(composed, "utf8"), 27);
  assert.equal(Buffer.byteLength(decomposed, "utf8"), 28);
});
