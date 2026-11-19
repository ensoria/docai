import { isDeepStrictEqual } from "node:util";
import { readAnswerPointer, referenceIdentity, validateAnswerRelations, collectionIdentity, isAnswerCollectionPath, stableJson, walk } from "./answer-values.mjs";
import { assertPlainJson } from "./strict-json.mjs";

const CONDITIONS = new Set(["openapi-raw", "openapi-sliced", "openapi-enriched", "docai-selected"]);
const OPERATORS = new Set(["equals", "contains", "absent", "set_equals", "header_contains", "evaluator-ambiguity.v1"]);
const environment = () => ({ forward: new Map(), reverse: new Map(), generatedRules: new Map() });
const copy = (env) => ({ ...env, forward: new Map(env.forward), reverse: new Map(env.reverse) });
const commit = (env, next) => { env.forward = next.forward; env.reverse = next.reverse; };

export function evaluateTaskSemantics({ answer, task, condition, ledger }) {
  assertPlainJson({ answer, task, condition, ledger }, "semantic input");
  if (!CONDITIONS.has(condition)) throw new Error(`Grader received unsupported condition ${String(condition)}`);
  const failures = validateAnswerRelations({ answer, task });
  walk(answer, "", (v, path) => {
    if (v.status === "unknown" || v.status === "partial") failures.push({ predicate_id: "language:required-knowledge", path, category: "required-knowledge", message: "Required answer knowledge is incomplete" });
  });
  const env = environment();
  const expected = task.private.expected_outcome;
  // These existing source-mapped key facts require visible ASCII strings, which UUIDs satisfy.
  const keyFacts = new Set(["common:create-idempotency", "checkout:payment-idempotency", "checkout:order-idempotency"]);
  for (const [index, a] of task.private.assertions.entries()) {
    if (!keyFacts.has(a.fact_id) || !ledger.rows.some((r) => r.measured && r.task_id === task.id && r.fact_id === a.fact_id && r.output_path === a.path && r.negative_control.assertion_index === index)) continue;
    walk(a.value, "", (v) => { if (v.kind === "generated" && v.rule === "opaque-string") env.generatedRules.set(referenceIdentity(v), new Set(["opaque-string", "uuid"])); });
  }
  // Bind by local role before policy assertions, never by private scope spelling.
  anchor(answer, expected, "", env, failures);
  const diagnostics = [];
  for (const [index, assertion] of task.private.assertions.entries()) {
    const row = ledger.rows.find((r) => r.measured && r.task_id === task.id && r.fact_id === assertion.fact_id
      && r.output_path === assertion.path && r.negative_control.assertion_index === index);
    const predicate_id = row?.predicate_id ?? `${task.id}:assertion:${index}`;
    if (assertion.path === `/steps/items/${expected.steps?.items.length - 1}/order` && answer.steps.items.length > expected.steps.items.length) {
      failures.push({ predicate_id, path: "/steps", category: assertion.failure_category, message: "Additional steps violate the documented workflow sequence" });
    }
    const resolved = resolveSemanticPointer(answer, expected, assertion.path);
    const result = assertionResult(resolved, assertion, env);
    if (!result.pass) failures.push({ predicate_id, path: assertion.path, category: assertion.failure_category, message: result.reason });
    if (policyCollection(assertion.path) && Array.isArray(resolved.value?.items)) {
      const canonical = readAnswerPointer(expected, assertion.path).value;
      for (const [i, item] of resolved.value.items.entries()) {
        if (!(canonical?.items ?? []).some((v) => collectionIdentity(item, assertion.path) === collectionIdentity(v, assertion.path))) {
          failures.push({ predicate_id, path: `${assertion.path}/items/${i}`, category: assertion.failure_category, message: "Additional policy or state has no documented counterpart" });
        }
      }
    }
    if (assertion.operator === "evaluator-ambiguity.v1") continue;
    const missingKey = condition === "openapi-raw" ? "raw_missing" : condition === "openapi-sliced" ? "sliced_missing" : null;
    const available = row ? row.availability[condition] === "available" : !(missingKey && task.private.fact_inventory[missingKey].includes(assertion.fact_id));
    const canonical = readAnswerPointer(expected, assertion.path).value;
    const claim = claimState(resolved, assertion.value, assertion.path, env, canonical);
    const status = available ? (claim === "unknown" ? "missed-fact" : "none")
      : claim === "unknown" ? (reportedGap(answer, resolved, assertion.value, assertion.path, env, canonical) ? "reported-gap" : "none") : claim === "known" ? "unsupported-guess" : "none";
    diagnostics.push({ predicate_id, fact_id: assertion.fact_id, path: assertion.path, availability: available ? "available" : "missing", status });
  }
  validateAdditionalErrorReplay({ answer, task, ledger, env, failures });
  const status = ["missed-fact", "unsupported-guess", "reported-gap"].find((s) => diagnostics.some((d) => d.status === s)) ?? "none";
  return { passed: failures.length === 0, failures, evidence_discipline: { status, diagnostics } };
}

