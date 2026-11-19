import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { PACKAGE_DIR, readPlan } from "./paths.mjs";
import { readTaskPacket } from "./contract.mjs";
import { buildTaskContext, parseYamlFile, parseYamlText } from "./context.mjs";
import { readAnswerPointer } from "./answer-values.mjs";
import { assertPlainJson } from "./strict-json.mjs";

const HTTP_ROOT = path.resolve(PACKAGE_DIR, "../../../../..");
const LEDGER_FILE = path.join(PACKAGE_DIR, "continuity/evidence-ledger.json");

export function readEvidenceLedger() {
  return JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
}

export function validateEvidenceLedger({ plan, packet, ledger, contexts }) {
  assertPlainJson({ plan, packet, ledger, contexts }, "evidence ledger input");
  const failures = [];
  const coverage = { measured: [], contextual_only: [] };
  const fail = (id, message) => failures.push(`${id}: ${message}`);
  if (ledger.benchmark_id !== plan.benchmark_id || ledger.plan_version !== plan.plan_version || !Array.isArray(ledger.rows)) {
    fail("ledger", "identity or rows invalid");
    return { failures, coverage };
  }
  const sources = new Map();
  const rendered = new Map();
  const seen = new Set();
  for (const row of ledger.rows) {
    const id = row.predicate_id;
    const task = packet.tasks.find((t) => t.id === row.task_id);
    if (!task || typeof id !== "string" || seen.has(id)) { fail(id, "unknown task or duplicate predicate"); continue; }
    seen.add(id);
    if (typeof row.measured !== "boolean" || !row.public_rule || !row.negative_control
        || !Array.isArray(row.source_evidence) || row.source_evidence.length === 0) {
      fail(id, "missing rule, negative control or source evidence");
    }
    const output = readAnswerPointer(task.private.expected_outcome, row.output_path);
    if (!output.found) fail(id, "output_path does not resolve in the typed answer");
    const assertion = task.private.assertions[row.negative_control?.assertion_index];
    if (row.measured && (!assertion || assertion.fact_id !== row.fact_id || assertion.path !== row.output_path)) fail(id, "no corresponding measured assertion");
    const availability = {};
    for (const condition of plan.conditions) {
      const context = contexts[task.id]?.[condition];
      if (!context || context.task_id !== task.id || context.condition !== condition || context.api_id !== packet.api_id) {
        fail(id, `missing or misidentified ${condition} context`);
        availability[condition] = "missing";
        continue;
      }
      const groups = new Map((row.source_evidence ?? []).map((evidence) => [evidence.group ?? "fact", false]));
      for (const evidence of row.source_evidence ?? []) {
        try {
          const file = safeSourcePath(evidence.file);
          if (!sources.has(file)) sources.set(file, evidence.pointer !== undefined ? parseYamlFile(file) : fs.readFileSync(file, "utf8"));
          const source = sources.get(file);
          if (typeof evidence.mapping !== "string" || evidence.mapping.trim().length < 20) throw new Error("missing reviewed source mapping");
          if (evidence.pointer !== undefined) {
            const found = readAnswerPointer(source, evidence.pointer);
            if (!found.found || !isDeepStrictEqual(found.value, evidence.source_value)) throw new Error("parsed source value mismatch");
            const yaml = renderedYaml(context, evidence.file, rendered);
            if (yaml !== undefined) {
              const actual = readAnswerPointer(yaml, evidence.pointer);
              if (actual.found && isDeepStrictEqual(actual.value, evidence.source_value)) groups.set(evidence.group ?? "fact", true);
            }
          } else {
            if (typeof evidence.source_value !== "string" || !evidence.source_value.trim()) throw new Error("missing Markdown excerpt");
            if (!markdownSection(source, evidence.section).includes(evidence.source_value)) throw new Error("Markdown source section/excerpt mismatch");
            const text = renderedMarkdown(context, evidence.file);
            if (text !== undefined && markdownSection(text, evidence.section).includes(evidence.source_value)) groups.set(evidence.group ?? "fact", true);
          }
        } catch (error) { fail(id, error.message); }
      }
      availability[condition] = groups.size > 0 && [...groups.values()].every(Boolean) ? "available" : "missing";
      if (row.availability?.[condition] !== availability[condition]) fail(id, `${condition} declared availability differs from rendered source evidence`);
    }
    if (!isDeepStrictEqual(Object.keys(row.availability ?? {}).sort(), [...plan.conditions].sort())) fail(id, "availability must name exactly four conditions");
    coverage[row.measured ? "measured" : "contextual_only"].push({ predicate_id: id, task_id: task.id, fact_id: row.fact_id, output_path: row.output_path, availability });
  }
  for (const task of packet.tasks) {
    for (const [index, assertion] of task.private.assertions.entries()) {
      if (!ledger.rows.some((r) => r.measured && r.task_id === task.id && r.fact_id === assertion.fact_id && r.output_path === assertion.path && r.negative_control?.assertion_index === index)) {
        fail(task.id, `assertion has no source mapping: ${assertion.fact_id} ${assertion.path}`);
      }
    }
    for (const fact of task.private.fact_inventory.required) {
      const rows = coverage.measured.filter((r) => r.task_id === task.id && r.fact_id === fact);
      if (!rows.length) fail(task.id, `required fact has no measured coverage: ${fact}`);
      for (const condition of plan.conditions) {
        const expectedMissing = condition === "openapi-raw" ? task.private.fact_inventory.raw_missing.includes(fact)
          : condition === "openapi-sliced" ? task.private.fact_inventory.sliced_missing.includes(fact) : false;
        if (rows.length && rows.some((r) => r.availability[condition] === "missing") !== expectedMissing) {
          fail(task.id, `${fact} ${condition} inventory disagrees with actual evidence`);
        }
      }
    }
  }
  return { failures: [...new Set(failures)], coverage };
}

