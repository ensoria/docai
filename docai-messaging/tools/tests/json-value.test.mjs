import test from "node:test";
import assert from "node:assert/strict";
import { equalExactJson, parseExactJson } from "../lib/json-value.mjs";

function equal(left, right) {
  return equalExactJson(parseExactJson(left), parseExactJson(right));
}

test("canonicalizes JSON decimals without narrowing them to binary floating point", () => {
  assert.deepEqual(parseExactJson("-1200.00e+40"), {
    kind: "number",
    sign: -1,
    coefficient: "12",
    exponent: 42n
  });
  assert.equal(equal("1", "1.0"), true);
  assert.equal(equal("1", "1e0"), true);
});

test("distinguishes adjacent integers beyond IEEE 754 precision", () => {
  assert.equal(equal("9007199254740992", "9007199254740993"), false);
});

test("compares decimals with arbitrary exponents and magnitudes", () => {
  assert.equal(
    equal("1e1000000000000000000000000000000", "10e999999999999999999999999999999"),
    true
  );
  assert.equal(
    equal("1e1000000000000000000000000000000", "1e1000000000000000000000000000001"),
    false
  );
});

test("treats every spelling of negative zero as exact zero", () => {
  assert.equal(equal("-0", "0.000e-999999999999999999999999999999"), true);
});

test("compares objects independently of source member order", () => {
  assert.equal(equal('{"first":1,"second":[true,null]}', '{"second":[true,null],"first":1.0}'), true);
});

test("compares arrays element by element in source order", () => {
  assert.equal(equal('[1,"two"]', '["two",1]'), false);
});

test("rejects duplicate object names after exact JSON string decoding", () => {
  assert.throws(() => parseExactJson('{"name":1,"\\u006eame":2}'), SyntaxError);
});

test("does not normalize decoded strings or object member names", () => {
  assert.equal(equal('"é"', '"é"'), false);
  assert.equal(equal('{"é":1}', '{"é":1}'), false);
});

test("rejects malformed JSON instead of accepting a valid prefix", () => {
  for (const source of ["01", "[1,]", '{"a":1} trailing', '"line\nfeed"']) {
    assert.throws(() => parseExactJson(source), SyntaxError, source);
  }
});
