import assert from "node:assert/strict";
import test from "node:test";
import { auditStorefrontContextSelection } from "../lib/complete-storefront-context-audit.mjs";

test("storefront context selection resolves a supplemental Reference Material ID", () => {
  const failures = [];
  auditStorefrontContextSelection({ operationBehavior: {
    receive: { requiredContexts: [], supplementalContexts: ["note"] }
  } }, { operations: { receive: {} } }, {
    workflows: {}, referenceMaterials: { note: {} }
  }, [{ operation: "receive", requiredContexts: [], supplementalContexts: ["references/relocated-note.md"] }],
  (condition, label) => { if (!condition) failures.push(label); }, {
    workflows: new Map(), referenceMaterials: new Map([["note", "references/relocated-note.md"]])
  });
  assert.deepEqual(failures, []);
});

test("storefront context selection compares path sets independently of source order", () => {
  const failures = [];
  auditStorefrontContextSelection({ operationBehavior: {
    receive: { requiredContexts: ["beta", "alpha"], supplementalContexts: ["note"] }
  } }, { operations: { receive: {} } }, {
    workflows: { alpha: {}, beta: {} }, referenceMaterials: { note: {} }
  }, [{ operation: "receive", requiredContexts: ["workflows/first.md", "workflows/second.md"],
    supplementalContexts: ["references/note.md"] }],
  (condition, label) => { if (!condition) failures.push(label); }, {
    workflows: new Map([["alpha", "workflows/first.md"], ["beta", "workflows/second.md"]]),
    referenceMaterials: new Map([["note", "references/note.md"]])
  });
  assert.deepEqual(failures, []);
});
