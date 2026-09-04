import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readCalibrationTaskPacket } from "../openapi-comparison-v3-context.mjs";
import { buildCalibrationPromptRecords } from "../openapi-comparison-v3-prompt.mjs";
import {
  ProviderResponseError,
  ProviderTransportError,
} from "../openapi-comparison-v3-provider-errors.mjs";
import { validateEvaluationRecord } from "../openapi-comparison-v3-record.mjs";
import {
  CALIBRATION_RUNNER_REVISION_FILES,
  FileRunStore,
  MemoryRunStore,
  buildCalibrationReport,
  buildRunnerRevision,
  runApprovedCalibration,
  selectCalibrationPrompts,
  validateLiveCalibrationPreflight,
  validateRetainedLedger,
} from "../openapi-comparison-v3-runner.mjs";
import { checkCalibrationRunState } from "../check-openapi-comparison-v3-runs.mjs";
import { readV3Plan } from "../openapi-comparison-v3-utils.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(TEST_DIR, "..", "run-openapi-comparison-v3-calibration.mjs");
const PLAN = readV3Plan();
const FROZEN_MODEL_IDS = {
  "openai-frontier": "gpt-5.6-sol",
  "anthropic-balanced": "claude-sonnet-5",
  "google-stable-agentic": "gemini-3.7-flash",
};
const FROZEN_PLAN = {
  ...PLAN,
  status: "calibration-frozen",
  targets: PLAN.targets.map((target) => ({
    ...target,
    model_id: FROZEN_MODEL_IDS[target.id],
  })),
};
const PROMPTS = buildCalibrationPromptRecords(PLAN);
const TASKS = new Map(
  readCalibrationTaskPacket(PLAN).tasks.map((task) => [task.id, task]),
);
const SECRET = "runner-secret-must-not-appear";
const RUNNER_REVISION = "runner-revision-test";

test("selects the exact 24 unique canonical calibration prompts", () => {
  const selected = selectCalibrationPrompts({ plan: PLAN, prompts: [...PROMPTS].reverse() });

  assert.equal(selected.length, 24);
  assert.equal(new Set(selected.map((prompt) => prompt.run_id)).size, 24);
  assert.deepEqual(
    selected.map((prompt) => prompt.calibration_ordinal),
    Array.from({ length: 24 }, (_, index) => index + 1),
  );
  assert.throws(
    () => selectCalibrationPrompts({ plan: PLAN, prompts: [...PROMPTS.slice(0, 23), PROMPTS[0]] }),
    /unique run identities/,
  );
});

test("denies execution without the exact plan-version approval before provider calls", async () => {
  let calls = 0;
  const options = executionOptions({
    adapters: adaptersFor(async () => {
      calls += 1;
      return successfulResponse(PROMPTS[0]);
    }),
    approval: "wrong-calibration",
  });

  await assert.rejects(
    runApprovedCalibration(options),
    /requires explicit approval for 3\.0\.0-calibration\.1/,
  );
  assert.equal(calls, 0);
});

test("dry run validates the plan and reports key presence without provider calls or secrets", async () => {
  let calls = 0;
  const adapters = Object.fromEntries(PLAN.targets.map((target) => [
    target.provider,
    {
      provider: target.provider,
      api_key_status: target.provider === "google" ? "absent" : "present",
      secret: SECRET,
      async execute() {
        calls += 1;
        throw new Error("dry run reached a provider");
      },
    },
  ]));

  const result = await runApprovedCalibration({
    plan: PLAN,
    prompts: PROMPTS,
    execute: false,
    adapters,
  });

  assert.equal(calls, 0);
  assert.equal(result.checkpoint.status, "dry-run");
  assert.equal(result.report.counts.planned, 24);
  assert.equal(result.report.provider_calls, 0);
  assert.deepEqual(result.report.api_key_presence, {
    anthropic: "present",
    google: "absent",
    openai: "present",
  });
  assert.doesNotMatch(JSON.stringify(result.report), new RegExp(SECRET));
});

test("resume skips all completed run identities without another provider call", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const adapters = adaptersFor(async (prompt) => {
    calls += 1;
    return successfulResponse(prompt);
  });

  const first = await runApprovedCalibration(executionOptions({ store, adapters }));
  const second = await runApprovedCalibration(executionOptions({ store, adapters }));

  assert.equal(first.checkpoint.status, "complete");
  assert.equal(second.checkpoint.status, "complete");
  assert.equal(calls, 24);
  assert.equal(store.listAttempts("calibration").length, 24);
  assert.equal(store.listRuns("calibration").length, 24);
  assert.equal(second.report.counts.skipped_completed, 24);
});

