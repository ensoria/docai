import { isDeepStrictEqual } from "node:util";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const label = (value) => typeof value === "string" && value.length > 0
  && value.trim() === value && !/[\r\n\t]/.test(value);

// Source ID selects a validated publication path, never a display-label fallback.
export function auditWorkflowLabels(contexts, complete, check, contextPaths) {
  const valid = record(contexts.workflows);
  check(valid, "Workflow labels source registry");
  if (!valid) return;
  const entries = Object.entries(contexts.workflows);
  const paths = entries.map(([id]) => contextPaths.workflows.get(id)).sort();
  const rows = complete.workflows.rows;
  const definitions = complete.workflowDefinitions;
  check(isDeepStrictEqual(rows.map((row) => row.path).sort(), paths), "Workflow labels routing paths");
  check(isDeepStrictEqual(definitions.map((definition) => definition.path).sort(), paths),
    "Workflow labels definition paths");
  for (const [id, source] of entries) {
    const ownerPath = contextPaths.workflows.get(id);
    const row = rows.find((entry) => entry.path === ownerPath);
    const definition = definitions.find((entry) => entry.path === ownerPath);
    check(record(source) && label(source.name) && row?.name === source.name,
      `Workflow labels ${id} routing name`);
    check(record(source) && label(source.summary) && row?.summary === source.summary,
      `Workflow labels ${id} summary`);
    check(record(source) && label(source.displayTitle) && definition?.title === source.displayTitle,
      `Workflow labels ${id} display title`);
  }
}
