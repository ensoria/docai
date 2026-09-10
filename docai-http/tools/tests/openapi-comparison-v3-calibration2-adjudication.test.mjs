import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { readTaskPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/contract.mjs";
import { deriveCanonicalRun, verifyCalibrationEvidence } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/evidence-verifier.mjs";
import { buildCalibrationPrompts } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/prompt.mjs";
import { readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";
import { buildRunnerRevision } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/runner.mjs";
import { checkAdjudicationPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-adjudication.mjs";
import { buildBlindedAdjudicationPacket, writeBlindedAdjudicationPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/adjudication.mjs";

const PLAN = readPlan();
const TASK_PACKET_TASKS = readTaskPacket(PLAN).tasks;
const TASKS = TASK_PACKET_TASKS.filter((task) => PLAN.calibration.task_ids.includes(task.id));
const PROMPTS = buildCalibrationPrompts({ plan: PLAN, packet: { benchmark_id: PLAN.benchmark_id, api_id: PLAN.calibration.api_id, tasks: TASK_PACKET_TASKS } });
const REVISION = buildRunnerRevision();
const PACKAGE_DIR = path.resolve("docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2");

test("requires verified evidence for every adjudication entry", () => {
  const { ledger, evidence } = verifiedLedger();
  const packet = buildBlindedAdjudicationPacket(evidence, TASKS, ids());

  assert.throws(() => buildBlindedAdjudicationPacket({ runs: ledger.runs }, TASKS), /verified calibration evidence/);
  assert.throws(() => buildBlindedAdjudicationPacket(structuredClone(evidence), TASKS), /verified calibration evidence/);
  assert.throws(() => writeBlindedAdjudicationPacket({ evidence: { ...evidence }, tasks: TASKS, packet }), /verified calibration evidence/);
});

test("rejects verifier-minted evidence from a different runner revision", () => {
  const { evidence } = verifiedLedger({ revision: "sha256:wrong" });
  assert.throws(() => buildBlindedAdjudicationPacket(evidence, TASKS), /runner revision/);
});

test("includes only verified automatic inconclusive records in a single blinded secondary packet", () => {
  const { evidence } = verifiedLedger();
  const packet = buildBlindedAdjudicationPacket(evidence, TASKS, ids());

  assert.equal(packet.case_count, 0);
  assert.equal(packet.reviewer.reviewer_count, 1);
  assert.equal(packet.review_method, "single-reviewer-condition-provider-model-blinded");
  assert.equal(packet.evidence_role, "secondary-adjudication-does-not-replace-automatic-primary");
  assert.deepEqual(packet.cases, []);
});

test("masks condition, provider, model, target, and run identities from the blinded packet", () => {
  const { evidence } = verifiedLedger();
  const packet = buildBlindedAdjudicationPacket(evidence, TASKS, ids());
  const text = JSON.stringify(packet).toLowerCase();

  for (const term of ["openai", "anthropic", "google", "openapi", "docai", evidence.runs[0].run_id.toLowerCase(), evidence.runs[0].resolved_model.toLowerCase()]) {
    assert.equal(text.includes(term), false, term);
  }
});

test("checker validates the exact empty automatic-evidence multiset", () => {
  const { evidence } = verifiedLedger();
  const packet = buildBlindedAdjudicationPacket(evidence, TASKS, ids());
  const result = checkAdjudicationPacket({ evidence, tasks: TASKS, packet, requireComplete: true });
  assert.deepEqual(result.failures, []);
  packet.cases.push({
    review_id: "R-00000000000000000000000000000001",
    user_task: "generic task",
    output_contract: "generic contract",
    expected_assertions: [],
    model_output: {},
    automatic_result: { transport_status: "completed", format_status: "fenced-json", contract_status: "valid", accuracy_status: "inconclusive", uncertainty_status: "none", failure_categories: [], reasons: [], manual_review_required: true },
    adjudication: { reviewer_id: "reviewer-1", decision: "correct", rationale: "Deterministic assertions support this result." },
  });
  packet.case_count = 1;
  const rewritten = checkAdjudicationPacket({ evidence, tasks: TASKS, packet, requireComplete: true });
  assert.match(rewritten.failures.join("\n"), /evidence multiset/);
});

test("returns ordinary failures for malformed cases containers", () => {
  const { evidence } = verifiedLedger();
  for (const cases of [{}, "cases", null, undefined]) {
    const packet = buildBlindedAdjudicationPacket(evidence, TASKS, ids());
    if (cases === undefined) delete packet.cases;
    else packet.cases = cases;
    assert.doesNotThrow(() => {
      const result = checkAdjudicationPacket({ evidence, tasks: TASKS, packet });
      assert.match(result.failures.join("\n"), /cases|case_count|missing fields/);
    });
  }
});

test("rejects a public private-root override", () => {
  const { evidence } = verifiedLedger();
  const packet = buildBlindedAdjudicationPacket(evidence, TASKS, ids());
  const root = temporaryRoot();
  try {
    assert.throws(
      () => writeBlindedAdjudicationPacket({ evidence, tasks: TASKS, packet, testPrivateRoot: root }),
      /unexpected field/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps non-identity task evidence intact in a genuinely verified non-empty packet", async () => {
  const fixture = await isolatedAmbiguityPackage();
  try {
    const packet = fixture.adjudication.buildBlindedAdjudicationPacket(fixture.evidence, fixture.tasks, ids());
    const inconclusive = fixture.evidence.runs.filter((run) => run.accuracy_status === "inconclusive");

    assert.equal(packet.case_count, inconclusive.length);
    assert.equal(packet.case_count, 12);
    assert.equal(packet.cases.every((entry) => entry.automatic_result.accuracy_status === "inconclusive"), true);
    assert.equal(packet.cases.every((entry) => entry.automatic_result.manual_review_required), true);
    assert.equal(packet.cases.every((entry) => entry.user_task === fixture.tasks.find((task) => task.id === fixture.ambiguityTaskId).public.user_task), true);
    assert.equal(packet.cases.every((entry) => entry.output_contract === fixture.tasks.find((task) => task.id === fixture.ambiguityTaskId).public.output_contract), true);
    assert.equal(packet.cases.every((entry) => JSON.stringify(entry.expected_assertions).includes("evaluator-ambiguity.v1")), true);
    assert.equal(packet.cases.every((entry) => Object.hasOwn(entry.model_output, "request")), true);
    assert.equal(JSON.stringify(packet).includes("<identity-masked>"), true);

    const pending = fixture.check.checkAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet, requireComplete: false });
    assert.deepEqual(pending.failures, []);
    const required = fixture.check.checkAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet, requireComplete: true });
    assert.match(required.failures.join("\n"), /pending adjudication/);

    packet.cases.forEach((entry) => { entry.adjudication = { reviewer_id: "reviewer-1", decision: "correct", rationale: "The retained assertions support this automatic result." }; });
    assert.deepEqual(fixture.check.checkAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet, requireComplete: true }).failures, []);

    const missing = structuredClone(packet);
    missing.cases.splice(-1, 1);
    missing.case_count = missing.cases.length;
    assert.match(fixture.check.checkAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet: missing, requireComplete: true }).failures.join("\n"), /evidence multiset/);

    const duplicate = structuredClone(packet);
    const distinct = duplicate.cases.findIndex((entry) => JSON.stringify(entry.automatic_result) !== JSON.stringify(duplicate.cases[0].automatic_result));
    assert.notEqual(distinct, -1);
    duplicate.cases[distinct] = { ...structuredClone(duplicate.cases[0]), review_id: "R-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF" };
    assert.match(fixture.check.checkAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet: duplicate, requireComplete: true }).failures.join("\n"), /evidence multiset/);

    const substituted = structuredClone(packet);
    substituted.cases[0].model_output = { request: { path: "/substituted" } };
    assert.match(fixture.check.checkAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet: substituted, requireComplete: true }).failures.join("\n"), /evidence multiset/);

    const leaking = structuredClone(packet);
    leaking.cases[0].adjudication.rationale = `The ${fixture.evidence.runs[0].provider} evidence is correct.`;
    assert.match(fixture.check.checkAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet: leaking, requireComplete: true }).failures.join("\n"), /blinded identity/);

    const file = fixture.adjudication.writeBlindedAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet });
    assert.equal(file, path.join(fixture.privateDir, "adjudication", fixture.plan.plan_version, "review-packet.json"));
    assert.equal(fileMode(path.dirname(file)), 0o700);
    assert.equal(fileMode(file), 0o600);
  } finally {
    fixture.cleanup();
  }
});