test("resume rejects retained attempts from a different runner revision before provider calls", async () => {
  const store = new MemoryRunStore();
  store.appendAttempt({
    record_version: "1",
    benchmark_id: FROZEN_PLAN.benchmark_id,
    plan_version: FROZEN_PLAN.plan_version,
    batch_id: "calibration",
    run_id: PROMPTS[0].run_id,
    api_id: PROMPTS[0].api_id,
    task_id: PROMPTS[0].task_id,
    target_id: PROMPTS[0].target.id,
    provider: PROMPTS[0].target.provider,
    condition: PROMPTS[0].condition,
    repetition: PROMPTS[0].repetition,
    attempt_number: 1,
    started_at: "2026-08-28T00:00:00.000Z",
    ended_at: "2026-08-28T00:00:01.000Z",
    status: "transport-error",
    provider_call: true,
    response: null,
    error: { name: "ProviderTransportError", message: "retained transport failure" },
    runner_revision: "different-runner-revision",
  });
  let calls = 0;

  await assert.rejects(
    runApprovedCalibration(executionOptions({
      store,
      adapters: adaptersFor(async (prompt) => {
        calls += 1;
        return successfulResponse(prompt);
      }),
    })),
    /runner revision/,
  );
  assert.equal(calls, 0);
});

test("retries one pre-response transport failure and retains both attempts", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const firstRunId = PROMPTS[0].run_id;
  const adapters = adaptersFor(async (prompt) => {
    calls += 1;
    if (prompt.run_id === firstRunId && calls === 1) {
      throw new ProviderTransportError("connection ended before a response");
    }
    return successfulResponse(prompt);
  });

  const result = await runApprovedCalibration(executionOptions({ store, adapters }));
  const firstAttempts = store.listAttempts("calibration")
    .filter((attempt) => attempt.run_id === firstRunId);

  assert.equal(result.checkpoint.status, "complete");
  assert.equal(calls, 25);
  assert.deepEqual(firstAttempts.map((attempt) => attempt.status), [
    "transport-error",
    "response",
  ]);
  assert.deepEqual(firstAttempts.map((attempt) => attempt.attempt_number), [1, 2]);
  assert.equal(store.listRuns("calibration").find((run) => run.run_id === firstRunId).attempt_count, 2);
});

test("a second pre-response transport failure becomes terminal without a third attempt", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const firstRunId = PROMPTS[0].run_id;
  const adapters = adaptersFor(async (prompt) => {
    calls += 1;
    if (prompt.run_id === firstRunId) {
      throw new ProviderTransportError("transport remained unavailable");
    }
    return successfulResponse(prompt);
  });

  await runApprovedCalibration(executionOptions({ store, adapters }));
  const firstAttempts = store.listAttempts("calibration")
    .filter((attempt) => attempt.run_id === firstRunId);
  const firstRun = store.listRuns("calibration").find((run) => run.run_id === firstRunId);

  assert.equal(calls, 25);
  assert.deepEqual(firstAttempts.map((attempt) => attempt.status), [
    "transport-error",
    "transport-error",
  ]);
  assert.equal(firstRun.transport_status, "transport-error");
  assert.equal(firstRun.attempt_count, 2);
});

test("does not retry provider, content, contract, or accuracy failures", async (t) => {
  const cases = [
    {
      name: "provider failure",
      response() {
        throw new ProviderResponseError("provider rejected request", { category: "provider_error" });
      },
      expected: { transport_status: "provider-error" },
    },
    {
      name: "content failure",
      response(prompt) {
        return successfulResponse(prompt, { contentText: "not json" });
      },
      expected: { format_status: "invalid-json" },
    },
    {
      name: "contract failure",
      response(prompt) {
        return successfulResponse(prompt, { contentText: "{}" });
      },
      expected: { contract_status: "invalid" },
    },
    {
      name: "accuracy failure",
      response(prompt) {
        const outcome = structuredClone(taskForPrompt(prompt).private.expected_outcome);
        outcome.request.method = "GET";
        return successfulResponse(prompt, { contentText: JSON.stringify(outcome) });
      },
      expected: { accuracy_status: "fail" },
    },
  ];

  for (const expectedCase of cases) {
    await t.test(expectedCase.name, async () => {
      const store = new MemoryRunStore();
      let calls = 0;
      const firstRunId = PROMPTS[0].run_id;
      const adapters = adaptersFor(async (prompt) => {
        calls += 1;
        return prompt.run_id === firstRunId
          ? expectedCase.response(prompt)
          : successfulResponse(prompt);
      });

      await runApprovedCalibration(executionOptions({ store, adapters }));
      const attempts = store.listAttempts("calibration")
        .filter((attempt) => attempt.run_id === firstRunId);
      const run = store.listRuns("calibration").find((record) => record.run_id === firstRunId);

      assert.equal(calls, 24);
      assert.equal(attempts.length, 1);
      assert.deepEqual(
        Object.fromEntries(Object.keys(expectedCase.expected).map((key) => [key, run[key]])),
        expectedCase.expected,
      );
    });
  }
});

test("validates a malformed 100-row retained ledger before applying the attempt cap", async () => {
  const store = new MemoryRunStore();
  for (let index = 0; index < 100; index += 1) {
    store.appendAttempt({ retained_attempt: index + 1 });
  }
  let calls = 0;

  await assert.rejects(
    runApprovedCalibration(executionOptions({
      store,
      adapters: adaptersFor(async (prompt) => {
        calls += 1;
        return successfulResponse(prompt);
      }),
    })),
    /retained ledger/,
  );
  assert.equal(calls, 0);
});