export function evaluateAssertion(contentJson, assertion) {
  assertPlainJson(contentJson, "grader content JSON");
  assertPlainJson(assertion, "grader assertion");
  return assertionResult(readAnswerPointer(contentJson, assertion.path), assertion, environment());
}

function assertionResult(resolved, assertion, env) {
  if (!OPERATORS.has(assertion.operator)) throw new Error(`Grader received unsupported assertion operator ${assertion.operator}`);
  if (assertion.operator === "evaluator-ambiguity.v1") return { pass: false, reason: "requires evaluator ambiguity review", evaluator_ambiguity: true };
  if (assertion.operator === "absent") return { pass: !resolved.found, reason: resolved.found ? "must be absent" : "" };
  if (!resolved.found) return { pass: false, reason: "is missing" };
  const trial = copy(env);
  let pass;
  if (assertion.operator === "header_contains") pass = headerContains(resolved.value, assertion.value);
  else if (assertion.operator === "set_equals") pass = matchSet(resolved.value, assertion.value, assertion.path, trial, false);
  else pass = match(resolved.value, assertion.value, assertion.path, trial, assertion.operator === "contains");
  if (pass) commit(env, trial);
  return { pass, reason: pass ? "" : "does not satisfy the exact semantic predicate" };
}

function match(actual, expected, path, env, subset = false) {
  if (expected === null || typeof expected !== "object") return isDeepStrictEqual(actual, expected);
  if (actual === null || typeof actual !== "object") return false;
  if (expected.kind && ["task-input", "external-input", "generated", "step-output"].includes(expected.kind)) return matchReference(actual, expected, env);
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((v, i) => match(actual[i], v, `${path}/${i}`, env, subset));
  }
  if (Array.isArray(actual)) return false;
  if (!subset && Object.keys(actual).length !== Object.keys(expected).length) return false;
  for (const [key, value] of Object.entries(expected)) {
    if (!Object.hasOwn(actual, key)) return false;
    if (key === "items" && Array.isArray(value) && isAnswerCollectionPath(path)) {
      if (path === "/steps") { if (!match(actual.items, value, `${path}/items`, env)) return false; }
      else if (!matchSet(actual.items, value, path, env, subset)) return false;
    } else if (key === "value" && /^(?:\/request|\/steps\/items\/\d+\/request)\/validation\/items\/\d+$/.test(path) && expected.constraint === "accepted-content-types" && value.status === "known") {
      if (actual.value?.status !== "known" || !matchSet(actual.value.value, value.value, `${path}/value/value`, env, false)) return false;
    } else if (key === "name" && path.includes("/headers/items/")) {
      if (typeof actual.name !== "string" || actual.name.toLowerCase() !== value.toLowerCase()) return false;
    } else if (!match(actual[key], value, `${path}/${escape(key)}`, env, subset)) return false;
  }
  return true;
}

function matchSet(actual, expected, path, env, subset) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || (!subset && actual.length !== expected.length) || actual.length < expected.length) return false;
  if (new Set(actual.map(stableJson)).size !== actual.length || new Set(expected.map(stableJson)).size !== expected.length) return false;
  const search = (i, used, state) => {
    if (i === expected.length) return state;
    for (let j = 0; j < actual.length; j += 1) {
      if (used.has(j)) continue;
      const trial = copy(state);
      if (!match(actual[j], expected[i], `${path}/items/${j}`, trial, subset)) continue;
      const result = search(i + 1, new Set([...used, j]), trial);
      if (result) return result;
    }
    return null;
  };
  const result = search(0, new Set(), copy(env));
  if (result) commit(env, result);
  return Boolean(result);
}

