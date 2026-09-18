import { diagnostic } from "../diagnostics.mjs";
import { CONVENTION_HEADINGS } from "./core-conventions.mjs";

function wholeFileSelection() {
  return { wholeFile: true, sections: [...CONVENTION_HEADINGS] };
}

function trustedSelection(selector) {
  if (selector === "all") return wholeFileSelection();
  if (selector === "none") return { wholeFile: false, sections: [] };
  return { wholeFile: false, sections: [...selector] };
}

function workflowWholeFile(path, reason, fallback) {
  return {
    path,
    ...(fallback === undefined ? {} : { fallback }),
    reason,
    ...wholeFileSelection()
  };
}

export function validateCompleteConventionRetrieval(coreFacts, workflowFacts) {
  const rows = coreFacts?.operations?.rows ?? [];
  const commonReferences = coreFacts?.failureShapes?.commonReferences ?? [];
  const diagnostics = [];
  for (const row of rows) {
    const referencesCommonShape = commonReferences.some((reference) => (
      reference.operation === row.operation
    ));
    const selectsErrorHandling = row.conventions === "all"
      || (Array.isArray(row.conventions) && row.conventions.includes("Error Handling"));
    if (referencesCommonShape && !selectsErrorHandling) {
      diagnostics.push(diagnostic(
        "DM-CONV-005",
        row.indexPath ?? "INDEX.md",
        row.line ?? 1,
        `Operation '${row.operation}' references a common failure shape but its selective convention dependency closure omits Error Handling.`
      ));
    }
  }
  const operations = rows.map((row) => ({
    operation: row.operation,
    selector: row.conventions,
    requiredWorkflowPaths: [...row.requiredContexts],
    trusted: trustedSelection(row.conventions),
    untrusted: wholeFileSelection(),
    supplementalWorkflows: row.supplementalContexts
      .filter((contextPath) => contextPath.startsWith("workflows/"))
      .map((contextPath) => workflowWholeFile(
        contextPath,
        "supplemental-workflow",
        row.conventions !== "all"
      ))
  }));
  return {
    diagnostics,
    facts: {
      conventionRetrieval: {
        operations,
        directWorkflows: (workflowFacts?.rows ?? []).map((row) => (
          workflowWholeFile(row.path, "direct-workflow")
        ))
      }
    }
  };
}
