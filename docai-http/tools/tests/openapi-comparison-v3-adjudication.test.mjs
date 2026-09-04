import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkAdjudicationPacket } from "../check-openapi-comparison-v3-adjudication.mjs";
import {
  adjudicationDirectory,
  buildBlindedAdjudicationPacket,
  validateAdjudicationPacket,
  writeBlindedAdjudicationPacket,
} from "../openapi-comparison-v3-adjudication.mjs";
import { readCalibrationTaskPacket } from "../openapi-comparison-v3-context.mjs";
import { buildCalibrationSchedule, readV3Plan } from "../openapi-comparison-v3-utils.mjs";

const PLAN = readV3Plan();
const SCHEDULE = buildCalibrationSchedule(PLAN);
const TASKS = readCalibrationTaskPacket(PLAN).tasks;
const IDS = [
  "R-00000000000000000000000000000001",
  "R-00000000000000000000000000000002",
  "R-00000000000000000000000000000003",
];

test("builds a one-reviewer packet from a validated canonical ledger", () => {
  const runs = canonicalRuns({ inconclusive: [0] });
  const original = structuredClone(runs[0]);
  const packet = packetFor(runs);

  assert.equal(packet.case_count, 1);
  assert.equal(packet.reviewer.reviewer_count, 1);
  assert.equal(packet.cases[0].review_id, IDS[0]);
  assert.equal(packet.cases[0].automatic_result.accuracy_status, "inconclusive");
  assert.deepEqual(runs[0], original);
  assert.deepEqual(validateAdjudicationPacket(packet, { requireComplete: false }).failures, []);
});

test("default review IDs are cryptographically random rather than schedule-derived", () => {
  const runs = canonicalRuns({ inconclusive: [0] });
  const first = buildBlindedAdjudicationPacket({ runs, tasks: TASKS });
  const second = buildBlindedAdjudicationPacket({ runs, tasks: TASKS });

  assert.match(first.cases[0].review_id, /^R-[A-F0-9]{32}$/);
  assert.match(second.cases[0].review_id, /^R-[A-F0-9]{32}$/);
  assert.notEqual(first.cases[0].review_id, second.cases[0].review_id);
});

test("masks source-derived identities and aliases in copied reviewer evidence without changing runs", () => {
  const runs = canonicalRuns({ inconclusive: [0] });
  const source = runs[0];
  source.resolved_model = "claude-sonnet-4-5-20250929";
  source.content_json = {
    note: "Claude says OpenAI used OpenAPI and DocAI under the openapi-raw condition.",
    model: "GPT and Gemini were also mentioned by the openai-frontier target.",
  };
  source.reasons = [`The run ${source.run_id} and claude-sonnet-4-5-20250929 were copied.`];
  const original = structuredClone(source);

  const packet = packetFor(runs);
  const reviewerText = JSON.stringify(packet).toLowerCase();

  [
    "claude",
    "sonnet",
    "openai",
    "openapi",
    "docai",
    "gpt",
    "gemini",
    "openai-frontier",
    source.run_id.toLowerCase(),
  ].forEach((identity) => assert.equal(reviewerText.includes(identity), false, identity));
  assert.match(reviewerText, /<identity-masked>/);
  assert.deepEqual(source, original);
});

test("requires a complete justified adjudication from exactly one reviewer", () => {
  const packet = packetFor(canonicalRuns({ inconclusive: [0] }));
  const incomplete = validateAdjudicationPacket(packet, { requireComplete: true });
  packet.cases[0].adjudication.decision = "correct";
  packet.cases[0].adjudication.rationale = "The deterministic rubric leaves this assertion ambiguous.";
  const complete = validateAdjudicationPacket(packet, { requireComplete: true });

  assert.match(incomplete.failures.join("\n"), /pending adjudication/);
  assert.deepEqual(complete.failures, []);
  assert.equal(complete.summary.correct, 1);
});

test("checker compares regenerated evidence as a multiset independent of random IDs and order", () => {
  const runs = canonicalRuns({ inconclusive: [0, 1] });
  const packet = packetFor(runs, IDS.slice(0, 2));
  packet.cases.reverse();
  packet.cases[0].review_id = "R-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  packet.cases[1].review_id = "R-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

  const result = checkAdjudicationPacket({ runs, tasks: TASKS, packet, requireComplete: false });

  assert.deepEqual(result.failures, []);
});

test("checker rejects rewritten automatic evidence even behind a hidden toJSON", () => {
  const runs = canonicalRuns({ inconclusive: [0] });
  const packet = packetFor(runs);
  const original = structuredClone(packet.cases[0].automatic_result);
  packet.cases[0].automatic_result.reasons = ["rewritten"];
  Object.defineProperty(packet.cases[0].automatic_result, "toJSON", {
    value: () => original,
  });

  assert.throws(
    () => checkAdjudicationPacket({ runs, tasks: TASKS, packet, requireComplete: false }),
    /finite plain JSON|enumerable data properties/,
  );
});

