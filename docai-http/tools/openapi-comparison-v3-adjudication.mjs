import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { readCalibrationTaskPacket } from "./openapi-comparison-v3-context.mjs";
import { validateBenchmarkTaskPacket } from "./openapi-comparison-v3-contract.mjs";
import { validateEvaluationRecord } from "./openapi-comparison-v3-record.mjs";
import { FileRunStore } from "./openapi-comparison-v3-runner.mjs";
import {
  assertFinitePlainJson,
  cloneFinitePlainJson,
} from "./openapi-comparison-v3-strict-json.mjs";
import {
  BENCHMARK_DIR,
  buildCalibrationSchedule,
  readV3Plan,
} from "./openapi-comparison-v3-utils.mjs";

const ADJUDICATION_DECISIONS = new Set(["pending", "correct", "incorrect", "unresolvable"]);
const PACKET_VERSION = "1";
const REVIEWER_ID = "reviewer-1";
const REVIEW_ID_PATTERN = /^R-[A-F0-9]{32}$/;
const PRIVATE_ADJUDICATION_ROOT = path.join(BENCHMARK_DIR, "private", "adjudication");
const TEST_ROOT_PREFIX = "docai-v3-adjudication-";
const GENERIC_IDENTITY_TOKENS = new Set(["model", "resolved"]);
const CANONICAL_BLINDED_ALIASES = [
  "openai",
  "anthropic",
  "google",
  "gpt",
  "claude",
  "sonnet",
  "gemini",
  "openapi",
  "docai",
  "openapi-raw",
  "openapi-sliced",
  "openapi-enriched",
  "docai-selected",
];

export function buildBlindedAdjudicationPacket(input = {}, dependencies = {}) {
  assertFinitePlainJson(input, "adjudication source input");
  requireExactKeys(input, ["runs", "tasks"], "adjudication source input");
  const reviewIdGenerator = validateDependencies(dependencies);
  const approvedPlan = readV3Plan();
  assertFinitePlainJson(approvedPlan, "checked-in calibration plan");
  const taskById = validateCanonicalTasks(input.tasks, approvedPlan);
  const runs = validateCanonicalSourceLedger(input.runs, approvedPlan);
  const blindedTerms = blindedIdentityTermsForRuns(runs, approvedPlan);
  const reviewIds = new Set();
  const cases = runs
    .filter((run) => run.accuracy_status === "inconclusive")
    .map((run) => {
      const reviewId = reviewIdGenerator();
      if (typeof reviewId !== "string" || !REVIEW_ID_PATTERN.test(reviewId)) {
        throw new Error("review ID generator must return R- plus 32 uppercase hexadecimal characters");
      }
      if (reviewIds.has(reviewId)) throw new Error(`duplicate generated review ID ${reviewId}`);
      reviewIds.add(reviewId);
      return buildReviewCase(run, taskById, blindedTerms, reviewId);
    })
    .sort((left, right) => left.review_id.localeCompare(right.review_id));
  const packet = {
    packet_version: PACKET_VERSION,
    review_method: "single-reviewer-condition-provider-model-blinded",
    evidence_role: "secondary-adjudication-does-not-replace-automatic-primary",
    reviewer: {
      reviewer_id: REVIEWER_ID,
      reviewer_count: 1,
      inter_rater_agreement: "not-measured",
    },
    case_count: cases.length,
    cases,
  };
  const validation = validateAdjudicationPacket(packet, {
    requireComplete: false,
    blindedTerms,
  });
  if (validation.failures.length > 0) {
    throw new Error(`blinded adjudication packet is invalid:\n- ${validation.failures.join("\n- ")}`);
  }
  return packet;
}

