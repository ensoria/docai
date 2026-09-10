import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readTaskPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/contract.mjs";
import { deriveCanonicalRun } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/evidence-verifier.mjs";
import { readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";
import { buildCalibrationPrompts } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/prompt.mjs";
import { checkCalibrationRunState } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-runs.mjs";
import { ProviderTransportError } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/provider-errors.mjs";
import {
  CALIBRATION_RUNNER_REVISION_FILES,
  FileRunStore,
  MemoryRunStore,
  buildRunnerRevision,
  readApprovedPrivateUtf8File,
  runApprovedCalibration,
  validateLivePreflight,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/runner.mjs";
import { PACKAGE_DIR, PRIVATE_DIR } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";

const plan = readPlan();
const packet = readTaskPacket(plan);
const prompts = buildCalibrationPrompts({ plan, packet });
const tasks = packet.tasks.filter((task) => plan.calibration.task_ids.includes(task.id));
const runnerRevision = "sha256:calibration2-runner-test";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(scriptDir, "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/run-calibration.mjs");
const checkedInModelResolutions = readJson(path.join(PACKAGE_DIR, "model-resolutions.json"));
const checkedInCostEstimate = readJson(path.join(PACKAGE_DIR, "cost-estimate.json"));
const checkedInMetrics = readJson(path.join(PRIVATE_DIR, "contexts", "calibration-metrics.json"));

test("dry run reports the 24 request matrix and does not create store state or call a provider", async () => {
  let calls = 0;
  const result = await runApprovedCalibration({
    plan,
    prompts,
    execute: false,
    adapters: adapters(async () => { calls += 1; throw new Error("network forbidden"); }),
  });
  assert.equal(result.report.counts.planned, 24);
  assert.equal(result.report.provider_calls, 0);
  assert.equal(result.report.counts.completed, 0);
  assert.equal(calls, 0);
});

test("Live preflight binds the checked-in ordered model and cost packets without provider calls", () => {
  let calls = 0;
  const capability = validateLivePreflight({
    plan: frozenPlan(),
    prompts,
    adapters: adapters(async () => { calls += 1; throw new Error("provider calls are forbidden"); }),
    modelResolutions: checkedInModelResolutions,
    costEstimate: checkedInCostEstimate,
    metricsPacket: checkedInMetrics,
    freezeManifest: { benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, status: "frozen" },
    validateFreezeArtifacts: () => true,
    runnerRevision,
  });
  assert.ok(capability);
  assert.equal(calls, 0);
});

test("shared private reader is no-follow, mode-safe, and read-only", () => {
  const root = temporaryDirectory();
  const directory = path.join(root, "adjudication", plan.plan_version);
  const file = path.join(directory, "review-packet.json");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(path.join(root, "adjudication"), 0o700);
  fs.chmodSync(directory, 0o700);
  fs.writeFileSync(file, "packet\n", { mode: 0o600 });
  try {
    assert.equal(readApprovedPrivateUtf8File({ root: path.join(root, "adjudication"), segments: [plan.plan_version, "review-packet.json"] }), "packet\n");
    const snapshot = filesystemSnapshot([directory, file]);
    fs.chmodSync(file, 0o644);
    assert.throws(() => readApprovedPrivateUtf8File({ root: path.join(root, "adjudication"), segments: [plan.plan_version, "review-packet.json"] }), /unsafe permissions/);
    assert.deepEqual(fs.readFileSync(file), snapshot[1].bytes);
    assert.equal(fileMode(file), 0o644);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a new response is derived through the full attempt ledger and resumes without calls", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const adapterSet = adapters(async ({ prompt }) => { calls += 1; return successfulResponse(prompt); });
  const first = await runApprovedCalibration(execution({ store, adapters: adapterSet }));
  const second = await runApprovedCalibration(execution({ store, adapters: adapterSet }));

  assert.equal(first.checkpoint.status, "complete");
  assert.equal(second.checkpoint.status, "complete");
  assert.equal(calls, 24);
  assert.equal(store.listAttempts("calibration").length, 24);
  assert.equal(store.listRuns("calibration").length, 24);
  const firstPrompt = prompts[0];
  const canonical = deriveCanonicalRun({
    plan,
    prompt: firstPrompt,
    task: taskFor(firstPrompt),
    attempts: store.listAttempts("calibration").filter((attempt) => attempt.run_id === firstPrompt.run_id),
    runnerRevision,
  });
  assert.deepEqual(store.listRuns("calibration").find((run) => run.run_id === firstPrompt.run_id), canonical);
});

test("rejects a literal forged Live preflight before any provider call", async () => {
  const store = new MemoryRunStore();
  let calls = 0;

  const options = execution({ store, adapters: adapters(async ({ prompt }) => { calls += 1; return successfulResponse(prompt); }) });
  options.livePreflight = livePreflight();
  await assert.rejects(runApprovedCalibration(options), /validated Live preflight capability/);
  assert.equal(calls, 0);
  assert.equal(store.listAttempts("calibration").length, 0);
});

test("verifies retained evidence before dereferencing adapter properties", async () => {
  const store = seededCompleteStore();
  store.runs[0].accuracy_status = "fail";
  let getterCalls = 0;
  const adapterSet = {};
  Object.defineProperty(adapterSet, "openai", {
    enumerable: true,
    get() { getterCalls += 1; throw new Error("adapter getter ran"); },
  });

  const options = execution({ store, adapters: adapters(async ({ prompt }) => successfulResponse(prompt)) });
  options.adapters = adapterSet;
  await assert.rejects(runApprovedCalibration(options), /own enumerable data/);
  assert.equal(getterCalls, 0);
});

test("a retained response/run mismatch fails before provider calls or mutations", async () => {
  const store = seededCompleteStore();
  store.runs[0].accuracy_status = "fail";
  const retainedAttemptCount = store.listAttempts("calibration").length;
  let calls = 0;
  await assert.rejects(
    runApprovedCalibration(execution({ store, adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[0]); }) })),
    /derived run mismatch/,
  );
  assert.equal(calls, 0);
  assert.equal(store.listAttempts("calibration").length, retainedAttemptCount);
});