test("records and immediately stops on an implementation defect", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const result = await runApprovedCalibration(executionOptions({
    store,
    adapters: adaptersFor(async () => {
      calls += 1;
      throw new Error("synthetic adapter implementation defect");
    }),
  }));

  assert.equal(calls, 1);
  assert.equal(result.checkpoint.status, "stopped");
  assert.equal(result.checkpoint.stop_reason, "implementation-defect");
  assert.equal(store.listAttempts("calibration").length, 1);
  assert.equal(store.listRuns("calibration").length, 1);
  assert.equal(store.listRuns("calibration")[0].implementation_defect, true);
});

test("a grader defect after a usable response retains one response attempt and stops", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const result = await runApprovedCalibration({
    ...executionOptions({
      store,
      adapters: adaptersFor(async (prompt) => {
        calls += 1;
        return successfulResponse(prompt);
      }),
    }),
    grader() {
      throw new Error("synthetic grader defect");
    },
  });

  const attempts = store.listAttempts("calibration");
  assert.equal(calls, 1);
  assert.equal(result.checkpoint.stop_reason, "implementation-defect");
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, "response");
  assert.equal(attempts[0].response.raw_response.id, "response-1");
  assert.equal(store.listRuns("calibration")[0].implementation_defect, true);
});

test("a transport-typed parser defect after a usable response is an implementation defect", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const result = await runApprovedCalibration({
    ...executionOptions({
      store,
      adapters: adaptersFor(async (prompt) => {
        calls += 1;
        return successfulResponse(prompt);
      }),
    }),
    parser() {
      throw new ProviderTransportError("parser is not provider transport");
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.checkpoint.stop_reason, "implementation-defect");
  assert.deepEqual(store.listAttempts("calibration").map((attempt) => attempt.status), [
    "response",
  ]);
  assert.equal(store.listRuns("calibration")[0].implementation_defect, true);
});

test("resume fails closed for an unresolved in-flight intent without resending", async () => {
  const store = new MemoryRunStore();
  const intent = inFlightIntent(PROMPTS[0]);
  store.writeCheckpoint("calibration", retainedCheckpoint({
    attemptCount: 1,
    intent,
  }));
  let calls = 0;

  const result = await runApprovedCalibration(executionOptions({
    store,
    adapters: adaptersFor(async (prompt) => {
      calls += 1;
      return successfulResponse(prompt);
    }),
  }));

  assert.equal(calls, 0);
  assert.equal(result.checkpoint.status, "stopped");
  assert.equal(result.checkpoint.stop_reason, "unresolved-in-flight-intent");
  assert.equal(result.checkpoint.attempt_count, 1);
  assert.deepEqual(result.checkpoint.in_flight_attempt, intent);
  assert.equal(result.report.counts.attempts, 1);
});

test("persists and counts an atomic in-flight intent before every provider call", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const result = await runApprovedCalibration(executionOptions({
    store,
    livePreflight: validatedPreflight({
      costEstimatePacket: costEstimate({ tokenCeiling: 25, costCeilingUsd: 100 }),
    }),
    adapters: adaptersFor(async (prompt) => {
      calls += 1;
      const checkpoint = store.readCheckpoint("calibration");
      assert.equal(store.listAttempts("calibration").length, 0);
      assert.equal(checkpoint.attempt_count, 1);
      assert.equal(checkpoint.in_flight_attempt.run_id, prompt.run_id);
      assert.equal(checkpoint.in_flight_attempt.attempt_number, 1);
      return successfulResponse(prompt);
    }),
  }));

  assert.equal(calls, 1);
  assert.equal(result.checkpoint.stop_reason, "token-ceiling");
  assert.equal(result.checkpoint.in_flight_attempt, null);
});

test("resume reconciles an in-flight intent only with its existing terminal attempt", async () => {
  const store = new MemoryRunStore();
  const prompt = PROMPTS[0];
  const intent = inFlightIntent(prompt);
  store.appendAttempt(responseAttempt(prompt));
  store.writeCheckpoint("calibration", retainedCheckpoint({
    attemptCount: 1,
    intent,
  }));
  let calls = 0;

  const result = await runApprovedCalibration(executionOptions({
    store,
    adapters: adaptersFor(async (selected) => {
      calls += 1;
      return successfulResponse(selected);
    }),
  }));

  assert.equal(calls, 23);
  assert.equal(result.checkpoint.status, "complete");
  assert.equal(result.checkpoint.in_flight_attempt, null);
  assert.equal(store.listAttempts("calibration").length, 24);
  assert.equal(store.listRuns("calibration").length, 24);
});

