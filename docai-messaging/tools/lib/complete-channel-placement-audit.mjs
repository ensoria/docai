import { isDeepStrictEqual } from "node:util";
import { parseDocsPath } from "./paths.mjs";
import { validateCompleteDocumentSet } from "./validators/complete.mjs";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const member = (value) => typeof value === "string" && value.length > 0
  && value.trim() === value && !/[\r\n\t]/.test(value);
const channelPath = (value) => typeof value === "string" && value.startsWith("channels/")
  && value.endsWith(".md") && parseDocsPath(value).value?.kind === "docs-root-relative";

// Candidate publication decisions, not source facts or a general path allocator.
// Ordinary pair validation and exact source inventory closure precede this gate.
export function auditCompleteChannelPlacement(policy, documentSet, options) {
  const valid = Array.isArray(policy) && policy.length > 0 && policy.every((entry) => record(entry)
    && isDeepStrictEqual(Object.keys(entry).sort(), ["details", "members"])
    && channelPath(entry.details) && Array.isArray(entry.members) && entry.members.length > 0
    && entry.members.every(member))
    && new Set(policy.map((entry) => entry.details)).size === policy.length;
  if (!valid) return ["channelPlacement requires closed records with unique channel paths and non-empty member arrays."];
  const core = validateCompleteDocumentSet(documentSet, options).facts.core;
  const issues = [];
  const names = policy.flatMap((entry) => entry.members);
  if (new Set(names).size !== names.length) issues.push("channelPlacement members must be unique within and across files.");
  const paths = documentSet.files.filter((file) => file.path.startsWith("channels/"))
    .map((file) => file.path).sort();
  if (!isDeepStrictEqual(policy.map((entry) => entry.details).sort(), paths)) {
    issues.push("channelPlacement policy paths differ from projected channel files.");
  }
  for (const entry of policy) {
    const expected = [...entry.members].sort();
    const routed = core.operations.rows.filter((row) => row.channelPath === entry.details)
      .map((row) => row.operation).sort();
    const defined = Object.entries(core.operationDefinitions.byName)
      .filter(([, definition]) => definition.path === entry.details).map(([name]) => name).sort();
    if (!isDeepStrictEqual(expected, routed)) {
      issues.push(`${entry.details} routing membership differs from channelPlacement.`);
    }
    if (!isDeepStrictEqual(expected, defined)) {
      issues.push(`${entry.details} definition membership differs from channelPlacement.`);
    }
  }
  return issues;
}
