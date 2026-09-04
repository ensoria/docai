import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCURACY_STATUSES,
  CONTRACT_STATUSES,
  FORMAT_STATUSES,
  TRANSPORT_STATUSES,
  UNCERTAINTY_STATUSES,
  isExceptionalRun,
  validateEvaluationRecord,
} from "../openapi-comparison-v3-record.mjs";

function validRecord(overrides = {}) {
  return {
    record_version: "3",
    benchmark_id: "docai-http-openapi-comparison-v3",
    plan_version: "3.0.0-calibration.1",
    run_id: "run-001",
    batch_id: "calibration",
    api_id: "complete-commerce",
    task_id: "upload-document-request",
    target_id: "openai-frontier",
    provider: "openai",
    condition: "openapi-raw",
    repetition: 1,
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
    ...overrides,
  };
}

test("exports the approved closed status sets", () => {
  assert.deepEqual(TRANSPORT_STATUSES, [
    "completed",
    "blocked",
    "provider-error",
    "transport-error",
    "incomplete",
  ]);
  assert.deepEqual(FORMAT_STATUSES, [
    "raw-json",
    "fenced-json",
    "invalid-json",
    "empty",
    "incomplete",
  ]);
  assert.deepEqual(CONTRACT_STATUSES, ["valid", "invalid", "not-evaluated"]);
  assert.deepEqual(ACCURACY_STATUSES, ["pass", "fail", "inconclusive", "not-evaluated"]);
  assert.deepEqual(UNCERTAINTY_STATUSES, [
    "none",
    "reported-gap",
    "missed-fact",
    "unsupported-guess",
    "not-evaluated",
  ]);
});

