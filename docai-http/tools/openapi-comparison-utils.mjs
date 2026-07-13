import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const SPEC_VERSION = "0.11.0";
export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const CANDIDATE_DIR = path.resolve(
  process.env.DOCAI_COMPLETE_CANDIDATE_DIR ?? path.join(SCRIPT_DIR, "..", "fixtures", "complete-candidates", `v${SPEC_VERSION}`),
);
export const TASKS_FILE = path.join(CANDIDATE_DIR, "evaluations", "tasks.json");
export const TARGETS_FILE = path.join(CANDIDATE_DIR, "evaluations", "targets.json");
export const SOURCE_OPENAPI_FILE = path.join(CANDIDATE_DIR, "source", "complete-openapi.yaml");
export const OPENAPI_BASELINE_DIR = path.join(CANDIDATE_DIR, "evaluations", "openapi-baseline");
export const OPENAPI_CONDITIONS = ["raw", "sliced", "enriched"];
export const LIVE_TASK_GROUPS = new Set(["request_construction", "response_handling", "error_handling", "workflow_completion"]);

const BASELINE_CONTEXTS = {
  "request-create-user-compact": {
    paths: ["/users"],
    schemas: ["User"],
    enrichment: ["CONVENTIONS.md", "resources/users.md"],
  },
  "request-upload-document-full": {
    paths: ["/documents"],
    schemas: [],
    enrichment: ["CONVENTIONS.md", "resources/documents.md"],
  },
  "response-payment-created-compact": {
    paths: ["/payments"],
    schemas: ["CardPaymentRequest", "BankPaymentRequest"],
    webhooks: ["payment.completed"],
    workflows: ["checkout"],
    enrichment: ["CONVENTIONS.md", "resources/payments.md", "workflows/checkout.md", "webhooks/payment-completed.md"],
  },
  "error-create-user-compact": {
    paths: ["/users"],
    schemas: ["User"],
    enrichment: ["CONVENTIONS.md", "resources/users.md"],
  },
  "workflow-complete-checkout-compact": {
    paths: ["/carts/{id}/validate", "/payments", "/orders"],
    schemas: ["CardPaymentRequest", "BankPaymentRequest"],
    webhooks: ["payment.completed"],
    workflows: ["checkout"],
    enrichment: ["CONVENTIONS.md", "resources/checkout.md", "resources/payments.md", "workflows/checkout.md", "webhooks/payment-completed.md"],
  },
};

export function read(file) {
  return fs.readFileSync(file, "utf8");
}

export function readJson(file) {
  return JSON.parse(read(file));
}

export function parseCommonArgs(argv, defaultGroup = "all", defaultCondition = "all") {
  const parsed = {
    group: defaultGroup,
    condition: defaultCondition,
    target: "required",
    task: null,
    includeOptional: false,
    summary: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--condition") {
      parsed.condition = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--target") {
      parsed.target = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--task") {
      parsed.task = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--include-optional") {
      parsed.includeOptional = true;
      continue;
    }
    if (arg === "--summary") {
      parsed.summary = true;
      continue;
    }
    if (!arg.startsWith("--") && parsed.group === defaultGroup) parsed.group = arg;
  }

  return parsed;
}

export function selectOpenApiConditions(condition) {
  if (condition === "all") return OPENAPI_CONDITIONS;
  if (!OPENAPI_CONDITIONS.includes(condition)) {
    throw new Error(`Unknown OpenAPI comparison condition: ${condition}. Use one of: ${OPENAPI_CONDITIONS.join(", ")}, all`);
  }
  return [condition];
}

export function selectComparableTasks(taskPacket, group, taskFilter) {
  if (group !== "all" && !LIVE_TASK_GROUPS.has(group)) {
    throw new Error(`OpenAPI comparison supports live task groups only. Use one of: ${[...LIVE_TASK_GROUPS].join(", ")}, all`);
  }
  const tasks = taskPacket.tasks.filter((task) => {
    if (!LIVE_TASK_GROUPS.has(task.group)) return false;
    if (group !== "all" && task.group !== group) return false;
    return !taskFilter || task.id === taskFilter;
  });
  if (tasks.length === 0) throw new Error(`No OpenAPI-comparable tasks found${taskFilter ? ` for ${taskFilter}` : ""}.`);
  return tasks;
}