export function validateAdjudicationPacket(packet, options = {}) {
  const failures = [];
  const summary = { total: 0, pending: 0, correct: 0, incorrect: 0, unresolvable: 0 };
  let requireComplete;
  let blindedTerms;
  try {
    assertFinitePlainJson(options, "adjudication validation options");
    requireAllowedKeys(options, ["requireComplete", "blindedTerms"], "adjudication validation options");
    requireComplete = options.requireComplete ?? false;
    blindedTerms = normalizeTerms([
      ...CANONICAL_BLINDED_ALIASES,
      ...(options.blindedTerms ?? []),
    ]);
    if (typeof requireComplete !== "boolean") throw new TypeError("requireComplete must be a boolean");
    if (options.blindedTerms !== undefined
        && (!Array.isArray(options.blindedTerms)
          || options.blindedTerms.some((term) => typeof term !== "string" || term === ""))) {
      throw new TypeError("blindedTerms must be an array of non-empty strings");
    }
    assertFinitePlainJson(packet, "adjudication packet");
  } catch (error) {
    failures.push(error.message);
    return { failures, summary };
  }

  if (!isPlainObject(packet)) return { failures: ["packet must be a plain object"], summary };
  assertExactKeys(packet, ["packet_version", "review_method", "evidence_role", "reviewer", "case_count", "cases"], "packet", failures);
  if (packet.packet_version !== PACKET_VERSION) failures.push(`packet_version must be ${PACKET_VERSION}`);
  if (packet.review_method !== "single-reviewer-condition-provider-model-blinded") {
    failures.push("packet must use the single blinded reviewer method");
  }
  if (packet.evidence_role !== "secondary-adjudication-does-not-replace-automatic-primary") {
    failures.push("packet must preserve the automatic result as primary");
  }
  validateReviewer(packet.reviewer, failures);
  if (!Array.isArray(packet.cases)) {
    failures.push("cases must be an array");
    return { failures, summary };
  }
  if (packet.case_count !== packet.cases.length) failures.push("case_count does not match cases");

  const reviewIds = new Set();
  const reviewerIds = new Set();
  packet.cases.forEach((reviewCase, index) => {
    const label = `case ${index + 1}`;
    if (!isPlainObject(reviewCase)) {
      failures.push(`${label} must be a plain object`);
      return;
    }
    assertExactKeys(reviewCase, [
      "review_id",
      "user_task",
      "output_contract",
      "expected_assertions",
      "model_output",
      "automatic_result",
      "adjudication",
    ], label, failures);
    if (typeof reviewCase.review_id !== "string" || !REVIEW_ID_PATTERN.test(reviewCase.review_id)) {
      failures.push(`${label} review_id must use the random blinded ID format`);
    } else if (reviewIds.has(reviewCase.review_id)) {
      failures.push(`${label} review_id must be unique`);
    } else {
      reviewIds.add(reviewCase.review_id);
    }
    if (typeof reviewCase.user_task !== "string" || reviewCase.user_task === "") {
      failures.push(`${label} user_task must be a non-empty string`);
    }
    if (typeof reviewCase.output_contract !== "string" || reviewCase.output_contract === "") {
      failures.push(`${label} output_contract must be a non-empty string`);
    }
    if (!Array.isArray(reviewCase.expected_assertions)) failures.push(`${label} expected_assertions must be an array`);
    if (!isPlainObject(reviewCase.model_output)) failures.push(`${label} model_output must be an object`);
    validateAutomaticResult(reviewCase.automatic_result, label, failures);
    const decision = validateDecision(reviewCase.adjudication, label, requireComplete, failures);
    if (decision !== null) {
      summary.total += 1;
      summary[decision.decision] += 1;
      reviewerIds.add(decision.reviewer_id);
    }
    const decisionLeak = findBlindedIdentity(reviewCase.adjudication, blindedTerms);
    if (decisionLeak !== null) failures.push(`${label} adjudication contains blinded identity ${decisionLeak}`);
  });
  if (reviewerIds.size > 0 && (reviewerIds.size !== 1 || !reviewerIds.has(packet.reviewer?.reviewer_id))) {
    failures.push("packet must contain exactly one recorded reviewer");
  }

  const copiedEvidence = packet.cases.map(({ review_id, adjudication, ...evidence }) => evidence);
  const copiedLeak = findBlindedIdentity(copiedEvidence, blindedTerms);
  if (copiedLeak !== null) failures.push(`packet reviewer evidence contains blinded identity ${copiedLeak}`);
  return { failures, summary };
}

