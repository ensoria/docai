import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { readTaskPacket } from "./contract.mjs";
import { requireVerifiedEvidence } from "./evidence-verifier.mjs";
import { PRIVATE_DIR, readPlan } from "./paths.mjs";
import { buildRunnerRevision } from "./runner.mjs";
import { assertPlainJson, clonePlainJson } from "./strict-json.mjs";

const DECISIONS = new Set(["pending", "correct", "incorrect", "unresolvable"]);
const REVIEW_ID = /^R-[A-F0-9]{32}$/;
const REVIEWER_ID = "reviewer-1";
const PRIVATE_ADJUDICATION_ROOT = path.join(PRIVATE_DIR, "adjudication");
const GENERIC_IDENTITY_TOKENS = new Set(["model", "resolved"]);
const CANONICAL_ALIASES = ["openai", "anthropic", "google", "gpt", "claude", "sonnet", "gemini", "openapi", "docai", "openapi-raw", "openapi-sliced", "openapi-enriched", "docai-selected"];

export function buildBlindedAdjudicationPacket(verifiedEvidence, tasks, dependencies = {}) {
  const evidence = requireVerifiedEvidence(verifiedEvidence);
  const plan = requireApprovedEvidence(evidence);
  const taskById = canonicalTasks(tasks, plan);
  const runs = canonicalRuns(evidence, plan);
  const terms = blindedTerms(runs, plan);
  const reviewIdGenerator = reviewIdGeneratorFor(dependencies);
  const ids = new Set();
  const cases = runs.filter((run) => run.accuracy_status === "inconclusive").map((run) => {
    const reviewId = reviewIdGenerator();
    if (typeof reviewId !== "string" || !REVIEW_ID.test(reviewId)) throw new Error("review ID generator must return R- plus 32 uppercase hexadecimal characters");
    if (ids.has(reviewId)) throw new Error(`duplicate generated review ID ${reviewId}`);
    ids.add(reviewId);
    const task = taskById.get(run.task_id);
    const copied = maskValue({
      user_task: task.public.user_task,
      output_contract: task.public.output_contract,
      expected_assertions: task.private.assertions,
      model_output: run.content_json,
      automatic_result: automaticResult(run),
    }, terms);
    return { review_id: reviewId, ...copied, adjudication: { reviewer_id: REVIEWER_ID, decision: "pending", rationale: "" } };
  }).sort((left, right) => left.review_id.localeCompare(right.review_id));
  const packet = {
    packet_version: "1",
    review_method: "single-reviewer-condition-provider-model-blinded",
    evidence_role: "secondary-adjudication-does-not-replace-automatic-primary",
    reviewer: { reviewer_id: REVIEWER_ID, reviewer_count: 1, inter_rater_agreement: "not-measured" },
    case_count: cases.length,
    cases,
  };
  const validation = validatePacket(packet, { requireComplete: false, terms });
  if (validation.failures.length > 0) throw new Error(`blinded adjudication packet is invalid:\n- ${validation.failures.join("\n- ")}`);
  return packet;
}

