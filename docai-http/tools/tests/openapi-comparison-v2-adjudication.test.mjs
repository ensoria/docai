import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildAdjudicationArtifacts,
  checkAdjudicationArtifacts,
  writeAdjudicationArtifacts,
} from "../openapi-comparison-v2-adjudication.mjs";

test("builds a deterministic single-reviewer packet from inconclusive runs only", () => {
  const input = fixtureInput();
  const artifacts = buildAdjudicationArtifacts(input);
  const reversed = buildAdjudicationArtifacts({
    ...input,
    runs: [...input.runs].reverse(),
    attempts: [...input.attempts].reverse(),
  });

  assert.equal(artifacts.packet.case_count, 2);
  assert.equal(Object.hasOwn(artifacts.packet, "benchmark_id"), false);
  assert.deepEqual(artifacts.packet, reversed.packet);
  assert.deepEqual(artifacts.decisions, reversed.decisions);
  assert.equal(artifacts.decisions.every((row) => row.decision === "pending"), true);
  assert.equal(artifacts.mapping.entries.length, 2);
  assert.equal(artifacts.sheet.includes("Decision records are edited in `decisions.jsonl`."), true);
});

test("reviewer artifacts redact documentation conditions, providers, models, and run identities", () => {
  const artifacts = buildAdjudicationArtifacts(fixtureInput());
  const reviewerText = JSON.stringify(artifacts.packet) + artifacts.sheet;

  [
    "run-openai-docai",
    "run-google-raw",
    "docai-selected",
    "openapi-raw",
    "OpenAPI",
    "DocAI",
    "openai",
    "google",
    "gpt-test",
    "gemini-test",
  ].forEach((forbidden) => assert.equal(reviewerText.includes(forbidden), false, forbidden));
  assert.equal(reviewerText.includes("<documentation-format-redacted>"), true);
  assert.equal(reviewerText.includes("<provider-redacted>"), true);
});

test("checker requires one complete justified decision per review id", () => {
  const artifacts = buildAdjudicationArtifacts(fixtureInput());
  const pending = checkAdjudicationArtifacts({ ...artifacts, requireComplete: false });
  const incomplete = checkAdjudicationArtifacts({ ...artifacts, requireComplete: true });
  const completeDecisions = artifacts.decisions.map((row, index) => ({
    ...row,
    decision: index === 0 ? "correct" : "incorrect",
    rationale: index === 0 ? "Semantically equivalent to the expected contract." : "Required behavior is missing.",
  }));
  const complete = checkAdjudicationArtifacts({
    ...artifacts,
    decisions: completeDecisions,
    requireComplete: true,
  });

  assert.deepEqual(pending.failures, []);
  assert.match(incomplete.failures.join("\n"), /pending decision/);
  assert.deepEqual(complete.failures, []);
  assert.equal(complete.summary.correct, 1);
  assert.equal(complete.summary.incorrect, 1);
});

test("checker detects packet modification and invalid decision values", () => {
  const artifacts = buildAdjudicationArtifacts(fixtureInput());
  const modifiedPacket = structuredClone(artifacts.packet);
  modifiedPacket.cases[0].model_output = { changed: true };
  const decisions = structuredClone(artifacts.decisions);
  decisions[0].decision = "pass";

  const result = checkAdjudicationArtifacts({
    expected: artifacts,
    packet: modifiedPacket,
    mapping: artifacts.mapping,
    decisions,
    sheet: artifacts.sheet,
    requireComplete: false,
  });

  assert.match(result.failures.join("\n"), /review packet does not match/);
  assert.match(result.failures.join("\n"), /invalid decision/);
});

test("writer preserves an existing decision file", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "docai-adjudication-"));
  const artifacts = buildAdjudicationArtifacts(fixtureInput());
  try {
    writeAdjudicationArtifacts({ directory, artifacts });
    const decisionsFile = path.join(directory, "decisions.jsonl");
    const retained = `${JSON.stringify({
      ...artifacts.decisions[0],
      decision: "correct",
      rationale: "Reviewed.",
    })}\n`;
    fs.writeFileSync(decisionsFile, retained);

    const result = writeAdjudicationArtifacts({ directory, artifacts });

    assert.equal(result.decisions_created, false);
    assert.equal(fs.readFileSync(decisionsFile, "utf8"), retained);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function fixtureInput() {
  const plan = {
    benchmark_id: "docai-http-openapi-comparison-v2-test",
    plan_version: "2.0.0-frozen.test",
    analysis: { manual_adjudication: "blinded-inconclusive-only" },
    conditions: ["openapi-raw", "docai-selected"],
    targets: [
      { id: "openai-frontier", provider: "openai", planned_model: "gpt-test" },
      { id: "google-agentic", provider: "google", planned_model: "gemini-test" },
    ],
  };
  const prompts = [
    prompt("run-openai-docai", "docai-selected", "openai-frontier"),
    prompt("run-google-raw", "openapi-raw", "google-agentic"),
    prompt("run-pass", "openapi-raw", "openai-frontier"),
  ];
  const runs = [
    run("run-openai-docai", "inconclusive"),
    run("run-google-raw", "inconclusive"),
    run("run-pass", "pass"),
  ];
  const attempts = [
    attempt("run-openai-docai", {
      answer: "The DocAI documentation leaves this unclear for OpenAI.",
      "x-docai-currency": "JPY",
      uncertainties: ["DocAI source uncertainty."],
    }),
    attempt("run-google-raw", {
      answer: "The OpenAPI input leaves this unclear for Google.",
      uncertainties: ["OpenAPI source uncertainty."],
    }),
    attempt("run-pass", { answer: "ok", uncertainties: [] }),
  ];
  const task = {
    id: "task-one",
    public: {
      user_task: "Construct the required client behavior.",
      output_contract: "contract.v1",
    },
    private: {
      assertions: [{
        path: "/answer",
        operator: "equals",
        value: "expected",
        failure_category: "answer",
      }],
    },
  };
  return {
    plan,
    batchId: "b01",
    prompts,
    runs,
    attempts,
    taskForPrompt: () => task,
  };
}

function prompt(runId, condition, targetId) {
  return {
    run_id: runId,
    batch_id: "b01",
    api_id: "api-one",
    task_id: "task-one",
    condition,
    target_id: targetId,
  };
}

function run(runId, status) {
  return {
    run_id: runId,
    batch_id: "b01",
    api_id: "api-one",
    task_id: "task-one",
    status,
    reasons: status === "inconclusive" ? ["/answer must equal expected"] : [],
    failure_categories: status === "inconclusive" ? ["answer"] : [],
    manual_review_required: status === "inconclusive",
  };
}

function attempt(runId, contentJson) {
  return {
    run_id: runId,
    batch_id: "b01",
    status: "response",
    response: { content_json: contentJson },
  };
}