function matchReference(actual, expected, env) {
  if (actual.kind !== expected.kind) return false;
  if (["task-input", "step-output"].includes(expected.kind)) return isDeepStrictEqual(actual, expected);
  const left = referenceIdentity(expected), right = referenceIdentity(actual);
  if (expected.kind === "generated" && !(env.generatedRules.get(left) ?? new Set([expected.rule])).has(actual.rule)) return false;
  if ((env.forward.has(left) && env.forward.get(left) !== right) || (env.reverse.has(right) && env.reverse.get(right) !== left)) return false;
  env.forward.set(left, right); env.reverse.set(right, left);
  return true;
}

function anchor(actual, expected, path, env, failures) {
  if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object") return;
  if (/\/(?:keep|preserve)(?:\/|$)/.test(path)) return;
  if (["generated", "external-input"].includes(expected.kind) && actual.kind === expected.kind) {
    if (!matchReference(actual, expected, env)) failures.push({ predicate_id: "language:reference-identity", path, category: "reference-identity", message: "Reference identity conflicts with its local role" });
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return;
    const collectionPath = path.endsWith("/items") ? path.slice(0, -6) : null;
    for (const [i, value] of expected.entries()) {
      const found = collectionPath && collectionPath !== "/steps" ? actual.find((v) => collectionIdentity(v, collectionPath) === collectionIdentity(value, collectionPath)) : actual[i];
      anchor(found, value, `${path}/${i}`, env, failures);
    }
  } else for (const [key, value] of Object.entries(expected)) anchor(actual[key], value, `${path}/${escape(key)}`, env, failures);
}