export function blindedIdentityTermsForRuns(runs, plan = readV3Plan()) {
  assertFinitePlainJson({ runs, plan }, "blinded identity source");
  if (!Array.isArray(runs)) throw new TypeError("blinded identity runs must be an array");
  const terms = [...CANONICAL_BLINDED_ALIASES];
  for (const run of runs) {
    for (const field of ["run_id", "provider", "condition", "target_id", "resolved_model"]) {
      if (typeof run[field] === "string" && run[field] !== "") terms.push(run[field]);
    }
    for (const field of ["provider", "condition", "target_id", "resolved_model"]) {
      if (typeof run[field] === "string") terms.push(...identityTokens(run[field]));
    }
  }
  for (const target of plan.targets ?? []) {
    if (typeof target.model_id === "string" && target.model_id !== "") {
      terms.push(target.model_id, ...identityTokens(target.model_id));
    }
  }
  return normalizeTerms(terms);
}

export function adjudicationDirectory(planVersion, options = {}) {
  if (typeof planVersion !== "string" || !isSafePlanVersion(planVersion)) {
    throw new Error("invalid adjudication plan version");
  }
  assertFinitePlainJson(options, "adjudication directory options");
  requireAllowedKeys(options, ["testPrivateRoot"], "adjudication directory options");
  const root = privateRoot(options.testPrivateRoot);
  const directory = path.resolve(root, planVersion);
  assertContained(root, directory);
  return directory;
}