test("resume records a retained-response parser defect without resending", async () => {
  const store = new MemoryRunStore();
  const prompt = PROMPTS[0];
  store.appendAttempt(responseAttempt(prompt));
  store.writeCheckpoint("calibration", retainedCheckpoint({ attemptCount: 1 }));
  let calls = 0;

  const result = await runApprovedCalibration({
    ...executionOptions({
      store,
      adapters: adaptersFor(async (selected) => {
        calls += 1;
        return successfulResponse(selected);
      }),
    }),
    parser() {
      throw new ProviderTransportError("retained parser defect is not transport");
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.checkpoint.stop_reason, "implementation-defect");
  assert.equal(store.listAttempts("calibration").length, 1);
  assert.equal(store.listRuns("calibration")[0].implementation_defect, true);
});

test("resume and checker share canonical retained-ledger validation", async () => {
  const store = new MemoryRunStore();
  const prompt = PROMPTS[0];
  store.appendRun(validRun(prompt, {
    api_id: "forged-api",
    attempt_count: 99,
  }));
  store.writeCheckpoint("calibration", retainedCheckpoint({
    completedRunIds: [prompt.run_id],
  }));
  let calls = 0;

  await assert.rejects(
    runApprovedCalibration(executionOptions({
      store,
      adapters: adaptersFor(async (selected) => {
        calls += 1;
        return successfulResponse(selected);
      }),
    })),
    /canonical api_id|no retained attempt/,
  );
  const direct = validateRetainedLedger({
    plan: FROZEN_PLAN,
    prompts: PROMPTS,
    attempts: store.listAttempts("calibration"),
    runs: store.listRuns("calibration"),
    checkpoint: store.readCheckpoint("calibration"),
    expectedRunnerRevision: RUNNER_REVISION,
  });
  const checked = checkCalibrationRunState({ plan: FROZEN_PLAN, prompts: PROMPTS, store });

  assert.equal(calls, 0);
  assert.deepEqual(checked.failures, direct.failures);
  assert.match(checked.failures.join("\n"), /canonical api_id|no retained attempt/);
});

test("runner snapshots adapter results before persistence", async () => {
  const store = new MemoryRunStore();
  let firstResponse;
  await runApprovedCalibration(executionOptions({
    store,
    adapters: adaptersFor(async (prompt) => {
      const response = successfulResponse(prompt);
      if (prompt.run_id === PROMPTS[0].run_id) firstResponse = response;
      return response;
    }),
  }));

  firstResponse.raw_response.id = "mutated-after-persistence";
  const retained = store.listAttempts("calibration")[0].response.raw_response;
  assert.equal(retained.id, "response-1");
});

test("synthetic completion flows through parse, contract, grade, persist, and exceptional count", async () => {
  const store = new MemoryRunStore();
  const firstRunId = PROMPTS[0].run_id;
  const result = await runApprovedCalibration(executionOptions({
    store,
    adapters: adaptersFor(async (prompt) => successfulResponse(prompt, {
      fenced: prompt.run_id === firstRunId,
    })),
  }));

  const runs = store.listRuns("calibration");
  assert.equal(result.checkpoint.status, "complete");
  assert.equal(runs.length, 24);
  runs.forEach(validateEvaluationRecord);
  assert.equal(runs.find((run) => run.run_id === firstRunId).format_status, "fenced-json");
  assert.equal(runs.find((run) => run.run_id === firstRunId).contract_status, "valid");
  assert.equal(runs.find((run) => run.run_id === firstRunId).accuracy_status, "pass");
  assert.equal(result.report.counts.exceptional_runs, 1);

  const checked = checkCalibrationRunState({ plan: FROZEN_PLAN, prompts: PROMPTS, store });
  assert.deepEqual(checked.failures, []);
});

test("stores snapshot mutable values and file logs remain append-only with atomic checkpoints", () => {
  const mutable = { nested: { value: "before" } };
  const memory = new MemoryRunStore();
  memory.appendAttempt(mutable);
  mutable.nested.value = "after";
  const listed = memory.listAttempts("calibration");
  listed[0].nested.value = "listed mutation";
  assert.equal(memory.listAttempts("calibration")[0].nested.value, "before");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-run-store-"));
  try {
    const store = new FileRunStore({
      runsDir: path.join(root, "runs"),
      checkpointsDir: path.join(root, "checkpoints"),
    });
    store.appendAttempt({ id: "attempt-1", batch_id: "calibration" });
    store.appendAttempt({ id: "attempt-2", batch_id: "calibration" });
    store.appendRun({ id: "run-1", batch_id: "calibration" });
    store.writeCheckpoint("calibration", { generation: 1 });
    store.writeCheckpoint("calibration", { generation: 2 });

    assert.deepEqual(store.listAttempts("calibration").map((row) => row.id), [
      "attempt-1",
      "attempt-2",
    ]);
    assert.deepEqual(store.listRuns("calibration").map((row) => row.id), ["run-1"]);
    assert.deepEqual(store.readCheckpoint("calibration"), { generation: 2 });
    assert.equal(
      fs.readFileSync(path.join(root, "runs", "calibration", "attempts.jsonl"), "utf8")
        .trim().split("\n").length,
      2,
    );
    assert.deepEqual(
      fs.readdirSync(path.join(root, "checkpoints")).sort(),
      ["calibration.json"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("file store tightens existing private modes and rejects symlinks or wrong path types", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-private-modes-"));
  try {
    const runsDir = path.join(root, "runs");
    const batchDir = path.join(runsDir, "calibration");
    const checkpointsDir = path.join(root, "checkpoints");
    fs.mkdirSync(batchDir, { recursive: true, mode: 0o755 });
    fs.mkdirSync(checkpointsDir, { mode: 0o755 });
    const attemptsFile = path.join(batchDir, "attempts.jsonl");
    fs.writeFileSync(attemptsFile, "", { mode: 0o644 });
    fs.chmodSync(runsDir, 0o755);
    fs.chmodSync(batchDir, 0o755);
    fs.chmodSync(checkpointsDir, 0o755);

    const store = new FileRunStore({ runsDir, checkpointsDir });
    store.appendAttempt({ id: "secured", batch_id: "calibration" });
    store.writeCheckpoint("calibration", { generation: 1 });

    assert.equal(fileMode(runsDir), 0o700);
    assert.equal(fileMode(batchDir), 0o700);
    assert.equal(fileMode(checkpointsDir), 0o700);
    assert.equal(fileMode(attemptsFile), 0o600);
    assert.equal(fileMode(path.join(checkpointsDir, "calibration.json")), 0o600);

    const symlinkRoot = path.join(root, "symlink-root");
    fs.symlinkSync(runsDir, symlinkRoot);
    assert.throws(
      () => new FileRunStore({ runsDir: symlinkRoot, checkpointsDir: path.join(root, "other") }),
      /symlink/,
    );

    const wrongType = path.join(root, "wrong-type");
    fs.writeFileSync(wrongType, "not a directory");
    assert.throws(
      () => new FileRunStore({ runsDir: wrongType, checkpointsDir: path.join(root, "more") }),
      /directory/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("memory and file snapshots preserve an own __proto__ JSON key safely", () => {
  const value = JSON.parse('{"batch_id":"calibration","__proto__":{"audit":true},"safe":1}');
  const memory = new MemoryRunStore();
  memory.appendAttempt(value);
  const memoryValue = memory.listAttempts("calibration")[0];
  assert.equal(Object.hasOwn(memoryValue, "__proto__"), true);
  assert.deepEqual(memoryValue.__proto__, { audit: true });
  assert.equal(Object.getPrototypeOf(memoryValue), Object.prototype);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-proto-"));
  try {
    const file = new FileRunStore({
      runsDir: path.join(root, "runs"),
      checkpointsDir: path.join(root, "checkpoints"),
    });
    file.appendAttempt(value);
    const fileValue = file.listAttempts("calibration")[0];
    assert.equal(Object.hasOwn(fileValue, "__proto__"), true);
    assert.deepEqual(fileValue.__proto__, { audit: true });
    assert.match(
      fs.readFileSync(path.join(root, "runs", "calibration", "attempts.jsonl"), "utf8"),
      /"__proto__":\{"audit":true\}/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runner revision changes with source content and reports never expose retained errors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-revision-"));
  try {
    fs.writeFileSync(path.join(root, "a.mjs"), "export const value = 1;\n");
    const first = buildRunnerRevision({ rootDir: root, files: ["a.mjs"] });
    const repeated = buildRunnerRevision({ rootDir: root, files: ["a.mjs"] });
    fs.writeFileSync(path.join(root, "a.mjs"), "export const value = 2;\n");
    const changed = buildRunnerRevision({ rootDir: root, files: ["a.mjs"] });

    assert.match(first, /^sha256:[a-f0-9]{64}$/);
    assert.equal(first, repeated);
    assert.notEqual(first, changed);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const store = new MemoryRunStore();
  store.appendAttempt({ error: { message: SECRET }, batch_id: "calibration" });
  const report = buildCalibrationReport({
    plan: PLAN,
    store,
    status: "stopped",
    adapters: adaptersFor(async () => null, { secret: SECRET }),
  });
  assert.doesNotMatch(JSON.stringify(report), new RegExp(SECRET));
});

test("configured runner revision covers evaluator code and consumed calibration artifacts", () => {
  const required = [
    "docai-http/tools/openapi-comparison-v3-parser.mjs",
    "docai-http/tools/openapi-comparison-v3-grader.mjs",
    "docai-http/tools/openapi-comparison-v3-prompt.mjs",
    "docai-http/tools/openapi-comparison-v3-record.mjs",
    "docai-http/tools/openapi-comparison-v3-contract.mjs",
    "docai-http/tools/openapi-comparison-v3-context.mjs",
    "docai-http/tools/openapi-comparison-v3-utils.mjs",
    "docai-http/tools/openapi-comparison-v2-context.mjs",
    "docai-http/tools/openapi-comparison-v2-contract.mjs",
    "docai-http/tools/openapi-comparison-v2-utils.mjs",
    "docai-http/benchmarks/openapi-comparison/v2/plan.json",
    "docai-http/benchmarks/openapi-comparison/v2/contracts.json",
    "docai-http/benchmarks/openapi-comparison/v3/plan.json",
    "docai-http/benchmarks/openapi-comparison/v3/contracts.json",
    "docai-http/benchmarks/openapi-comparison/v3/continuity/tasks.json",
    "docai-http/benchmarks/openapi-comparison/v3/calibration-schedule.jsonl",
    "docai-http/benchmarks/openapi-comparison/v3/private/prompts/calibration.jsonl",
    "docai-http/benchmarks/openapi-comparison/v3/private/contexts/calibration-metrics.json",
    "docai-http/benchmarks/openapi-comparison/v3/model-resolutions.json",
    "docai-http/benchmarks/openapi-comparison/v3/cost-estimate.json",
    "docai-http/benchmarks/openapi-comparison/v3/freeze-manifest.json",
    "docai-http/tools/estimate-openapi-comparison-v3-cost.mjs",
    "docai-http/tools/freeze-openapi-comparison-v3.mjs",
  ];
  required.forEach((file) => assert.ok(CALIBRATION_RUNNER_REVISION_FILES.includes(file), file));
  assert.equal(
    new Set(CALIBRATION_RUNNER_REVISION_FILES).size,
    CALIBRATION_RUNNER_REVISION_FILES.length,
  );
});

test("calibration report counts distinct validated completed and exceptional run IDs", () => {
  const store = new MemoryRunStore();
  const run = validRun(PROMPTS[0], { format_status: "fenced-json" });
  store.appendRun(run);
  store.appendRun(run);

  const report = buildCalibrationReport({
    plan: PLAN,
    store,
    status: "open",
    adapters: adaptersFor(async () => null),
  });

  assert.equal(report.counts.completed, 1);
  assert.equal(report.counts.exceptional_runs, 1);
  assert.equal(report.counts.remaining, 23);
});

test("Live preflight validates every key, model, freeze hook, and numeric ceiling", () => {
  let freezeChecks = 0;
  const inputs = preflightInputs({
    validateFreezeArtifacts({ freezeManifest, plan, runnerRevision }) {
      freezeChecks += 1;
      assert.equal(freezeManifest.plan_version, FROZEN_PLAN.plan_version);
      assert.equal(plan, FROZEN_PLAN);
      assert.equal(runnerRevision, RUNNER_REVISION);
      return { valid: true };
    },
  });
  const validated = validateLiveCalibrationPreflight(inputs);
  assert.equal(freezeChecks, 1);
  assert.equal(validated.token_ceiling, 1_000_000);
  assert.equal(validated.cost_ceiling_usd, 100);

  const missingKey = preflightInputs();
  missingKey.adapters.google = { ...missingKey.adapters.google, api_key_status: "absent" };
  assert.throws(() => validateLiveCalibrationPreflight(missingKey), /google API key is required/);

  const missingModel = preflightInputs();
  delete missingModel.modelResolutions["anthropic-balanced"];
  assert.throws(
    () => validateLiveCalibrationPreflight(missingModel),
    /missing model resolution for target anthropic-balanced/,
  );

  const substitutedModel = preflightInputs();
  substitutedModel.modelResolutions["openai-frontier"].requested_model = "substituted-before-freeze";
  assert.throws(
    () => validateLiveCalibrationPreflight(substitutedModel),
    /requested_model must match frozen plan model_id/,
  );

  const nonnumericCost = preflightInputs();
  nonnumericCost.costEstimate.calibration.cost_ceiling_usd = "100";
  assert.throws(
    () => validateLiveCalibrationPreflight(nonnumericCost),
    /cost ceiling must be a positive finite number/,
  );

  const nonnumericTokens = preflightInputs();
  nonnumericTokens.costEstimate.calibration.total_tokens_ceiling = "1000000";
  assert.throws(
    () => validateLiveCalibrationPreflight(nonnumericTokens),
    /token ceiling must be a positive integer/,
  );

  const wrongFreezeIdentity = preflightInputs();
  wrongFreezeIdentity.freezeManifest.plan_version = "wrong-plan";
  assert.throws(
    () => validateLiveCalibrationPreflight(wrongFreezeIdentity),
    /freeze manifest does not match the approved plan/,
  );

  const invalidFreeze = preflightInputs({ validateFreezeArtifacts: () => ({ valid: false }) });
  assert.throws(
    () => validateLiveCalibrationPreflight(invalidFreeze),
    /freeze artifact validation failed/,
  );
});

test("execution requires validated Live preflight before touching store or providers", async () => {
  let storeTouches = 0;
  let calls = 0;
  const store = new Proxy({}, {
    get() {
      storeTouches += 1;
      throw new Error("store opened before preflight");
    },
  });

  await assert.rejects(
    runApprovedCalibration({
      ...executionOptions({
        store,
        adapters: adaptersFor(async () => {
          calls += 1;
          return successfulResponse(PROMPTS[0]);
        }),
      }),
      livePreflight: {},
    }),
    /validated Live preflight/,
  );
  assert.equal(storeTouches, 0);
  assert.equal(calls, 0);
});

test("execution rejects a provider model substitution against the validated preflight", async () => {
  const store = new MemoryRunStore();
  let calls = 0;
  const result = await runApprovedCalibration(executionOptions({
    store,
    adapters: adaptersFor(async (prompt) => {
      calls += 1;
      const response = successfulResponse(prompt);
      response.resolved_model = "substituted-after-freeze";
      return response;
    }),
  }));

  assert.equal(calls, 1);
  assert.equal(result.checkpoint.stop_reason, "implementation-defect");
  assert.equal(store.listAttempts("calibration")[0].status, "response");
  assert.equal(
    store.listAttempts("calibration")[0].response.resolved_model,
    "substituted-after-freeze",
  );
  assert.equal(store.listRuns("calibration")[0].implementation_defect, true);
});

test("execution enforces cumulative token and USD cost ceilings", async (t) => {
  const cases = [
    {
      name: "token ceiling",
      cost: costEstimate({ tokenCeiling: 25, costCeilingUsd: 100 }),
      expectedStop: "token-ceiling",
    },
    {
      name: "cost ceiling",
      cost: costEstimate({ tokenCeiling: 1_000_000, costCeilingUsd: 0.000001 }),
      expectedStop: "cost-ceiling",
    },
  ];

  for (const expected of cases) {
    await t.test(expected.name, async () => {
      const store = new MemoryRunStore();
      let calls = 0;
      const preflight = validatedPreflight({ costEstimatePacket: expected.cost });
      const result = await runApprovedCalibration(executionOptions({
        store,
        livePreflight: preflight,
        adapters: adaptersFor(async (prompt) => {
          calls += 1;
          return successfulResponse(prompt);
        }),
      }));

      assert.equal(calls, 1);
      assert.equal(result.checkpoint.status, "stopped");
      assert.equal(result.checkpoint.stop_reason, expected.expectedStop);
      assert.equal(store.listAttempts("calibration").length, 1);
      assert.equal(store.listRuns("calibration").length, 1);
    });
  }
});

test("resume enforces retained cumulative usage before another provider call", async () => {
  const store = new MemoryRunStore();
  const prompt = PROMPTS[0];
  store.appendAttempt(responseAttempt(prompt));
  store.appendRun(validRun(prompt, {
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
  }));
  store.writeCheckpoint("calibration", retainedCheckpoint({
    attemptCount: 1,
    completedRunIds: [prompt.run_id],
  }));
  let calls = 0;

  const result = await runApprovedCalibration(executionOptions({
    store,
    livePreflight: validatedPreflight({
      costEstimatePacket: costEstimate({ tokenCeiling: 25, costCeilingUsd: 100 }),
    }),
    adapters: adaptersFor(async (selected) => {
      calls += 1;
      return successfulResponse(selected);
    }),
  }));

  assert.equal(calls, 0);
  assert.equal(result.checkpoint.status, "stopped");
  assert.equal(result.checkpoint.stop_reason, "token-ceiling");
  assert.equal(result.checkpoint.attempt_count, 1);
});

test("dry-run CLI prints identity, ceilings, targets, key presence, and zero calls", () => {
  const result = spawnSync(process.execPath, [CLI, "--dry-run"], {
    cwd: path.resolve(TEST_DIR, "..", "..", ".."),
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_API_KEY: SECRET,
      ANTHROPIC_API_KEY: "",
      GOOGLE_API_KEY: "",
      DOCAI_LIVE_LLM_APPROVED_CALIBRATION: FROZEN_PLAN.plan_version,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Plan: docai-http-openapi-comparison-v3 3\.0\.0-calibration\.1/);
  assert.match(result.stdout, /Request ceiling: 24/);
  assert.match(result.stdout, /Estimated token ceiling: \d+/);
  assert.match(result.stdout, /Estimated cost ceiling \(USD\):/);
  assert.match(result.stdout, /openai-frontier \(openai\)/);
  assert.match(result.stdout, /anthropic-balanced \(anthropic\)/);
  assert.match(result.stdout, /google-stable-agentic \(google\)/);
  assert.match(result.stdout, /API key presence: openai=present, anthropic=absent, google=absent/);
  assert.match(result.stdout, /Provider calls: 0/);
  assert.doesNotMatch(result.stdout, new RegExp(SECRET));
});

function executionOptions({
  store = new MemoryRunStore(),
  adapters = adaptersFor(async (prompt) => successfulResponse(prompt)),
  approval = FROZEN_PLAN.plan_version,
  livePreflight = validatedPreflight({ adapters }),
} = {}) {
  return {
    plan: FROZEN_PLAN,
    prompts: PROMPTS,
    execute: true,
    approval,
    adapters,
    store,
    taskForPrompt,
    modelResolutions: modelResolutions(),
    clock: deterministicClock(),
    runnerRevision: RUNNER_REVISION,
    livePreflight,
  };
}

function adaptersFor(execute, extra = {}) {
  return Object.fromEntries(PLAN.targets.map((target) => [
    target.provider,
    {
      provider: target.provider,
      api_key_status: "present",
      async execute({ prompt, modelResolution }) {
        return execute(prompt, modelResolution);
      },
      ...extra,
    },
  ]));
}

function taskForPrompt(prompt) {
  const task = TASKS.get(prompt.task_id);
  if (!task) throw new Error(`missing task ${prompt.task_id}`);
  return task;
}

function successfulResponse(prompt, { contentText = null, fenced = false } = {}) {
  const json = contentText ?? JSON.stringify(taskForPrompt(prompt).private.expected_outcome);
  return {
    content_text: fenced ? `\`\`\`json\n${json}\n\`\`\`` : json,
    completion: {
      complete: true,
      category: "completed",
      provider_status: "completed",
      stop_reason: null,
    },
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    resolved_model: FROZEN_MODEL_IDS[prompt.target.id],
    provider_request_id: `request-${prompt.calibration_ordinal}`,
    raw_response: { id: `response-${prompt.calibration_ordinal}` },
  };
}

function deterministicClock() {
  let tick = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 7, 28, 0, 0, tick)).toISOString();
    tick += 1;
    return value;
  };
}

function modelResolutions() {
  return Object.fromEntries(FROZEN_PLAN.targets.map((target) => [
    target.id,
    {
      target_id: target.id,
      provider: target.provider,
      requested_model: target.model_id ?? `${target.id}-requested`,
      resolved_model: target.model_id ?? `${target.id}-resolved`,
      pricing_usd_per_million_tokens: { input: 1, output: 1 },
      request_settings: {
        json_output_mode: "prompt-only",
        sampling_parameters: "omitted",
        max_output_tokens: 8192,
        tools: false,
        ...(target.provider === "openai" ? { reasoning_effort: "medium" } : {}),
        ...(target.provider === "anthropic" ? { thinking: "adaptive" } : {}),
        ...(target.provider === "google" ? { thinking_level: "medium", grounding: false } : {}),
      },
    },
  ]));
}

function costEstimate({ tokenCeiling = 1_000_000, costCeilingUsd = 100 } = {}) {
  return {
    benchmark_id: FROZEN_PLAN.benchmark_id,
    plan_version: FROZEN_PLAN.plan_version,
    calibration: {
      requests: 24,
      total_tokens_ceiling: tokenCeiling,
      cost_ceiling_usd: costCeilingUsd,
    },
  };
}

function preflightInputs({
  adapters = adaptersFor(async () => null),
  costEstimatePacket = costEstimate(),
  validateFreezeArtifacts = () => ({ valid: true }),
} = {}) {
  return {
    plan: FROZEN_PLAN,
    prompts: PROMPTS,
    adapters,
    modelResolutions: modelResolutions(),
    costEstimate: costEstimatePacket,
    freezeManifest: {
      benchmark_id: FROZEN_PLAN.benchmark_id,
      plan_version: FROZEN_PLAN.plan_version,
      status: "frozen",
    },
    validateFreezeArtifacts,
    runnerRevision: RUNNER_REVISION,
  };
}

function validatedPreflight(options = {}) {
  return validateLiveCalibrationPreflight(preflightInputs({
    ...options,
    costEstimatePacket: options.costEstimatePacket ?? costEstimate(),
  }));
}

function inFlightIntent(prompt, overrides = {}) {
  return {
    intent_version: "1",
    benchmark_id: FROZEN_PLAN.benchmark_id,
    plan_version: FROZEN_PLAN.plan_version,
    batch_id: "calibration",
    run_id: prompt.run_id,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
    attempt_number: 1,
    started_at: "2026-08-28T00:00:00.000Z",
    runner_revision: RUNNER_REVISION,
    ...overrides,
  };
}

function retainedCheckpoint({
  attemptCount = 0,
  completedRunIds = [],
  intent = null,
  status = "open",
  stopReason = null,
} = {}) {
  return {
    checkpoint_version: "1",
    benchmark_id: FROZEN_PLAN.benchmark_id,
    plan_version: FROZEN_PLAN.plan_version,
    batch_id: "calibration",
    status,
    stop_reason: stopReason,
    attempt_count: attemptCount,
    completed_run_ids: completedRunIds,
    in_flight_attempt: intent,
    runner_revision: RUNNER_REVISION,
    updated_at: "2026-08-28T00:00:00.000Z",
  };
}

function responseAttempt(prompt, overrides = {}) {
  return {
    record_version: "1",
    benchmark_id: FROZEN_PLAN.benchmark_id,
    plan_version: FROZEN_PLAN.plan_version,
    batch_id: "calibration",
    run_id: prompt.run_id,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
    attempt_number: 1,
    started_at: "2026-08-28T00:00:00.000Z",
    ended_at: "2026-08-28T00:00:01.000Z",
    status: "response",
    provider_call: true,
    response: successfulResponse(prompt),
    error: null,
    runner_revision: RUNNER_REVISION,
    ...overrides,
  };
}

function validRun(prompt, overrides = {}) {
  return {
    record_version: "3",
    benchmark_id: FROZEN_PLAN.benchmark_id,
    plan_version: FROZEN_PLAN.plan_version,
    run_id: prompt.run_id,
    batch_id: "calibration",
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
    attempt_count: 1,
    transport_status: "completed",
    format_status: "raw-json",
    contract_status: "valid",
    accuracy_status: "pass",
    uncertainty_status: "none",
    failure_categories: [],
    reasons: [],
    manual_review_required: false,
    implementation_defect: false,
    runner_revision: RUNNER_REVISION,
    ...overrides,
  };
}

function fileMode(file) {
  return fs.statSync(file).mode & 0o777;
}
