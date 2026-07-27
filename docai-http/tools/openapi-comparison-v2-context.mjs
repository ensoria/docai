import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  BENCHMARK_DIR,
  readV2Plan,
} from "./openapi-comparison-v2-utils.mjs";
import {
  readContractPacket,
  validateBenchmarkTaskPacket,
} from "./openapi-comparison-v2-contract.mjs";

const CONFORMANCE_DIR = path.resolve(BENCHMARK_DIR, "..", "..", "..", "fixtures", "conformance", "v1.0.0");
const CONDITIONS = new Set([
  "openapi-raw",
  "openapi-sliced",
  "openapi-enriched",
  "docai-selected",
]);

export function resolveApiArtifacts(api) {
  if (!api || typeof api.id !== "string") throw new Error("API descriptor with id is required");

  if (api.id === "complete-commerce") {
    return {
      root: CONFORMANCE_DIR,
      task_packet: path.join(BENCHMARK_DIR, "continuity", "tasks.json"),
      openapi: path.join(CONFORMANCE_DIR, "source", "complete-openapi.yaml"),
      behavior: path.join(CONFORMANCE_DIR, "source", "complete-behavior.yaml"),
      docai: {
        full: path.join(CONFORMANCE_DIR, "valid", "full"),
        compact: path.join(CONFORMANCE_DIR, "valid", "compact"),
      },
    };
  }

  if (api.id.startsWith("holdout-")) {
    const holdoutName = api.id.slice("holdout-".length);
    const root = path.join(BENCHMARK_DIR, "private", "holdouts", holdoutName);
    return {
      root,
      task_packet: path.join(root, "tasks.json"),
      openapi: path.join(root, "source", "openapi.yaml"),
      behavior: path.join(root, "source", "behavior.yaml"),
      docai: {
        full: path.join(root, "docai", "full"),
        compact: path.join(root, "docai", "compact"),
      },
    };
  }

  throw new Error(`No benchmark artifact mapping for API ${api.id}`);
}

export function readApiTaskPacket(api, plan = readV2Plan()) {
  const artifacts = resolveApiArtifacts(api);
  const packet = readContractPacket(artifacts.task_packet);
  return validateBenchmarkTaskPacket(packet, plan);
}

export function buildTaskContext(api, task, condition) {
  if (!CONDITIONS.has(condition)) throw new Error(`Unsupported context condition ${condition}`);
  const artifacts = resolveApiArtifacts(api);
  const missingFactIds = missingFacts(task, condition);
  const requiredFactIds = [...task.private.fact_inventory.required];
  const common = {
    api_id: api.id,
    task_id: task.id,
    condition,
    fact_ids: requiredFactIds.filter((fact) => !missingFactIds.includes(fact)),
    missing_fact_ids: missingFactIds,
  };

  if (condition === "openapi-raw") {
    return {
      ...common,
      media_type: "application/yaml",
      source_files: [logicalPath(artifacts.openapi)],
      content: readUtf8(artifacts.openapi),
    };
  }

  if (condition === "openapi-sliced") {
    const openapi = parseYamlFile(artifacts.openapi);
    const sliced = sliceOpenApiDocument(openapi, task.public.retrieval.openapi_roots);
    return {
      ...common,
      media_type: "application/json",
      source_files: [logicalPath(artifacts.openapi)],
      content: `${JSON.stringify(sliced, null, 2)}\n`,
    };
  }

  if (condition === "openapi-enriched") {
    const openapiPath = logicalPath(artifacts.openapi);
    const behaviorPath = logicalPath(artifacts.behavior);
    return {
      ...common,
      media_type: "text/plain",
      source_files: [openapiPath, behaviorPath],
      content: [
        `<!-- openapi:${openapiPath} -->`,
        "",
        readUtf8(artifacts.openapi).trimEnd(),
        "",
        `<!-- behavior:${behaviorPath} -->`,
        "",
        readUtf8(artifacts.behavior).trimEnd(),
        "",
      ].join("\n"),
    };
  }

  const profileRoot = task.profile === "compact" ? artifacts.docai.compact : artifacts.docai.full;
  const files = task.public.retrieval.docai_files.map((relativeFile) => {
    const resolved = path.resolve(profileRoot, relativeFile);
    ensureWithin(profileRoot, resolved, `DocAI retrieval path ${relativeFile}`);
    return { relativeFile, resolved };
  });
  return {
    ...common,
    media_type: "text/markdown",
    source_files: files.map(({ resolved }) => logicalPath(resolved)),
    content: files.flatMap(({ relativeFile, resolved }) => [
      `<!-- docai:${relativeFile} -->`,
      "",
      readUtf8(resolved).trimEnd(),
      "",
    ]).join("\n"),
  };
}