test("checker rejects source identities and canonical aliases in reviewer decisions", () => {
  const runs = canonicalRuns({ inconclusive: [0] });
  runs[0].resolved_model = "claude-sonnet-4-5-20250929";
  const packet = packetFor(runs);
  packet.cases[0].adjudication.decision = "incorrect";
  packet.cases[0].adjudication.rationale = `Claude from OpenAI produced ${runs[0].run_id} with ${runs[0].resolved_model}.`;

  const result = checkAdjudicationPacket({ runs, tasks: TASKS, packet, requireComplete: true });

  assert.match(result.failures.join("\n"), /blinded identity/);
});

test("checker rejects a source-derived model identity without a canonical provider alias", () => {
  const runs = canonicalRuns({ inconclusive: [0] });
  runs[0].resolved_model = "orion-v9-2026";
  const packet = packetFor(runs);
  packet.cases[0].adjudication.decision = "correct";
  packet.cases[0].adjudication.rationale = "The orion-v9-2026 output is acceptable.";

  const result = checkAdjudicationPacket({ runs, tasks: TASKS, packet, requireComplete: true });

  assert.match(result.failures.join("\n"), /blinded identity/);
});

test("rejects malformed and duplicate source rows before inconclusive filtering", () => {
  const malformed = canonicalRuns();
  malformed[23] = {};

  const duplicatePass = canonicalRuns();
  duplicatePass[23] = structuredClone(duplicatePass[22]);

  const duplicateMixed = canonicalRuns({ inconclusive: [0] });
  duplicateMixed[23] = { ...structuredClone(duplicateMixed[0]), accuracy_status: "pass", manual_review_required: false };

  assert.throws(() => packetFor(malformed), /invalid evaluation record|canonical source ledger/);
  assert.throws(() => packetFor(duplicatePass), /duplicate run identity|canonical source ledger/);
  assert.throws(() => packetFor(duplicateMixed), /duplicate run identity|canonical source ledger/);
});

test("rejects noncanonical or descriptor-tainted task packets before filtering", () => {
  const mutated = structuredClone(TASKS);
  mutated[0].public.user_task = "Changed task";

  const hidden = structuredClone(TASKS);
  Object.defineProperty(hidden.at(-1), "hidden", { value: true });

  const accessor = structuredClone(TASKS);
  Object.defineProperty(accessor[0].public, "user_task", {
    enumerable: true,
    get: () => TASKS[0].public.user_task,
  });

  for (const tasks of [mutated, hidden, accessor]) {
    assert.throws(
      () => buildBlindedAdjudicationPacket({ runs: canonicalRuns(), tasks }, idOptions()),
      /canonical task packet|finite plain JSON|enumerable data properties/,
    );
  }
});

test("rejects hidden, symbol, accessor, and prototype dependency injection objects", () => {
  const probes = [];

  const hidden = {};
  Object.defineProperty(hidden, "hidden", { value: true });
  probes.push(hidden);

  const symbol = {};
  symbol[Symbol("generator")] = () => IDS[0];
  probes.push(symbol);

  const accessor = {};
  Object.defineProperty(accessor, "reviewIdGenerator", {
    enumerable: true,
    get: () => () => IDS[0],
  });
  probes.push(accessor);

  probes.push(Object.create({ reviewIdGenerator: () => IDS[0] }));

  for (const dependencies of probes) {
    assert.throws(
      () => buildBlindedAdjudicationPacket(
        { runs: canonicalRuns(), tasks: TASKS },
        dependencies,
      ),
      /dependencies|enumerable data properties|hidden|symbol|plain object/,
    );
  }
});

test("rejects hidden, symbol, accessor, prototype, and nonfinite packet data", () => {
  const probes = [];

  const hidden = packetFor(canonicalRuns({ inconclusive: [0] }));
  Object.defineProperty(hidden.cases[0], "hidden", { value: true });
  probes.push(hidden);

  const symbol = packetFor(canonicalRuns({ inconclusive: [0] }));
  symbol.cases[0][Symbol("run_identity")] = SCHEDULE[0].run_id;
  probes.push(symbol);

  const accessor = packetFor(canonicalRuns({ inconclusive: [0] }));
  Object.defineProperty(accessor.cases[0], "review_id", {
    enumerable: true,
    get: () => IDS[0],
  });
  probes.push(accessor);

  const prototype = packetFor(canonicalRuns({ inconclusive: [0] }));
  Object.setPrototypeOf(prototype.reviewer, { secondReviewer: true });
  probes.push(prototype);

  const nonfinite = packetFor(canonicalRuns({ inconclusive: [0] }));
  nonfinite.cases[0].model_output.value = Number.NaN;
  probes.push(nonfinite);

  for (const packet of probes) {
    const result = validateAdjudicationPacket(packet, { requireComplete: false });
    assert.match(
      result.failures.join("\n"),
      /finite plain JSON|enumerable data properties|plain objects|symbol keys/,
    );
  }
});