test("an unresolved in-flight intent does not resend or mutate retained state", async () => {
  const store = new MemoryRunStore();
  store.writeCheckpoint("calibration", openIntentCheckpoint(prompts[0]));
  let calls = 0;
  await assert.rejects(
    runApprovedCalibration(execution({ store, adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[0]); }) })),
    /unresolved-in-flight-intent/,
  );
  assert.equal(calls, 0);
  assert.equal(store.listAttempts("calibration").length, 0);
});

test("FileRunStore construction and checking missing state are read-only", () => {
  const root = temporaryDirectory();
  try {
    const runsDir = path.join(root, "runs");
    const checkpointsDir = path.join(root, "checkpoints");
    const store = new FileRunStore({ runsDir, checkpointsDir });
    assert.equal(fs.existsSync(runsDir), false);
    assert.equal(fs.existsSync(checkpointsDir), false);

    const checked = checkCalibrationRunState({ plan, prompts, tasks, store, runnerRevision });
    assert.equal(checked.calibration.status, "pending");
    assert.equal(fs.existsSync(runsDir), false);
    assert.equal(fs.existsSync(checkpointsDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FileRunStore rejects unsafe directory modes without repairing them", () => {
  const root = temporaryDirectory();
  try {
    const runsDir = path.join(root, "runs");
    const checkpointsDir = path.join(root, "checkpoints");
    fs.mkdirSync(runsDir, { mode: 0o755 });
    fs.mkdirSync(checkpointsDir, { mode: 0o700 });

    assert.throws(() => new FileRunStore({ runsDir, checkpointsDir }), /permissions/);
    assert.equal(fs.statSync(runsDir).mode & 0o777, 0o755);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FileRunStore rejects paths outside its approved private root and freezes its configuration", () => {
  const outside = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "calibration2-outside-"));
  const root = temporaryDirectory();
  try {
    assert.throws(
      () => new FileRunStore({ runsDir: path.join(outside, "runs"), checkpointsDir: path.join(outside, "checkpoints") }),
      /approved private root/,
    );
    const store = new FileRunStore({ runsDir: path.join(root, "runs"), checkpointsDir: path.join(root, "checkpoints") });
    assert.throws(() => { store.runsDir = path.join(outside, "replacement"); }, /read only/);
    assert.throws(() => { store.checkpointsDir = path.join(outside, "replacement"); }, /read only/);
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FileRunStore rejects group or other writable ancestry below the approved private root", () => {
  const unsafe = path.join(PRIVATE_DIR, `.unsafe-store-${process.pid}-${Date.now()}`);
  try {
    fs.mkdirSync(unsafe, { recursive: true, mode: 0o777 });
    fs.chmodSync(unsafe, 0o777);
    assert.throws(
      () => new FileRunStore({ runsDir: path.join(unsafe, "runs"), checkpointsDir: path.join(unsafe, "checkpoints") }),
      /group or other writable/,
    );
  } finally {
    fs.rmSync(unsafe, { recursive: true, force: true });
  }
});

test("FileRunStore rechecks writable ancestry before reading retained state", () => {
  const root = temporaryDirectory();
  try {
    const store = new FileRunStore({ runsDir: path.join(root, "runs"), checkpointsDir: path.join(root, "checkpoints") });
    store.initialize();
    fs.chmodSync(root, 0o777);
    assert.throws(() => store.listAttempts("calibration"), /group or other writable/);
  } finally {
    fs.chmodSync(root, 0o700);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejected Live preflight leaves an uninitialized FileRunStore absent", async () => {
  const root = temporaryDirectory();
  try {
    const runsDir = path.join(root, "runs");
    const checkpointsDir = path.join(root, "checkpoints");
    const store = new FileRunStore({ runsDir, checkpointsDir });
    let calls = 0;
    const options = execution({ store, adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[0]); }) });
    options.livePreflight = livePreflight();

    await assert.rejects(runApprovedCalibration(options), /validated Live preflight capability/);
    assert.equal(calls, 0);
    assert.equal(fs.existsSync(runsDir), false);
    assert.equal(fs.existsSync(checkpointsDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Live preflight rejects any absent API key before minting a capability", () => {
  const adapterSet = adapters(async () => successfulResponse(prompts[0]));
  adapterSet.openai.api_key_status = "absent";
  assert.throws(() => validateLivePreflight({
    plan: frozenPlan(),
    prompts,
    adapters: adapterSet,
    modelResolutions: resolutions(),
    costEstimate: checkedInCostEstimate,
    metricsPacket: checkedInMetrics,
    freezeManifest: { benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, status: "frozen" },
    validateFreezeArtifacts: () => true,
    runnerRevision,
  }), /API key.*present/);
});

test("Live execution uses the execute function bound when the capability was minted", async () => {
  const store = new MemoryRunStore();
  let originalCalls = 0;
  let replacementCalls = 0;
  const adapterSet = adapters(async () => { originalCalls += 1; throw new Error("bound implementation failure"); });
  const options = execution({ store, adapters: adapterSet });
  Object.values(adapterSet).forEach((adapter) => {
    adapter.execute = async () => { replacementCalls += 1; throw new Error("replacement implementation failure"); };
  });

  await runApprovedCalibration(options);
  assert.equal(originalCalls, 1);
  assert.equal(replacementCalls, 0);
});

test("a retained budget at its token ceiling stops before a new provider call", async () => {
  const store = seededOpenStore({ inputTokens: checkedInCostEstimate.calibration.total_tokens_ceiling });
  let calls = 0;
  const result = await runApprovedCalibration(execution({
    store,
    adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[1]); }),
  }));
  assert.equal(calls, 0);
  assert.equal(result.checkpoint.status, "stopped");
  assert.equal(result.checkpoint.stop_reason, "token-ceiling");
});

test("a retained budget at its cost ceiling stops before a new provider call", async () => {
  const store = seededOpenStore({ outputTokens: 130_000 });
  let calls = 0;
  const result = await runApprovedCalibration(execution({
    store,
    adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[1]); }),
  }));
  assert.equal(calls, 0);
  assert.equal(result.checkpoint.stop_reason, "cost-ceiling");
});