export function selectTargets(targetPacket, targetFilter, includeOptional) {
  if (targetFilter && targetFilter !== "required") {
    const target = targetPacket.targets.find((candidate) => candidate.id === targetFilter);
    if (!target) throw new Error(`Unknown target: ${targetFilter}`);
    return [target];
  }
  return targetPacket.targets.filter((target) => includeOptional || target.required);
}

export function buildOpenApiPromptRecord(taskPacket, targetPacket, target, task, condition) {
  const context = buildOpenApiContext(task, condition);
  const system = [
    "You are evaluating an OpenAPI baseline context for comparison with DocAI HTTP.",
    "Use only the provided context.",
    "Do not infer DocAI HTTP behavior unless it is explicitly included in the context.",
    "If the context lacks a fact needed for the task, report it in `uncertainties` rather than guessing.",
    "Return strict JSON only, with no Markdown fences or prose outside the JSON object.",
  ].join(" ");

  const user = [
    "# Evaluation Task",
    `DocAI HTTP version: ${taskPacket.docai_http}`,
    `Candidate: ${taskPacket.candidate}`,
    `Baseline: openapi-${condition}`,
    `Source: ${path.relative(CANDIDATE_DIR, SOURCE_OPENAPI_FILE)}`,
    `Task ID: ${task.id}`,
    `Task group: ${task.group}`,
    "",
    "## User Task",
    task.user_task,
    "",
    "## Required Output",
    outputContract(task.group),
    "",
    "## Context",
    context,
  ].join("\n");

  return {
    run_id: `openapi-${condition}__${target.id}__${task.id}`,
    docai_http: taskPacket.docai_http,
    candidate: taskPacket.candidate,
    baseline: {
      format: "openapi",
      condition,
      source: path.relative(CANDIDATE_DIR, SOURCE_OPENAPI_FILE),
    },
    target: {
      id: target.id,
      provider: target.provider,
      model: target.model,
      required: target.required,
    },
    task: {
      id: task.id,
      group: task.group,
    },
    temperature: targetPacket.selection_policy.temperature,
    tools: targetPacket.selection_policy.tools,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

export function buildOpenApiContext(task, condition) {
  const mapping = BASELINE_CONTEXTS[task.id];
  if (!mapping) throw new Error(`No OpenAPI baseline context mapping for task ${task.id}`);

  if (condition === "raw") {
    return `<!-- openapi:source/complete-openapi.yaml -->\n\n${read(SOURCE_OPENAPI_FILE)}`;
  }

  const sliced = buildSlicedOpenApiYaml(mapping);
  if (condition === "sliced") {
    return `<!-- openapi:sliced:${task.id} -->\n\n${sliced}`;
  }

  if (condition === "enriched") {
    return [
      `<!-- openapi:sliced:${task.id} -->`,
      "",
      sliced,
      "",
      "## Authoritative Behavior Appendix",
      "",
      "The following Markdown files are included as an enrichment proxy for source facts that are not expressed in raw OpenAPI.",
      "They are used only for the OpenAPI enriched comparison condition.",
      "",
      enrichedContext(mapping.enrichment),
    ].join("\n");
  }

  throw new Error(`Unknown OpenAPI comparison condition: ${condition}`);
}

export function contextMetrics(task, condition) {
  const context = buildOpenApiContext(task, condition);
  const characters = [...context].length;
  return {
    task_id: task.id,
    task_group: task.group,
    condition,
    context_utf8_bytes: Buffer.byteLength(context, "utf8"),
    context_characters: characters,
    approx_tokens_chars_div_4: Math.ceil(characters / 4),
  };
}

function buildSlicedOpenApiYaml(mapping) {
  const source = read(SOURCE_OPENAPI_FILE);
  const lines = source.split(/\r?\n/);
  const parts = [extractBlock(lines, "openapi", 0), extractBlock(lines, "info", 0), "paths:"];

  (mapping.paths ?? []).forEach((apiPath) => parts.push(extractBlock(lines, apiPath, 2)));

  if ((mapping.webhooks ?? []).length > 0) {
    parts.push("webhooks:");
    mapping.webhooks.forEach((eventName) => parts.push(extractBlock(lines, eventName, 2)));
  }

  if ((mapping.workflows ?? []).length > 0) {
    parts.push("x-docai-workflows:");
    mapping.workflows.forEach((workflowName) => parts.push(extractBlock(lines, workflowName, 2)));
  }

  if ((mapping.schemas ?? []).length > 0) {
    parts.push("components:", "  schemas:");
    mapping.schemas.forEach((schemaName) => parts.push(extractBlock(lines, schemaName, 4)));
  }

  return parts.filter(Boolean).join("\n");
}

function extractBlock(lines, key, indent) {
  const prefix = " ".repeat(indent);
  const start = lines.findIndex((line) => line === `${prefix}${key}:` || line.startsWith(`${prefix}${key}: `));
  if (start === -1) throw new Error(`OpenAPI source lacks ${prefix}${key}: block`);

  const block = [lines[start]];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() !== "" && leadingSpaces(line) <= indent) break;
    block.push(line);
  }
  return block.join("\n").replace(/\s+$/u, "");
}

