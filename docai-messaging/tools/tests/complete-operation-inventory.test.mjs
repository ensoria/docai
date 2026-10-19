import assert from "node:assert/strict";
import test from "node:test";
import { collectCompleteOperationInventory } from "../lib/complete-operation-inventory.mjs";

function sources() {
  return [
    { operations: { control: {}, second: {} } },
    { representations: [{ operation: "record" }, { operation: "reuse" }] },
    { operations: { publish: {}, receive: {} } }
  ];
}

test("operation inventory derives the sorted source union without a fixed count", () => {
  assert.deepEqual(collectCompleteOperationInventory(...sources()), {
    operations: ["control", "publish", "receive", "record", "reuse", "second"], issues: []
  });
});

test("operation inventory ignores declaration ordering", () => {
  const inputs = sources();
  inputs[0].operations = { second: {}, control: {} };
  inputs[1].representations.reverse();
  inputs[2].operations = { receive: {}, publish: {} };
  assert.deepEqual(collectCompleteOperationInventory(...inputs), {
    operations: ["control", "publish", "receive", "record", "reuse", "second"], issues: []
  });
});

for (const [left, right] of [[0, 1], [0, 2], [1, 2]]) {
  test(`operation inventory rejects duplicate source owners ${left}/${right}`, () => {
    const inputs = sources();
    const name = left === 0 ? "control" : "record";
    if (right === 1) inputs[right].representations.push({ operation: name });
    else inputs[right].operations[name] = {};
    const result = collectCompleteOperationInventory(...inputs);
    assert.equal(result.issues.length, 1);
    assert.match(result.issues[0], /duplicate operation owner/);
  });
}

test("operation inventory rejects repeated representation declarations", () => {
  const inputs = sources();
  inputs[1].representations.push({ operation: "record" });
  assert.match(collectCompleteOperationInventory(...inputs).issues.join("\n"), /duplicate operation owner/);
});

for (const [label, mutate] of [
  ["missing context operations", (inputs) => { delete inputs[0].operations; }],
  ["array storefront operations", (inputs) => { inputs[2].operations = []; }],
  ["null representation collection", (inputs) => { inputs[1].representations = null; }],
  ["null representation entry", (inputs) => { inputs[1].representations[0] = null; }],
  ["non-string operation identity", (inputs) => { inputs[1].representations[0].operation = 1; }],
  ["empty operation identity", (inputs) => { inputs[0].operations[""] = {}; }]
]) {
  test(`operation inventory rejects ${label} without throwing`, () => {
    const inputs = sources();
    mutate(inputs);
    assert.match(collectCompleteOperationInventory(...inputs).issues.join("\n"), /source operation inventory/);
  });
}