test("a response that reaches its token ceiling stops before another provider call", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const result = await runApprovedCalibration(execution({
    store,
    adapters: adapters(async ({ prompt }) => {
      calls += 1;
      return {
        ...successfulResponse(prompt),
        usage: {
          input_tokens: checkedInCostEstimate.calibration.total_tokens_ceiling,
          output_tokens: 0,
          total_tokens: checkedInCostEstimate.calibration.total_tokens_ceiling,
        },
      };
    }),
  }));
  assert.equal(calls, 1);
  assert.equal(result.checkpoint.stop_reason, "token-ceiling");
});

test("two missing terminal runs are rejected before runner mutation or a provider call", async () => {
  const store = new MemoryRunStore();
  store.appendAttempt(responseAttempt(prompts[0]));
  store.appendAttempt(responseAttempt(prompts[1]));
  store.writeCheckpoint("calibration", { ...checkpoint([]), attempt_count: 2 });
  let calls = 0;
  await assert.rejects(
    runApprovedCalibration(execution({ store, adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[2]); }) })),
    /retained ledger is invalid/,
  );
  assert.equal(calls, 0);
  assert.equal(store.listRuns("calibration").length, 0);
  assert.equal(store.listAttempts("calibration").length, 2);
});

test("a forged stale predecessor checkpoint cannot reconcile, mutate, or call an adapter", async () => {
  const store = new MemoryRunStore();
  const terminal = responseAttempt(prompts[0]);
  store.appendAttempt(terminal);
  store.writeCheckpoint("calibration", {
    ...stalePredecessorCheckpoint(terminal, []),
    status: "stopped",
    stop_reason: "forged-stop",
  });
  const before = {
    attempts: store.listAttempts("calibration"),
    runs: store.listRuns("calibration"),
    checkpoint: store.readCheckpoint("calibration"),
  };
  let calls = 0;

  await assert.rejects(
    runApprovedCalibration(execution({ store, adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[1]); }) })),
    /retained ledger is invalid/,
  );

  assert.equal(calls, 0);
  assert.deepEqual({
    attempts: store.listAttempts("calibration"),
    runs: store.listRuns("calibration"),
    checkpoint: store.readCheckpoint("calibration"),
  }, before);
});

