import { isDeepStrictEqual } from "node:util";
import { collectCompleteOperationInventory } from "./complete-operation-inventory.mjs";

const contextId = "complete-contexts";
const representationId = "complete-representations";
const asyncapiId = "storefront-asyncapi-3.1.0";
const behaviorId = "storefront-behavior";
const registry = [contextId, representationId, asyncapiId, behaviorId].sort();
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Finite source authority shared by channel and operation-row provenance audits.
// Called only after the candidate's source-to-output comparisons succeed.
export function collectCompleteOperationContributors(sources, sourceIds) {
  const failure = (issues) => ({ issues, contributors: new Map(), operations: [] });
  if (!(sources instanceof Map) || !Array.isArray(sourceIds)
      || !isDeepStrictEqual([...sourceIds].sort(), registry)
      || !isDeepStrictEqual([...sources.keys()].sort(), registry)) {
    return failure(["source_refs contributors require the complete candidate source registry"]);
  }
  const contexts = sources.get(contextId);
  const representations = sources.get(representationId);
  const asyncapi = sources.get(asyncapiId);
  if (!record(sources.get(behaviorId)?.operationBehavior)) {
    return failure(["source_refs contributors require storefront behavior ownership"]);
  }
  const inventory = collectCompleteOperationInventory(contexts, representations, asyncapi);
  if (inventory.issues.length > 0) {
    return failure(inventory.issues.map((issue) => `source_refs contributors: ${issue}`));
  }
  const issues = Object.keys(asyncapi.operations)
    .filter((name) => !Object.hasOwn(sources.get(behaviorId).operationBehavior, name))
    .map((name) => `${name} source_refs contributors lack storefront behavior ownership`);
  if (issues.length > 0) return failure(issues);
  return {
    issues: [], operations: inventory.operations,
    contributors: new Map([
      ...Object.keys(contexts.operations).map((name) => [name, [contextId]]),
      ...representations.representations.map((entry) => [entry.operation, [representationId]]),
      ...Object.keys(asyncapi.operations).map((name) => [name, [asyncapiId, behaviorId]])
    ])
  };
}