export function writeBlindedAdjudicationPacket(input) {
  assertPlainJson(input, "adjudication write input");
  requireKeys(input, ["evidence", "tasks", "packet"], ["evidence", "tasks", "packet"], "adjudication write input");
  const evidence = requireVerifiedEvidence(input.evidence);
  const expected = buildBlindedAdjudicationPacket(evidence, input.tasks);
  const terms = blindedTerms(canonicalRuns(evidence, requireApprovedEvidence(evidence)), readPlan());
  const validation = validatePacket(input.packet, { requireComplete: false, terms });
  if (validation.failures.length > 0) throw new Error(`cannot write invalid adjudication packet:\n- ${validation.failures.join("\n- ")}`);
  if (!sameMultiset(evidenceMultiset(input.packet), evidenceMultiset(expected))) throw new Error("adjudication packet does not match the verified automatic evidence multiset");

  const root = path.resolve(PRIVATE_ADJUDICATION_ROOT);
  const directory = path.join(root, requireApprovedEvidence(evidence).plan_version);
  preparePrivateDirectory(root, directory);
  const file = path.join(directory, "review-packet.json");
  const existing = lstat(file);
  if (existing !== null) {
    if (existing.isSymbolicLink()) throw new Error(`private file must not be a symlink: ${file}`);
    throw new Error("review packet already exists and is immutable");
  }
  fs.writeFileSync(file, `${JSON.stringify(input.packet, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  secureFile(file);
  return file;
}

export function checkBlindedAdjudicationPacket(input) {
  assertPlainJson(input, "adjudication check input");
  requireKeys(input, ["evidence", "tasks", "packet", "requireComplete"], ["evidence", "tasks", "packet"], "adjudication check input");
  if (input.requireComplete !== undefined && typeof input.requireComplete !== "boolean") throw new TypeError("requireComplete must be a boolean");
  const evidence = requireVerifiedEvidence(input.evidence);
  const plan = requireApprovedEvidence(evidence);
  const runs = canonicalRuns(evidence, plan);
  const terms = blindedTerms(runs, plan);
  const validation = validatePacket(input.packet, { requireComplete: input.requireComplete ?? false, terms });
  const failures = [...validation.failures];
  if (failures.length > 0) return { failures, summary: validation.summary };
  const expected = buildBlindedAdjudicationPacket(evidence, input.tasks);
  if (!sameHeader(input.packet, expected)) failures.push("adjudication packet header does not match regenerated source evidence");
  if (!sameMultiset(evidenceMultiset(input.packet), evidenceMultiset(expected))) failures.push("automatic packet does not match the verified inconclusive records as an evidence multiset");
  return { failures, summary: validation.summary };
}

function requireApprovedEvidence(evidence) {
  const plan = readPlan();
  if (evidence.benchmark_id !== plan.benchmark_id || evidence.plan_version !== plan.plan_version) throw new Error("verified evidence does not match the approved calibration plan");
  if (evidence.runner_revision !== buildRunnerRevision()) throw new Error("verified evidence does not match the approved calibration runner revision");
  return plan;
}

function canonicalTasks(tasks, plan) {
  assertPlainJson(tasks, "adjudication tasks");
  const canonical = readTaskPacket(plan).tasks.filter((task) => plan.calibration.task_ids.includes(task.id));
  if (!isDeepStrictEqual(tasks, canonical)) throw new Error("tasks must match the complete canonical task packet");
  return new Map(canonical.map((task) => [task.id, task]));
}

function canonicalRuns(evidence, plan) {
  if (!Array.isArray(evidence.runs) || evidence.runs.length !== 24) throw new Error("verified evidence must contain exactly 24 runs");
  const seen = new Set();
  for (const run of evidence.runs) {
    if (seen.has(run.run_id)) throw new Error(`verified evidence has duplicate run identity ${run.run_id}`);
    seen.add(run.run_id);
    if (run.benchmark_id !== plan.benchmark_id || run.plan_version !== plan.plan_version) throw new Error("verified evidence contains a wrong run identity");
  }
  return evidence.runs;
}

function automaticResult(run) {
  return {
    transport_status: run.transport_status, format_status: run.format_status, contract_status: run.contract_status,
    accuracy_status: run.accuracy_status, uncertainty_status: run.uncertainty_status,
    failure_categories: clonePlainJson(run.failure_categories, "automatic failure categories"),
    reasons: clonePlainJson(run.reasons, "automatic reasons"), manual_review_required: run.manual_review_required,
  };
}

function validatePacket(packet, { requireComplete, terms }) {
  const failures = [];
  const summary = { total: 0, pending: 0, correct: 0, incorrect: 0, unresolvable: 0 };
  try { assertPlainJson(packet, "adjudication packet"); } catch (error) { return { failures: [error.message], summary }; }
  requirePacketKeys(packet, ["packet_version", "review_method", "evidence_role", "reviewer", "case_count", "cases"], "packet", failures);
  if (packet.packet_version !== "1") failures.push("packet_version must be 1");
  if (packet.review_method !== "single-reviewer-condition-provider-model-blinded") failures.push("packet must use the single blinded reviewer method");
  if (packet.evidence_role !== "secondary-adjudication-does-not-replace-automatic-primary") failures.push("packet must preserve the automatic result as primary");
  if (!packet.reviewer || packet.reviewer.reviewer_id !== REVIEWER_ID || packet.reviewer.reviewer_count !== 1 || packet.reviewer.inter_rater_agreement !== "not-measured") failures.push("packet must contain exactly one reviewer");
  if (!Array.isArray(packet.cases)) {
    failures.push("cases must be an array");
    return { failures, summary };
  }
  if (packet.case_count !== packet.cases.length) failures.push("case_count does not match cases");
  const ids = new Set(); const reviewers = new Set();
  for (const [index, reviewCase] of packet.cases.entries()) {
    const label = `case ${index + 1}`;
    requirePacketKeys(reviewCase, ["review_id", "user_task", "output_contract", "expected_assertions", "model_output", "automatic_result", "adjudication"], label, failures);
    if (typeof reviewCase.review_id !== "string" || !REVIEW_ID.test(reviewCase.review_id) || ids.has(reviewCase.review_id)) failures.push(`${label} review_id must be a unique blinded ID`);
    else ids.add(reviewCase.review_id);
    if (typeof reviewCase.user_task !== "string" || reviewCase.user_task === "" || typeof reviewCase.output_contract !== "string" || reviewCase.output_contract === "" || !Array.isArray(reviewCase.expected_assertions) || !reviewCase.model_output || typeof reviewCase.model_output !== "object") failures.push(`${label} reviewer evidence is malformed`);
    const result = reviewCase.automatic_result;
    if (!result || result.accuracy_status !== "inconclusive" || result.manual_review_required !== true || result.contract_status !== "valid" || !Array.isArray(result.failure_categories) || !Array.isArray(result.reasons)) failures.push(`${label} must preserve valid inconclusive automatic evidence`);
    const decision = reviewCase.adjudication;
    if (!decision || typeof decision.reviewer_id !== "string" || !DECISIONS.has(decision.decision) || typeof decision.rationale !== "string") failures.push(`${label} adjudication is malformed`);
    else {
      reviewers.add(decision.reviewer_id); summary.total += 1; summary[decision.decision] += 1;
      if (decision.decision !== "pending" && decision.rationale.trim() === "") failures.push(`${label} completed adjudication requires a rationale`);
      if (requireComplete && decision.decision === "pending") failures.push(`${label} pending adjudication is not allowed`);
    }
    const decisionLeak = identityLeak(decision, terms);
    if (decisionLeak !== null) failures.push(`${label} adjudication contains blinded identity ${decisionLeak}`);
  }
  if (reviewers.size > 0 && (reviewers.size !== 1 || !reviewers.has(REVIEWER_ID))) failures.push("packet must contain exactly one recorded reviewer");
  const evidenceLeak = identityLeak(packet.cases.map(({ review_id, adjudication, ...copy }) => copy), terms);
  if (evidenceLeak !== null) failures.push(`packet reviewer evidence contains blinded identity ${evidenceLeak}`);
  return { failures, summary };
}

function blindedTerms(runs, plan) {
  const terms = [...CANONICAL_ALIASES];
  for (const run of runs) {
    if (typeof run.run_id === "string" && run.run_id !== "") terms.push(run.run_id);
    for (const field of ["provider", "condition", "target_id", "resolved_model"]) {
      if (typeof run[field] === "string" && run[field] !== "") terms.push(run[field], ...identityTokens(run[field]));
    }
  }
  for (const target of plan.targets) if (typeof target.model_id === "string" && target.model_id !== "") terms.push(target.model_id, ...identityTokens(target.model_id));
  return [...new Set(terms)].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function maskValue(value, terms) {
  if (typeof value === "string") return terms.reduce((masked, term) => replaceTerm(masked, term), value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => maskValue(entry, terms));
  const masked = {};
  for (const [key, child] of Object.entries(value)) {
    const nextKey = maskValue(key, terms);
    if (Object.hasOwn(masked, nextKey)) throw new Error("identity masking creates duplicate key");
    masked[nextKey] = maskValue(child, terms);
  }
  return masked;
}

function identityLeak(value, terms) {
  const strings = []; collectStrings(value, strings);
  return terms.find((term) => strings.some((candidate) => containsTerm(candidate, term))) ?? null;
}
function collectStrings(value, strings) { if (typeof value === "string") strings.push(value); else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, strings)); else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) { strings.push(key); collectStrings(child, strings); } }
function containsTerm(value, term) { return termPattern(term).test(value); }
function replaceTerm(value, term) { return /^[A-Za-z0-9]+$/.test(term) ? value.replace(termPattern(term, true), "$1<identity-masked>") : value.replace(termPattern(term, true), "<identity-masked>"); }
function termPattern(term, global = false) { const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return /^[A-Za-z0-9]+$/.test(term) ? new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, global ? "gi" : "i") : new RegExp(escaped, global ? "gi" : "i"); }
function identityTokens(value) { return value.split(/[^A-Za-z0-9]+/).filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !GENERIC_IDENTITY_TOKENS.has(token.toLowerCase())); }

function reviewIdGeneratorFor(dependencies) {
  if (dependencies === null || typeof dependencies !== "object" || Array.isArray(dependencies) || Object.getPrototypeOf(dependencies) !== Object.prototype) throw new TypeError("adjudication dependencies must be a plain object");
  for (const key of Reflect.ownKeys(dependencies)) {
    if (typeof key !== "string" || key !== "reviewIdGenerator") throw new TypeError("adjudication dependencies has unexpected field");
    const descriptor = Object.getOwnPropertyDescriptor(dependencies, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError("adjudication dependencies must contain enumerable data properties only");
  }
  if (!Object.hasOwn(dependencies, "reviewIdGenerator")) return () => `R-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
  if (typeof dependencies.reviewIdGenerator !== "function") throw new TypeError("reviewIdGenerator must be a function");
  return dependencies.reviewIdGenerator;
}

function sameHeader(left, right) { return isDeepStrictEqual({ packet_version: left.packet_version, review_method: left.review_method, evidence_role: left.evidence_role, reviewer: left.reviewer, case_count: left.case_count }, { packet_version: right.packet_version, review_method: right.review_method, evidence_role: right.evidence_role, reviewer: right.reviewer, case_count: right.case_count }); }
function evidenceMultiset(packet) { const values = new Map(); for (const { review_id, adjudication, ...evidence } of packet.cases) { const fingerprint = canonicalJson(evidence); values.set(fingerprint, (values.get(fingerprint) ?? 0) + 1); } return values; }
function sameMultiset(left, right) { return left.size === right.size && [...left].every(([key, count]) => right.get(key) === count); }
function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function requirePacketKeys(value, expected, label, failures) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== expected.length || expected.some((key) => !Object.hasOwn(value, key))) failures.push(`${label} has unexpected or missing fields`); }
function requireKeys(value, allowed, required, label) { const unexpected = Object.keys(value).find((key) => !allowed.includes(key)); if (unexpected !== undefined) throw new TypeError(`${label} has unexpected field ${unexpected}`); for (const key of required) if (!Object.hasOwn(value, key)) throw new TypeError(`${label} requires ${key}`); }

