import { isDeepStrictEqual } from "node:util";
import { scanMarkdown } from "./markdown.mjs";
import { validateCompleteDocumentSet } from "./validators/complete.mjs";

// Finite generator navigation rule. The caller must first validate ordinary
// structure, source bindings, inventory, context selection and Workflow facts.
// In particular, a source-checked row is not authority before that preflight.
export function auditCompleteRelatedPolicy(policy, syntheticSources, documentSet, options) {
  if (!isDeepStrictEqual(policy, { rule: "workflow-contexts-and-known-steps-v1" })) {
    return ["relatedNavigation requires exactly rule workflow-contexts-and-known-steps-v1."];
  }
  const core = validateCompleteDocumentSet(documentSet, options).facts.core;
  const definitions = Object.values(core.operationDefinitions.byName);
  const owners = new Map(definitions.map((entry) => [
    `${entry.action} ${entry.channel} (${entry.name})`, entry.name
  ]));
  const related = new Map(core.operations.rows.map((row) => [row.operation,
    new Set([...row.requiredContexts, ...row.supplementalContexts]
      .filter((target) => target.startsWith("workflows/")))]));
  for (const source of syntheticSources) {
    for (const [id, workflow] of Object.entries(source.workflows ?? {})) {
      // None/unknown/unsupported section states do not supply known Step edges.
      // This does not prove their absence; independently known contexts survive.
      if (Object.hasOwn(workflow, "sections") || !Array.isArray(workflow.steps)) continue;
      for (const step of workflow.steps) {
        related.get(owners.get(step))?.add(`workflows/${id}.md`);
      }
    }
  }
  const issues = [];
  const scanned = new Map();
  for (const definition of definitions) {
    const file = documentSet.files.find((entry) => entry.path === definition.path);
    if (!scanned.has(file.path)) scanned.set(file.path, scanMarkdown({ text: file.content, file: file.path }).value);
    const markdown = scanned.get(file.path);
    // Core definitions carry expanded same_as line coordinates. Locate the
    // original heading by identity instead of applying those lines to raw text.
    const owner = markdown.headings.find((heading) => heading.level === 2
      && heading.text === `${definition.action} ${definition.channel} (${definition.name})`);
    const end = markdown.headings.find((heading) => heading.level === 2 && heading.line > owner.line)?.line
      ?? file.identityLine;
    const heading = markdown.headings.find((heading) => heading.level === 3
      && heading.text === "Related" && heading.line > owner.line && heading.line < end);
    const actual = markdown.lines.filter((line) => line.line > heading.line && line.line < end)
      .map((line) => line.text).join("\n").trim();
    const paths = [...related.get(definition.name)].sort();
    const expected = paths.length === 0 ? "none" : paths.join(", ");
    if (actual !== expected) issues.push(`${definition.name} Related differs from known Workflow navigation policy.`);
  }
  return issues;
}