test("retries the same prompt immediately after one transport error", async () => {
  const store = new MemoryRunStore();
  const callRunIds = [];
  let calls = 0;
  const result = await runApprovedCalibration(execution({
    store,
    adapters: adapters(async ({ prompt }) => {
      calls += 1;
      callRunIds.push(prompt.run_id);
      if (calls === 1) throw new ProviderTransportError("temporary transport failure");
      throw new Error("stop after retry regression probe");
    }),
  }));
  assert.equal(result.checkpoint.stop_reason, "implementation-defect");
  assert.deepEqual(callRunIds, [prompts[0].run_id, prompts[0].run_id]);
});

test("records successful ended_at after the adapter resolves", async () => {
  const store = new MemoryRunStore();
  let resolved = false;
  let calls = 0;
  const result = await runApprovedCalibration(execution({
    store,
    clock: () => resolved ? "2026-09-08T00:00:02.000Z" : "2026-09-08T00:00:00.000Z",
    adapters: adapters(async ({ prompt }) => {
      calls += 1;
      if (calls === 1) { resolved = true; return successfulResponse(prompt); }
      throw new Error("stop after timestamp regression probe");
    }),
  }));
  assert.equal(result.checkpoint.stop_reason, "implementation-defect");
  assert.equal(store.listAttempts("calibration")[0].ended_at, "2026-09-08T00:00:02.000Z");
});