function safeSourcePath(file) {
  if (typeof file !== "string" || !file.startsWith("fixtures/conformance/v1.0.0/")) throw new Error("source must be an unchanged Stable fixture");
  const resolved = path.resolve(HTTP_ROOT, file);
  const root = path.join(HTTP_ROOT, "fixtures/conformance/v1.0.0");
  if (!resolved.startsWith(`${root}${path.sep}`) || fs.realpathSync(resolved) !== resolved) throw new Error("source escapes Stable fixtures");
  return resolved;
}

function renderedYaml(context, file, cache) {
  if (!context.source_files.includes(file)) return undefined;
  const key = `${context.task_id}\0${context.condition}\0${file}`;
  if (cache.has(key)) return cache.get(key);
  let value;
  if (context.condition === "openapi-sliced") value = JSON.parse(context.content);
  else if (context.condition === "openapi-raw") value = parseYamlText(context.content);
  else if (context.condition === "openapi-enriched") {
    const marker = `<!-- ${file.includes("behavior") ? "behavior" : "openapi"}:${file} -->`;
    const start = context.content.indexOf(marker);
    if (start < 0) return undefined;
    const rest = context.content.slice(start + marker.length);
    value = parseYamlText(rest.split(/<!-- (?:openapi|behavior):/)[0]);
  }
  cache.set(key, value);
  return value;
}

function renderedMarkdown(context, file) {
  if (context.condition !== "docai-selected" || !context.source_files.includes(file)) return undefined;
  const relative = file.split(/\/valid\/(?:full|compact)\//)[1];
  const marker = `<!-- docai:${relative} -->`;
  const start = context.content.indexOf(marker);
  if (start < 0) return undefined;
  return context.content.slice(start + marker.length).split("<!-- docai:")[0];
}

function markdownSection(text, heading) {
  const lines = text.split("\n");
  const start = lines.indexOf(heading);
  if (start < 0) return "";
  const level = heading.match(/^#+/)?.[0].length;
  let end = start + 1;
  while (end < lines.length && !(new RegExp(`^#{1,${level}} `).test(lines[end]))) end += 1;
  return lines.slice(start, end).join("\n");
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const plan = readPlan();
    const packet = readTaskPacket(plan);
    const contexts = Object.fromEntries(packet.tasks.map((task) => [task.id, Object.fromEntries(plan.conditions.map((condition) => [condition, buildTaskContext({ api: { id: packet.api_id }, task, condition })]))]));
    const report = validateEvidenceLedger({ plan, packet, ledger: readEvidenceLedger(), contexts });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.failures.length) process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
