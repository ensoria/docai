import fs from "node:fs";
import path from "node:path";

import {
  BENCHMARK_DIR,
  readV2Plan,
} from "./openapi-comparison-v2-utils.mjs";

const CONTRACTS_FILE = path.join(BENCHMARK_DIR, "contracts.json");
const contracts = JSON.parse(fs.readFileSync(CONTRACTS_FILE, "utf8"));
const forbiddenPublicKeys = new Set([
  "assertions",
  "evidence",
  "expected_outcome",
  "grader",
  "grader_evidence",
]);

export function readContractPacket(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function validateBenchmarkTaskPacket(packet, plan = readV2Plan()) {
  requireObject(packet, "task packet");
  if (packet.benchmark_id !== plan.benchmark_id) {
    throw new Error(`task packet benchmark_id must be ${plan.benchmark_id}`);
  }

  const api = plan.apis.find((candidate) => candidate.id === packet.api_id);
  if (!api) throw new Error(`task packet has unknown api_id ${packet.api_id}`);
  if (!Array.isArray(packet.tasks)) throw new Error("task packet tasks must be an array");

  const taskIds = packet.tasks.map((task) => task.id);
  if (new Set(taskIds).size !== taskIds.length) {
    throw new Error(`task packet ${packet.api_id} task ids must be unique`);
  }
  if (!sameMembers(taskIds, api.tasks)) {
    throw new Error(`task packet ${packet.api_id} task ids must exactly match plan`);
  }

  packet.tasks.forEach((task) => validateTask(task, packet.api_id));
  return packet;
}

export function buildRequiredOutputText(contractId) {
  const contract = contracts.output_contracts[contractId];
  if (!contract) throw new Error(`unknown output contract ${contractId}`);
  return [
    "Return one JSON object with no Markdown fence or surrounding prose.",
    "Use this exact top-level structure; replace placeholder values with the task result:",
    JSON.stringify(contract.json_shape, null, 2),
  ].join("\n");
}

export function taskContracts() {
  return structuredClone(contracts);
}

function validateTask(task, apiId) {
  requireObject(task, `task in ${apiId}`);
  if (typeof task.id !== "string" || !/^[a-z0-9-]+$/.test(task.id)) {
    throw new Error(`task in ${apiId} requires a lowercase hyphenated id`);
  }

  const expectedContract = contracts.task_classes[task.class];
  if (!expectedContract) {
    throw new Error(`task ${task.id} has unsupported class ${task.class}`);
  }
  if (!["full", "compact"].includes(task.profile)) {
    throw new Error(`task ${task.id} profile must be full or compact`);
  }

  requireObject(task.public, `task ${task.id} public`);
  findForbiddenPublicKey(task.public, `task ${task.id} public`);
  if (typeof task.public.user_task !== "string" || task.public.user_task.trim() === "") {
    throw new Error(`task ${task.id} public.user_task is required`);
  }
  if (task.public.output_contract !== expectedContract) {
    throw new Error(`task ${task.id} output_contract must be ${expectedContract}`);
  }
  validateRetrieval(task);

  requireObject(task.private, `task ${task.id} private`);
  requireObject(task.private.expected_outcome, `task ${task.id} private.expected_outcome`);
  if (!Array.isArray(task.private.assertions) || task.private.assertions.length === 0) {
    throw new Error(`task ${task.id} requires private assertions`);
  }
  task.private.assertions.forEach((assertion, index) => {
    validateAssertion(assertion, task.id, index);
  });
  validateFactInventory(task);
}

function validateRetrieval(task) {
  const retrieval = task.public.retrieval;
  requireObject(retrieval, `task ${task.id} public.retrieval`);
  requireStringArray(retrieval.openapi_roots, `task ${task.id} openapi_roots`, true);
  requireStringArray(retrieval.docai_files, `task ${task.id} docai_files`, true);
}

function validateAssertion(assertion, taskId, index) {
  requireObject(assertion, `task ${taskId} assertion ${index}`);
  if (typeof assertion.path !== "string" || !assertion.path.startsWith("/")) {
    throw new Error(`task ${taskId} assertion ${index} requires an absolute path`);
  }
  if (!contracts.assertion_operators.includes(assertion.operator)) {
    throw new Error(`task ${taskId} has unsupported assertion operator ${assertion.operator}`);
  }
  if (assertion.operator !== "absent" && !Object.hasOwn(assertion, "value")) {
    throw new Error(`task ${taskId} assertion ${index} requires value`);
  }
  if (typeof assertion.failure_category !== "string" || assertion.failure_category.trim() === "") {
    throw new Error(`task ${taskId} assertion ${index} requires failure_category`);
  }
}

function validateFactInventory(task) {
  const inventory = task.private.fact_inventory;
  requireObject(inventory, `task ${task.id} fact_inventory`);
  requireStringArray(inventory.required, `task ${task.id} required facts`, true);
  requireStringArray(inventory.raw_missing, `task ${task.id} raw_missing`);
  requireStringArray(inventory.sliced_missing, `task ${task.id} sliced_missing`);

  const required = new Set(inventory.required);
  [...inventory.raw_missing, ...inventory.sliced_missing].forEach((fact) => {
    if (!required.has(fact)) {
      throw new Error(`task ${task.id} missing fact ${fact} is not listed as required`);
    }
  });
}

function findForbiddenPublicKey(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenPublicKey(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  Object.entries(value).forEach(([key, child]) => {
    if (forbiddenPublicKeys.has(key)) {
      throw new Error(`${location} task data must not contain ${key}`);
    }
    findForbiddenPublicKey(child, `${location}.${key}`);
  });
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function requireStringArray(value, name, requireNonempty = false) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${name} must be an array of non-empty strings`);
  }
  if (requireNonempty && value.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${name} must not contain duplicates`);
  }
}

function sameMembers(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}
