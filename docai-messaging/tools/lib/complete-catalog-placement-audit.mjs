import { isDeepStrictEqual } from "node:util";
import { parseDocsPath } from "./paths.mjs";
import { validateCompleteDocumentSet } from "./validators/complete.mjs";

const groups = ["operationShards", "sourceShards"];
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const member = (value) => typeof value === "string" && value.length > 0
  && value.trim() === value && !/[\r\n\t]/.test(value);
const detailsPath = (value) => typeof value === "string" && value.endsWith(".md")
  && parseDocsPath(value).value?.kind === "docs-root-relative";

// Finite publication decisions, not API facts or a general shard allocator.
// Ordinary pair validation and source-inventory closure run before this gate.
export function auditCompleteCatalogPlacement(policy, documentSet, options) {
  if (!record(policy) || !isDeepStrictEqual(Object.keys(policy).sort(), groups)) {
    return ["catalogPlacement must declare exactly sourceShards and operationShards."];
  }
  const core = validateCompleteDocumentSet(documentSet, options).facts.core;
  const catalogs = {
    sourceShards: { routes: core.sources.shards, rows: core.sources.rows,
      path: (row) => row.file, name: (row) => row.id },
    operationShards: { routes: core.operations.shards, rows: core.operations.rows,
      path: (row) => row.indexPath, name: (row) => row.operation }
  };
  const issues = [];
  for (const group of groups) {
    const entries = policy[group];
    const valid = Array.isArray(entries) && entries.length > 0 && entries.every((entry) => record(entry)
      && isDeepStrictEqual(Object.keys(entry).sort(), ["details", "members"])
      && detailsPath(entry.details) && Array.isArray(entry.members) && entry.members.length > 0
      && entry.members.every(member))
      && new Set(entries.map((entry) => entry.details)).size === entries.length;
    if (!valid) {
      issues.push(`${group} requires unique Details paths and non-empty explicit member arrays in closed records.`);
      continue;
    }
    const names = entries.flatMap((entry) => entry.members);
    if (new Set(names).size !== names.length) {
      issues.push(`${group} members must be unique within and across shards.`);
    }
    const catalog = catalogs[group];
    if (!isDeepStrictEqual(entries.map((entry) => entry.details).sort(),
      catalog.routes.map((route) => route.path).sort())) {
      issues.push(`${group} policy paths differ from projected shard paths.`);
    }
    for (const entry of entries) {
      const actual = catalog.rows.filter((row) => catalog.path(row) === entry.details).map(catalog.name).sort();
      if (!isDeepStrictEqual([...entry.members].sort(), actual)) {
        issues.push(`${group} ${entry.details} membership differs from publication policy.`);
      }
    }
  }
  return issues;
}
