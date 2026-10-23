import { isDeepStrictEqual } from "node:util";
import { parseDocsPath } from "./paths.mjs";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const groups = ["referenceMaterials", "workflows"];
const text = (value) => typeof value === "string" && value.length > 0
  && value.trim() === value && !/[\r\n\t]/.test(value);
const sameSet = (left, right) => isDeepStrictEqual([...left].sort(), [...right].sort());

// Compile source-bound publication decisions once per audit, never from output.
// No ID-derived default or display-label fallback is permitted.
export function resolveCompleteContextPlacement(policy, sources) {
  const fail = (message) => ({ paths: null, issues: [message] });
  if (!record(policy) || !isDeepStrictEqual(Object.keys(policy).sort(), groups)) {
    return fail("contextPlacement must declare exactly workflows and referenceMaterials.");
  }
  const owners = { workflows: new Set(), referenceMaterials: new Set() };
  for (const [index, source] of sources.entries()) {
    if (index === 0 && !record(source.workflows)) return fail("Workflow labels source registry must be a record.");
    for (const group of groups) {
      const registry = source[group] ?? {};
      if (!record(registry)) return fail(`contextPlacement ${group} source registry must be a record.`);
      for (const id of Object.keys(registry)) {
        if (!text(id) || owners.workflows.has(id) || owners.referenceMaterials.has(id)) {
          return fail("contextPlacement has an invalid or ambiguous source context owner.");
        }
        owners[group].add(id);
      }
    }
  }
  const paths = { workflows: new Map(), referenceMaterials: new Map() };
  const seenPaths = new Set();
  for (const group of groups) {
    const entries = policy[group];
    const directory = group === "workflows" ? "workflows/" : "references/";
    if (!Array.isArray(entries) || !entries.every((entry) => record(entry)
      && isDeepStrictEqual(Object.keys(entry).sort(), ["details", "id"])
      && text(entry.id) && typeof entry.details === "string"
      && entry.details.startsWith(directory) && entry.details.endsWith(".md")
      && parseDocsPath(entry.details).value?.kind === "docs-root-relative")) {
      return fail(`contextPlacement ${group} requires closed owner/path records of the correct file kind.`);
    }
    for (const { id, details } of entries) {
      if (paths[group].has(id) || seenPaths.has(details)) {
        return fail(`contextPlacement ${group} owners and paths must be unique.`);
      }
      paths[group].set(id, details);
      seenPaths.add(details);
    }
    if (!sameSet(paths[group].keys(), owners[group])) {
      return fail(`contextPlacement ${group} owners differ from the source registry.`);
    }
  }
  return { paths, issues: [] };
}

export function auditCompleteContextPaths(paths, documentSet, complete) {
  const issues = [];
  for (const group of groups) {
    const expected = paths[group].values();
    const directory = group === "workflows" ? "workflows/" : "references/";
    if (!sameSet(expected, documentSet.files.filter((file) => file.path.startsWith(directory)).map((file) => file.path))) {
      issues.push(`contextPlacement ${group} file paths differ from policy.`);
    }
  }
  for (const [group, actual] of [
    ["workflows", complete.workflows.rows], ["workflows", complete.workflowDefinitions],
    ["referenceMaterials", complete.referenceMaterials]
  ]) {
    if (!sameSet(paths[group].values(), actual.map((entry) => entry.path))) {
      issues.push(`contextPlacement ${group} routing/definition paths differ from policy.`);
    }
  }
  return issues;
}