test("CLI private packet reads reject symlinks and unsafe modes without repair", async (t) => {
  const cases = {
    "final symlink": (fixture, file) => {
      const outside = path.join(fixture.root, "outside.json");
      fs.writeFileSync(outside, fs.readFileSync(file));
      fs.unlinkSync(file);
      fs.symlinkSync(outside, file);
      return outside;
    },
    "intermediate symlink": (fixture, file) => {
      const directory = path.dirname(file);
      const outside = path.join(fixture.root, "outside-directory");
      fs.mkdirSync(outside, { mode: 0o700 });
      fs.renameSync(directory, path.join(outside, fixture.plan.plan_version));
      fs.symlinkSync(outside, directory);
      return path.join(outside, fixture.plan.plan_version, "review-packet.json");
    },
    "permissive file": (_fixture, file) => { fs.chmodSync(file, 0o644); return file; },
    "permissive directory": (_fixture, file) => { fs.chmodSync(path.dirname(file), 0o755); return file; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    await t.test(name, async () => {
      const fixture = await isolatedAmbiguityPackage();
      try {
        const packet = fixture.adjudication.buildBlindedAdjudicationPacket(fixture.evidence, fixture.tasks, ids());
        fixture.persist(packet);
        const file = fixture.adjudication.writeBlindedAdjudicationPacket({ evidence: fixture.evidence, tasks: fixture.tasks, packet });
        const observed = mutate(fixture, file);
        const before = fs.lstatSync(observed);
        const bytes = before.isSymbolicLink() ? fs.readFileSync(observed) : fs.readFileSync(observed);
        const result = spawnSync(process.execPath, [fixture.checkFile], { encoding: "utf8" });
        assert.notEqual(result.status, 0);
        const after = fs.lstatSync(observed);
        assert.deepEqual(fs.readFileSync(observed), bytes);
        assert.equal(after.mode & 0o777, before.mode & 0o777);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

function verifiedLedger({ revision = REVISION } = {}) {
  const plan = structuredClone(PLAN);
  const prompts = structuredClone(PROMPTS);
  const tasks = structuredClone(TASKS);
  const attempts = prompts.map((prompt) => responseAttempt(prompt, revision));
  const runs = prompts.map((prompt, index) => deriveCanonicalRun({ plan, prompt, task: tasks.find((task) => task.id === prompt.task_id), attempts: [attempts[index]], runnerRevision: revision }));
  const ledger = { plan, prompts, tasks, attempts, runs, checkpoint: checkpoint(runs, revision), expectedRunnerRevision: revision };
  const result = verifyCalibrationEvidence(ledger);
  assert.deepEqual(result.failures, []);
  return { ledger, evidence: result.evidence };
}

function responseAttempt(prompt, revision) {
  const task = TASKS.find((candidate) => candidate.id === prompt.task_id);
  return {
    record_version: "1", benchmark_id: PLAN.benchmark_id, plan_version: PLAN.plan_version, batch_id: "calibration", run_id: prompt.run_id,
    api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider, condition: prompt.condition,
    repetition: prompt.repetition, attempt_number: 1, started_at: "2026-09-10T00:00:00.000Z", ended_at: "2026-09-10T00:00:01.000Z", status: "response", provider_call: true,
    response: { content_text: JSON.stringify(task.private.expected_outcome), completion: { complete: true, category: "completed", provider_status: null, stop_reason: "end_turn" }, usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }, resolved_model: `${prompt.target.id}-model`, provider_request_id: `request-${prompt.calibration_ordinal}`, raw_response: { id: `response-${prompt.calibration_ordinal}` } }, error: null, runner_revision: revision,
  };
}

function checkpoint(runs, revision) {
  return { checkpoint_version: "1", benchmark_id: PLAN.benchmark_id, plan_version: PLAN.plan_version, batch_id: "calibration", status: "complete", stop_reason: null, attempt_count: runs.length, completed_run_ids: runs.map((run) => run.run_id), in_flight_attempt: null, runner_revision: revision, updated_at: "2026-09-10T00:00:01.000Z" };
}


function ids() {
  let ordinal = 0;
  return { reviewIdGenerator() { ordinal += 1; return `R-${String(ordinal).padStart(32, "0")}`; } };
}

function temporaryRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), "docai-calibration2-adjudication-")); }
function fileMode(file) { return fs.statSync(file).mode & 0o777; }

async function isolatedAmbiguityPackage() {
  const root = fs.mkdtempSync(path.join(path.resolve("docai-http"), ".calibration2-adjudication-fixture-"));
  const packageDir = path.join(root, "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2");
  fs.mkdirSync(path.dirname(packageDir), { recursive: true });
  fs.cpSync(PACKAGE_DIR, packageDir, { recursive: true });
  fs.cpSync("docai-http/fixtures", path.join(root, "docai-http/fixtures"), { recursive: true });
  const tasksFile = path.join(packageDir, "continuity/tasks.json");
  const packet = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
  const task = packet.tasks.find((candidate) => candidate.id === "upload-document-request");
  task.private.fact_inventory.required.push("fixture:ambiguity");
  task.private.assertions.push({ path: "/request", operator: "evaluator-ambiguity.v1", failure_category: "fixture-ambiguity", fact_id: "fixture:ambiguity" });
  fs.writeFileSync(tasksFile, `${JSON.stringify(packet, null, 2)}\n`);

  const runtime = path.join(packageDir, "runtime");
  const [paths, contract, prompt, verifier, runner, adjudication, check] = await Promise.all([
    import(pathToFileURL(path.join(runtime, "paths.mjs")).href),
    import(pathToFileURL(path.join(runtime, "contract.mjs")).href),
    import(pathToFileURL(path.join(runtime, "prompt.mjs")).href),
    import(pathToFileURL(path.join(runtime, "evidence-verifier.mjs")).href),
    import(pathToFileURL(path.join(runtime, "runner.mjs")).href),
    import(pathToFileURL(path.join(runtime, "adjudication.mjs")).href),
    import(pathToFileURL(path.join(runtime, "check-adjudication.mjs")).href),
  ]);
  const plan = paths.readPlan();
  const taskPacket = contract.readTaskPacket(plan).tasks;
  const tasks = taskPacket.filter((candidate) => plan.calibration.task_ids.includes(candidate.id));
  const prompts = prompt.buildCalibrationPrompts({ plan, packet: { benchmark_id: plan.benchmark_id, api_id: plan.calibration.api_id, tasks: taskPacket } });
  const revision = runner.buildRunnerRevision();
  const attempts = prompts.map((entry) => responseAttemptFor(entry, tasks, plan, revision));
  const runs = prompts.map((entry, index) => verifier.deriveCanonicalRun({ plan, prompt: entry, task: tasks.find((candidate) => candidate.id === entry.task_id), attempts: [attempts[index]], runnerRevision: revision }));
  const checkpointValue = { checkpoint_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: "calibration", status: "complete", stop_reason: null, attempt_count: attempts.length, completed_run_ids: runs.map((run) => run.run_id), in_flight_attempt: null, runner_revision: revision, updated_at: "2026-09-10T00:00:01.000Z" };
  const verification = verifier.verifyCalibrationEvidence({ plan, prompts, tasks, attempts, runs, checkpoint: checkpointValue, expectedRunnerRevision: revision });
  assert.deepEqual(verification.failures, []);
  return {
    root, packageDir, plan, tasks, attempts, runs, checkpoint: checkpointValue, evidence: verification.evidence,
    adjudication, check, privateDir: path.join(packageDir, "private"), checkFile: path.join(runtime, "check-adjudication.mjs"), ambiguityTaskId: task.id,
    persist(packetToWrite) {
      const store = new runner.FileRunStore({ runsDir: path.join(packageDir, "private/runs", plan.plan_version), checkpointsDir: path.join(packageDir, "private/checkpoints", plan.plan_version) });
      store.initialize();
      attempts.forEach((attempt) => store.appendAttempt(attempt));
      runs.forEach((run) => store.appendRun(run));
      store.writeCheckpoint("calibration", checkpointValue);
    },
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); },
  };
}

function responseAttemptFor(prompt, tasks, plan, revision) {
  const task = tasks.find((candidate) => candidate.id === prompt.task_id);
  return {
    record_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: "calibration", run_id: prompt.run_id,
    api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider, condition: prompt.condition,
    repetition: prompt.repetition, attempt_number: 1, started_at: "2026-09-10T00:00:00.000Z", ended_at: "2026-09-10T00:00:01.000Z", status: "response", provider_call: true,
    response: { content_text: JSON.stringify(task.private.expected_outcome), completion: { complete: true, category: "completed", provider_status: null, stop_reason: "end_turn" }, usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }, resolved_model: `${prompt.target.id}-model`, provider_request_id: `request-${prompt.calibration_ordinal}`, raw_response: { id: `response-${prompt.calibration_ordinal}` } }, error: null, runner_revision: revision,
  };
}
