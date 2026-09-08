import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, types } from "node:util";

import { readTaskPacket } from "./contract.mjs";
import { PACKAGE_DIR, readPlan } from "./paths.mjs";
import { assertPlainJson } from "./strict-json.mjs";

const CONFORMANCE_DIR = path.resolve(PACKAGE_DIR, "..", "..", "..", "..", "..", "fixtures", "conformance", "v1.0.0");

export function buildTaskContext(input) {
  assertPlainJson(input, "context input");
  const { api, task, condition } = input;
  const plan = readPlan();
  const resolvedTask = canonicalTask(plan, api, task);
  if (!plan.conditions.includes(condition)) {
    throw new Error(`context condition must be one of ${plan.conditions.join(", ")}`);
  }
  return observeBuiltContext(plan, resolvedTask, condition).public_context;
}

export function buildParityReport(options = {}) {
  const transformBuiltContext = readParityTransform(options);
  const plan = readPlan();
  const api = { id: plan.calibration.api_id };
  const packet = readTaskPacket(plan);
  const tasks = packet.tasks.map((task) => parityTask(plan, api, task, transformBuiltContext));
  const failures = tasks.filter((task) => task.status !== "pass").map((task) => task.task_id);

  return {
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    status: failures.length === 0 ? "pass" : "fail",
    summary: { apis: 1, tasks: tasks.length, parity_failures: failures.length },
    failures,
    tasks,
  };
}

function readParityTransform(options) {
  if (types.isProxy(options)) throw new TypeError("parity options must not be a Proxy");
  if (!options || typeof options !== "object" || Array.isArray(options)
      || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError("parity options must be a plain object");
  }
  const keys = Reflect.ownKeys(options);
  for (const key of keys) {
    if (typeof key !== "string") throw new TypeError("parity options must not contain symbol keys");
    if (key !== "transformBuiltContext") throw new Error(`parity options has unknown option ${key}`);
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError(`parity option ${key} must be own enumerable data`);
    }
  }
  if (!Object.hasOwn(options, "transformBuiltContext")) return (context) => context;
  const transform = Object.getOwnPropertyDescriptor(options, "transformBuiltContext").value;
  if (types.isProxy(transform)) throw new TypeError("parity transformBuiltContext must not be a Proxy");
  if (typeof transform !== "function") throw new TypeError("parity transformBuiltContext must be a function");
  return transform;
}

function parityTask(plan, api, task, transformBuiltContext) {
  const contexts = Object.fromEntries(plan.conditions.map((condition) => [
    condition,
    observeBuiltContext(plan, task, condition, transformBuiltContext),
  ]));
  const inventory = task.private.fact_inventory;
  const required = sortedUnique(inventory.required);
  const rawMissing = contexts["openapi-raw"].missing_fact_ids;
  const slicedMissing = contexts["openapi-sliced"].missing_fact_ids;
  const enrichedFacts = contexts["openapi-enriched"].fact_ids;
  const docaiFacts = contexts["docai-selected"].fact_ids;
  const expectedRawMissing = sortedUnique(inventory.raw_missing);
  const expectedSlicedMissing = sortedUnique(inventory.sliced_missing);
  const parity = sameValues(required, enrichedFacts)
    && sameValues(required, docaiFacts)
    && sameValues(expectedRawMissing, rawMissing)
    && sameValues(expectedSlicedMissing, slicedMissing)
    && sameValues(difference(required, expectedRawMissing), contexts["openapi-raw"].fact_ids)
    && sameValues(difference(required, expectedSlicedMissing), contexts["openapi-sliced"].fact_ids)
    && contexts["openapi-enriched"].missing_fact_ids.length === 0
    && contexts["docai-selected"].missing_fact_ids.length === 0;

  return {
    api_id: api.id,
    task_id: task.id,
    status: parity ? "pass" : "fail",
    required_fact_ids: required,
    enriched_fact_ids: enrichedFacts,
    docai_fact_ids: docaiFacts,
    enriched_missing: difference(required, enrichedFacts),
    docai_missing: difference(required, docaiFacts),
    raw_missing: rawMissing,
    sliced_missing: slicedMissing,
  };
}