test("a substituted resolved model becomes an implementation defect without another call", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const result = await runApprovedCalibration(execution({
    store,
    adapters: adapters(async ({ prompt }) => {
      calls += 1;
      return { ...successfulResponse(prompt), resolved_model: "substituted-after-preflight" };
    }),
  }));
  assert.equal(calls, 1);
  assert.equal(result.checkpoint.stop_reason, "implementation-defect");
  assert.equal(store.listRuns("calibration")[0].implementation_defect, true);
});

test("checker scans configured secrets without exposing their value", () => {
  const store = seededCompleteStore();
  const secret = "runner-checker-regression-secret";
  store.attempts[0].response.raw_response.secret = secret;
  const result = checkCalibrationRunState({ plan, prompts, tasks, store, runnerRevision, secretValues: [secret] });
  assert.equal(result.failures.includes("private run state contains a configured secret value"), true);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("runner revision includes every package-local runtime module reachable from its entrypoints", () => {
  const entrypoints = ["runner.mjs", "run-calibration.mjs", "check-runs.mjs"];
  const reachable = runtimeClosure(entrypoints);
  const listed = new Set(CALIBRATION_RUNNER_REVISION_FILES.map((file) => path.basename(file)));
  reachable.forEach((file) => assert.equal(listed.has(file), true, `${file} is missing from the runner revision`));
});

test("FileRunStore initializes explicit private state and keeps logs append-only", () => {
  const root = temporaryDirectory();
  try {
    const runsDir = path.join(root, "runs");
    const checkpointsDir = path.join(root, "checkpoints");
    const store = new FileRunStore({ runsDir, checkpointsDir });
    store.initialize();
    store.appendAttempt(responseAttempt(prompts[0]));
    store.appendAttempt(responseAttempt(prompts[1]));
    store.writeCheckpoint("calibration", checkpoint([]));

    const attemptFile = path.join(runsDir, "calibration", "attempts.jsonl");
    const attemptLines = fs.readFileSync(attemptFile, "utf8").trimEnd().split("\n");
    assert.equal(attemptLines.length, 2);
    assert.deepEqual(JSON.parse(attemptLines[0]), responseAttempt(prompts[0]));
    assert.deepEqual(JSON.parse(attemptLines[1]), responseAttempt(prompts[1]));
    assert.equal(fs.statSync(runsDir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(runsDir, "calibration")).mode & 0o777, 0o700);
    assert.equal(fs.statSync(checkpointsDir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(attemptFile).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(checkpointsDir, "calibration.json")).mode & 0o777, 0o600);
    assert.deepEqual(store.readCheckpoint("calibration"), checkpoint([]));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runApprovedCalibration initializes FileRunStore only when it reaches its first write", async () => {
  const root = temporaryDirectory();
  try {
    const runsDir = path.join(root, "runs");
    const checkpointsDir = path.join(root, "checkpoints");
    const store = new FileRunStore({ runsDir, checkpointsDir });
    let calls = 0;

    const result = await runApprovedCalibration(execution({
      store,
      adapters: adapters(async () => { calls += 1; throw new Error("test implementation failure"); }),
    }));

    assert.equal(calls, 1);
    assert.equal(result.checkpoint.status, "stopped");
    assert.equal(result.checkpoint.stop_reason, "implementation-defect");
    assert.equal(fs.statSync(runsDir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(runsDir, "calibration", "attempts.jsonl")).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(checkpointsDir, "calibration.json")).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FileRunStore does not create dangling final or intermediate symlink targets", () => {
  const root = temporaryDirectory();
  try {
    const runsDir = path.join(root, "runs");
    const store = new FileRunStore({ runsDir, checkpointsDir: path.join(root, "checkpoints") });
    store.initialize();
    const attemptFile = path.join(runsDir, "calibration", "attempts.jsonl");
    const escapedFinal = path.join(root, "escaped-final.jsonl");
    fs.symlinkSync(escapedFinal, attemptFile);
    assert.throws(() => store.appendAttempt(responseAttempt(prompts[0])), /symlink/);
    assert.equal(fs.existsSync(escapedFinal), false);

    fs.unlinkSync(attemptFile);
    fs.rmdirSync(path.join(runsDir, "calibration"));
    const escapedIntermediate = path.join(root, "escaped", "calibration");
    fs.symlinkSync(escapedIntermediate, path.join(runsDir, "calibration"));
    assert.throws(() => store.appendAttempt(responseAttempt(prompts[0])), /symlink/);
    assert.equal(fs.existsSync(escapedIntermediate), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("corrupt or partial FileRunStore JSONL fails before runner mutation", async () => {
  const root = temporaryDirectory();
  try {
    const runsDir = path.join(root, "runs");
    const checkpointsDir = path.join(root, "checkpoints");
    const store = new FileRunStore({ runsDir, checkpointsDir });
    store.initialize();
    const attemptFile = path.join(runsDir, "calibration", "attempts.jsonl");
    fs.writeFileSync(attemptFile, '{"partial":true}', { mode: 0o600 });
    const before = filesystemSnapshot([runsDir, path.join(runsDir, "calibration"), checkpointsDir, attemptFile]);
    let calls = 0;

    await assert.rejects(
      runApprovedCalibration(execution({ store, adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[0]); }) })),
      /JSONL file must end with a newline/,
    );
    assert.equal(calls, 0);
    assert.deepEqual(filesystemSnapshot([runsDir, path.join(runsDir, "calibration"), checkpointsDir, attemptFile]), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tampered FileRunStore resume preserves retained bytes and modes", async () => {
  const root = temporaryDirectory();
  try {
    const runsDir = path.join(root, "runs");
    const checkpointsDir = path.join(root, "checkpoints");
    const store = new FileRunStore({ runsDir, checkpointsDir });
    store.initialize();
    const attemptFile = path.join(runsDir, "calibration", "attempts.jsonl");
    fs.writeFileSync(attemptFile, `${JSON.stringify(responseAttempt(prompts[0]))}\n`, { mode: 0o600 });
    const before = filesystemSnapshot([runsDir, path.join(runsDir, "calibration"), checkpointsDir, attemptFile]);
    let calls = 0;

    await assert.rejects(
      runApprovedCalibration(execution({ store, adapters: adapters(async () => { calls += 1; return successfulResponse(prompts[0]); }) })),
      /retained ledger is invalid/,
    );
    assert.equal(calls, 0);
    assert.deepEqual(filesystemSnapshot([runsDir, path.join(runsDir, "calibration"), checkpointsDir, attemptFile]), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("live preflight declares missing calibration.2 freeze readiness without calling providers", () => {
  assert.throws(() => validateLivePreflight({
    plan,
    prompts,
    adapters: adapters(async () => { throw new Error("network forbidden"); }),
    modelResolutions: {},
    costEstimate: null,
    freezeManifest: null,
    validateFreezeArtifacts: () => true,
    runnerRevision,
  }), /calibration-frozen|frozen/);
});

test("runner public inputs reject Proxy values before traps", async () => {
  const { proxy, calls } = countedProxy({});
  assert.throws(() => new FileRunStore(proxy), /Proxy/);
  assert.equal(calls(), 0);
  await assert.rejects(runApprovedCalibration(proxy), /Proxy/);
  assert.equal(calls(), 0);
  assert.throws(() => buildRunnerRevision({ rootDir: new String("unsafe"), files: ["x"] }), /string/);
});

test("the versioned CLI accepts dry-run only and never creates private run files", () => {
  const result = spawnSync(process.execPath, [CLI, "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Request ceiling: 24/);
  assert.match(result.stdout, /Provider calls: 0/);
  const invalid = spawnSync(process.execPath, [CLI, "--dry-run", "--execute"], { encoding: "utf8" });
  assert.notEqual(invalid.status, 0);
});

test("the versioned CLI reports API-key presence without logging configured values", () => {
  const secret = "cli-presence-only-regression-secret";
  const result = spawnSync(process.execPath, [CLI, "--dry-run"], {
    encoding: "utf8",
    env: { ...process.env, OPENAI_API_KEY: secret, ANTHROPIC_API_KEY: secret, GOOGLE_API_KEY: secret },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /API key presence: openai=present, anthropic=present, google=present/);
  assert.equal(`${result.stdout}${result.stderr}`.includes(secret), false);
});

function execution({ store, adapters: adapterSet, clock = () => "2026-09-08T00:00:00.000Z" }) {
  const frozen = frozenPlan();
  const modelResolutions = resolutions();
  const preflight = validateLivePreflight({
    plan: frozen,
    prompts,
    adapters: adapterSet,
    modelResolutions,
    costEstimate: checkedInCostEstimate,
    metricsPacket: checkedInMetrics,
    freezeManifest: { benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, status: "frozen" },
    validateFreezeArtifacts: () => true,
    runnerRevision,
  });
  return {
    plan: frozen,
    prompts,
    execute: true,
    approval: "3.0.0-calibration.2",
    adapters: adapterSet,
    store,
    tasks,
    modelResolutions,
    runnerRevision,
    livePreflight: preflight,
    clock,
  };
}

function livePreflight() {
  return { benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, runner_revision: runnerRevision, test_only: true };
}

function adapters(execute) {
  return Object.fromEntries(plan.targets.map((target) => [target.provider, { provider: target.provider, api_key_status: "present", execute }]));
}

function resolutions() {
  return structuredClone(checkedInModelResolutions);
}

function successfulResponse(prompt) {
  return {
    content_text: JSON.stringify(taskFor(prompt).private.expected_outcome),
    completion: { complete: true, category: "completed", provider_status: null, stop_reason: "end_turn" },
    usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
    resolved_model: resolutionFor(prompt.target.id).resolved_model,
    provider_request_id: `request-${prompt.calibration_ordinal}`,
    raw_response: { id: `response-${prompt.calibration_ordinal}` },
  };
}

function frozenPlan() {
  return {
    ...plan,
    status: "calibration-frozen",
    targets: plan.targets.map((target) => ({ ...target, model_id: resolutionFor(target.id).resolved_model })),
  };
}

function resolutionFor(targetId) {
  const resolution = checkedInModelResolutions.targets.find((target) => target.target_id === targetId);
  if (!resolution) throw new Error(`missing checked-in resolution for ${targetId}`);
  return resolution;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function responseAttempt(prompt) {
  return {
    record_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: "calibration",
    run_id: prompt.run_id, api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id,
    provider: prompt.target.provider, condition: prompt.condition, repetition: prompt.repetition,
    attempt_number: 1, started_at: "2026-09-08T00:00:00.000Z", ended_at: "2026-09-08T00:00:00.000Z",
    status: "response", provider_call: true, response: successfulResponse(prompt), error: null, runner_revision: runnerRevision,
  };
}

function seededCompleteStore() {
  const store = new MemoryRunStore();
  const attempts = prompts.map(responseAttempt);
  attempts.forEach((attempt) => store.appendAttempt(attempt));
  const runs = prompts.map((prompt, index) => deriveCanonicalRun({ plan, prompt, task: taskFor(prompt), attempts: [attempts[index]], runnerRevision }));
  runs.forEach((run) => store.appendRun(run));
  store.writeCheckpoint("calibration", checkpoint(runs));
  return store;
}

function seededOpenStore({ inputTokens = 0, outputTokens = 0 }) {
  const store = new MemoryRunStore();
  const attempt = responseAttempt(prompts[0]);
  attempt.response.usage = { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens };
  const run = deriveCanonicalRun({ plan, prompt: prompts[0], task: taskFor(prompts[0]), attempts: [attempt], runnerRevision });
  store.appendAttempt(attempt);
  store.appendRun(run);
  store.writeCheckpoint("calibration", checkpoint([run]));
  return store;
}

function checkpoint(runs) {
  return {
    checkpoint_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: "calibration",
    status: runs.length === 24 ? "complete" : "open", stop_reason: null, attempt_count: runs.length,
    completed_run_ids: runs.map((run) => run.run_id), in_flight_attempt: null, runner_revision: runnerRevision,
    updated_at: "2026-09-08T00:00:00.000Z",
  };
}

function stalePredecessorCheckpoint(terminal, runs) {
  return {
    checkpoint_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: "calibration",
    status: "open", stop_reason: null, attempt_count: 1,
    completed_run_ids: runs.map((run) => run.run_id),
    in_flight_attempt: {
      intent_version: "1", benchmark_id: terminal.benchmark_id, plan_version: terminal.plan_version, batch_id: terminal.batch_id,
      run_id: terminal.run_id, api_id: terminal.api_id, task_id: terminal.task_id, target_id: terminal.target_id,
      provider: terminal.provider, condition: terminal.condition, repetition: terminal.repetition,
      attempt_number: terminal.attempt_number, started_at: terminal.started_at, runner_revision: terminal.runner_revision,
    },
    runner_revision: runnerRevision, updated_at: terminal.started_at,
  };
}

function openIntentCheckpoint(prompt) {
  return {
    ...checkpoint([]), attempt_count: 1, in_flight_attempt: {
      intent_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: "calibration",
      run_id: prompt.run_id, api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id,
      provider: prompt.target.provider, condition: prompt.condition, repetition: prompt.repetition,
      attempt_number: 1, started_at: "2026-09-08T00:00:00.000Z", runner_revision: runnerRevision,
    },
  };
}

function taskFor(prompt) { return tasks.find((task) => task.id === prompt.task_id); }

function filesystemSnapshot(files) {
  return files.map((file) => ({
    file,
    mode: fs.statSync(file).mode & 0o777,
    bytes: fs.statSync(file).isFile() ? fs.readFileSync(file) : null,
  }));
}

function fileMode(file) { return fs.statSync(file).mode & 0o777; }

function temporaryDirectory() {
  fs.mkdirSync(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  return fs.mkdtempSync(path.join(PRIVATE_DIR, ".calibration2-store-"));
}

function runtimeClosure(entrypoints) {
  const seen = new Set();
  const pending = [...entrypoints];
  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(path.join(PACKAGE_DIR, "runtime", file), "utf8");
    for (const match of source.matchAll(/from\s+["']\.\/([^"']+\.mjs)["']/g)) pending.push(match[1]);
  }
  return seen;
}

function countedProxy(target) {
  let trapCalls = 0;
  const proxy = new Proxy(target, {
    get(target_, key, receiver) { trapCalls += 1; return Reflect.get(target_, key, receiver); },
    getPrototypeOf(target_) { trapCalls += 1; return Reflect.getPrototypeOf(target_); },
    ownKeys(target_) { trapCalls += 1; return Reflect.ownKeys(target_); },
    getOwnPropertyDescriptor(target_, key) { trapCalls += 1; return Reflect.getOwnPropertyDescriptor(target_, key); },
  });
  return { proxy, calls: () => trapCalls };
}
