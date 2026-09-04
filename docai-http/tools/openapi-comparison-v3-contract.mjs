import fs from "node:fs";
import path from "node:path";

import {
  BENCHMARK_DIR,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

const CONTRACTS_FILE = path.join(BENCHMARK_DIR, "contracts.json");
const SCHEMA_TYPES = new Set([
  "object",
  "array",
  "string",
  "integer",
  "number",
  "boolean",
  "null",
  "any-json",
]);
const SCHEMA_KEYS = new Set([
  "type",
  "required",
  "properties",
  "additional_properties",
  "items",
  "enum",
  "pattern",
  "minimum",
  "nullable",
]);
const ASSERTION_KEYS = new Set([
  "path",
  "operator",
  "value",
  "failure_category",
  "fact_id",
]);
const PACKET_KEYS = ["benchmark_id", "api_id", "tasks"];
const TASK_KEYS = ["id", "class", "profile", "public", "private"];
const PUBLIC_KEYS = ["user_task", "output_contract", "retrieval"];
const RETRIEVAL_KEYS = ["openapi_roots", "docai_files"];
const PRIVATE_KEYS = ["expected_outcome", "assertions", "fact_inventory"];
const FACT_INVENTORY_KEYS = ["required", "raw_missing", "sliced_missing"];
const FORBIDDEN_PUBLIC_KEYS = new Set([
  "assertions",
  "evidence",
  "expected_outcome",
  "fact_ids",
  "fact_inventory",
  "failure_category",
  "grader",
  "grader_evidence",
  "missing_fact_ids",
  "private",
  "raw_missing",
  "sliced_missing",
]);
const JSON_POINTER_PATTERN = /^(?:\/(?:[^~/]|~[01])*(?:\/(?:[^~/]|~[01])*)*)$/;

const contracts = loadContracts();

export function readContractPacket(file) {
  const packet = JSON.parse(fs.readFileSync(file, "utf8"));
  if (isPlainObject(packet) && Object.hasOwn(packet, "output_contracts")) {
    validateContractsPacket(packet, file);
  }
  return packet;
}

export function taskContracts() {
  return structuredClone(contracts);
}

export function validateBenchmarkTaskPacket(packet, plan = readV3Plan()) {
  requireExactPlainObject(packet, "task packet", PACKET_KEYS);
  requireObject(plan, "benchmark plan");
  if (packet.benchmark_id !== plan.benchmark_id) {
    throw new Error(`task packet benchmark_id must be ${plan.benchmark_id}`);
  }

  requireObject(plan.calibration, "benchmark plan calibration");
  if (packet.api_id !== plan.calibration.api_id) {
    throw new Error(`task packet api_id must be ${plan.calibration.api_id}`);
  }
  requireDenseArray(packet.tasks, "task packet tasks");

  packet.tasks.forEach((task) => validateTask(task, packet.api_id));

  const taskIds = packet.tasks.map((task) => task?.id);
  if (new Set(taskIds).size !== taskIds.length) {
    throw new Error(`task packet ${packet.api_id} task ids must be unique`);
  }
  for (const taskId of plan.calibration.task_ids) {
    if (!taskIds.includes(taskId)) {
      throw new Error(`task packet ${packet.api_id} is missing calibration task ${taskId}`);
    }
  }
  if (!isFiniteJsonValue(packet, new WeakSet())) {
    throw new Error("task packet must be a finite JSON value");
  }

  return packet;
}

export function validateOutputContract(value, contractId) {
  const contract = contracts.output_contracts[contractId];
  if (!contract) throw new Error(`unknown output contract ${contractId}`);

  const errors = [];
  validateValue(value, contract.schema, "", errors, new WeakSet());
  return { valid: errors.length === 0, errors };
}

export function buildRequiredOutputText(contractId) {
  const contract = contracts.output_contracts[contractId];
  if (!contract) throw new Error(`unknown output contract ${contractId}`);

  return [
    "Return exactly one raw JSON object with no Markdown fence or surrounding prose.",
    "The object must satisfy this public schema. Enum arrays list the only allowed generic choices:",
    JSON.stringify({
      schema_version: contract.schema_version,
      schema: contract.schema,
    }, null, 2),
  ].join("\n");
}

function loadContracts() {
  const packet = JSON.parse(fs.readFileSync(CONTRACTS_FILE, "utf8"));
  validateContractsPacket(packet, CONTRACTS_FILE);
  return packet;
}

function validateContractsPacket(packet, source) {
  requireObject(packet, `contract packet ${source}`);
  if (typeof packet.contract_version !== "string" || packet.contract_version.trim() === "") {
    throw new Error(`contract packet ${source} contract_version must be a non-empty string`);
  }
  requireObject(packet.task_classes, `contract packet ${source} task_classes`);
  requireStringArray(
    Object.values(packet.task_classes),
    `contract packet ${source} task class contract ids`,
    true,
  );
  requireStringArray(
    packet.assertion_operators,
    `contract packet ${source} assertion_operators`,
    true,
  );
  requireObject(packet.output_contracts, `contract packet ${source} output_contracts`);

  const contractIds = Object.keys(packet.output_contracts);
  if (contractIds.length === 0) throw new Error(`contract packet ${source} must define contracts`);
  for (const contractId of Object.values(packet.task_classes)) {
    if (!Object.hasOwn(packet.output_contracts, contractId)) {
      throw new Error(`contract packet ${source} task class references unknown contract ${contractId}`);
    }
  }

  for (const [contractId, contract] of Object.entries(packet.output_contracts)) {
    requireObject(contract, `output contract ${contractId}`);
    if (contract.schema_version !== "1") {
      throw new Error(`output contract ${contractId} schema_version must be 1`);
    }
    validateSchema(contract.schema, `/output_contracts/${escapePointer(contractId)}/schema`);
  }
}

function validateSchema(schema, pointer) {
  requireObject(schema, `schema ${pointer}`);
  for (const key of Object.keys(schema)) {
    if (!SCHEMA_KEYS.has(key)) throw new Error(`schema ${pointer} has unsupported keyword ${key}`);
  }
  if (!SCHEMA_TYPES.has(schema.type)) {
    throw new Error(`schema ${pointer} has unsupported type ${String(schema.type)}`);
  }
  if (Object.hasOwn(schema, "nullable") && schema.nullable !== true) {
    throw new Error(`schema ${pointer} nullable must be true when present`);
  }

  if (Object.hasOwn(schema, "enum")) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      throw new Error(`schema ${pointer} enum must be a non-empty array`);
    }
    const encoded = schema.enum.map((value) => {
      if (!isJsonScalar(value)) throw new Error(`schema ${pointer} enum values must be JSON scalars`);
      return JSON.stringify(value);
    });
    if (new Set(encoded).size !== encoded.length) {
      throw new Error(`schema ${pointer} enum values must be unique`);
    }
    for (const value of schema.enum) {
      if (value === null && schema.nullable === true) continue;
      if (!matchesPrimitiveType(value, schema.type)) {
        throw new Error(`schema ${pointer} enum value does not match type ${schema.type}`);
      }
    }
  }

  if (Object.hasOwn(schema, "pattern")) {
    if (schema.type !== "string" || typeof schema.pattern !== "string") {
      throw new Error(`schema ${pointer} pattern requires type string`);
    }
    if (!hasFullMatchPatternWrapper(schema.pattern)) {
      throw new Error(`schema ${pointer} pattern must use the full-match wrapper ^(?:...)$`);
    }
    try {
      new RegExp(schema.pattern);
    } catch (error) {
      throw new Error(`schema ${pointer} pattern is invalid: ${error.message}`);
    }
  }

  if (Object.hasOwn(schema, "minimum")) {
    if (!["integer", "number"].includes(schema.type) || !Number.isFinite(schema.minimum)) {
      throw new Error(`schema ${pointer} minimum requires a finite numeric schema`);
    }
  }

  if (schema.type === "object") {
    requireStringArray(schema.required, `schema ${pointer} required`);
    requireObject(schema.properties, `schema ${pointer} properties`);
    if (!Object.hasOwn(schema, "additional_properties")) {
      throw new Error(`schema ${pointer} must declare additional_properties`);
    }
    for (const requiredProperty of schema.required) {
      if (!Object.hasOwn(schema.properties, requiredProperty)) {
        throw new Error(`schema ${pointer} required property ${requiredProperty} is not declared`);
      }
    }
    for (const [property, childSchema] of Object.entries(schema.properties)) {
      validateSchema(childSchema, `${pointer}/properties/${escapePointer(property)}`);
    }
    if (schema.additional_properties !== false) {
      validateSchema(schema.additional_properties, `${pointer}/additional_properties`);
    }
  } else if (["required", "properties", "additional_properties"].some((key) => Object.hasOwn(schema, key))) {
    throw new Error(`schema ${pointer} object keywords require type object`);
  }

  if (schema.type === "array") {
    if (!Object.hasOwn(schema, "items")) throw new Error(`schema ${pointer} array requires items`);
    validateSchema(schema.items, `${pointer}/items`);
  } else if (Object.hasOwn(schema, "items")) {
    throw new Error(`schema ${pointer} items requires type array`);
  }
}