test("writer confines exclusive mode-safe output to a disposable private root", () => {
  const testPrivateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-adjudication-"));
  const packet = packetFor(canonicalRuns({ inconclusive: [0] }));
  try {
    const file = writeBlindedAdjudicationPacket({
      planVersion: PLAN.plan_version,
      packet,
      testPrivateRoot,
    });

    assert.equal(file, path.join(testPrivateRoot, PLAN.plan_version, "review-packet.json"));
    assert.equal(fileMode(testPrivateRoot), 0o700);
    assert.equal(fileMode(path.dirname(file)), 0o700);
    assert.equal(fileMode(file), 0o600);
    assert.throws(
      () => writeBlindedAdjudicationPacket({ planVersion: PLAN.plan_version, packet, testPrivateRoot }),
      /already exists|exclusive/,
    );
  } finally {
    fs.rmSync(testPrivateRoot, { recursive: true, force: true });
  }
});

test("writer rejects unsafe plan segments, arbitrary directories, and symlink traversal", () => {
  const testPrivateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-adjudication-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-adjudication-outside-"));
  const packet = packetFor(canonicalRuns({ inconclusive: [0] }));
  try {
    assert.throws(() => adjudicationDirectory("..", { testPrivateRoot }), /invalid adjudication plan version/);
    assert.throws(
      () => writeBlindedAdjudicationPacket({ directory: outside, packet }),
      /unexpected|planVersion/,
    );

    fs.symlinkSync(outside, path.join(testPrivateRoot, PLAN.plan_version));
    assert.throws(
      () => writeBlindedAdjudicationPacket({ planVersion: PLAN.plan_version, packet, testPrivateRoot }),
      /symlink/,
    );
    assert.equal(fs.existsSync(path.join(outside, "review-packet.json")), false);
  } finally {
    fs.rmSync(testPrivateRoot, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("writer rejects a symlink supplied as the disposable private root", () => {
  const rootLink = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-adjudication-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-adjudication-outside-"));
  const packet = packetFor(canonicalRuns({ inconclusive: [0] }));
  fs.rmSync(rootLink, { recursive: true });
  fs.symlinkSync(outside, rootLink);
  try {
    assert.throws(
      () => writeBlindedAdjudicationPacket({
        planVersion: PLAN.plan_version,
        packet,
        testPrivateRoot: rootLink,
      }),
      /symlink/,
    );
    assert.equal(fs.existsSync(path.join(outside, "review-packet.json")), false);
  } finally {
    fs.unlinkSync(rootLink);
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

function packetFor(runs, ids = [IDS[0]]) {
  return buildBlindedAdjudicationPacket({ runs, tasks: TASKS }, idOptions(ids));
}

function idOptions(ids = [IDS[0]]) {
  let index = 0;
  return {
    reviewIdGenerator() {
      const value = ids[index];
      index += 1;
      return value;
    },
  };
}

function canonicalRuns({ inconclusive = [] } = {}) {
  const inconclusiveSet = new Set(inconclusive);
  return SCHEDULE.map((row, index) => ({
    record_version: "3",
    benchmark_id: PLAN.benchmark_id,
    plan_version: PLAN.plan_version,
    run_id: row.run_id,
    batch_id: row.batch_id,
    api_id: row.api_id,
    task_id: row.task_id,
    target_id: row.target_id,
    provider: row.provider,
    condition: row.condition,
    repetition: row.repetition,
    attempt_count: 1,
    transport_status: "completed",
    format_status: "raw-json",
    contract_status: "valid",
    accuracy_status: inconclusiveSet.has(index) ? "inconclusive" : "pass",
    uncertainty_status: "none",
    failure_categories: inconclusiveSet.has(index) ? ["evaluator-ambiguity"] : [],
    reasons: inconclusiveSet.has(index) ? ["requires evaluator ambiguity review"] : [],
    manual_review_required: inconclusiveSet.has(index),
    implementation_defect: false,
    content_json: { response: `response-${index + 1}` },
    resolved_model: `${row.provider}-resolved-model`,
  }));
}

function fileMode(file) {
  return fs.statSync(file).mode & 0o777;
}