export function sliceOpenApiDocument(document, roots) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("OpenAPI document must be an object");
  }
  if (!Array.isArray(roots) || roots.length === 0) {
    throw new Error("At least one OpenAPI root is required");
  }

  const sliced = {};
  if (document.openapi !== undefined) sliced.openapi = structuredClone(document.openapi);
  if (document.info !== undefined) sliced.info = structuredClone(document.info);

  const pending = [];
  roots.forEach((root) => {
    const resolved = resolveDottedRoot(document, root);
    setPath(sliced, resolved.path, structuredClone(resolved.value));
    collectLocalRefs(resolved.value, pending);
  });

  const visited = new Set();
  while (pending.length > 0) {
    const ref = pending.shift();
    if (visited.has(ref)) continue;
    visited.add(ref);

    const pointerPath = parseLocalPointer(ref);
    const value = getPath(document, pointerPath, `OpenAPI reference ${ref}`);
    setPath(sliced, pointerPath, structuredClone(value));
    collectLocalRefs(value, pending);
  }

  return sliced;
}

export function buildParityReport({ privateRequired = false } = {}) {
  const plan = readV2Plan();
  const tasks = [];
  const skippedApis = [];

  plan.apis.forEach((api) => {
    const artifacts = resolveApiArtifacts(api);
    if (!fs.existsSync(artifacts.task_packet)) {
      if (privateRequired || !api.private_until_run_close) {
        throw new Error(`Required task packet is missing for ${api.id}: ${artifacts.task_packet}`);
      }
      skippedApis.push(api.id);
      return;
    }

    const packet = readApiTaskPacket(api, plan);
    packet.tasks.forEach((task) => {
      const raw = buildTaskContext(api, task, "openapi-raw");
      const sliced = buildTaskContext(api, task, "openapi-sliced");
      const enriched = buildTaskContext(api, task, "openapi-enriched");
      const docai = buildTaskContext(api, task, "docai-selected");
      const required = sortedUnique(task.private.fact_inventory.required);
      const enrichedFacts = sortedUnique(enriched.fact_ids);
      const docaiFacts = sortedUnique(docai.fact_ids);
      const parity = sameValues(required, enrichedFacts) && sameValues(required, docaiFacts);

      tasks.push({
        api_id: api.id,
        task_id: task.id,
        status: parity ? "pass" : "fail",
        required_fact_ids: required,
        enriched_fact_ids: enrichedFacts,
        docai_fact_ids: docaiFacts,
        enriched_missing: difference(required, enrichedFacts),
        docai_missing: difference(required, docaiFacts),
        raw_missing: [...raw.missing_fact_ids],
        sliced_missing: [...sliced.missing_fact_ids],
      });
    });
  });

  const parityFailures = tasks.filter((task) => task.status !== "pass").length;
  return {
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    status: parityFailures === 0 ? "pass" : "fail",
    summary: {
      apis: plan.apis.length - skippedApis.length,
      tasks: tasks.length,
      parity_failures: parityFailures,
      skipped_apis: skippedApis.length,
    },
    skipped_apis: skippedApis,
    tasks,
  };
}

function missingFacts(task, condition) {
  if (condition === "openapi-raw") return [...task.private.fact_inventory.raw_missing];
  if (condition === "openapi-sliced") return [...task.private.fact_inventory.sliced_missing];
  return [];
}

function parseYamlFile(file) {
  const script = [
    "value = YAML.load_file(ARGV.fetch(0))",
    "STDOUT.write(JSON.generate(value))",
  ].join("; ");
  const result = spawnSync("ruby", ["-ryaml", "-rjson", "-e", script, file], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Unable to run Ruby YAML parser for ${file}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Unable to parse YAML ${file}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

function resolveDottedRoot(document, root) {
  if (typeof root !== "string" || root.trim() === "") {
    throw new Error("OpenAPI root must be a non-empty string");
  }
  const segments = root.split(".");
  const resolved = resolveSegments(document, segments, []);
  if (!resolved) throw new Error(`OpenAPI root not found: ${root}`);
  return resolved;
}

function resolveSegments(current, remaining, consumed) {
  if (remaining.length === 0) return { path: consumed, value: current };
  if (!current || typeof current !== "object" || Array.isArray(current)) return null;

  for (let count = remaining.length; count >= 1; count -= 1) {
    const key = remaining.slice(0, count).join(".");
    if (!Object.hasOwn(current, key)) continue;
    const result = resolveSegments(current[key], remaining.slice(count), [...consumed, key]);
    if (result) return result;
  }
  return null;
}

function collectLocalRefs(value, output) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLocalRefs(item, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) output.push(value.$ref);
  Object.values(value).forEach((item) => collectLocalRefs(item, output));
}

function parseLocalPointer(ref) {
  return ref.slice(2).split("/").map((segment) => (
    decodeURIComponent(segment.replaceAll("~1", "/").replaceAll("~0", "~"))
  ));
}

function getPath(document, segments, label) {
  let current = document;
  segments.forEach((segment) => {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, segment)) {
      throw new Error(`${label} does not resolve`);
    }
    current = current[segment];
  });
  return current;
}

function setPath(target, segments, value) {
  let current = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }
    if (!Object.hasOwn(current, segment)) current[segment] = {};
    current = current[segment];
  });
}

function ensureWithin(root, candidate, label) {
  const relative = path.relative(path.resolve(root), candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes its profile root`);
  }
}

function readUtf8(file) {
  return fs.readFileSync(file, "utf8");
}

function logicalPath(file) {
  return path.relative(path.resolve(BENCHMARK_DIR, "..", "..", ".."), file).split(path.sep).join("/");
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