function observeBuiltContext(plan, task, condition, transformBuiltContext = (context) => context) {
  const built = transformBuiltContext(
    buildStableContext({ id: plan.calibration.api_id }, task, condition),
    { api_id: plan.calibration.api_id, task, condition },
  );
  assertPlainJson(built, "stable context");
  if (!Array.isArray(built.fact_ids) || !Array.isArray(built.missing_fact_ids)) {
    throw new Error("stable context builder must return fact_ids and missing_fact_ids arrays");
  }
  const factIds = sortedUnique(built.fact_ids);
  const missingFactIds = sortedUnique(built.missing_fact_ids);
  if (factIds.some((factId) => typeof factId !== "string") || missingFactIds.some((factId) => typeof factId !== "string")) {
    throw new Error("stable context builder fact metadata must contain strings");
  }
  return {
    fact_ids: factIds,
    missing_fact_ids: missingFactIds,
    public_context: {
      api_id: plan.calibration.api_id,
      task_id: task.id,
      condition,
      media_type: built.media_type,
      source_files: [...built.source_files],
      content: built.content,
    },
  };
}

function buildStableContext(api, task, condition) {
  const artifacts = resolveStableArtifacts(api);
  const missingFactIds = condition === "openapi-raw" ? [...task.private.fact_inventory.raw_missing]
    : condition === "openapi-sliced" ? [...task.private.fact_inventory.sliced_missing] : [];
  const common = {
    api_id: api.id,
    task_id: task.id,
    condition,
    fact_ids: task.private.fact_inventory.required.filter((fact) => !missingFactIds.includes(fact)),
    missing_fact_ids: missingFactIds,
  };
  if (condition === "openapi-raw") return {
    ...common, media_type: "application/yaml", source_files: [logicalPath(artifacts.openapi)], content: readUtf8(artifacts.openapi),
  };
  if (condition === "openapi-sliced") {
    const sliced = sliceOpenApiDocument(parseYamlFile(artifacts.openapi), task.public.retrieval.openapi_roots);
    return { ...common, media_type: "application/json", source_files: [logicalPath(artifacts.openapi)], content: `${JSON.stringify(sliced, null, 2)}\n` };
  }
  if (condition === "openapi-enriched") {
    const openapiPath = logicalPath(artifacts.openapi);
    const behaviorPath = logicalPath(artifacts.behavior);
    return { ...common, media_type: "text/plain", source_files: [openapiPath, behaviorPath], content: [
      `<!-- openapi:${openapiPath} -->`, "", readUtf8(artifacts.openapi).trimEnd(), "",
      `<!-- behavior:${behaviorPath} -->`, "", readUtf8(artifacts.behavior).trimEnd(), "",
    ].join("\n") };
  }
  const profileRoot = task.profile === "compact" ? artifacts.docai.compact : artifacts.docai.full;
  const files = task.public.retrieval.docai_files.map((relativeFile) => {
    const resolved = path.resolve(profileRoot, relativeFile);
    ensureWithin(profileRoot, resolved, `DocAI retrieval path ${relativeFile}`);
    return { relativeFile, resolved };
  });
  return { ...common, media_type: "text/markdown", source_files: files.map(({ resolved }) => logicalPath(resolved)), content: files.flatMap(({ relativeFile, resolved }) => [
    `<!-- docai:${relativeFile} -->`, "", readUtf8(resolved).trimEnd(), "",
  ]).join("\n") };
}

function resolveStableArtifacts(api) {
  if (!api || api.id !== "complete-commerce") throw new Error("context api_id must be complete-commerce");
  return {
    openapi: path.join(CONFORMANCE_DIR, "source", "complete-openapi.yaml"),
    behavior: path.join(CONFORMANCE_DIR, "source", "complete-behavior.yaml"),
    docai: { full: path.join(CONFORMANCE_DIR, "valid", "full"), compact: path.join(CONFORMANCE_DIR, "valid", "compact") },
  };
}

function canonicalTask(plan, api, task) {
  if (!api || api.id !== plan.calibration.api_id) throw new Error(`context api_id must be ${plan.calibration.api_id}`);
  const expected = readTaskPacket(plan).tasks.find((candidate) => candidate.id === task?.id);
  if (!expected || !isDeepStrictEqual(task, expected)) throw new Error(`context requires a canonical task for ${plan.calibration.api_id}`);
  return expected;
}