test("accepts every allowed transport status in its valid dimension combination", () => {
  const records = [
    validRecord(),
    validRecord({
      transport_status: "blocked",
      format_status: "empty",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
    validRecord({
      transport_status: "provider-error",
      format_status: "empty",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
    validRecord({
      transport_status: "transport-error",
      format_status: "empty",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
    validRecord({
      transport_status: "incomplete",
      format_status: "incomplete",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
  ];

  for (const record of records) {
    assert.strictEqual(validateEvaluationRecord(record), record);
  }
});

test("accepts every allowed format status in its valid dimension combination", () => {
  const records = [
    validRecord({ format_status: "raw-json" }),
    validRecord({ format_status: "fenced-json" }),
    validRecord({
      format_status: "invalid-json",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
    validRecord({
      format_status: "empty",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
    validRecord({
      format_status: "incomplete",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
  ];

  for (const record of records) {
    assert.strictEqual(validateEvaluationRecord(record), record);
  }
});

test("accepts every allowed contract, accuracy, and uncertainty status in valid combinations", () => {
  const records = [
    validRecord({ contract_status: "valid", accuracy_status: "pass", uncertainty_status: "none" }),
    validRecord({ contract_status: "valid", accuracy_status: "fail", uncertainty_status: "reported-gap" }),
    validRecord({
      contract_status: "valid",
      accuracy_status: "inconclusive",
      uncertainty_status: "missed-fact",
      manual_review_required: true,
    }),
    validRecord({ contract_status: "valid", accuracy_status: "pass", uncertainty_status: "unsupported-guess" }),
    validRecord({
      contract_status: "invalid",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
    validRecord({
      format_status: "invalid-json",
      contract_status: "not-evaluated",
      accuracy_status: "not-evaluated",
      uncertainty_status: "not-evaluated",
    }),
  ];

  for (const record of records) {
    assert.strictEqual(validateEvaluationRecord(record), record);
  }
});

test("rejects every invalid enum value", () => {
  const fields = [
    "transport_status",
    "format_status",
    "contract_status",
    "accuracy_status",
    "uncertainty_status",
  ];

  for (const field of fields) {
    assert.throws(
      () => validateEvaluationRecord(validRecord({ [field]: "unexpected" })),
      new RegExp(`${field} must be one of`),
      field,
    );
  }
});

test("rejects missing identity and result fields", () => {
  const requiredFields = [
    "record_version",
    "benchmark_id",
    "plan_version",
    "run_id",
    "batch_id",
    "api_id",
    "task_id",
    "target_id",
    "provider",
    "condition",
    "repetition",
    "attempt_count",
    "transport_status",
    "format_status",
    "contract_status",
    "accuracy_status",
    "uncertainty_status",
    "failure_categories",
    "reasons",
    "manual_review_required",
    "implementation_defect",
  ];

  for (const field of requiredFields) {
    const record = validRecord();
    delete record[field];

    assert.throws(() => validateEvaluationRecord(record), new RegExp(`${field} is required`), field);
  }
});

test("rejects unknown keys and malformed primitive identity fields", () => {
  assert.throws(
    () => validateEvaluationRecord(validRecord({ unknown: true })),
    /unknown key unknown/,
  );
  assert.throws(
    () => validateEvaluationRecord(validRecord({ record_version: "2" })),
    /record_version must be "3"/,
  );

  for (const field of [
    "benchmark_id",
    "plan_version",
    "run_id",
    "batch_id",
    "api_id",
    "task_id",
    "target_id",
    "provider",
    "condition",
  ]) {
    assert.throws(
      () => validateEvaluationRecord(validRecord({ [field]: "" })),
      new RegExp(`${field} must be a non-empty string`),
      field,
    );
  }

  for (const value of [0, -1, 1.5, Number.NaN, Infinity, "1"]) {
    assert.throws(
      () => validateEvaluationRecord(validRecord({ repetition: value })),
      /repetition must be a positive integer/,
      `repetition ${String(value)}`,
    );
    assert.throws(
      () => validateEvaluationRecord(validRecord({ attempt_count: value })),
      /attempt_count must be a positive integer/,
      `attempt_count ${String(value)}`,
    );
  }
});

test("rejects unknown non-enumerable and symbol own keys", () => {
  const nonEnumerableRecord = validRecord();
  Object.defineProperty(nonEnumerableRecord, "hidden", { value: true });
  assert.throws(
    () => validateEvaluationRecord(nonEnumerableRecord),
    /unknown key hidden/,
  );

  const symbolRecord = validRecord();
  symbolRecord[Symbol("hidden")] = true;
  assert.throws(
    () => validateEvaluationRecord(symbolRecord),
    /unknown key Symbol\(hidden\)/,
  );
});

test("rejects malformed array and boolean result fields", () => {
  for (const field of ["failure_categories", "reasons"]) {
    assert.throws(() => validateEvaluationRecord(validRecord({ [field]: "not-an-array" })), new RegExp(`${field} must be an array of strings`));
    assert.throws(() => validateEvaluationRecord(validRecord({ [field]: ["ok", 1] })), new RegExp(`${field} must be an array of strings`));
  }

  for (const field of ["manual_review_required", "implementation_defect"]) {
    assert.throws(() => validateEvaluationRecord(validRecord({ [field]: "false" })), new RegExp(`${field} must be a boolean`));
  }
});

test("accepts optional audit fields when their values are valid JSON or nullable strings", () => {
  const record = validRecord({
    content_text: "{\"answer\":true}",
    content_json: { answer: true },
    raw_response: { choices: [{ text: "ok" }] },
    parse_error: { code: "invalid-json", message: "example" },
    usage: { input_tokens: 12, output_tokens: 4 },
    resolved_model: "gpt-example",
    provider_request_id: "request-123",
    stop_reason: "stop",
    started_at: "2026-08-27T00:00:00.000Z",
    ended_at: "2026-08-27T00:00:01.000Z",
    runner_revision: "revision-123",
  });

  assert.strictEqual(validateEvaluationRecord(record), record);

  for (const field of [
    "content_text",
    "resolved_model",
    "provider_request_id",
    "stop_reason",
    "started_at",
    "ended_at",
    "runner_revision",
  ]) {
    assert.doesNotThrow(() => validateEvaluationRecord(validRecord({ [field]: null })), field);
    assert.throws(() => validateEvaluationRecord(validRecord({ [field]: 1 })), new RegExp(`${field} must be a string or null`), field);
  }

  for (const field of ["content_json", "raw_response", "parse_error", "usage"]) {
    assert.doesNotThrow(() => validateEvaluationRecord(validRecord({ [field]: null })), field);
    assert.throws(() => validateEvaluationRecord(validRecord({ [field]: { nested: undefined } })), new RegExp(`${field} must be a JSON value`), field);
  }
});

test("enforces every cross-dimension invariant", () => {
  const cases = [
    [
      "incomplete transport requires incomplete format",
      validRecord({
        transport_status: "incomplete",
        contract_status: "not-evaluated",
        accuracy_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
      }),
      /transport_status incomplete requires format_status incomplete/,
    ],
    [
      "incomplete transport requires unevaluated later dimensions",
      validRecord({
        transport_status: "incomplete",
        format_status: "incomplete",
        contract_status: "valid",
      }),
      /transport_status incomplete requires all later dimensions to be not-evaluated/,
    ],
    [
      "blocked transport requires unevaluated later dimensions",
      validRecord({
        transport_status: "blocked",
        format_status: "empty",
        accuracy_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
      }),
      /transport_status blocked requires later dimensions to be not-evaluated/,
    ],
    [
      "provider errors require unevaluated later dimensions",
      validRecord({
        transport_status: "provider-error",
        format_status: "empty",
        contract_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
      }),
      /transport_status provider-error requires later dimensions to be not-evaluated/,
    ],
    [
      "transport errors require unevaluated later dimensions",
      validRecord({
        transport_status: "transport-error",
        format_status: "empty",
        contract_status: "not-evaluated",
        accuracy_status: "not-evaluated",
      }),
      /transport_status transport-error requires later dimensions to be not-evaluated/,
    ],
    ...["blocked", "provider-error", "transport-error"].flatMap((transportStatus) => [
      [
        `${transportStatus} rejects raw model output`,
        validRecord({
          transport_status: transportStatus,
          contract_status: "not-evaluated",
          accuracy_status: "not-evaluated",
          uncertainty_status: "not-evaluated",
        }),
        new RegExp(`transport_status ${transportStatus} requires format_status empty`),
      ],
      [
        `${transportStatus} rejects fenced model output`,
        validRecord({
          transport_status: transportStatus,
          format_status: "fenced-json",
          contract_status: "not-evaluated",
          accuracy_status: "not-evaluated",
          uncertainty_status: "not-evaluated",
        }),
        new RegExp(`transport_status ${transportStatus} requires format_status empty`),
      ],
    ]),
    [
      "invalid format requires unevaluated later dimensions",
      validRecord({
        format_status: "invalid-json",
        accuracy_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
      }),
      /format_status invalid-json requires later dimensions to be not-evaluated/,
    ],
    [
      "empty format requires unevaluated later dimensions",
      validRecord({
        format_status: "empty",
        contract_status: "not-evaluated",
        uncertainty_status: "not-evaluated",
      }),
      /format_status empty requires later dimensions to be not-evaluated/,
    ],
    [
      "incomplete format requires unevaluated later dimensions",
      validRecord({
        format_status: "incomplete",
        contract_status: "not-evaluated",
        accuracy_status: "pass",
        uncertainty_status: "not-evaluated",
      }),
      /format_status incomplete requires later dimensions to be not-evaluated/,
    ],
    [
      "invalid contract requires unevaluated accuracy and uncertainty",
      validRecord({ contract_status: "invalid", accuracy_status: "fail" }),
      /contract_status invalid requires accuracy_status and uncertainty_status to be not-evaluated/,
    ],
    [
      "valid contract requires an evaluated accuracy result",
      validRecord({ contract_status: "valid", accuracy_status: "not-evaluated" }),
      /contract_status valid requires an evaluated accuracy_status/,
    ],
    [
      "valid contract requires an evaluated uncertainty result",
      validRecord({ contract_status: "valid", uncertainty_status: "not-evaluated" }),
      /contract_status valid requires an evaluated uncertainty_status/,
    ],
    [
      "inconclusive accuracy requires manual review",
      validRecord({ accuracy_status: "inconclusive", manual_review_required: false }),
      /manual_review_required must be true exactly when accuracy_status is inconclusive/,
    ],
    [
      "manual review is forbidden for decided accuracy",
      validRecord({ manual_review_required: true }),
      /manual_review_required must be true exactly when accuracy_status is inconclusive/,
    ],
    [
      "implementation defects cannot have an accuracy result",
      validRecord({ implementation_defect: true }),
      /implementation_defect requires accuracy_status not-evaluated/,
    ],
  ];

  for (const [name, record, expectedError] of cases) {
    assert.throws(() => validateEvaluationRecord(record), expectedError, name);
  }
});

test("accepts a coherent not-evaluated implementation defect record", () => {
  const record = validRecord({
    format_status: "empty",
    contract_status: "not-evaluated",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
    implementation_defect: true,
  });

  assert.strictEqual(validateEvaluationRecord(record), record);
});

test("counts a multidimensionally exceptional record once", () => {
  const exceptional = validRecord({
    format_status: "fenced-json",
    contract_status: "invalid",
    accuracy_status: "not-evaluated",
    uncertainty_status: "not-evaluated",
  });

  assert.equal(isExceptionalRun(exceptional), true);
  assert.equal(isExceptionalRun(validRecord()), false);
  assert.throws(
    () => isExceptionalRun(validRecord({ format_status: "invalid-json", contract_status: "valid" })),
    /format_status invalid-json requires later dimensions to be not-evaluated/,
  );
});
