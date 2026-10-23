import { isDeepStrictEqual } from "node:util";
import { scanMarkdown } from "./markdown.mjs";
import { validateCompleteFieldDefaults } from "./validators/complete-field-defaults.mjs";
import {
  collectPayloadRepresentations, validateCompleteSameAs
} from "./validators/complete-same-as.mjs";

const original = {
  operation: "r-json-original-operation", message: "json-original-message",
  reply: false, mediaType: "application/json"
};
const reuse = {
  operation: "r-json-reuse-operation", message: "json-reuse-message",
  reply: false, mediaType: "application/json"
};

function sameIdentity(actual, expected) {
  return actual !== undefined && Object.entries(expected)
    .every(([key, value]) => actual[key] === value);
}

// Run only for this versioned candidate, after ordinary pair and source validation.
// This preserves representative fixture coverage, not a token-savings claim or
// an additional conformance rule for arbitrary generated compact sets.
export function auditCompleteCompactPolicy(documentSet) {
  const owner = documentSet.files.filter((file) => file.path.startsWith("channels/"))
    .map((file) => ({ file, target: collectPayloadRepresentations(file)
      .find((entry) => entry.kind === "expanded" && sameIdentity(entry, original)) }))
    .find((entry) => entry.target !== undefined);
  const file = owner?.file;
  const path = file?.path;
  const target = owner?.target;
  const defaults = validateCompleteFieldDefaults(documentSet);
  const sameAs = validateCompleteSameAs(defaults.expandedDocumentSet);
  const issues = [];

  const hasDefaults = defaults.facts.fieldDefaults.some((entry) => entry.path === path
    && target !== undefined && entry.line > target.line && entry.line < target.endLine
    && isDeepStrictEqual(entry.columns, [
      { column: "Required", value: "yes" }, { column: "Nullable", value: "no" }
    ])
    && entry.logicalHeader[0] === "Field");
  if (!hasDefaults) issues.push("JSON original must retain its field_defaults representative (Required=yes | Nullable=no).");

  const hasReuse = sameAs.facts.sameAs.some((entry) => entry.path === path
    && sameIdentity(entry.reference, reuse) && sameIdentity(entry.target, original));
  if (!hasReuse || file?.metadata["x-retrieval-unit"] !== "channel-file") {
    issues.push("JSON reuse must retain its same_as representative targeting JSON original with a channel-file retrieval unit.");
  }

  const markdown = file && scanMarkdown(file.content).value;
  // The normal example is first; extension fences after required content cannot
  // stand in for it. Ordinary validation owns fence grammar and decoded equality.
  const example = markdown?.fences.find((fence) => target !== undefined
    && fence.startLine > target.line && fence.endLine < target.endLine);
  if (example?.info !== "json" || example.endLine !== example.startLine + 2) {
    issues.push("JSON original must retain its one-line JSON example representative.");
  }
  return issues;
}
