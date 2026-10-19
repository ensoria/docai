import assert from "node:assert/strict";
import test from "node:test";
import { auditStorefrontContextSelection } from "../lib/complete-storefront-context-audit.mjs";

test("storefront context selection resolves a supplemental Reference Material ID", () => {
  const failures = [];
  auditStorefrontContextSelection({ operationBehavior: {
    receive: { requiredContexts: [], supplementalContexts: ["note"] }
  } }, { operations: { receive: {} } }, {
    workflows: {}, referenceMaterials: { note: {} }
  }, [{ operation: "receive", requiredContexts: [], supplementalContexts: ["references/note.md"] }],
  (condition, label) => { if (!condition) failures.push(label); });
  assert.deepEqual(failures, []);
});

test("storefront context selection compares path sets independently of source order", () => {
  const failures = [];
  auditStorefrontContextSelection({ operationBehavior: {
    receive: { requiredContexts: ["beta", "alpha"], supplementalContexts: ["note"] }
  } }, { operations: { receive: {} } }, {
    workflows: { alpha: {}, beta: {} }, referenceMaterials: { note: {} }
  }, [{ operation: "receive", requiredContexts: ["workflows/alpha.md", "workflows/beta.md"],
    supplementalContexts: ["references/note.md"] }],
  (condition, label) => { if (!condition) failures.push(label); });
  assert.deepEqual(failures, []);
});