function resolveSemanticPointer(answer, expected, pointer) {
  let actual = answer, canonical = expected, path = "";
  for (const token of pointer.slice(1).split("/").map((s) => s.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (Array.isArray(canonical) && Array.isArray(actual) && path.endsWith("/items") && path !== "/steps/items") {
      const collectionPath = path.slice(0, -6), member = canonical[token];
      actual = actual.find((v) => collectionIdentity(v, collectionPath) === collectionIdentity(member, collectionPath));
    } else actual = actual && typeof actual === "object" ? actual[token] : undefined;
    canonical = canonical && typeof canonical === "object" ? canonical[token] : undefined;
    path += `/${escape(token)}`;
    if (actual === undefined) return { found: false };
  }
  return { found: true, value: actual };
}

function claimState(resolved, expected, path, env, canonical) {
  if (!resolved.found) return "unknown";
  const actual = resolved.value;
  if (actual?.status === "unknown") return "unknown";
  if (Array.isArray(expected?.items) && Array.isArray(actual?.items)) {
    for (const member of expected.items) {
      const found = findEvidenceMember(actual.items, member, path, env, canonical?.items ?? expected.items);
      if (found === undefined) return actual.status === "partial" ? "unknown" : "absent";
      if (claimState({ found: true, value: found }, member, path, env, member) === "unknown") return "unknown";
    }
    return "known";
  }
  let unknown = false;
  walk(actual, "", (v) => { if (v.status === "unknown" || v.status === "partial") unknown = true; });
  return unknown ? "unknown" : "known";
}

function headerContains(actual, expected) {
  if (!actual || !expected || Array.isArray(actual) || Array.isArray(expected)) return false;
  const normalized = new Map();
  for (const [key, value] of Object.entries(actual)) {
    const name = key.toLowerCase(); if (normalized.has(name)) return false;
    normalized.set(name, value);
  }
  return Object.entries(expected).every(([name, value]) => isDeepStrictEqual(normalized.get(name.toLowerCase()), value));
}
function reportedGap(answer, resolved, expected, path, env, canonical) {
  const targets = new Set();
  const collect = (actual, template, location, inventory) => {
    if (!actual || typeof actual !== "object") return;
    if (actual.status === "unknown") { targets.add(actual); return; }
    if (Array.isArray(template?.items) && Array.isArray(actual.items)) {
      for (const member of template.items) {
        const found = findEvidenceMember(actual.items, member, location, env, inventory?.items ?? template.items);
        if (found === undefined && actual.status === "partial") targets.add(actual);
        else collect(found, member, location, member);
      }
    } else for (const [key, value] of Object.entries(template ?? {})) collect(actual[key], value, `${location}/${escape(key)}`, inventory?.[key]);
  };
  if (resolved.found) collect(resolved.value, expected, path, canonical);
  return answer.uncertainties.some((pointer) => {
    const target = readAnswerPointer(answer, pointer);
    if (!target.found || !["unknown", "partial"].includes(target.value?.status)) return false;
    return targets.has(target.value) || (!resolved.found && path.startsWith(`${pointer}/`));
  });
}
function findEvidenceMember(items, expected, path, env, inventory) {
  const exact = items.filter((v) => sameMember(v, expected, path, env));
  if (exact.length > 0) return exact.length === 1 ? exact[0] : undefined;
  if (path !== "/response/relations") return undefined;
  const compatible = (actual, template) => {
    const knownKeys = ["target", "field"].filter((key) => actual[key]?.status === "known");
    return knownKeys.length > 0 && knownKeys.every((key) => isDeepStrictEqual(actual[key], template[key]));
  };
  const candidates = items.filter((v) => compatible(v, expected) && inventory.filter((template) => compatible(v, template)).length === 1);
  return candidates.length === 1 ? candidates[0] : undefined;
}
function validateAdditionalErrorReplay({ answer, task, ledger, env, failures }) {
  const expected = task.private.expected_outcome;
  if (!Array.isArray(answer.errors?.items)) return;
  const policies = ledger.rows.filter((r) => r.measured && r.task_id === task.id && r.fact_id === "common:create-idempotency" && /^\/errors\/items\/\d+\/recovery\/preserve$/.test(r.output_path));
  for (const [i, member] of answer.errors.items.entries()) {
    if (expected.errors.items.some((v) => collectionIdentity(v, "/errors") === collectionIdentity(member, "/errors"))) continue;
    const recovery = member.recovery;
    const action = recovery.action;
    for (const policy of policies) {
      const original = readAnswerPointer(expected, policy.output_path.slice(0, -"/preserve".length)).value;
      if (!isDeepStrictEqual(recovery.operation, original.operation)) continue;
      // An action label cannot override an explicit source-policy contradiction.
      if (recovery.repeat_side_effect.status === "known" && original.repeat_side_effect.status === "known"
          && !isDeepStrictEqual(recovery.repeat_side_effect, original.repeat_side_effect)) {
        failures.push({ predicate_id: policy.predicate_id, path: `/errors/items/${i}/recovery`, category: "error-recovery", message: "Additional recovery contradicts the source-mapped side-effect policy" });
        continue;
      }
      if (action.status !== "known") continue;
      const { kind, key_strategy, request_equivalence } = action.value;
      if (!["retry", "refresh-and-retry", "correct-and-retry", "select-original-or-new"].includes(kind)) continue;
      const trigger = recovery.trigger.value?.category;
      const newLogicalAttempt = (kind === "correct-and-retry" && trigger === "rejected-input" && key_strategy === "new" && request_equivalence === "changed")
        || (kind === "select-original-or-new" && trigger === "conflict" && key_strategy === "original-or-new" && request_equivalence === "not-applicable");
      if (newLogicalAttempt && recovery.repeat_side_effect.status === "known" && recovery.repeat_side_effect.value === false) continue;
      const safe = action.value.key_strategy === original.action.value.key_strategy
        && action.value.request_equivalence === original.action.value.request_equivalence
        && isDeepStrictEqual(recovery.repeat_side_effect, original.repeat_side_effect)
        && match(recovery.preserve, original.preserve, `/errors/items/${i}/recovery/preserve`, copy(env), true);
      if (!safe) failures.push({ predicate_id: policy.predicate_id, path: `/errors/items/${i}/recovery`, category: "error-recovery", message: "Additional replay contradicts the source-mapped original-key/request safety policy" });
    }
  }
}
function sameMember(actual, expected, path, env) {
  if (collectionIdentity(actual, path) === collectionIdentity(expected, path)) return true;
  const left = expected?.target ?? expected, right = actual?.target ?? actual;
  if (!["generated", "external-input"].includes(left?.kind) || right?.kind !== left.kind) return false;
  const bound = env.forward.get(referenceIdentity(left));
  return bound ? bound === referenceIdentity(right) : left.kind !== "generated" || left.rule === right.rule;
}
function escape(value) { return value.replaceAll("~", "~0").replaceAll("/", "~1"); }
function policyCollection(path) { return /\/(?:retry|failure_recovery|webhook_reconciliation|reconciliation|states_after_success|record_states)$/.test(path); }