export function writeBlindedAdjudicationPacket(input = {}) {
  assertFinitePlainJson(input, "adjudication write input");
  requireAllowedKeys(input, ["planVersion", "packet", "testPrivateRoot"], "adjudication write input");
  for (const field of ["planVersion", "packet"]) {
    if (!Object.hasOwn(input, field)) throw new TypeError(`adjudication write input requires ${field}`);
  }
  const approvedPlan = readV3Plan();
  if (input.planVersion !== approvedPlan.plan_version) {
    throw new Error(`adjudication plan version must be ${approvedPlan.plan_version}`);
  }
  const validation = validateAdjudicationPacket(input.packet, { requireComplete: false });
  if (validation.failures.length > 0) {
    throw new Error(`cannot write invalid adjudication packet:\n- ${validation.failures.join("\n- ")}`);
  }

  const root = privateRoot(input.testPrivateRoot);
  const directory = adjudicationDirectory(input.planVersion, {
    ...(input.testPrivateRoot === undefined ? {} : { testPrivateRoot: input.testPrivateRoot }),
  });
  preparePrivateDirectory(root, directory);
  const file = path.join(directory, "review-packet.json");
  const existing = lstatIfPresent(file);
  if (existing !== null) {
    if (existing.isSymbolicLink()) throw new Error(`private file must not be a symlink: ${file}`);
    if (!existing.isFile()) throw new Error(`private path must be a regular file: ${file}`);
    throw new Error("review packet already exists and is immutable");
  }
  fs.writeFileSync(file, `${JSON.stringify(input.packet, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  secureRegularFile(file);
  return file;
}

function buildReviewCase(run, taskById, blindedTerms, reviewId) {
  const task = taskById.get(run.task_id);
  const copiedEvidence = maskReviewerValue({
    user_task: task.public.user_task,
    output_contract: task.public.output_contract,
    expected_assertions: task.private.assertions,
    model_output: run.content_json,
    automatic_result: automaticResult(run),
  }, blindedTerms);
  return {
    review_id: reviewId,
    ...copiedEvidence,
    adjudication: {
      reviewer_id: REVIEWER_ID,
      decision: "pending",
      rationale: "",
    },
  };
}

function validateCanonicalTasks(tasks, approvedPlan) {
  if (!Array.isArray(tasks)) throw new TypeError("tasks must be an array");
  const packet = {
    benchmark_id: approvedPlan.benchmark_id,
    api_id: approvedPlan.calibration.api_id,
    tasks,
  };
  validateBenchmarkTaskPacket(packet, approvedPlan);
  const canonicalTasks = readCalibrationTaskPacket(approvedPlan).tasks;
  if (!isDeepStrictEqual(tasks, canonicalTasks)) {
    throw new Error("tasks must match the complete canonical task packet");
  }
  return new Map(canonicalTasks.map((task) => [task.id, task]));
}

function validateCanonicalSourceLedger(runs, approvedPlan) {
  if (!Array.isArray(runs)) throw new TypeError("runs must be an array");
  const schedule = buildCalibrationSchedule(approvedPlan);
  if (runs.length !== schedule.length) {
    throw new Error(`canonical source ledger must contain exactly ${schedule.length} runs`);
  }
  const expectedById = new Map(schedule.map((row) => [row.run_id, row]));
  const seen = new Set();
  runs.forEach((run, index) => {
    try {
      validateEvaluationRecord(run);
    } catch (error) {
      throw new Error(`run ${index + 1} is an invalid evaluation record: ${error.message}`);
    }
    if (seen.has(run.run_id)) throw new Error(`duplicate run identity ${run.run_id}`);
    seen.add(run.run_id);
    const expected = expectedById.get(run.run_id);
    if (!expected) throw new Error(`canonical source ledger contains unknown run ${run.run_id}`);
    const identity = {
      benchmark_id: approvedPlan.benchmark_id,
      plan_version: approvedPlan.plan_version,
      batch_id: expected.batch_id,
      api_id: expected.api_id,
      task_id: expected.task_id,
      target_id: expected.target_id,
      provider: expected.provider,
      condition: expected.condition,
      repetition: expected.repetition,
    };
    for (const [field, value] of Object.entries(identity)) {
      if (run[field] !== value) {
        throw new Error(`canonical source ledger run ${run.run_id} has wrong ${field}`);
      }
    }
  });
  if (seen.size !== expectedById.size || [...expectedById.keys()].some((runId) => !seen.has(runId))) {
    throw new Error("canonical source ledger does not contain the exact calibration schedule");
  }
  return runs;
}

function automaticResult(run) {
  return {
    transport_status: run.transport_status,
    format_status: run.format_status,
    contract_status: run.contract_status,
    accuracy_status: run.accuracy_status,
    uncertainty_status: run.uncertainty_status,
    failure_categories: cloneFinitePlainJson(run.failure_categories, "automatic failure categories"),
    reasons: cloneFinitePlainJson(run.reasons, "automatic reasons"),
    manual_review_required: run.manual_review_required,
  };
}

function validateReviewer(reviewer, failures) {
  if (!isPlainObject(reviewer)) {
    failures.push("reviewer must be a plain object");
    return;
  }
  assertExactKeys(reviewer, ["reviewer_id", "reviewer_count", "inter_rater_agreement"], "reviewer", failures);
  if (typeof reviewer.reviewer_id !== "string" || reviewer.reviewer_id === "") {
    failures.push("reviewer_id must be a non-empty string");
  }
  if (reviewer.reviewer_count !== 1) failures.push("reviewer_count must be exactly 1");
  if (reviewer.inter_rater_agreement !== "not-measured") {
    failures.push("inter_rater_agreement must be not-measured for one reviewer");
  }
}

function validateAutomaticResult(result, label, failures) {
  if (!isPlainObject(result)) {
    failures.push(`${label} automatic_result must be a plain object`);
    return;
  }
  assertExactKeys(result, [
    "transport_status",
    "format_status",
    "contract_status",
    "accuracy_status",
    "uncertainty_status",
    "failure_categories",
    "reasons",
    "manual_review_required",
  ], `${label} automatic_result`, failures);
  if (result.accuracy_status !== "inconclusive" || result.manual_review_required !== true) {
    failures.push(`${label} must preserve inconclusive automatic accuracy`);
  }
  if (result.contract_status !== "valid") failures.push(`${label} automatic result must preserve a valid contract`);
  if (!Array.isArray(result.failure_categories) || !Array.isArray(result.reasons)) {
    failures.push(`${label} automatic_result categories and reasons must be arrays`);
  }
}

function validateDecision(decision, label, requireComplete, failures) {
  if (!isPlainObject(decision)) {
    failures.push(`${label} adjudication must be a plain object`);
    return null;
  }
  assertExactKeys(decision, ["reviewer_id", "decision", "rationale"], `${label} adjudication`, failures);
  if (typeof decision.reviewer_id !== "string" || decision.reviewer_id === "") {
    failures.push(`${label} adjudication reviewer_id must be a non-empty string`);
  }
  if (!ADJUDICATION_DECISIONS.has(decision.decision)) {
    failures.push(`${label} has invalid adjudication decision ${String(decision.decision)}`);
  }
  if (typeof decision.rationale !== "string") {
    failures.push(`${label} adjudication rationale must be a string`);
  } else if (decision.decision !== "pending" && decision.rationale.trim() === "") {
    failures.push(`${label} completed adjudication requires a rationale`);
  }
  if (requireComplete && decision.decision === "pending") {
    failures.push(`${label} pending adjudication is not allowed`);
  }
  return ADJUDICATION_DECISIONS.has(decision.decision) && typeof decision.reviewer_id === "string"
    ? decision
    : null;
}

function maskReviewerValue(value, terms) {
  if (typeof value === "string") return maskString(value, terms);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => maskReviewerValue(entry, terms));
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    const maskedKey = maskString(key, terms);
    if (Object.hasOwn(result, maskedKey)) throw new Error(`identity masking creates duplicate key ${maskedKey}`);
    result[maskedKey] = maskReviewerValue(child, terms);
  }
  return result;
}

function maskString(value, terms) {
  let result = value;
  for (const term of terms) result = replaceIdentityTerm(result, term, "<identity-masked>");
  return result;
}

function findBlindedIdentity(value, terms) {
  const strings = [];
  collectStrings(value, strings);
  for (const term of terms) {
    if (strings.some((candidate) => containsIdentityTerm(candidate, term))) return term;
  }
  return null;
}

function collectStrings(value, strings) {
  if (typeof value === "string") {
    strings.push(value);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, strings));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    strings.push(key);
    collectStrings(child, strings);
  }
}

function containsIdentityTerm(value, term) {
  return identityPattern(term).test(value);
}

function replaceIdentityTerm(value, term, replacement) {
  if (/^[A-Za-z0-9]+$/.test(term)) {
    return value.replace(identityPattern(term, true), `$1${replacement}`);
  }
  return value.replace(identityPattern(term, true), replacement);
}

function identityPattern(term, global = false) {
  const escaped = escapeRegExp(term);
  const flags = global ? "gi" : "i";
  return /^[A-Za-z0-9]+$/.test(term)
    ? new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, flags)
    : new RegExp(escaped, flags);
}

function identityTokens(value) {
  return value.split(/[^A-Za-z0-9]+/).filter((token) => (
    token.length >= 3
      && !/^\d+$/.test(token)
      && !GENERIC_IDENTITY_TOKENS.has(token.toLowerCase())
  ));
}

function normalizeTerms(terms) {
  return [...new Set(terms.filter((term) => typeof term === "string" && term !== ""))]
    .sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function validateDependencies(dependencies) {
  if (!isPlainObject(dependencies)) throw new TypeError("adjudication dependencies must be a plain object");
  for (const key of Reflect.ownKeys(dependencies)) {
    if (typeof key !== "string") throw new TypeError("adjudication dependencies must not contain symbol keys");
    if (key !== "reviewIdGenerator") {
      throw new TypeError(`adjudication dependencies has unexpected field ${key}`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(dependencies, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError("adjudication dependencies must contain enumerable data properties only");
    }
  }
  const generator = Object.hasOwn(dependencies, "reviewIdGenerator")
    ? Object.getOwnPropertyDescriptor(dependencies, "reviewIdGenerator").value
    : secureReviewId;
  if (typeof generator !== "function") throw new TypeError("reviewIdGenerator must be a function");
  return generator;
}

function secureReviewId() {
  return `R-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
}

function privateRoot(testPrivateRoot) {
  if (testPrivateRoot === undefined) return path.resolve(PRIVATE_ADJUDICATION_ROOT);
  if (typeof testPrivateRoot !== "string" || testPrivateRoot === "") {
    throw new TypeError("testPrivateRoot must be a non-empty string");
  }
  const root = path.resolve(testPrivateRoot);
  const temporaryRoot = path.resolve(os.tmpdir());
  assertContained(temporaryRoot, root);
  if (!path.basename(root).startsWith(TEST_ROOT_PREFIX)) {
    throw new Error(`testPrivateRoot must use the ${TEST_ROOT_PREFIX} prefix`);
  }
  return root;
}

function preparePrivateDirectory(root, directory) {
  assertContained(root, directory);
  const parent = path.dirname(root);
  assertExistingComponents(parent, root);
  secureDirectory(root);
  assertExistingComponents(root, directory);
  secureDirectory(directory);
}

function assertExistingComponents(base, target) {
  const relative = path.relative(base, target);
  if (relative === "" || relative === ".") {
    inspectDirectoryIfPresent(target);
    return;
  }
  assertContained(base, target);
  let current = base;
  inspectDirectoryIfPresent(current);
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    inspectDirectoryIfPresent(current);
  }
}

