import { isDeepStrictEqual } from "node:util";
import { scanMarkdown } from "./markdown.mjs";
import { collectCompleteOperationContributors } from "./complete-operation-contributors.mjs";

// A shard attributes its own routing rows, not whole linked channel/context bodies.
export function auditCompleteOperationShardContributorClosure(sources, sourceIds, documentSet, coreFacts) {
  const routes = coreFacts?.operations?.shards;
  const rows = coreFacts?.operations?.rows;
  const ownershipIssue = "operation shard source_refs contributors have unknown or inconsistent routing/file/row ownership";
  if (!Array.isArray(routes) || !Array.isArray(rows) || !Array.isArray(documentSet?.files)) {
    return [ownershipIssue];
  }
  const files = documentSet.files.filter((file) => {
    const heading = scanMarkdown({ text: file.content, file: file.path }).value?.headings[0];
    return heading?.level === 1 && heading.text === "Messaging Operation Index";
  });
  // Flat routing has no shard scope. Ordinary/source/publication gates own it.
  if (routes.length === 0) return files.length === 0 ? [] : [ownershipIssue];
  const inventory = collectCompleteOperationContributors(sources, sourceIds);
  if (inventory.issues.length > 0) return inventory.issues;
  const paths = routes.map((route) => route.path);
  if (paths.some((entry) => typeof entry !== "string")
      || new Set(paths).size !== paths.length
      || !isDeepStrictEqual([...paths].sort(), files.map((file) => file.path).sort())
      || !isDeepStrictEqual(rows.map((row) => row.operation).sort(), inventory.operations)
      || rows.some((row) => !paths.includes(row.indexPath))
      || paths.some((filePath) => !rows.some((row) => row.indexPath === filePath))) {
    return [ownershipIssue];
  }
  const issues = [];
  for (const file of files) {
    const required = new Set(rows.filter((row) => row.indexPath === file.path)
      .flatMap((row) => inventory.contributors.get(row.operation)));
    const ids = [...required].sort();
    const expected = isDeepStrictEqual(ids, [...sourceIds].sort()) ? "all" : ids.join(", ");
    if (file.metadata?.source_refs !== expected) {
      issues.push(`${file.path} source_refs contributors must be ${expected}`);
    }
  }
  return issues;
}