function leadingSpaces(line) {
  const match = line.match(/^ */u);
  return match ? match[0].length : 0;
}

function enrichedContext(relativePaths) {
  return relativePaths
    .map((relativePath) => {
      const file = path.join(CANDIDATE_DIR, "valid", "full", relativePath);
      return `<!-- docai-full-enrichment:${relativePath} -->\n\n${read(file)}`;
    })
    .join("\n\n");
}

function outputContract(taskGroup) {
  if (taskGroup === "request_construction") {
    return [
      "Return an object with:",
      "- `method`: HTTP method.",
      "- `path`: request path, including any required path or query values if applicable.",
      "- `headers`: object of request headers to send.",
      "- `body`: JSON object, multipart part list, raw body descriptor, or `null`.",
      "- `boundary_handling`: for multipart/form-data requests, describe whether multipart boundary generation is delegated to the HTTP library; otherwise omit or set to `null`.",
      "- `omitted_optional_fields`: array of optional fields intentionally omitted.",
      "- `evidence`: array of short context quotes or section names used.",
      "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
    ].join("\n");
  }
  if (taskGroup === "response_handling") {
    return [
      "Return an object with:",
      "- `success_status`: selected success status code.",
      "- `body_handling`: object with `fields`, `status_value` when the response documents a fixed status value, and any nullability/body-presence behavior to handle.",
      "- `headers`: response headers to read, or `none`.",
      "- `related_followups`: array of workflow or webhook identifiers or files to consider.",
      "- `evidence`: array of short context quotes or section names used.",
      "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
    ].join("\n");
  }
  if (taskGroup === "error_handling") {
    return [
      "Return an object with:",
      "- `endpoint_errors`: array of endpoint-specific error objects with `status`, `code`, optional `shape`, and `action`.",
      "- `common_errors`: array of common error objects with `status`, `code`, optional `shape`, and `action`.",
      "- `retry_policy`: retry or non-retry behavior.",
      "- `evidence`: array of short context quotes or section names used.",
      "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
    ].join("\n");
  }
  return [
    "Return an object with:",
    "- `steps`: ordered workflow steps with endpoint, values to pass, values to keep, and resulting state.",
    "- `failure_recovery`: recovery actions and preserved state for failure branches.",
    "- `webhook_reconciliation`: webhook matching and reconciliation behavior.",
    "- `evidence`: array of short context quotes or section names used.",
    "- `uncertainties`: array of missing or ambiguous facts, empty when none.",
  ].join("\n");
}