export function parseYamlFile(file) {
  if (typeof file !== "string" || file.length === 0) throw new TypeError("YAML file path must be a non-empty string");
  const script = [
    "file = ARGV.fetch(0)",
    "source = File.binread(file)",
    "nodes = [Psych.parse_stream(source, filename: file)]",
    "until nodes.empty?; node = nodes.pop; raise ArgumentError, \"Explicit YAML tags are not allowed: #{node.tag}\" if node.respond_to?(:tag) && node.tag; children = node.respond_to?(:children) ? node.children : nil; nodes.concat(children) if children; end",
    "value = Psych.safe_load(source, permitted_classes: [], permitted_symbols: [], aliases: false, filename: file)",
    "STDOUT.write(JSON.generate(value))",
  ].join("; ");
  const result = spawnSync("ruby", ["-rpsych", "-rjson", "-e", script, file], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw new Error(`Unable to run Ruby YAML parser for ${file}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Unable to parse YAML ${file}: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}

function sliceOpenApiDocument(document, roots) {
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("OpenAPI document must be an object");
  if (!Array.isArray(roots) || roots.length === 0) throw new Error("At least one OpenAPI root is required");
  const sliced = {};
  if (document.openapi !== undefined) sliced.openapi = structuredClone(document.openapi);
  if (document.info !== undefined) sliced.info = structuredClone(document.info);
  const pending = [];
  roots.forEach((root) => { const resolved = resolveDottedRoot(document, root); setPath(sliced, resolved.path, structuredClone(resolved.value)); collectLocalRefs(resolved.value, pending); });
  const visited = new Set();
  while (pending.length > 0) {
    const ref = pending.shift();
    if (visited.has(ref)) continue;
    visited.add(ref);
    const pointerPath = ref.slice(2).split("/").map((segment) => decodeURIComponent(segment.replaceAll("~1", "/").replaceAll("~0", "~")));
    const value = getPath(document, pointerPath, `OpenAPI reference ${ref}`);
    setPath(sliced, pointerPath, structuredClone(value));
    collectLocalRefs(value, pending);
  }
  return sliced;
}

function resolveDottedRoot(document, root) {
  if (typeof root !== "string" || root.trim() === "") throw new Error("OpenAPI root must be a non-empty string");
  const resolveSegments = (current, remaining, consumed) => {
    if (remaining.length === 0) return { path: consumed, value: current };
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    for (let count = remaining.length; count >= 1; count -= 1) {
      const key = remaining.slice(0, count).join(".");
      if (!Object.hasOwn(current, key)) continue;
      const result = resolveSegments(current[key], remaining.slice(count), [...consumed, key]);
      if (result) return result;
    }
    return null;
  };
  const resolved = resolveSegments(document, root.split("."), []);
  if (!resolved) throw new Error(`OpenAPI root not found: ${root}`);
  return resolved;
}

function collectLocalRefs(value, output) {
  if (Array.isArray(value)) { value.forEach((item) => collectLocalRefs(item, output)); return; }
  if (!value || typeof value !== "object") return;
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) output.push(value.$ref);
  Object.values(value).forEach((item) => collectLocalRefs(item, output));
}

function getPath(document, segments, label) {
  let current = document;
  segments.forEach((segment) => { if (!current || typeof current !== "object" || !Object.hasOwn(current, segment)) throw new Error(`${label} does not resolve`); current = current[segment]; });
  return current;
}

function setPath(target, segments, value) {
  let current = target;
  segments.forEach((segment, index) => { if (index === segments.length - 1) { current[segment] = value; return; } if (!Object.hasOwn(current, segment)) current[segment] = {}; current = current[segment]; });
}

function ensureWithin(root, candidate, label) {
  const relative = path.relative(path.resolve(root), candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`${label} escapes its profile root`);
}

function readUtf8(file) { return fs.readFileSync(file, "utf8"); }
function logicalPath(file) { return path.relative(path.resolve(PACKAGE_DIR, "..", "..", "..", "..", ".."), file).split(path.sep).join("/"); }
function sortedUnique(values) { return [...new Set(values)].sort(); }
function difference(left, right) { const rightSet = new Set(right); return left.filter((value) => !rightSet.has(value)); }
function sameValues(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
