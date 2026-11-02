import fs from "node:fs";
import path from "node:path";
import { compareExactJsonNumbers, parseExactJson } from "./json-value.mjs";
import { decodeUtf8Bytes } from "./identity.mjs";
import { isDeepStrictEqual } from "node:util";

export const COMPLETE_REQUIREMENTS = Array.from({ length: 38 }, (_, n) => `R8-COMPLETE-${String(n + 1).padStart(3, "0")}`);
export const CONDITIONAL_REQUIREMENTS = ["R8-1X-001", "R8-1X-002", "RELEASE-HDR-001"];
const kinds = new Set(["complete-pair", "complete-full", "complete-compact", "complete-source-scenario"]);
export function assertCorpusFacts(facts, assertions) {
  requireValue(Array.isArray(assertions), "assertions must be an array");
  for (const assertion of assertions) {
    objectKeys(assertion, ["pointer", "equals"], [], "fact assertion");
    const pointer = assertion.pointer;
    requireValue(typeof pointer === "string" && (pointer === "" || pointer.startsWith("/"))
      && !/~(?![01])/.test(pointer), "invalid facts pointer");
    let value = facts, found = true;
    for (const key of pointer === "" ? [] : pointer.slice(1).split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"))) {
      if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) { found = false; break; }
      value = value[key];
    }
    requireValue(found && isDeepStrictEqual(value, assertion.equals), `fact-mismatch:${pointer}`);
  }
}
export function requireValue(condition, message) {
  if (!condition) throw new TypeError(`Complete corpus: ${message}`);
}
export function objectKeys(value, required, optional, label) {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  requireValue(required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => [...required, ...optional].includes(key)), `${label} fields are invalid`);
}
export function uniqueStrings(value, label, { nonempty = false } = {}) {
  requireValue(Array.isArray(value) && (!nonempty || value.length > 0)
    && value.every(item => typeof item === "string" && item.length > 0)
    && new Set(value).size === value.length, `${label} must contain unique strings`);
}
export function safeRelative(value) {
  requireValue(typeof value === "string" && value.split("/").every(part =>
    /^[A-Za-z0-9._-]+$/.test(part) && part !== "." && part !== ".."), `unsafe path ${String(value)}`);
  return value;
}
export function containedPath(root, relative, { exists = true } = {}) {
  safeRelative(relative);
  let current = path.resolve(root);
  requireValue(!fs.lstatSync(current).isSymbolicLink(), "root path must not be a symbolic link");
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (fs.existsSync(current)) requireValue(!fs.lstatSync(current).isSymbolicLink(), `symbolic link path ${relative}`);
    else requireValue(!exists, `missing path ${relative}`);
  }
  return current;
}
export function readCorpusJson(file) {
  const text = decodeUtf8Bytes(fs.readFileSync(file));
  const exact = parseExactJson(text); // Also rejects duplicate member names.
  const minimum = parseExactJson("-9007199254740991");
  const maximum = parseExactJson("9007199254740991");
  function validateNumbers(value) {
    if (value instanceof Map) {
      for (const member of value.values()) validateNumbers(member);
    } else if (Array.isArray(value)) {
      for (const member of value) validateNumbers(member);
    } else if (value !== null && typeof value === "object" && value.kind === "number") {
      // The exact normalized tuple has no trailing coefficient zeroes. A
      // negative exponent is fractional even when native conversion rounds it.
      requireValue(value.exponent >= 0n && compareExactJsonNumbers(value, minimum) >= 0
        && compareExactJsonNumbers(value, maximum) <= 0,
      "recipe numeric literals must be exact safe integers; preserve numeric source as strings");
    }
  }
  validateNumbers(exact);
  return JSON.parse(text, (_key, value) => {
    requireValue(typeof value !== "number" || Number.isSafeInteger(value),
      "recipe numeric literals must be safe integers; preserve exact numeric source as strings");
    return value;
  });
}
export function validateCorpusManifest(manifest, ruleIds) {
  objectKeys(manifest, ["schema_version", "docai_messaging", "scope", "base_files", "requirements", "cases"], [], "manifest");
  requireValue(manifest.schema_version === 1 && manifest.docai_messaging === "0.17.1"
    && manifest.scope === "complete-candidate", "unsupported manifest schema/version/scope");
  requireValue(manifest.base_files && !Array.isArray(manifest.base_files)
    && typeof manifest.base_files === "object" && Object.keys(manifest.base_files).length > 0, "missing base files");
  for (const [name, hash] of Object.entries(manifest.base_files)) {
    safeRelative(name);
    requireValue(/^(full|compact|source)\//.test(name) && /^[0-9a-f]{64}$/.test(hash), "invalid base file binding");
  }
  requireValue(Array.isArray(manifest.requirements), "missing requirements");
  const expected = [...COMPLETE_REQUIREMENTS, ...CONDITIONAL_REQUIREMENTS];
  const ids = manifest.requirements.map(row => row.id);
  uniqueStrings(ids, "requirement IDs");
  requireValue(ids.length === expected.length && ids.every(id => expected.includes(id)), "requirement inventory differs");
  const facetKeys = new Set();
  for (const row of manifest.requirements) {
    objectKeys(row, ["id", "facets_complete", "facets"], [], "requirement");
    uniqueStrings(row.facets, "facet IDs");
    requireValue(typeof row.facets_complete === "boolean" && (!row.facets_complete || row.facets.length > 0), "incomplete facet declaration");
    for (const facet of row.facets) facetKeys.add(`${row.id}/${facet}`);
  }
  requireValue(Array.isArray(manifest.cases) && manifest.cases.length > 0, "missing cases");
  uniqueStrings(manifest.cases.map(entry => entry.id), "case IDs");
  uniqueStrings(manifest.cases.map(entry => entry.path), "case paths");
  for (const entry of manifest.cases) {
    objectKeys(entry, ["id", "kind", "path", "expected", "expected_rule_ids", "rule_ids", "facets"], [], "case");
    safeRelative(entry.path);
    requireValue(kinds.has(entry.kind) && ["valid", "invalid"].includes(entry.expected), "invalid case kind/expectation");
    requireValue(entry.path.startsWith(`focused/${entry.expected}/`) && entry.path.endsWith(".json"), "case path/expectation differs");
    uniqueStrings(entry.expected_rule_ids, "expected rule IDs");
    uniqueStrings(entry.rule_ids, "case rule IDs", { nonempty: true });
    requireValue([...entry.rule_ids, ...entry.expected_rule_ids].every(id => ruleIds.has(id)), "unknown rule ID");
    requireValue(entry.expected_rule_ids.length === (entry.expected === "valid" ? 0 : 1)
      && entry.expected_rule_ids.every(id => entry.rule_ids.includes(id)), "case needs one primary rule for invalid, none for valid");
    requireValue(Array.isArray(entry.facets), "invalid case facets");
    const refs = entry.facets.map(ref => {
      objectKeys(ref, ["requirement", "facet"], [], "facet reference");
      const key = `${ref.requirement}/${ref.facet}`;
      requireValue(facetKeys.has(key), "unknown facet reference");
      return key;
    });
    uniqueStrings(refs, "case facet references");
  }
}