function inspectDirectoryIfPresent(directory) {
  const stat = lstatIfPresent(directory);
  if (stat === null) return;
  if (stat.isSymbolicLink()) throw new Error(`private path must not traverse a symlink: ${directory}`);
  if (!stat.isDirectory()) throw new Error(`private path must be a directory: ${directory}`);
}

function secureDirectory(directory) {
  const stat = lstatIfPresent(directory);
  if (stat === null) fs.mkdirSync(directory, { mode: 0o700 });
  else {
    if (stat.isSymbolicLink()) throw new Error(`private path must not be a symlink: ${directory}`);
    if (!stat.isDirectory()) throw new Error(`private path must be a directory: ${directory}`);
  }
  fs.chmodSync(directory, 0o700);
  const secured = fs.lstatSync(directory);
  if (!secured.isDirectory() || secured.isSymbolicLink() || (secured.mode & 0o777) !== 0o700) {
    throw new Error(`private directory must have mode 0700: ${directory}`);
  }
}

function secureRegularFile(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`private file must not be a symlink: ${file}`);
  if (!stat.isFile()) throw new Error(`private path must be a regular file: ${file}`);
  fs.chmodSync(file, 0o600);
  if ((fs.lstatSync(file).mode & 0o777) !== 0o600) {
    throw new Error(`private file must have mode 0600: ${file}`);
  }
}