function validateValue(value, schema, pointer, errors, ancestors) {
  if (value === null && schema.nullable === true) return;

  if (schema.type === "any-json") {
    if (!isFiniteJsonValue(value, ancestors)) {
      errors.push(`${displayPointer(pointer)}: must be a finite JSON value`);
      return;
    }
    if (Object.hasOwn(schema, "enum") && !schema.enum.some((candidate) => Object.is(candidate, value))) {
      errors.push(`${displayPointer(pointer)}: must equal one of ${schema.enum.map(JSON.stringify).join(", ")}`);
    }
    return;
  }

  if (!matchesPrimitiveType(value, schema.type)) {
    errors.push(`${displayPointer(pointer)}: must be ${typeDescription(schema.type)}`);
    return;
  }

  if (Object.hasOwn(schema, "enum") && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    errors.push(`${displayPointer(pointer)}: must equal one of ${schema.enum.map(JSON.stringify).join(", ")}`);
  }
  if (Object.hasOwn(schema, "minimum") && value < schema.minimum) {
    errors.push(`${displayPointer(pointer)}: must be greater than or equal to ${schema.minimum}`);
  }
  if (Object.hasOwn(schema, "pattern") && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${displayPointer(pointer)}: must match pattern ${schema.pattern}`);
  }

  if (schema.type === "array") {
    if (!isDenseJsonArray(value)) {
      errors.push(`${displayPointer(pointer)}: must be a dense JSON array`);
      return;
    }
    if (ancestors.has(value)) {
      errors.push(`${displayPointer(pointer)}: must be a finite JSON value`);
      return;
    }
    ancestors.add(value);
    value.forEach((item, index) => {
      validateValue(item, schema.items, joinPointer(pointer, index), errors, ancestors);
    });
    ancestors.delete(value);
  }

  if (schema.type === "object") {
    if (!hasPlainJsonProperties(value)) {
      errors.push(`${displayPointer(pointer)}: must be a plain JSON object`);
      return;
    }
    if (ancestors.has(value)) {
      errors.push(`${displayPointer(pointer)}: must be a finite JSON value`);
      return;
    }
    ancestors.add(value);
    for (const property of schema.required) {
      if (!Object.hasOwn(value, property)) {
        errors.push(`${joinPointer(pointer, property)}: is required`);
      }
    }
    for (const [property, child] of Object.entries(value)) {
      const childPointer = joinPointer(pointer, property);
      if (Object.hasOwn(schema.properties, property)) {
        validateValue(child, schema.properties[property], childPointer, errors, ancestors);
      } else if (schema.additional_properties === false) {
        errors.push(`${childPointer}: is not allowed`);
      } else {
        validateValue(child, schema.additional_properties, childPointer, errors, ancestors);
      }
    }
    ancestors.delete(value);
  }
}

function validateTask(task, apiId) {
  const name = taskName(task, apiId);
  requireExactPlainObject(task, name, TASK_KEYS);
  if (typeof task.id !== "string" || !/^[a-z0-9-]+$/.test(task.id)) {
    throw new Error(`task in ${apiId} requires a lowercase hyphenated id`);
  }

  const expectedContract = contracts.task_classes[task.class];
  if (!expectedContract) throw new Error(`task ${task.id} has unsupported class ${task.class}`);
  if (!["full", "compact"].includes(task.profile)) {
    throw new Error(`task ${task.id} profile must be full or compact`);
  }

  const publicName = `task ${task.id} public`;
  requirePlainFiniteObject(task.public, publicName);
  if (containsCycle(task.public)) throw new Error(`${publicName} must be a finite JSON value`);
  findForbiddenPublicKey(task.public, publicName);
  requireExactKeys(task.public, publicName, PUBLIC_KEYS);
  if (typeof task.public.user_task !== "string" || task.public.user_task.trim() === "") {
    throw new Error(`task ${task.id} public.user_task is required`);
  }
  if (task.public.output_contract !== expectedContract) {
    throw new Error(`task ${task.id} output_contract must be ${expectedContract}`);
  }
  validateRetrieval(task);

  requireExactPlainObject(task.private, `task ${task.id} private`, PRIVATE_KEYS);
  requirePlainFiniteObject(
    task.private.expected_outcome,
    `task ${task.id} private.expected_outcome`,
  );
  const expectedResult = validateOutputContract(task.private.expected_outcome, expectedContract);
  if (!expectedResult.valid) {
    throw new Error(`task ${task.id} expected_outcome is invalid: ${expectedResult.errors.join("; ")}`);
  }
  requireDenseArray(task.private.assertions, `task ${task.id} private.assertions`);
  if (task.private.assertions.length === 0) {
    throw new Error(`task ${task.id} requires private assertions`);
  }
  validateFactInventory(task);
  task.private.assertions.forEach((assertion, index) => validateAssertion(assertion, task, index));
}

function validateRetrieval(task) {
  const retrieval = task.public.retrieval;
  requireExactPlainObject(retrieval, `task ${task.id} public.retrieval`, RETRIEVAL_KEYS);
  requireStringArray(retrieval.openapi_roots, `task ${task.id} openapi_roots`, true);
  requireStringArray(retrieval.docai_files, `task ${task.id} docai_files`, true);
}

function validateAssertion(assertion, task, index) {
  const name = `task ${task.id} assertion ${index}`;
  requirePlainFiniteObject(assertion, name);
  requireExactKeys(assertion, name, ASSERTION_KEYS, [
    "path",
    "operator",
    "failure_category",
    "fact_id",
  ]);
  if (typeof assertion.path !== "string" || !JSON_POINTER_PATTERN.test(assertion.path)) {
    throw new Error(`task ${task.id} assertion ${index} requires an absolute JSON Pointer`);
  }
  if (!contracts.assertion_operators.includes(assertion.operator)) {
    throw new Error(`task ${task.id} has unsupported assertion operator ${assertion.operator}`);
  }
  if (!assertionOperatorForbidsValue(assertion.operator) && !Object.hasOwn(assertion, "value")) {
    throw new Error(`task ${task.id} assertion ${index} requires value`);
  }
  if (assertionOperatorForbidsValue(assertion.operator) && Object.hasOwn(assertion, "value")) {
    throw new Error(`task ${task.id} assertion ${index} ${assertion.operator} operator must not have value`);
  }
  if (["equals", "contains"].includes(assertion.operator)
      && !isFiniteJsonValue(assertion.value, new WeakSet())) {
    throw new Error(
      `task ${task.id} assertion ${index} ${assertion.operator} value must be a finite JSON value`,
    );
  }
  if (assertion.operator === "header_contains"
      && (!hasPlainJsonProperties(assertion.value)
        || Object.keys(assertion.value).length === 0
        || Object.values(assertion.value).some((value) => typeof value !== "string"))) {
    throw new Error(
      `task ${task.id} assertion ${index} header_contains value must be a non-empty plain object with string values`,
    );
  }
  if (assertion.operator === "set_equals"
      && (!isDenseJsonArray(assertion.value)
        || !isFiniteJsonValue(assertion.value, new WeakSet()))) {
    throw new Error(
      `task ${task.id} assertion ${index} set_equals value must be a dense finite JSON array`,
    );
  }
  if (typeof assertion.failure_category !== "string" || assertion.failure_category.trim() === "") {
    throw new Error(`task ${task.id} assertion ${index} requires failure_category`);
  }
  if (typeof assertion.fact_id !== "string" || assertion.fact_id.trim() === "") {
    throw new Error(`task ${task.id} assertion ${index} requires fact_id`);
  }
  if (!task.private.fact_inventory.required.includes(assertion.fact_id)) {
    throw new Error(`task ${task.id} assertion ${index} fact_id ${assertion.fact_id} is not required`);
  }
}

function assertionOperatorForbidsValue(operator) {
  return operator === "absent" || operator === "evaluator-ambiguity.v1";
}

function validateFactInventory(task) {
  const inventory = task.private.fact_inventory;
  requireExactPlainObject(inventory, `task ${task.id} fact_inventory`, FACT_INVENTORY_KEYS);
  requireStringArray(inventory.required, `task ${task.id} required facts`, true);
  requireStringArray(inventory.raw_missing, `task ${task.id} raw_missing`);
  requireStringArray(inventory.sliced_missing, `task ${task.id} sliced_missing`);

  const required = new Set(inventory.required);
  for (const fact of [...inventory.raw_missing, ...inventory.sliced_missing]) {
    if (!required.has(fact)) {
      throw new Error(`task ${task.id} missing fact ${fact} is not listed as required`);
    }
  }
}

function findForbiddenPublicKey(value, location, seen = new WeakSet()) {
  if (value && typeof value === "object") {
    if (seen.has(value)) return;
    seen.add(value);
  }
  if (Array.isArray(value)) {
    if (!isDenseJsonArray(value)) return;
    value.forEach((item, index) => findForbiddenPublicKey(item, `${location}[${index}]`, seen));
    return;
  }
  if (!hasPlainJsonProperties(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(key)) {
      throw new Error(`${location} task data must not contain ${key}`);
    }
    findForbiddenPublicKey(child, `${location}.${key}`, seen);
  }
}

function isFiniteJsonValue(value, ancestors) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;

  if (ancestors.has(value)) return false;
  ancestors.add(value);
  let valid;
  if (Array.isArray(value)) {
    valid = isDenseJsonArray(value) && value.every((item) => isFiniteJsonValue(item, ancestors));
  } else {
    valid = hasPlainJsonProperties(value)
      && Object.values(value).every((item) => isFiniteJsonValue(item, ancestors));
  }
  ancestors.delete(value);
  return valid;
}

function isDenseJsonArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) return false;
  const expectedOwnKeys = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
  if (ownKeys.length !== expectedOwnKeys.length || ownKeys.some((key, index) => key !== expectedOwnKeys[index])) {
    return false;
  }
  const enumerableKeys = Object.keys(value);
  if (enumerableKeys.length !== value.length) return false;
  return enumerableKeys.every((key, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return key === String(index) && descriptor.enumerable && Object.hasOwn(descriptor, "value");
  });
}

function hasPlainJsonProperties(value) {
  if (!isPlainObject(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) return false;
  return ownKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor.enumerable && Object.hasOwn(descriptor, "value");
  });
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function matchesPrimitiveType(value, type) {
  if (type === "object") return isPlainObject(value);
  if (type === "array") return Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "integer") return Number.isInteger(value) && Number.isFinite(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "null") return value === null;
  return type === "any-json";
}

function typeDescription(type) {
  if (type === "object") return "a plain JSON object";
  if (type === "array") return "an array";
  if (type === "string") return "a string";
  if (type === "integer") return "an integer";
  if (type === "number") return "a finite number";
  if (type === "boolean") return "a boolean";
  if (type === "null") return "null";
  return "a finite JSON value";
}

function isJsonScalar(value) {
  return value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function hasFullMatchPatternWrapper(pattern) {
  if (!pattern.startsWith("^(?:") || !pattern.endsWith(")$")) return false;

  let depth = 0;
  let escaped = false;
  let inCharacterClass = false;
  for (let index = 1; index < pattern.length - 1; index += 1) {
    const character = pattern[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "[" && !inCharacterClass) {
      inCharacterClass = true;
      continue;
    }
    if (character === "]" && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }
    if (inCharacterClass) continue;
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return index === pattern.length - 2;
      if (depth < 0) return false;
    }
  }
  return false;
}

function containsCycle(value, ancestors = new WeakSet(), visited = new WeakSet()) {
  if (!value || typeof value !== "object") return false;
  if (ancestors.has(value)) return true;
  if (visited.has(value)) return false;

  ancestors.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && Object.hasOwn(descriptor, "value")
        && containsCycle(descriptor.value, ancestors, visited)) {
      return true;
    }
  }
  ancestors.delete(value);
  visited.add(value);
  return false;
}

function taskName(task, apiId) {
  if (task && typeof task === "object") {
    const descriptor = Object.getOwnPropertyDescriptor(task, "id");
    if (descriptor && Object.hasOwn(descriptor, "value") && typeof descriptor.value === "string") {
      return `task ${descriptor.value}`;
    }
  }
  return `task in ${apiId}`;
}

function requireExactPlainObject(value, name, expectedKeys) {
  requirePlainFiniteObject(value, name);
  requireExactKeys(value, name, expectedKeys);
}

function requirePlainFiniteObject(value, name) {
  if (!hasPlainJsonProperties(value)) {
    throw new Error(`${name} must be a plain finite JSON object`);
  }
}

function requireExactKeys(value, name, allowedKeys, requiredKeys = allowedKeys) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${name} has unknown key ${key}`);
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) throw new Error(`${name} requires ${key}`);
  }
}

function requireDenseArray(value, name) {
  if (!isDenseJsonArray(value)) throw new Error(`${name} must be a dense JSON array`);
}

function requireObject(value, name) {
  if (!isPlainObject(value)) throw new Error(`${name} must be an object`);
}

function requireStringArray(value, name, requireNonempty = false) {
  if (!isDenseJsonArray(value)
      || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${name} must be an array of non-empty strings`);
  }
  if (requireNonempty && value.length === 0) throw new Error(`${name} must not be empty`);
  if (new Set(value).size !== value.length) throw new Error(`${name} must not contain duplicates`);
}

function joinPointer(pointer, token) {
  return `${pointer}/${escapePointer(String(token))}`;
}

function escapePointer(token) {
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

function displayPointer(pointer) {
  return pointer || "/";
}
