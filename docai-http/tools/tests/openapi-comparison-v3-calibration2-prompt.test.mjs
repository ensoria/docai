import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readPlan, buildCalibrationSchedule } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";
import {
  buildRequiredOutputText,
  readTaskPacket,
  validateOutputContract,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/contract.mjs";
import { buildTaskContext } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/context.mjs";
import {
  buildCalibrationPrompts,
  buildPromptMetrics,
  buildPromptRecord,
  renderedPromptText,
  validatePromptRecord,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/prompt.mjs";
import {
  assertSafePrivateOutputPath,
  buildCanonicalPromptArtifacts,
  writeCanonicalPromptArtifacts,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/build-prompts.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const PACKAGE_DIR = path.join(
  REPOSITORY_ROOT,
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2",
);
const plan = readPlan();
const packet = readTaskPacket(plan);
const api = { id: plan.calibration.api_id };

test("closes the six-task calibration packet and its two-task subset", () => {
  assert.equal(packet.benchmark_id, plan.benchmark_id);
  assert.equal(packet.api_id, plan.calibration.api_id);
  assert.equal(packet.tasks.length, 6);
  assert.deepEqual(packet.tasks.map((task) => task.id), [
    "create-user-request",
    "upload-document-request",
    "payment-created-response",
    "create-user-errors",
    "complete-checkout-workflow",
    "payment-completed-webhook",
  ]);
  assert.deepEqual(plan.calibration.task_ids, [
    "upload-document-request",
    "complete-checkout-workflow",
  ]);
  packet.tasks.forEach((task) => {
    assert.equal(Object.keys(task.public).sort().join(","), "output_contract,retrieval,user_task");
    assert.equal(Object.hasOwn(task.public, "expected_outcome"), false);
    assert.equal(Object.hasOwn(task.private, "expected_outcome"), true);
  });
});

test("builds every condition context without private task evidence", () => {
  const task = taskById("upload-document-request");
  const contexts = plan.conditions.map((condition) => buildTaskContext({ api, task, condition }));

  assert.deepEqual(contexts.map((context) => context.condition), plan.conditions);
  contexts.forEach((context) => {
    assert.equal(context.api_id, api.id);
    assert.equal(context.task_id, task.id);
    assert.equal(context.content.endsWith("\n"), true);
    assert.equal(context.source_files.length > 0, true);
    assert.equal(JSON.stringify(context).includes("expected_outcome"), false);
    assert.equal(JSON.stringify(context).includes("fact_inventory"), false);
  });
});

test("reproduces the exact canonical 24-record private prompt packet", () => {
  const first = buildCalibrationPrompts({ plan, packet });
  const second = buildCalibrationPrompts({ plan, packet });
  writeCanonicalPromptArtifacts({ plan, packet });
  const promptFile = path.join(PACKAGE_DIR, "private", "prompts", "calibration.jsonl");
  const metricsFile = path.join(PACKAGE_DIR, "private", "contexts", "calibration-metrics.json");
  const firstPromptBytes = fs.readFileSync(promptFile);
  const firstMetricsBytes = fs.readFileSync(metricsFile);
  writeCanonicalPromptArtifacts({ plan, packet });

  assert.equal(first.length, 24);
  assert.equal(new Set(first.map((row) => row.run_id)).size, 24);
  assert.deepEqual(second, first);
  assert.equal(fs.existsSync(promptFile), true);
  assert.deepEqual(readJsonl(promptFile), first);
  assert.deepEqual(fs.readFileSync(promptFile), firstPromptBytes);
  assert.deepEqual(fs.readFileSync(metricsFile), firstMetricsBytes);
  assert.equal(fs.statSync(promptFile).mode & 0o777, 0o600);
  assert.equal(fs.statSync(metricsFile).mode & 0o777, 0o600);
  first.forEach((record) => {
    assert.doesNotThrow(() => validatePromptRecord(record, { plan, packet }));
    assert.equal(record.prompt_sha256, sha256(renderedPromptText(record)));
  });
});

test("rejects Proxy and non-plain API inputs before reading their properties", () => {
  const run = buildCalibrationSchedule(plan)[0];
  const task = taskById(run.task_id);
  const prompts = buildCalibrationPrompts({ plan, packet });
  const inputs = [
    [buildTaskContext, { api, task, condition: run.condition }],
    [buildPromptRecord, { plan, packet, run, api, task }],
    [buildCalibrationPrompts, { plan, packet }],
    [(input) => buildPromptMetrics(prompts, input), { plan, packet }],
    [buildCanonicalPromptArtifacts, { plan, packet }],
    [writeCanonicalPromptArtifacts, { plan, packet }],
  ];

  inputs.forEach(([operation, input]) => {
    const { proxy, trapCalls } = countedProxy(input);
    assert.throws(() => operation(proxy), /Proxy/);
    assert.equal(trapCalls(), 0);

    const nonPlain = Object.assign(Object.create({ inherited: true }), input);
    assert.throws(() => operation(nonPlain), /plain JSON object/);
  });
});

test("rejects proxied prompt records before invoking their traps", () => {
  const prompts = buildCalibrationPrompts({ plan, packet });
  const inputs = [
    [(value) => validatePromptRecord(value, { plan, packet }), prompts[0]],
    [(value) => buildPromptMetrics(value, { plan, packet }), prompts],
  ];

  inputs.forEach(([operation, input]) => {
    const { proxy, trapCalls } = countedProxy(input);
    assert.throws(() => operation(proxy), /Proxy/);
    assert.equal(trapCalls(), 0);
  });
});

test("rejects non-plain output values before contract traversal", () => {
  const { proxy, trapCalls } = countedProxy({});
  assert.throws(() => validateOutputContract(proxy, "request-construction.v3"), /Proxy/);
  assert.equal(trapCalls(), 0);

  let getterCalls = 0;
  const accessorValue = {};
  Object.defineProperty(accessorValue, "request", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  assert.throws(() => validateOutputContract(accessorValue, "request-construction.v3"), /plain JSON/);
  assert.equal(getterCalls, 0);
  assert.throws(
    () => validateOutputContract(Object.create({ inherited: true }), "request-construction.v3"),
    /plain JSON object/,
  );
});

test("rejects non-primitive or empty contract IDs before coercion", () => {
  const operations = [
    (contractId) => validateOutputContract({}, contractId),
    (contractId) => buildRequiredOutputText(contractId),
  ];

  operations.forEach((operation) => {
    const { proxy, trapCalls } = countedProxy({});
    assert.throws(() => operation(proxy), /contractId must be a non-empty primitive string/);
    assert.equal(trapCalls(), 0);

    ["", "   ", new String("request-construction.v3"), null, 1].forEach((contractId) => {
      assert.throws(() => operation(contractId), /contractId must be a non-empty primitive string/);
    });
  });
});

test("confines private outputs and rejects symlinked private paths", () => {
  assert.throws(
    () => assertSafePrivateOutputPath(path.join(PACKAGE_DIR, "escaped", "calibration.jsonl")),
    /unsafe private path/,
  );

  const copy = path.join(path.dirname(PACKAGE_DIR), `.calibration2-symlink-test-${process.pid}-${Date.now()}`);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "docai-calibration2-private-"));
  try {
    fs.cpSync(PACKAGE_DIR, copy, { recursive: true });
    const copiedPrompts = path.join(copy, "private", "prompts");
    fs.rmSync(copiedPrompts, { recursive: true, force: true });
    fs.symlinkSync(outside, copiedPrompts, "dir");

    const result = spawnSync(process.execPath, [path.join(copy, "runtime", "build-prompts.mjs")], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlinks are not allowed/);
    assert.equal(fs.existsSync(path.join(outside, "calibration.jsonl")), false);
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("rejects group or other writable private ancestry", () => {
  const copy = copiedPackage("writable-ancestor");
  try {
    fs.chmodSync(copy, 0o777);
    const result = runCopiedGenerator(copy);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /group or other writable ancestor/);
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

test("enforces owner-only private directories owned by the current user", () => {
  const copy = copiedPackage("private-permissions");
  const privateRoot = path.join(copy, "private");
  const promptsDirectory = path.join(privateRoot, "prompts");
  const contextsDirectory = path.join(privateRoot, "contexts");
  try {
    fs.chmodSync(privateRoot, 0o755);
    fs.chmodSync(promptsDirectory, 0o755);
    fs.chmodSync(contextsDirectory, 0o750);

    const result = runCopiedGenerator(copy);

    assert.equal(result.status, 0, result.stderr);
    [privateRoot, promptsDirectory, contextsDirectory].forEach((directory) => {
      const stat = fs.statSync(directory);
      assert.equal(stat.mode & 0o777, 0o700);
      if (typeof process.getuid === "function") assert.equal(stat.uid, process.getuid());
    });
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

test("never leaks expected answers or private assertions into public prompt text", () => {
  const records = buildCalibrationPrompts({ plan, packet });
  const serialized = JSON.stringify(records);

  assert.equal(serialized.includes("expected_outcome"), false);
  assert.equal(serialized.includes("fact_inventory"), false);
  assert.equal(serialized.includes("checkout:order-recovery"), false);
  records.forEach((record) => {
    assert.equal(recordedText(record).includes("expected_outcome"), false);
    assert.equal(recordedText(record).includes("assertions"), false);
  });
});

test("rejects records whose run, task, context, or private keys drift from the canonical packet", () => {
  const run = buildCalibrationSchedule(plan)[0];
  const task = taskById(run.task_id);
  const record = buildPromptRecord({ plan, packet, run, api, task });

  assert.throws(
    () => buildPromptRecord({ plan, packet, run: { ...run, provider: "other" }, api, task }),
    /run identity/,
  );
  const privateKey = structuredClone(record);
  privateKey.context.nested = { expected_outcome: "leak" };
  assert.throws(() => validatePromptRecord(privateKey, { plan, packet }), /private key expected_outcome/);
});

test("derives deterministic metrics for all canonical private prompts", () => {
  const prompts = buildCalibrationPrompts({ plan, packet });
  const first = buildPromptMetrics(prompts, { plan, packet });
  const second = buildPromptMetrics(prompts, { plan, packet });

  assert.deepEqual(second, first);
  assert.equal(first.rows.length, 24);
  first.rows.forEach((row) => {
    assert.equal(row.context_utf8_bytes > 0, true);
    assert.equal(row.prompt_utf8_bytes > row.context_utf8_bytes, true);
    assert.match(row.prompt_sha256, /^[a-f0-9]{64}$/);
  });
});

function taskById(taskId) {
  const task = packet.tasks.find((candidate) => candidate.id === taskId);
  assert.ok(task, `expected task ${taskId}`);
  return task;
}

function recordedText(record) {
  return [record.prompt.system, record.prompt.documentation, record.prompt.task, record.prompt.required_output].join("\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function countedProxy(target) {
  let trapCalls = 0;
  const proxy = new Proxy(target, {
    get(target_, property, receiver) {
      trapCalls += 1;
      return Reflect.get(target_, property, receiver);
    },
    getPrototypeOf(target_) {
      trapCalls += 1;
      return Reflect.getPrototypeOf(target_);
    },
    ownKeys(target_) {
      trapCalls += 1;
      return Reflect.ownKeys(target_);
    },
    getOwnPropertyDescriptor(target_, property) {
      trapCalls += 1;
      return Reflect.getOwnPropertyDescriptor(target_, property);
    },
  });
  return { proxy, trapCalls: () => trapCalls };
}

function copiedPackage(label) {
  const copy = path.join(path.dirname(PACKAGE_DIR), `.calibration2-${label}-${process.pid}-${Date.now()}`);
  fs.cpSync(PACKAGE_DIR, copy, { recursive: true });
  return copy;
}

function runCopiedGenerator(copy) {
  return spawnSync(process.execPath, [path.join(copy, "runtime", "build-prompts.mjs")], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });
}

function readJsonl(file) {
  return fs.readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
}
