import { isDeepStrictEqual } from "node:util";

const label = (value) => typeof value === "string" && value.length > 0
  && value.trim() === value && !/[\r\n\t]/.test(value);

// These are explicit labels for declared owners, not a general label generator.
// Storefront Task belongs to behavior; its Summary belongs to AsyncAPI.
export function auditOperationLabels(contexts, representations, asyncapi, behavior, rows, check) {
  const contracts = [
    ...Object.entries(contexts.operations).map(([name, facts]) => [name, facts?.task, facts?.summary]),
    ...representations.representations.map((facts) => [facts.operation, facts.task, facts.summary]),
    ...Object.entries(asyncapi.operations).map(([name, facts]) => [
      name, behavior.operationBehavior?.[name]?.task, facts?.summary
    ])
  ];
  for (const [name, task, summary] of contracts) {
    const row = rows.find((entry) => entry.operation === name);
    check(label(task) && !task.includes("; ") && isDeepStrictEqual(row?.tasks, [task]),
      `operation labels ${name} task`);
    check(label(summary) && row?.summary === summary, `operation labels ${name} summary`);
  }
}