function preparePrivateDirectory(root, directory) { if (!isContained(root, directory)) throw new Error("private adjudication path escapes its root"); inspectComponents(path.dirname(root), root); secureDirectory(root); inspectComponents(root, directory); secureDirectory(directory); }
function inspectComponents(base, target) { if (!isContained(base, target)) throw new Error("private adjudication path escapes its root"); let current = base; inspectDirectory(current); for (const segment of path.relative(base, target).split(path.sep).filter(Boolean)) { current = path.join(current, segment); inspectDirectory(current); } }
function inspectDirectory(directory) { const stat = lstat(directory); if (stat === null) return; if (stat.isSymbolicLink()) throw new Error(`private path must not traverse a symlink: ${directory}`); if (!stat.isDirectory()) throw new Error(`private path must be a directory: ${directory}`); }
function secureDirectory(directory) { const stat = lstat(directory); if (stat === null) fs.mkdirSync(directory, { mode: 0o700 }); else if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`private path must be a directory: ${directory}`); fs.chmodSync(directory, 0o700); if ((fs.lstatSync(directory).mode & 0o777) !== 0o700) throw new Error(`private directory must have mode 0700: ${directory}`); }
function secureFile(file) { const stat = fs.lstatSync(file); if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`private path must be a regular file: ${file}`); fs.chmodSync(file, 0o600); if ((fs.lstatSync(file).mode & 0o777) !== 0o600) throw new Error(`private file must have mode 0600: ${file}`); }
function lstat(file) { try { return fs.lstatSync(file); } catch (error) { if (error?.code === "ENOENT") return null; throw error; } }
function isContained(root, candidate) { const relative = path.relative(path.resolve(root), path.resolve(candidate)); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)); }
