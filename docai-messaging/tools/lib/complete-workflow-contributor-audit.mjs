import { isDeepStrictEqual } from "node:util";

const sourceId = "complete-contexts";
const registry = [sourceId, "complete-representations", "storefront-asyncapi-3.1.0", "storefront-behavior"].sort();
// These roles have full source-to-body comparisons in the preceding audit.
// Registry membership alone cannot certify an unexamined Workflow's provenance.
const auditedOwners = ["alpha-delivery", "alpha-observability", "state-none", "state-unknown", "state-unsupported"];
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (left, right) => isDeepStrictEqual([...left].sort(), [...right].sort());

export function auditCompleteWorkflowContributorClosure(sources, sourceIds, contextPaths, documentSet, completeFacts) {
  const ownershipIssue = "Workflow source_refs contributors require the compared source owner/path/routing/definition/file closure";
  if (!(sources instanceof Map) || !Array.isArray(sourceIds)
      || !same(sourceIds, registry) || !same(sources.keys(), registry)) {
    return ["Workflow source_refs contributors require the complete candidate source registry"];
  }
  const contexts = sources.get(sourceId);
  if (contexts?.sourceId !== sourceId || !record(contexts.workflows)
      || !same(Object.keys(contexts.workflows), auditedOwners)
      || Object.values(contexts.workflows).some((owner) => !record(owner))
      || [...sources].some(([id, source]) => id !== sourceId && source?.workflows !== undefined
        && (!record(source.workflows) || Object.keys(source.workflows).length !== 0))) {
    return [ownershipIssue];
  }
  const paths = contextPaths?.workflows;
  const rows = completeFacts?.workflows?.rows;
  const definitions = completeFacts?.workflowDefinitions;
  if (!(paths instanceof Map) || !same(paths.keys(), auditedOwners)
      || !Array.isArray(rows) || !Array.isArray(definitions) || !Array.isArray(documentSet?.files)) {
    return [ownershipIssue];
  }
  const targets = [...paths.values()];
  const files = documentSet.files.filter((file) => file.path.startsWith("workflows/"));
  if (targets.some((target) => typeof target !== "string" || !target.startsWith("workflows/"))
      || new Set(targets).size !== targets.length
      || !same(files.map((file) => file.path), targets)
      || !same(rows.map((row) => row.path), targets)
      || !same(definitions.map((definition) => definition.path), targets)) {
    return [ownershipIssue];
  }
  // Source-authored Steps and markers are Workflow facts. References to other
  // contracts/conventions do not import those documents' body contributors.
  return files.filter((file) => file.metadata?.source_refs !== sourceId)
    .map((file) => `${file.path} source_refs contributors must be ${sourceId}`);
}