function lstatIfPresent(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertContained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) return;
  throw new Error(`private adjudication path escapes its root: ${candidate}`);
}

function isSafePlanVersion(value) {
  return /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value);
}

function assertExactKeys(value, expected, label, failures) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!isDeepStrictEqual(actual, wanted)) failures.push(`${label} has unexpected or missing fields`);
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!isDeepStrictEqual(actual, wanted)) throw new TypeError(`${label} has unexpected or missing fields`);
}

function requireAllowedKeys(value, allowed, label) {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected !== undefined) throw new TypeError(`${label} has unexpected field ${unexpected}`);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runCli() {
  if (!process.argv.includes("--write")) {
    console.error("Usage: openapi-comparison-v3-adjudication.mjs --write");
    process.exitCode = 2;
    return;
  }
  const plan = readV3Plan();
  const taskPacket = readCalibrationTaskPacket(plan);
  const store = new FileRunStore({
    runsDir: path.join(BENCHMARK_DIR, "private", "runs", plan.plan_version),
    checkpointsDir: path.join(BENCHMARK_DIR, "private", "checkpoints", plan.plan_version),
  });
  const packet = buildBlindedAdjudicationPacket({
    runs: store.listRuns("calibration"),
    tasks: taskPacket.tasks,
  });
  const file = writeBlindedAdjudicationPacket({
    planVersion: plan.plan_version,
    packet,
  });
  console.log(`Wrote ${packet.case_count} blinded adjudication cases to ${path.relative(process.cwd(), file)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
