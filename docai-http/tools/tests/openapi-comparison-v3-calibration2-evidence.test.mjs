import assert from "node:assert/strict";
import test from "node:test";

import { readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";
import { readTaskPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/contract.mjs";
import {
  evaluateAssertion,
  gradeParsedResponse,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/grader.mjs";
import { parseProviderText } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/parser.mjs";
import { buildCalibrationPrompts } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/prompt.mjs";
import {
  isExceptionalRun,
  validateEvaluationRecord,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/record.mjs";
import {
  deriveCanonicalRun,
  reconcileCalibrationEvidence,
  requireVerifiedEvidence,
  verifyCalibrationEvidence,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/evidence-verifier.mjs";

const RUNNER_REVISION = "sha256:calibration2-test";
const plan = readPlan();
const packet = readTaskPacket(plan);
const prompts = buildCalibrationPrompts({ plan, packet });
const tasks = packet.tasks.filter((task) => plan.calibration.task_ids.includes(task.id));

test("rejects fabricated all-pass claims without a provider call", () => {
  let providerCalls = 0;
  const fabricatedAllPass = syntheticLedger({ fabricateRuns: true });

  const result = verifyCalibrationEvidence(fabricatedAllPass);

  assert.equal(result.evidence, null);
  assert.match(result.failures.join("\n"), /derived run mismatch/);
  assert.equal(providerCalls, 0);
});

test("rejects a retained payload mismatch behind a claimed-pass run", () => {
  const ledger = syntheticLedger();
  ledger.attempts[0].response.content_text = JSON.stringify({ uncertainties: [] });

  const result = verifyCalibrationEvidence(ledger);

  assert.equal(result.evidence, null);
  assert.match(result.failures.join("\n"), /derived run mismatch/);
});

test("verifies an entire canonical 24-run ledger and mints immutable evidence", () => {
  const result = verifyCalibrationEvidence(syntheticLedger({ fabricateRuns: false }));

  assert.deepEqual(result.failures, []);
  assert.equal(result.evidence.runs.length, 24);
  assert.strictEqual(requireVerifiedEvidence(result.evidence), result.evidence);
  assert.equal(Object.isFrozen(result.evidence), true);
  assert.equal(Object.isFrozen(result.evidence.runs), true);
});

test("rejects every independently tampered derived record field group", async (t) => {
  const mutations = {
    transport_status: "blocked",
    format_status: "fenced-json",
    contract_status: "invalid",
    accuracy_status: "fail",
    uncertainty_status: "reported-gap",
    failure_categories: ["tampered"],
    reasons: ["tampered"],
    manual_review_required: true,
    implementation_defect: true,
    content_text: "tampered",
    content_json: { tampered: true },
    raw_response: { tampered: true },
    parse_error: { code: "tampered", message: "tampered" },
    usage: { input_tokens: 11, output_tokens: 20, total_tokens: 31 },
    resolved_model: "tampered-model",
    provider_request_id: "tampered-request",
    stop_reason: "tampered-stop",
    started_at: "2026-09-08T00:00:02.000Z",
    ended_at: "2026-09-08T00:00:03.000Z",
    attempt_count: 2,
    runner_revision: "sha256:tampered",
  };

  for (const [field, value] of Object.entries(mutations)) {
    await t.test(field, () => {
      const ledger = syntheticLedger({ fabricateRuns: false });
      ledger.runs[0][field] = value;
      const result = verifyCalibrationEvidence(ledger);
      assert.equal(result.evidence, null);
      assert.notEqual(result.failures.length, 0);
    });
  }
});

test("derives complete deterministic records for every terminal path", async (t) => {
  const prompt = prompts[0];
  const task = taskFor(prompt);
  const invalidResponse = responseAttempt(prompt);
  invalidResponse.response.content_text = "not JSON";
  const incompleteResponse = responseAttempt(prompt);
  incompleteResponse.response.content_text = '{"partial":';
  incompleteResponse.response.completion = {
    complete: false,
    category: "incomplete",
    provider_status: "incomplete",
    stop_reason: "max_tokens",
  };
  const providerError = terminalAttempt(prompt, "provider-error", {
    name: "ProviderResponseError",
    message: "provider rejected",
    http_status: 429,
    category: "rate_limit",
    response_body: { error: "x" },
    provider_request_id: "provider-id",
    stop_reason: "rate_limit",
    retryable: false,
    usable_response: true,
  });
  const transportError = terminalAttempt(
    prompt,
    "transport-error",
    {
      name: "ProviderTransportError",
      message: "transport failed",
      category: "transport_error",
      retryable: true,
      usable_response: false,
    },
    {
      attempt_number: 2,
      started_at: "2026-09-08T00:00:02.000Z",
      ended_at: "2026-09-08T00:00:03.000Z",
    },
  );
  const transportRetryPrecursor = terminalAttempt(prompt, "transport-error", {
    name: "ProviderTransportError",
    message: "first transport failure",
    category: "transport_error",
    retryable: true,
    usable_response: false,
  });
  const implementationDefect = terminalAttempt(prompt, "implementation-defect", {
    name: "Error",
    message: "grader failed",
  });
  const cases = [
    ["response", [invalidResponse], {
      ...expectedIdentity(prompt, 1),
      transport_status: "completed",
      format_status: "invalid-json",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
      failure_categories: ["output-format"],
      reasons: ["Provider response must be one JSON object or one json fence."],
      manual_review_required: false,
      implementation_defect: false,
      content_text: "not JSON",
      content_json: null,
      raw_response: { id: `response-${prompt.calibration_ordinal}` },
      parse_error: {
        code: "invalid-json",
        message: "Provider response must be one JSON object or one json fence.",
      },
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      resolved_model: `${prompt.target.id}-model`,
      provider_request_id: `request-${prompt.calibration_ordinal}`,
      stop_reason: "end_turn",
      started_at: "2026-09-08T00:00:00.000Z",
      ended_at: "2026-09-08T00:00:01.000Z",
    }],
    ["incomplete", [incompleteResponse], {
      ...expectedIdentity(prompt, 1),
      transport_status: "incomplete",
      format_status: "incomplete",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
      failure_categories: ["output-format"],
      reasons: ["Provider response is incomplete; partial text was not parsed."],
      manual_review_required: false,
      implementation_defect: false,
      content_text: '{"partial":',
      content_json: null,
      raw_response: { id: `response-${prompt.calibration_ordinal}` },
      parse_error: {
        code: "incomplete",
        message: "Provider response is incomplete; partial text was not parsed.",
      },
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      resolved_model: `${prompt.target.id}-model`,
      provider_request_id: `request-${prompt.calibration_ordinal}`,
      stop_reason: "max_tokens",
      started_at: "2026-09-08T00:00:00.000Z",
      ended_at: "2026-09-08T00:00:01.000Z",
    }],
    ["provider-error", [providerError], {
      ...expectedIdentity(prompt, 1),
      ...notEvaluatedFailure({
        transportStatus: "provider-error",
        failureCategories: ["rate_limit"],
        reasons: ["provider rejected"],
        rawResponse: { error: "x" },
        providerRequestId: "provider-id",
        stopReason: "rate_limit",
      }),
    }],
    ["transport-error", [transportRetryPrecursor, transportError], {
      ...expectedIdentity(prompt, 2),
      ...notEvaluatedFailure({
        transportStatus: "transport-error",
        failureCategories: ["transport-error"],
        reasons: ["transport failed"],
      }),
      ended_at: "2026-09-08T00:00:03.000Z",
    }],
    ["implementation-defect", [implementationDefect], {
      ...expectedIdentity(prompt, 1),
      ...notEvaluatedFailure({
        transportStatus: "blocked",
        failureCategories: ["implementation-defect"],
        reasons: ["grader failed"],
        stopReason: "implementation-defect",
        implementationDefect: true,
      }),
    }],
  ];

  for (const [name, attempts, expected] of cases) {
    await t.test(name, () => {
      const first = deriveCanonicalRun({ plan, prompt, task, attempts, runnerRevision: RUNNER_REVISION });
      const second = deriveCanonicalRun({ plan, prompt, task, attempts, runnerRevision: RUNNER_REVISION });
      assert.deepEqual(first, expected);
      assert.deepEqual(second, expected);
    });
  }
});

test("derives calibration.1 terminal-error chronology from the complete retry sequence", async (t) => {
  const prompt = prompts[0];
  const task = taskFor(prompt);
  const firstAttempt = {
    ...responseAttempt(prompt),
    started_at: "2026-09-08T00:00:00.000Z",
    ended_at: "2026-09-08T00:00:01.000Z",
    status: "transport-error",
    response: null,
    error: {
      name: "ProviderTransportError",
      message: "first transport failure",
      category: "transport_error",
      retryable: true,
      usable_response: false,
    },
  };

  await t.test("provider-error uses T0 instead of terminal T2", () => {
    const terminalAttempt = {
      ...responseAttempt(prompt),
      attempt_number: 2,
      started_at: "2026-09-08T00:00:02.000Z",
      ended_at: "2026-09-08T00:00:03.000Z",
      status: "provider-error",
      response: null,
      error: {
        name: "ProviderResponseError",
        message: "provider rejected retry",
        http_status: 429,
        category: "rate_limit",
        stop_reason: "rate_limit",
        provider_request_id: "provider-retry-id",
        response_body: { error: "rate limited" },
        retryable: false,
        usable_response: true,
      },
    };

    const expected = {
        ...expectedIdentity(prompt, 2),
        transport_status: "provider-error",
        format_status: "empty",
        contract_status: "not-evaluated",
        accuracy_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
        failure_categories: ["rate_limit"],
        reasons: ["provider rejected retry"],
        manual_review_required: false,
        implementation_defect: false,
        content_text: null,
        content_json: null,
        raw_response: { error: "rate limited" },
        parse_error: null,
        usage: null,
        resolved_model: null,
        provider_request_id: "provider-retry-id",
        stop_reason: "rate_limit",
        started_at: "2026-09-08T00:00:00.000Z",
        ended_at: "2026-09-08T00:00:03.000Z",
    };
    assert.deepEqual(
      deriveCanonicalRun({
        plan,
        prompt,
        task,
        attempts: [firstAttempt, terminalAttempt],
        runnerRevision: RUNNER_REVISION,
      }),
      expected,
    );
    const ledger = syntheticLedger({ fabricateRuns: false });
    ledger.attempts.splice(0, 1, firstAttempt, terminalAttempt);
    ledger.runs[0] = expected;
    ledger.checkpoint.attempt_count = ledger.attempts.length;
    assert.deepEqual(verifyCalibrationEvidence(ledger).failures, []);
  });

  await t.test("terminal transport-error uses T0 instead of terminal T2", () => {
    const terminalAttempt = {
      ...responseAttempt(prompt),
      attempt_number: 2,
      started_at: "2026-09-08T00:00:02.000Z",
      ended_at: "2026-09-08T00:00:03.000Z",
      status: "transport-error",
      response: null,
      error: {
        name: "ProviderTransportError",
        message: "second transport failure",
        category: "transport_error",
        retryable: true,
        usable_response: false,
      },
    };

    const expected = {
        ...expectedIdentity(prompt, 2),
        transport_status: "transport-error",
        format_status: "empty",
        contract_status: "not-evaluated",
        accuracy_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
        failure_categories: ["transport-error"],
        reasons: ["second transport failure"],
        manual_review_required: false,
        implementation_defect: false,
        content_text: null,
        content_json: null,
        raw_response: null,
        parse_error: null,
        usage: null,
        resolved_model: null,
        provider_request_id: null,
        stop_reason: null,
        started_at: "2026-09-08T00:00:00.000Z",
        ended_at: "2026-09-08T00:00:03.000Z",
    };
    assert.deepEqual(
      deriveCanonicalRun({
        plan,
        prompt,
        task,
        attempts: [firstAttempt, terminalAttempt],
        runnerRevision: RUNNER_REVISION,
      }),
      expected,
    );
    const ledger = syntheticLedger({ fabricateRuns: false });
    ledger.attempts.splice(0, 1, firstAttempt, terminalAttempt);
    ledger.runs[0] = expected;
    ledger.checkpoint.attempt_count = ledger.attempts.length;
    assert.deepEqual(verifyCalibrationEvidence(ledger).failures, []);
  });

  await t.test("implementation-defect uses T0 instead of terminal T2", () => {
    const terminalAttempt = {
      ...responseAttempt(prompt),
      attempt_number: 2,
      started_at: "2026-09-08T00:00:02.000Z",
      ended_at: "2026-09-08T00:00:03.000Z",
      status: "implementation-defect",
      provider_call: false,
      response: null,
      error: {
        name: "Error",
        message: "runner failed after retry",
      },
    };

    const expected = {
        ...expectedIdentity(prompt, 2),
        transport_status: "blocked",
        format_status: "empty",
        contract_status: "not-evaluated",
        accuracy_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
        failure_categories: ["implementation-defect"],
        reasons: ["runner failed after retry"],
        manual_review_required: false,
        implementation_defect: true,
        content_text: null,
        content_json: null,
        raw_response: null,
        parse_error: null,
        usage: null,
        resolved_model: null,
        provider_request_id: null,
        stop_reason: "implementation-defect",
        started_at: "2026-09-08T00:00:00.000Z",
        ended_at: "2026-09-08T00:00:03.000Z",
    };
    assert.deepEqual(
      deriveCanonicalRun({
        plan,
        prompt,
        task,
        attempts: [firstAttempt, terminalAttempt],
        runnerRevision: RUNNER_REVISION,
      }),
      expected,
    );
    const ledger = syntheticLedger({ fabricateRuns: false });
    ledger.attempts.splice(0, 1, firstAttempt, terminalAttempt);
    ledger.runs[0] = expected;
    ledger.checkpoint.attempt_count = ledger.attempts.length;
    assert.deepEqual(verifyCalibrationEvidence(ledger).failures, []);
  });
});

test("canonical derivation rejects every terminal-attempt identity drift", async (t) => {
  const prompt = prompts[0];
  const task = taskFor(prompt);
  const mutations = {
    benchmark_id: "wrong-benchmark",
    plan_version: "wrong-plan",
    batch_id: "wrong-batch",
    run_id: "wrong-run",
    api_id: "wrong-api",
    task_id: "wrong-task",
    target_id: "wrong-target",
    provider: "wrong-provider",
    condition: "wrong-condition",
    repetition: 2,
  };

  for (const [field, value] of Object.entries(mutations)) {
    await t.test(field, () => {
      const attempt = responseAttempt(prompt);
      attempt[field] = value;
      assert.throws(
        () => deriveCanonicalRun({ plan, prompt, task, attempts: [attempt], runnerRevision: RUNNER_REVISION }),
        new RegExp(`canonical attempt 1 ${field}`),
      );
    });
  }
});

test("canonical derivation rejects nonterminal or over-limit attempt numbers", () => {
  const prompt = prompts[0];
  const task = taskFor(prompt);
  const firstTransportError = terminalAttempt(prompt, "transport-error", {
    name: "ProviderTransportError",
    message: "retryable",
    category: "transport_error",
    retryable: true,
    usable_response: false,
  });
  const thirdAttempt = { ...responseAttempt(prompt), attempt_number: 3 };

  assert.throws(
    () => deriveCanonicalRun({ plan, prompt, task, attempts: [firstTransportError], runnerRevision: RUNNER_REVISION }),
    /do not contain a terminal attempt/,
  );
  assert.throws(
    () => deriveCanonicalRun({ plan, prompt, task, attempts: [thirdAttempt], runnerRevision: RUNNER_REVISION }),
    /attempt_number must be 1 or 2/,
  );
});

test("rejects literal retained errors outside their calibration.1 status shape", async (t) => {
  const prompt = prompts[0];
  const task = taskFor(prompt);
  const cases = [
    ["provider-error missing name", "provider-error", {
      message: "provider rejected",
      http_status: 500,
      category: "provider_error",
      stop_reason: null,
      provider_request_id: null,
      response_body: null,
      retryable: false,
      usable_response: true,
    }],
    ["provider-error missing required audit field", "provider-error", {
      name: "ProviderResponseError",
      message: "provider rejected",
      http_status: 500,
      category: "provider_error",
      stop_reason: null,
      provider_request_id: null,
      retryable: false,
      usable_response: true,
    }],
    ["provider-error with transport identity", "provider-error", {
      name: "ProviderTransportError",
      message: "wrong category",
      http_status: null,
      category: "transport_error",
      stop_reason: null,
      provider_request_id: null,
      response_body: null,
      retryable: true,
      usable_response: false,
    }],
    ["provider-error with impossible retry flags", "provider-error", {
      name: "ProviderResponseError",
      message: "wrong flags",
      http_status: 503,
      category: "model_unavailable",
      stop_reason: "model_unavailable",
      provider_request_id: "request-id",
      response_body: { error: "unavailable" },
      retryable: true,
      usable_response: false,
    }],
    ["provider-error with extra field", "provider-error", {
      name: "ProviderResponseError",
      message: "provider rejected",
      http_status: 500,
      category: "provider_error",
      stop_reason: null,
      provider_request_id: null,
      response_body: null,
      retryable: false,
      usable_response: true,
      cause: "fabricated",
    }],
    ["transport-error missing name", "transport-error", {
      message: "network failed",
      category: "transport_error",
      retryable: true,
      usable_response: false,
    }],
    ["transport-error with provider identity", "transport-error", {
      name: "ProviderResponseError",
      message: "wrong class",
      category: "transport_error",
      retryable: true,
      usable_response: false,
    }],
    ["transport-error with impossible retry flags", "transport-error", {
      name: "ProviderTransportError",
      message: "wrong flags",
      category: "transport_error",
      retryable: false,
      usable_response: true,
    }],
    ["transport-error with provider-only field", "transport-error", {
      name: "ProviderTransportError",
      message: "cross-category field",
      category: "transport_error",
      retryable: true,
      usable_response: false,
      http_status: 503,
    }],
    ["implementation-defect missing name", "implementation-defect", {
      message: "runner failed",
    }],
    ["implementation-defect with provider name", "implementation-defect", {
      name: "ProviderResponseError",
      message: "misclassified provider failure",
    }],
    ["implementation-defect with transport field", "implementation-defect", {
      name: "TypeError",
      message: "runner failed",
      retryable: false,
    }],
  ];

  for (const [name, status, error] of cases) {
    await t.test(name, () => {
      const attempt = {
        ...responseAttempt(prompt),
        status,
        response: null,
        error,
      };
      if (status === "transport-error") {
        attempt.attempt_number = 2;
        attempt.started_at = "2026-09-08T00:00:02.000Z";
        attempt.ended_at = "2026-09-08T00:00:03.000Z";
      }
      assert.throws(
        () => deriveCanonicalRun({
          plan,
          prompt,
          task,
          attempts: status === "transport-error"
            ? [{
              ...responseAttempt(prompt),
              status: "transport-error",
              response: null,
              error: {
                name: "ProviderTransportError",
                message: "first network failure",
                category: "transport_error",
                retryable: true,
                usable_response: false,
              },
            }, attempt]
            : [attempt],
          runnerRevision: RUNNER_REVISION,
        }),
        /error/,
      );
    });
  }
});

test("full-ledger verification rejects impossible literal provider-error records before derivation", async (t) => {
  const cases = [
    ["message-only error", {
      message: "provider rejected",
    }],
    ["transport metadata under provider-error status", {
      name: "ProviderTransportError",
      message: "transport-shaped provider error",
      category: "transport_error",
      retryable: true,
      usable_response: false,
    }],
  ];

  for (const [name, error] of cases) {
    await t.test(name, () => {
      const ledger = syntheticLedger({ fabricateRuns: false });
      const prompt = ledger.prompts[0];
      ledger.attempts[0] = {
        ...responseAttempt(prompt),
        status: "provider-error",
        response: null,
        error,
      };
      ledger.runs[0] = {
        ...expectedIdentity(prompt, 1),
        transport_status: "provider-error",
        format_status: "empty",
        contract_status: "not-evaluated",
        accuracy_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
        failure_categories: [error.category ?? "provider-error"],
        reasons: [error.message],
        manual_review_required: false,
        implementation_defect: false,
        content_text: null,
        content_json: null,
        raw_response: null,
        parse_error: null,
        usage: null,
        resolved_model: null,
        provider_request_id: null,
        stop_reason: null,
        started_at: "2026-09-08T00:00:00.000Z",
        ended_at: "2026-09-08T00:00:01.000Z",
      };

      const result = verifyCalibrationEvidence(ledger);
      assert.equal(result.evidence, null);
      assert.match(result.failures.join("\n"), /attempt 1 is invalid:.*error/);
    });
  }
});

test("verifies complete ledgers for every valid terminal path and retry sequence", async (t) => {
  const prompt = prompts[0];
  const cases = [
    ["response", [responseAttempt(prompt)]],
    ["incomplete", [{
      ...responseAttempt(prompt),
      response: {
        ...responseAttempt(prompt).response,
        completion: {
          complete: false,
          category: "incomplete",
          provider_status: "incomplete",
          stop_reason: "max_tokens",
        },
      },
    }]],
    ["provider-error", [terminalAttempt(prompt, "provider-error", {
      name: "ProviderResponseError",
      message: "provider rejected",
      http_status: null,
      category: "provider_error",
      stop_reason: null,
      provider_request_id: null,
      response_body: null,
      retryable: false,
      usable_response: true,
    })]],
    ["transport-error retry", [
      terminalAttempt(prompt, "transport-error", {
        name: "ProviderTransportError",
        message: "first transport failure",
        category: "transport_error",
        retryable: true,
        usable_response: false,
      }),
      terminalAttempt(prompt, "transport-error", {
        name: "ProviderTransportError",
        message: "second transport failure",
        category: "transport_error",
        retryable: true,
        usable_response: false,
      }, {
        attempt_number: 2,
        started_at: "2026-09-08T00:00:02.000Z",
        ended_at: "2026-09-08T00:00:03.000Z",
      }),
    ]],
    ["implementation-defect", [terminalAttempt(prompt, "implementation-defect", {
      name: "Error",
      message: "runner defect",
    })]],
  ];

  for (const [name, runAttempts] of cases) {
    await t.test(name, () => {
      const ledger = ledgerWithFirstRunAttempts(runAttempts);
      const result = verifyCalibrationEvidence(ledger);
      assert.deepEqual(result.failures, []);
      assert.equal(result.evidence.runs.length, 24);
    });
  }
});

test("rejects duplicate, unknown, retry-drift, terminal, and checkpoint ledger tampering", async (t) => {
  const cases = [
    ["duplicate attempt", (ledger) => ledger.attempts.push(structuredClone(ledger.attempts[0]))],
    ["duplicate run", (ledger) => ledger.runs.push(structuredClone(ledger.runs[0]))],
    ["duplicate prompt", (ledger) => { ledger.prompts[1] = structuredClone(ledger.prompts[0]); }],
    ["duplicate task", (ledger) => { ledger.tasks[1] = structuredClone(ledger.tasks[0]); }],
    ["unknown attempt", (ledger) => { ledger.attempts[0].run_id = "unknown-run"; }],
    ["unknown run", (ledger) => { ledger.runs[0].run_id = "unknown-run"; }],
    ["attempt number gap", (ledger) => { ledger.attempts[0].attempt_number = 2; ledger.runs[0].attempt_count = 2; }],
    ["retry drift", (ledger) => ledger.attempts.push({ ...structuredClone(ledger.attempts[0]), attempt_number: 2 })],
    ["missing terminal", (ledger) => {
      ledger.attempts[0].status = "transport-error";
      ledger.attempts[0].response = null;
      ledger.attempts[0].error = {
        name: "ProviderTransportError",
        message: "transport",
        category: "transport_error",
        retryable: true,
        usable_response: false,
      };
    }],
    ["checkpoint identity", (ledger) => { ledger.checkpoint.batch_id = "wrong"; }],
    ["checkpoint count", (ledger) => { ledger.checkpoint.attempt_count += 1; }],
    ["checkpoint completed IDs", (ledger) => { ledger.checkpoint.completed_run_ids = []; }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const ledger = syntheticLedger({ fabricateRuns: false });
      mutate(ledger);
      assert.equal(verifyCalibrationEvidence(ledger).evidence, null);
    });
  }
});

test("accepts a canonical open checkpoint with one persisted in-flight intent", () => {
  const ledger = openLedgerWithIntent();

  assert.deepEqual(verifyCalibrationEvidence(ledger).failures, []);
});

test("rejects an unresolved T5 retry intent after its retained attempt ended at T10", () => {
  const prompt = prompts[0];
  const ledger = {
    plan: structuredClone(plan),
    prompts: structuredClone(prompts),
    tasks: structuredClone(tasks),
    attempts: [{
      record_version: "1",
      benchmark_id: plan.benchmark_id,
      plan_version: plan.plan_version,
      batch_id: "calibration",
      run_id: prompt.run_id,
      api_id: prompt.api_id,
      task_id: prompt.task_id,
      target_id: prompt.target.id,
      provider: prompt.target.provider,
      condition: prompt.condition,
      repetition: prompt.repetition,
      attempt_number: 1,
      started_at: "2026-09-08T00:00:00.000Z",
      ended_at: "2026-09-08T00:00:10.000Z",
      status: "transport-error",
      provider_call: true,
      response: null,
      error: {
        name: "ProviderTransportError",
        message: "first transport failure",
        category: "transport_error",
        retryable: true,
        usable_response: false,
      },
      runner_revision: RUNNER_REVISION,
    }],
    runs: [],
    checkpoint: {
      checkpoint_version: "1",
      benchmark_id: plan.benchmark_id,
      plan_version: plan.plan_version,
      batch_id: "calibration",
      status: "open",
      stop_reason: null,
      attempt_count: 2,
      completed_run_ids: [],
      in_flight_attempt: {
        intent_version: "1",
        benchmark_id: plan.benchmark_id,
        plan_version: plan.plan_version,
        batch_id: "calibration",
        run_id: prompt.run_id,
        api_id: prompt.api_id,
        task_id: prompt.task_id,
        target_id: prompt.target.id,
        provider: prompt.target.provider,
        condition: prompt.condition,
        repetition: prompt.repetition,
        attempt_number: 2,
        started_at: "2026-09-08T00:00:05.000Z",
        runner_revision: RUNNER_REVISION,
      },
      runner_revision: RUNNER_REVISION,
      updated_at: "2026-09-08T00:00:11.000Z",
    },
    expectedRunnerRevision: RUNNER_REVISION,
  };

  const result = verifyCalibrationEvidence(ledger);

  assert.equal(result.evidence, null);
  assert.match(result.failures.join("\n"), /in_flight_attempt started_at precedes the retained attempt ended_at/);
});

test("rejects in-flight identity, numbering, timestamp, revision, and completion drift", async (t) => {
  const cases = [
    ["identity", (ledger) => { ledger.checkpoint.in_flight_attempt.run_id = "unknown-run"; }],
    ["attempt number", (ledger) => { ledger.checkpoint.in_flight_attempt.attempt_number = 2; }],
    ["timestamp", (ledger) => { ledger.checkpoint.in_flight_attempt.started_at = "not-a-timestamp"; }],
    ["revision", (ledger) => { ledger.checkpoint.in_flight_attempt.runner_revision = "sha256:wrong"; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const ledger = openLedgerWithIntent();
      mutate(ledger);
      assert.equal(verifyCalibrationEvidence(ledger).evidence, null);
    });
  }
});

test("rejects attempt and checkpoint timestamp or runner-revision drift", async (t) => {
  const cases = [
    ["attempt start timestamp", (ledger) => { ledger.attempts[0].started_at = "not-a-timestamp"; }],
    ["attempt timestamp order", (ledger) => { ledger.attempts[0].ended_at = "2026-09-07T23:59:59.000Z"; }],
    ["checkpoint timestamp", (ledger) => { ledger.checkpoint.updated_at = "not-a-timestamp"; }],
    ["attempt revision", (ledger) => { ledger.attempts[0].runner_revision = "sha256:wrong"; }],
    ["run revision", (ledger) => { ledger.runs[0].runner_revision = "sha256:wrong"; }],
    ["checkpoint revision", (ledger) => { ledger.checkpoint.runner_revision = "sha256:wrong"; }],
    ["expected revision", (ledger) => { ledger.expectedRunnerRevision = "sha256:wrong"; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const ledger = syntheticLedger({ fabricateRuns: false });
      mutate(ledger);
      assert.equal(verifyCalibrationEvidence(ledger).evidence, null);
    });
  }
});

test("requires strict complete run equality and rejects caller-selected omissions", async (t) => {
  await t.test("missing optional audit field", () => {
    const ledger = syntheticLedger({ fabricateRuns: false });
    delete ledger.runs[0].raw_response;
    const result = verifyCalibrationEvidence(ledger);
    assert.equal(result.evidence, null);
    assert.match(result.failures.join("\n"), /derived run mismatch/);
  });

  await t.test("extra run field", () => {
    const ledger = syntheticLedger({ fabricateRuns: false });
    ledger.runs[0].ignored_by_caller = true;
    assert.equal(verifyCalibrationEvidence(ledger).evidence, null);
  });

  await t.test("caller omission option", () => {
    const ledger = { ...syntheticLedger({ fabricateRuns: false }), omitFields: ["raw_response"] };
    assert.equal(verifyCalibrationEvidence(ledger).evidence, null);
  });
});

test("fails closed for malformed, Proxy, getter, subclass, nonfinite, and cyclic evidence inputs", () => {
  const malformed = [null, [], "ledger", { plan }];
  malformed.forEach((value) => assert.equal(verifyCalibrationEvidence(value).evidence, null));

  const { proxy, trapCalls } = countedProxy(syntheticLedger({ fabricateRuns: false }));
  assert.equal(verifyCalibrationEvidence(proxy).evidence, null);
  assert.equal(trapCalls(), 0);

  const getter = {};
  Object.defineProperty(getter, "plan", { enumerable: true, get() { throw new Error("getter invoked"); } });
  assert.equal(verifyCalibrationEvidence(getter).evidence, null);

  class Ledger {}
  assert.equal(verifyCalibrationEvidence(new Ledger()).evidence, null);

  const nonfinite = syntheticLedger({ fabricateRuns: false });
  nonfinite.attempts[0].response.usage.input_tokens = Infinity;
  assert.equal(verifyCalibrationEvidence(nonfinite).evidence, null);

  const cyclic = syntheticLedger({ fabricateRuns: false });
  cyclic.attempts[0].response.raw_response.self = cyclic.attempts[0].response.raw_response;
  assert.equal(verifyCalibrationEvidence(cyclic).evidence, null);

  const sparse = syntheticLedger({ fabricateRuns: false });
  sparse.attempts.length += 1;
  assert.equal(verifyCalibrationEvidence(sparse).evidence, null);

  const symbolValue = syntheticLedger({ fabricateRuns: false });
  symbolValue.attempts[0].response.raw_response.value = Symbol("unsafe");
  assert.equal(verifyCalibrationEvidence(symbolValue).evidence, null);

  const symbolKey = syntheticLedger({ fabricateRuns: false });
  symbolKey.attempts[0].response.raw_response[Symbol("unsafe")] = true;
  assert.equal(verifyCalibrationEvidence(symbolKey).evidence, null);
});

test("all public runtime boundaries reject unsafe values without traps or coercion", async (t) => {
  const assertion = { operator: "absent", path: "/missing", failure_category: "test" };
  const publicBoundaries = [
    ["parser options", (value) => parseProviderText("{}", value), "throws"],
    ["grader input", (value) => gradeParsedResponse(value), "throws"],
    ["assertion content", (value) => evaluateAssertion(value, assertion), "throws"],
    ["assertion descriptor", (value) => evaluateAssertion({}, value), "throws"],
    ["record validator", (value) => validateEvaluationRecord(value), "throws"],
    ["exception classifier", (value) => isExceptionalRun(value), "throws"],
    ["canonical derivation", (value) => deriveCanonicalRun(value), "throws"],
    ["evidence verifier", (value) => verifyCalibrationEvidence(value), "returns"],
    ["verified evidence guard", (value) => requireVerifiedEvidence(value), "throws"],
  ];

  for (const [name, invoke, rejection] of publicBoundaries) {
    await t.test(name, () => {
      const { proxy, trapCalls } = countedProxy({});
      assertBoundaryRejects(invoke, proxy, rejection);
      assert.equal(trapCalls(), 0, "Proxy traps must not run");

      for (const value of hostileJsonValues()) assertBoundaryRejects(invoke, value, rejection);
    });
  }
});

test("returns deterministic failures for wrong ledger container types", () => {
  for (const field of ["prompts", "tasks", "attempts", "runs"]) {
    const ledger = syntheticLedger({ fabricateRuns: false });
    ledger[field] = {};

    assert.doesNotThrow(() => verifyCalibrationEvidence(ledger), field);
    const result = verifyCalibrationEvidence(ledger);
    assert.equal(result.evidence, null, field);
    assert.match(result.failures.join("\n"), new RegExp(`${field} must be an array`), field);
  }
});

test("validates all nested terminal-attempt metadata before derivation", async (t) => {
  const cases = [
    ["completion category", () => {
      const ledger = syntheticLedger({ fabricateRuns: false });
      ledger.attempts[0].response.completion.category = "incomplete";
      return ledger;
    }],
    ["completion provider status", () => {
      const ledger = syntheticLedger({ fabricateRuns: false });
      ledger.attempts[0].response.completion.provider_status = {};
      return ledger;
    }],
    ["unknown error field", () => {
      const ledger = providerErrorLedger();
      ledger.attempts[0].error.ignored = "unsafe drift";
      return ledger;
    }],
    ["error stop reason type", () => {
      const ledger = providerErrorLedger();
      ledger.attempts[0].error.stop_reason = 429;
      return ledger;
    }],
  ];

  for (const [name, buildLedger] of cases) {
    await t.test(name, () => {
      const result = verifyCalibrationEvidence(buildLedger());
      assert.equal(result.evidence, null);
      assert.match(result.failures.join("\n"), /attempt 1 is invalid/);
    });
  }
});

test("rejects a retained ledger above the 100-attempt hard cap", () => {
  const ledger = syntheticLedger({ fabricateRuns: false });
  const extraAttempts = Array.from({ length: 77 }, (_, index) => ({
    ...structuredClone(ledger.attempts[0]),
    attempt_number: index + 2,
  }));
  ledger.attempts.push(...extraAttempts);
  ledger.checkpoint.attempt_count = 101;

  const result = verifyCalibrationEvidence(ledger);

  assert.equal(result.evidence, null);
  assert.match(result.failures.join("\n"), /exceeds the 100-attempt hard cap/);
});

test("rejects evidence lookalikes, clones, Proxies, and mutation attempts", () => {
  const ledger = syntheticLedger({ fabricateRuns: false });
  const originalRunId = ledger.attempts[0].run_id;
  const originalRawResponseId = ledger.attempts[0].response.raw_response.id;
  const originalCompletedRunId = ledger.checkpoint.completed_run_ids[0];
  const evidence = verifyCalibrationEvidence(ledger).evidence;

  ledger.attempts[0].response.raw_response.id = "mutated-source";
  ledger.runs[0].raw_response.id = "mutated-source";
  ledger.checkpoint.completed_run_ids[0] = "mutated-source";

  assert.throws(() => requireVerifiedEvidence({ ...evidence }), /not verified/);
  assert.throws(() => requireVerifiedEvidence(structuredClone(evidence)), /not verified/);
  assert.throws(() => requireVerifiedEvidence(new Proxy(evidence, {})), /Proxy/);
  assert.throws(() => { evidence.runs.push({}); }, /extensible|read only|frozen/i);
  const evidenceRun = evidence.runs.find((run) => run.run_id === originalRunId);
  assert.throws(() => { evidenceRun.raw_response.id = "mutated-evidence"; }, /read only/i);
  assert.throws(() => { evidence.checkpoint.completed_run_ids[0] = "mutated-evidence"; }, /read only/i);
  assert.equal(evidenceRun.raw_response.id, originalRawResponseId);
  assert.equal(evidence.checkpoint.completed_run_ids[0], originalCompletedRunId);
  assert.equal(Object.isFrozen(evidenceRun.raw_response), true);
  assert.equal(Object.isFrozen(evidence.checkpoint.completed_run_ids), true);
  assert.equal(evidence.runs[0].run_id, prompts.find((prompt) => prompt.run_id === evidence.runs[0].run_id).run_id);
});

test("reconciles exactly one missing run or only a stale checkpoint", () => {
  const ledger = syntheticLedger({ fabricateRuns: false });
  const missing = ledger.runs.pop();
  ledger.checkpoint = stalePredecessor(ledger, missing.run_id);

  const missingRun = reconcileCalibrationEvidence(ledger);

  assert.deepEqual(missingRun.failures, []);
  assert.equal(missingRun.evidence, null);
  assert.equal(missingRun.reconciliation.runs_to_append.length, 1);
  assert.deepEqual(missingRun.reconciliation.runs_to_append[0], missing);
  assert.equal(missingRun.reconciliation.checkpoint.completed_run_ids.length, 24);

  const staleCheckpoint = syntheticLedger({ fabricateRuns: false });
  staleCheckpoint.checkpoint = stalePredecessor(staleCheckpoint, staleCheckpoint.runs.at(-1).run_id, staleCheckpoint.runs.slice(0, -1));
  const checkpointOnly = reconcileCalibrationEvidence(staleCheckpoint);
  assert.deepEqual(checkpointOnly.failures, []);
  assert.equal(checkpointOnly.evidence, null);
  assert.equal(checkpointOnly.reconciliation.runs_to_append.length, 0);
  assert.equal(checkpointOnly.reconciliation.checkpoint.completed_run_ids.length, 24);

  const multipleMissing = syntheticLedger({ fabricateRuns: false });
  multipleMissing.runs.splice(-2, 2);
  multipleMissing.checkpoint.completed_run_ids = multipleMissing.runs.map((run) => run.run_id);
  multipleMissing.checkpoint.attempt_count = multipleMissing.attempts.length - 2;
  multipleMissing.checkpoint.status = "open";
  const rejected = reconcileCalibrationEvidence(multipleMissing);
  assert.equal(rejected.reconciliation, null);
  assert.equal(rejected.evidence, null);

  const broadCheckpointDrift = syntheticLedger({ fabricateRuns: false });
  broadCheckpointDrift.checkpoint.completed_run_ids = [];
  broadCheckpointDrift.checkpoint.status = "open";
  const broadRejected = reconcileCalibrationEvidence(broadCheckpointDrift);
  assert.equal(broadRejected.reconciliation, null);
  assert.equal(broadRejected.evidence, null);
});

test("reconciliation rejects every drift from the canonical predecessor checkpoint", async (t) => {
  const cases = {
    "forged stopped status and reason": (checkpoint) => ({ ...checkpoint, status: "stopped", stop_reason: "forged-stop" }),
    "forged complete status": (checkpoint) => ({ ...checkpoint, status: "complete" }),
    "forged update time": (checkpoint) => ({ ...checkpoint, updated_at: "2026-09-09T00:00:00.000Z" }),
    "reordered completed IDs": (checkpoint) => ({ ...checkpoint, completed_run_ids: [...checkpoint.completed_run_ids].reverse() }),
    "missing in-flight intent": (checkpoint) => ({ ...checkpoint, in_flight_attempt: null }),
  };

  for (const [name, drift] of Object.entries(cases)) {
    await t.test(name, () => {
      const ledger = syntheticLedger({ fabricateRuns: false });
      const missing = ledger.runs.pop();
      ledger.checkpoint = drift(stalePredecessor(ledger, missing.run_id));

      const result = reconcileCalibrationEvidence(ledger);

      assert.equal(result.evidence, null);
      assert.equal(result.reconciliation, null);
    });
  }
});

function syntheticLedger({ fabricateRuns = false } = {}) {
  const attempts = prompts.map((prompt) => responseAttempt(prompt));
  const runs = prompts.map((prompt, index) => fabricateRuns
    ? fabricatedRun(prompt)
    : deriveCanonicalRun({ plan, prompt, task: taskFor(prompt), attempts: [attempts[index]], runnerRevision: RUNNER_REVISION }));
  return {
    plan: structuredClone(plan),
    prompts: structuredClone(prompts),
    tasks: structuredClone(tasks),
    attempts,
    runs,
    checkpoint: checkpoint(runs),
    expectedRunnerRevision: RUNNER_REVISION,
  };
}

function stalePredecessor(ledger, runId, completedRuns = ledger.runs) {
  const terminal = ledger.attempts.find((attempt) => attempt.run_id === runId);
  return {
    checkpoint_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: "calibration",
    status: "open",
    stop_reason: null,
    attempt_count: ledger.attempts.length,
    completed_run_ids: completedRuns.map((run) => run.run_id),
    in_flight_attempt: {
      intent_version: "1",
      benchmark_id: terminal.benchmark_id,
      plan_version: terminal.plan_version,
      batch_id: terminal.batch_id,
      run_id: terminal.run_id,
      api_id: terminal.api_id,
      task_id: terminal.task_id,
      target_id: terminal.target_id,
      provider: terminal.provider,
      condition: terminal.condition,
      repetition: terminal.repetition,
      attempt_number: terminal.attempt_number,
      started_at: terminal.started_at,
      runner_revision: terminal.runner_revision,
    },
    runner_revision: RUNNER_REVISION,
    updated_at: terminal.started_at,
  };
}

function terminalAttempt(prompt, status, error, overrides = {}) {
  return {
    ...responseAttempt(prompt),
    status,
    response: null,
    error,
    ...overrides,
  };
}

function taskFor(prompt) {
  return tasks.find((candidate) => candidate.id === prompt.task_id);
}

function responseAttempt(prompt) {
  const task = taskFor(prompt);
  return {
    record_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: "calibration",
    run_id: prompt.run_id,
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
    attempt_number: 1,
    started_at: "2026-09-08T00:00:00.000Z",
    ended_at: "2026-09-08T00:00:01.000Z",
    status: "response",
    provider_call: true,
    response: {
      content_text: JSON.stringify(task.private.expected_outcome),
      completion: {
        complete: true,
        category: "completed",
        provider_status: null,
        stop_reason: "end_turn",
      },
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      resolved_model: `${prompt.target.id}-model`,
      provider_request_id: `request-${prompt.calibration_ordinal}`,
      raw_response: { id: `response-${prompt.calibration_ordinal}` },
    },
    error: null,
    runner_revision: RUNNER_REVISION,
  };
}

function countedProxy(target) {
  let trapCalls = 0;
  const proxy = new Proxy(target, {
    get(target_, property, receiver) { trapCalls += 1; return Reflect.get(target_, property, receiver); },
    getPrototypeOf(target_) { trapCalls += 1; return Reflect.getPrototypeOf(target_); },
    ownKeys(target_) { trapCalls += 1; return Reflect.ownKeys(target_); },
    getOwnPropertyDescriptor(target_, property) { trapCalls += 1; return Reflect.getOwnPropertyDescriptor(target_, property); },
  });
  return { proxy, trapCalls: () => trapCalls };
}

function fabricatedRun(prompt) {
  return {
    record_version: "3",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
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
    content_text: "{}",
    content_json: {},
    raw_response: null,
    parse_error: null,
    usage: null,
    resolved_model: null,
    provider_request_id: null,
    stop_reason: null,
    started_at: "2026-09-08T00:00:00.000Z",
    ended_at: "2026-09-08T00:00:01.000Z",
    runner_revision: RUNNER_REVISION,
  };
}

function checkpoint(runs) {
  return {
    checkpoint_version: "1",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: "calibration",
    status: "complete",
    stop_reason: null,
    attempt_count: runs.length,
    completed_run_ids: runs.map((run) => run.run_id),
    in_flight_attempt: null,
    runner_revision: RUNNER_REVISION,
    updated_at: "2026-09-08T00:00:01.000Z",
  };
}

function openLedgerWithIntent() {
  const prompt = prompts[0];
  return {
    plan: structuredClone(plan),
    prompts: structuredClone(prompts),
    tasks: structuredClone(tasks),
    attempts: [],
    runs: [],
    checkpoint: {
      checkpoint_version: "1",
      benchmark_id: plan.benchmark_id,
      plan_version: plan.plan_version,
      batch_id: "calibration",
      status: "open",
      stop_reason: null,
      attempt_count: 1,
      completed_run_ids: [],
      in_flight_attempt: {
        intent_version: "1",
        benchmark_id: plan.benchmark_id,
        plan_version: plan.plan_version,
        batch_id: "calibration",
        run_id: prompt.run_id,
        api_id: prompt.api_id,
        task_id: prompt.task_id,
        target_id: prompt.target.id,
        provider: prompt.target.provider,
        condition: prompt.condition,
        repetition: prompt.repetition,
        attempt_number: 1,
        started_at: "2026-09-08T00:00:00.000Z",
        runner_revision: RUNNER_REVISION,
      },
      runner_revision: RUNNER_REVISION,
      updated_at: "2026-09-08T00:00:00.000Z",
    },
    expectedRunnerRevision: RUNNER_REVISION,
  };
}

function providerErrorLedger() {
  const ledger = syntheticLedger({ fabricateRuns: false });
  const prompt = ledger.prompts[0];
  const attempt = terminalAttempt(prompt, "provider-error", {
    name: "ProviderResponseError",
    message: "provider rejected",
    category: "provider_error",
    stop_reason: null,
    provider_request_id: "provider-id",
    response_body: { error: "x" },
    retryable: false,
    usable_response: true,
    http_status: 500,
  });
  ledger.attempts[0] = attempt;
  ledger.runs[0] = deriveCanonicalRun({
    plan: ledger.plan,
    prompt,
    task: ledger.tasks.find((task) => task.id === prompt.task_id),
    attempts: [attempt],
    runnerRevision: RUNNER_REVISION,
  });
  return ledger;
}

function ledgerWithFirstRunAttempts(runAttempts) {
  const ledger = syntheticLedger({ fabricateRuns: false });
  const prompt = ledger.prompts[0];
  ledger.attempts.splice(0, 1, ...runAttempts);
  ledger.runs[0] = deriveCanonicalRun({
    plan: ledger.plan,
    prompt,
    task: ledger.tasks.find((task) => task.id === prompt.task_id),
    attempts: runAttempts,
    runnerRevision: RUNNER_REVISION,
  });
  ledger.checkpoint.attempt_count = ledger.attempts.length;
  return ledger;
}

function expectedIdentity(prompt, attemptCount) {
  return {
    record_version: "3",
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    run_id: prompt.run_id,
    batch_id: "calibration",
    api_id: prompt.api_id,
    task_id: prompt.task_id,
    target_id: prompt.target.id,
    provider: prompt.target.provider,
    condition: prompt.condition,
    repetition: prompt.repetition,
    attempt_count: attemptCount,
    runner_revision: RUNNER_REVISION,
  };
}

function notEvaluatedFailure({
  transportStatus,
  failureCategories,
  reasons,
  rawResponse = null,
  providerRequestId = null,
  stopReason = null,
  implementationDefect = false,
}) {
  return {
    transport_status: transportStatus,
    format_status: "empty",
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    failure_categories: failureCategories,
    reasons,
    manual_review_required: false,
    implementation_defect: implementationDefect,
    content_text: null,
    content_json: null,
    raw_response: rawResponse,
    parse_error: null,
    usage: null,
    resolved_model: null,
    provider_request_id: providerRequestId,
    stop_reason: stopReason,
    started_at: "2026-09-08T00:00:00.000Z",
    ended_at: "2026-09-08T00:00:01.000Z",
  };
}

function hostileJsonValues() {
  const getter = {};
  Object.defineProperty(getter, "value", {
    enumerable: true,
    get() { throw new Error("getter invoked"); },
  });
  class Subclass {}
  class ArraySubclass extends Array {}
  const cyclic = {};
  cyclic.self = cyclic;
  const sparse = [];
  sparse.length = 1;
  const symbolKey = {};
  symbolKey[Symbol("unsafe")] = true;
  return [getter, new Subclass(), new ArraySubclass(), Infinity, cyclic, sparse, Symbol("unsafe"), symbolKey];
}

function assertBoundaryRejects(invoke, value, rejection) {
  if (rejection === "returns") {
    const result = invoke(value);
    assert.equal(result.evidence, null);
    assert.notEqual(result.failures.length, 0);
    return;
  }
  assert.throws(() => invoke(value));
}
