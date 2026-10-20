import { isDeepStrictEqual } from "node:util";
import { validateCompleteDocumentSet } from "./validators/complete.mjs";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const summary = (value) => typeof value === "string" && value.length > 0
  && value.trim() === value && !/[\r\n\t]/.test(value);
const groups = ["operationShards", "sourceShards"];

// Candidate publication policy, not an API fact or a general prose renderer.
// The caller has already validated the pair and its source bindings.
export function auditCompleteCatalogPolicy(policy, documentSet, options) {
  if (!record(policy) || !isDeepStrictEqual(Object.keys(policy).sort(), groups)) {
    return ["catalogSummaries must declare exactly sourceShards and operationShards."];
  }
  const core = validateCompleteDocumentSet(documentSet, options).facts.core;
  const routes = { sourceShards: core.sources.shards, operationShards: core.operations.shards };
  const issues = [];
  for (const group of groups) {
    const entries = policy[group];
    const valid = Array.isArray(entries) && entries.every((entry) => record(entry)
      && isDeepStrictEqual(Object.keys(entry).sort(), ["details", "summary"])
      && typeof entry.details === "string" && entry.details.length > 0 && summary(entry.summary))
      && new Set(entries.map((entry) => entry.details)).size === entries.length;
    if (!valid) {
      issues.push(`${group} requires unique details paths and explicit single-line summary strings.`);
      continue;
    }
    if (!isDeepStrictEqual(entries.map((entry) => entry.details).sort(),
      routes[group].map((route) => route.path).sort())) {
      issues.push(`${group} policy paths differ from projected shard paths.`);
    }
    for (const entry of entries) {
      const route = routes[group].find((route) => route.path === entry.details);
      if (route?.summary !== entry.summary) issues.push(`${group} ${entry.details} Summary differs from publication policy.`);
    }
  }
  return issues;
}
