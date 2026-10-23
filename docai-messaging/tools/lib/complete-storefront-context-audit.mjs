import { isDeepStrictEqual } from "node:util";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sameSet = (left, right) => isDeepStrictEqual([...left].sort(), [...right].sort());

// Behavior facts attach context selection to declared AsyncAPI owners; omission
// never establishes no required coordination in this finite candidate policy.
export function auditStorefrontContextSelection(behavior, asyncapi, contexts, rows, check, contextPaths) {
  const contracts = behavior.operationBehavior;
  const owners = Object.keys(asyncapi.operations);
  const validOwners = record(contracts) && sameSet(Object.keys(contracts), owners);
  check(validOwners, "storefront context selection owners");
  if (!validOwners) return;

  const sourcePaths = (ids, required) => {
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return null;
    const paths = [];
    for (const id of ids) {
      if (typeof id !== "string") return null;
      const workflow = Object.hasOwn(contexts.workflows ?? {}, id);
      const reference = Object.hasOwn(contexts.referenceMaterials ?? {}, id);
      if ((workflow && reference) || (!workflow && (required || !reference))) return null;
      const resolved = contextPaths[workflow ? "workflows" : "referenceMaterials"].get(id);
      if (resolved === undefined) return null;
      paths.push(resolved);
    }
    return paths;
  };
  for (const operation of owners) {
    const facts = contracts[operation];
    const required = sourcePaths(facts?.requiredContexts, true);
    const supplemental = sourcePaths(facts?.supplementalContexts, false);
    const valid = required !== null && supplemental !== null
      && required.every((path) => !supplemental.includes(path));
    check(valid, `storefront context selection ${operation} source contract`);
    if (!valid) continue;
    const row = rows.find((entry) => entry.operation === operation);
    check(row !== undefined && sameSet(row.requiredContexts, required)
      && sameSet(row.supplementalContexts, supplemental),
    `storefront context selection ${operation} routing`);
  }
}
