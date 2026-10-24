import { isDeepStrictEqual } from "node:util";
import { collectCompleteOperationInventory } from "./complete-operation-inventory.mjs";

const contextId = "complete-contexts";
const representationId = "complete-representations";
const asyncapiId = "storefront-asyncapi-3.1.0";
const behaviorId = "storefront-behavior";
const registry = [contextId, representationId, asyncapiId, behaviorId].sort();
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Finite contributor proof, after source-to-output fact comparisons succeed.
// Source ownership includes routing-only Task/Summary/context/Conventions facts;
// links do not import the referenced document's body contributors into this file.
export function auditStorefrontContributorClosure(sources, sourceIds, documentSet, coreFacts) {
  if (!(sources instanceof Map) || !Array.isArray(sourceIds)
      || !isDeepStrictEqual([...sourceIds].sort(), registry)
      || !isDeepStrictEqual([...sources.keys()].sort(), registry)) {
    return ["source_refs contributors require the complete candidate source registry"];
  }
  const contexts = sources.get(contextId);
  const representations = sources.get(representationId);
  const asyncapi = sources.get(asyncapiId);
  if (!record(sources.get(behaviorId)?.operationBehavior)) {
    return ["source_refs contributors require storefront behavior ownership"];
  }
  const inventory = collectCompleteOperationInventory(contexts, representations, asyncapi);
  if (inventory.issues.length > 0) {
    return inventory.issues.map((issue) => `source_refs contributors: ${issue}`);
  }
  const contributors = new Map([
    ...Object.keys(contexts.operations).map((name) => [name, [contextId]]),
    ...representations.representations.map((entry) => [entry.operation, [representationId]]),
    ...Object.keys(asyncapi.operations).map((name) => [name, [asyncapiId, behaviorId]])
  ]);
  const rows = coreFacts?.operations?.rows;
  const definitions = coreFacts?.operationDefinitions?.byName;
  if (!Array.isArray(rows) || !record(definitions) || !Array.isArray(documentSet?.files)) {
    return ["source_refs contributors require validated operation ownership"];
  }
  const issues = [];
  const targets = new Set();
  for (const name of Object.keys(asyncapi.operations)) {
    const matches = rows.filter((row) => row.operation === name);
    if (matches.length !== 1 || !Object.hasOwn(sources.get(behaviorId).operationBehavior, name)
        || typeof matches[0].channelPath !== "string"
        || definitions[name]?.path !== matches[0].channelPath) {
      issues.push(`${name} source_refs contributors have ambiguous routing/definition ownership`);
    } else targets.add(matches[0].channelPath);
  }
  if (issues.length > 0) return issues;

  const compare = (filePath, required) => {
    const ids = [...required].sort(); // Source IDs are ASCII by the validated registry.
    const expected = isDeepStrictEqual(ids, registry) ? "all" : ids.join(", ");
    const files = documentSet.files.filter((file) => file.path === filePath);
    if (files.length !== 1 || files[0].metadata?.source_refs !== expected) {
      issues.push(`${filePath} source_refs contributors must be ${expected}`);
    }
  };
  // The fifteen compared sections use behavior facts and AsyncAPI server,
  // security, identity and Message facts; the manifest is not a fifth source.
  compare("CONVENTIONS.md", new Set([asyncapiId, behaviorId]));
  for (const filePath of targets) {
    const required = new Set();
    const fileRows = rows.filter((row) => row.channelPath === filePath);
    const defined = Object.keys(definitions).filter((name) => definitions[name]?.path === filePath).sort();
    if (!isDeepStrictEqual(fileRows.map((row) => row.operation).sort(), defined)
        || new Set(defined).size !== fileRows.length
        || fileRows.some((row) => !contributors.has(row.operation))) {
      issues.push(`${filePath} source_refs contributors have unknown or inconsistent operation owners`);
      continue;
    }
    for (const row of fileRows) for (const id of contributors.get(row.operation)) required.add(id);
    compare(filePath, required);
  }
  return issues;
}
