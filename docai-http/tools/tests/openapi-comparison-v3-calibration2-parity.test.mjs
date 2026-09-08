import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";
import * as contextRuntime from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/context.mjs";

const { buildParityReport } = contextRuntime;

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const CHECKER = path.join(
  REPOSITORY_ROOT,
  "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-parity.mjs",
);

test("reports parity for all six continuity tasks against the canonical fact inventories", () => {
  const report = buildParityReport();

  assert.equal(report.benchmark_id, readPlan().benchmark_id);
  assert.equal(report.plan_version, "3.0.0-calibration.2");
  assert.equal(report.status, "pass");
  assert.equal(report.summary.tasks, 6);
  assert.equal(report.summary.parity_failures, 0);
  assert.equal(report.failures.length, 0);
  report.tasks.forEach((entry) => {
    assert.deepEqual(entry.enriched_missing, []);
    assert.deepEqual(entry.docai_missing, []);
  });
});

test("the package parity entrypoint prints the successful closed report", () => {
  const result = spawnSync(process.execPath, [CHECKER], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.failures.length, 0);
});

test("rejects aliases, symbols, object classes, and arbitrary YAML tags", () => {
  assert.equal(typeof contextRuntime.parseYamlFile, "function");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "docai-calibration2-yaml-"));
  const fixtures = [
    ["aliases", "value: &value\n  nested: true\ncopy: *value\n"],
    ["symbols", "--- !ruby/symbol unsafe\n"],
    ["objects", "--- !ruby/object:Object {}\n"],
    ["tags", "--- !docai.example/value unsafe\n"],
  ];
  try {
    fixtures.forEach(([name, contents]) => {
      const file = path.join(directory, `${name}.yaml`);
      fs.writeFileSync(file, contents, "utf8");
      assert.throws(() => contextRuntime.parseYamlFile(file), /Unable to parse YAML/);
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("produces byte-identical parity reports across Node and Ruby processes", () => {
  const first = spawnSync(process.execPath, [CHECKER], { cwd: REPOSITORY_ROOT, encoding: "utf8" });
  const second = spawnSync(process.execPath, [CHECKER], { cwd: REPOSITORY_ROOT, encoding: "utf8" });

  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout, first.stdout);
});

test("validates the closed parity options container before reading or executing its transform", () => {
  const { proxy, trapCalls } = countedProxy({});
  assert.throws(() => buildParityReport(proxy), /Proxy/);
  assert.equal(trapCalls(), 0);

  let getterCalls = 0;
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, "transformBuiltContext", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return (context) => context;
    },
  });
  assert.throws(() => buildParityReport(accessorOptions), /own enumerable data/);
  assert.equal(getterCalls, 0);
  assert.throws(() => buildParityReport({ extra: true }), /unknown option extra/);

  let applyCalls = 0;
  const proxyTransform = new Proxy((context) => context, {
    apply(target, thisArgument, argumentsList) {
      applyCalls += 1;
      return Reflect.apply(target, thisArgument, argumentsList);
    },
  });
  assert.throws(() => buildParityReport({ transformBuiltContext: proxyTransform }), /Proxy/);
  assert.equal(applyCalls, 0);

  assert.equal(buildParityReport({ transformBuiltContext: (context) => context }).status, "pass");
});

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
