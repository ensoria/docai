import { isDeepStrictEqual } from "node:util";
import { CONVENTION_HEADINGS } from "./validators/core-conventions.mjs";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sorted = (values) => [...values].sort();
const sameSet = (left, right) => isDeepStrictEqual(sorted(left), sorted(right));
const headings = new Set(CONVENTION_HEADINGS);
const dependencyList = (value) => value === null || (Array.isArray(value)
  && value.every((name) => typeof name === "string" && headings.has(name))
  && new Set(value).size === value.length);
const wholeFile = (selection) => selection?.wholeFile === true
  && sameSet(selection.sections ?? [], CONVENTION_HEADINGS);

// Finite source-aware proof for this candidate, not a general prose dependency analyzer.
export function auditConventionDependencies(contexts, representations, asyncapi, result, check) {
  const operations = new Map();
  const workflows = new Map();
  const sections = new Map();
  let valid = true;
  for (const source of [contexts, representations]) {
    const entries = source.representations ?? Object.entries(source.operations)
      .map(([operation, facts]) => ({ operation, ...facts }));
    const workflowEntries = Object.entries(source.workflows ?? {});
    const model = source.conventionDependencies;
    const modelValid = record(model)
      && sameSet(Object.keys(model), ["operations", "workflows", "sections"])
      && record(model.operations) && record(model.workflows) && record(model.sections)
      && sameSet(Object.keys(model.operations), entries.map((entry) => entry.operation))
      && sameSet(Object.keys(model.workflows), workflowEntries.map(([id]) => id))
      && [...Object.values(model.operations), ...Object.values(model.workflows)]
        .every(dependencyList)
      && Object.entries(model.sections).every(([name, dependencies]) => (
        headings.has(name) && dependencyList(dependencies)
      ));
    check(modelValid, `${source.sourceId} convention dependencies model`);
    valid &&= modelValid;
    if (!modelValid) continue;
    for (const entry of entries) {
      check(!operations.has(entry.operation), `${entry.operation} convention dependencies ownership`);
      valid &&= !operations.has(entry.operation);
      operations.set(entry.operation, { ...entry, dependencies: model.operations[entry.operation] });
    }
    for (const [id, workflow] of workflowEntries) {
      check(!workflows.has(id), `${id} convention dependencies ownership`);
      valid &&= !workflows.has(id);
      workflows.set(id, { ...workflow, dependencies: model.workflows[id] });
    }
    for (const [name, dependencies] of Object.entries(model.sections)) {
      const equal = !sections.has(name) || (dependencies === null
        ? sections.get(name) === null : Array.isArray(sections.get(name))
          && sameSet(sections.get(name), dependencies));
      check(equal, `${name} convention dependencies conflict`);
      valid &&= equal;
      sections.set(name, dependencies);
    }
  }
  if (!valid) return;

  const operationHeadings = new Map([...operations].map(([name, entry]) => [
    `${entry.action} ${entry.channel} (${name})`, name
  ]));
  for (const [name, entry] of Object.entries(asyncapi.operations)) {
    const channel = asyncapi.channels[entry.channel?.$ref?.split("/").at(-1)];
    operationHeadings.set(`${entry.action.toUpperCase()} ${channel?.address} (${name})`, name);
  }
  const closure = (operation, selected) => {
    const pending = [["operation", operation], ...selected.map((name) => ["section", name])];
    const visited = new Set();
    const needed = new Set();
    let known = true;
    while (pending.length > 0) {
      const [kind, name] = pending.pop();
      const key = `${kind}:${name}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const entry = kind === "operation" ? operations.get(name) : workflows.get(name);
      const dependencies = kind === "section" ? sections.get(name) : entry?.dependencies;
      if (kind === "section") needed.add(name);
      if (!Array.isArray(dependencies)) { known = false; continue; }
      pending.push(...dependencies.map((dependency) => ["section", dependency]));
      if (kind === "operation") {
        const required = Object.hasOwn(contexts.operations, name)
          ? entry.requiredContexts : entry.requiredContexts ?? [];
        if (!Array.isArray(required)) { known = false; continue; }
        pending.push(...required.map((id) => ["workflow", id]));
      } else if (kind === "workflow") {
        if (Object.hasOwn(entry, "sections")) {
          // Section-state sources prove no steps only through explicit none;
          // an extra steps member cannot shadow an incomplete/ambiguous source.
          if (entry.sections?.Steps !== "none" || Object.hasOwn(entry, "steps")) known = false;
          continue;
        }
        if (!Array.isArray(entry.steps)) { known = false; continue; }
        // Source Steps in this finite scenario are exact operation headings.
        for (const step of entry.steps) {
          const target = operationHeadings.get(step);
          if (target === undefined) known = false;
          else pending.push(["operation", target]);
        }
      }
    }
    return { known, needed };
  };

  const rows = result.facts.core.operations.rows;
  const retrieval = result.facts.complete.conventionRetrieval;
  for (const row of rows) {
    const entry = operations.get(row.operation);
    if (entry) {
      const sourcePaths = (ids, required) => Array.isArray(ids)
        && ids.every((id) => typeof id === "string"
          && (workflows.has(id) || (!required && Object.hasOwn(contexts.referenceMaterials, id))))
        && new Set(ids).size === ids.length
        ? ids.map((id) => `${workflows.has(id) ? "workflows" : "references"}/${id}.md`) : null;
      const contextEntry = Object.hasOwn(contexts.operations, row.operation);
      const required = sourcePaths(contextEntry ? entry.requiredContexts : entry.requiredContexts ?? [], true);
      const supplemental = sourcePaths(contextEntry ? entry.supplementalContexts : entry.supplementalContexts ?? [], false);
      const matches = required !== null && supplemental !== null
        && sameSet(row.requiredContexts, required) && sameSet(row.supplementalContexts, supplemental);
      check(matches, `${row.operation} convention closure context routing`);
      if (!matches) continue;
    }
    const selected = row.conventions === "all" ? CONVENTION_HEADINGS
      : row.conventions === "none" ? [] : row.conventions;
    if (!sameSet(selected, CONVENTION_HEADINGS)) {
      const proof = closure(row.operation, selected);
      check(proof.known && [...proof.needed].every((name) => selected.includes(name)),
        `${row.operation} convention closure`);
    }
    const facts = retrieval?.operations.find((operation) => operation.operation === row.operation);
    check(wholeFile(facts?.untrusted)
      && sameSet(facts?.requiredWorkflowPaths ?? [], row.requiredContexts)
      && sameSet(facts?.supplementalWorkflows.map((workflow) => workflow.path) ?? [],
        row.supplementalContexts.filter((path) => path.startsWith("workflows/")))
      && facts.supplementalWorkflows.every((workflow) => wholeFile(workflow)
        && workflow.reason === "supplemental-workflow"
        && workflow.fallback === (row.conventions !== "all")),
    `${row.operation} convention closure fallback`);
  }
  check(sameSet(retrieval?.directWorkflows.map((workflow) => workflow.path) ?? [],
    [...workflows.keys()].map((id) => `workflows/${id}.md`))
    && retrieval.directWorkflows.every((workflow) => wholeFile(workflow)
      && workflow.reason === "direct-workflow"), "direct Workflow convention closure fallback");
}
