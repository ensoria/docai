import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRequiredOutputText,
  validateBenchmarkTaskPacket,
} from "../openapi-comparison-v2-contract.mjs";

const plan = {
  benchmark_id: "docai-http-openapi-comparison-v2",
  apis: [
    {
      id: "example-api",
      tasks: [
        "request-one",
        "response-one",
        "error-one",
        "workflow-one",
        "webhook-one",
        "retrieval-one",
      ],
    },
  ],
};

test("accepts one complete six-task API packet", () => {
  assert.doesNotThrow(() => validateBenchmarkTaskPacket(validPacket(), plan));
});

test("rejects a task identity not frozen in the plan", () => {
  const packet = validPacket();
  packet.tasks[0].id = "replacement-task";

  assert.throws(
    () => validateBenchmarkTaskPacket(packet, plan),
    /task ids must exactly match plan/,
  );
});

test("rejects duplicate task identities", () => {
  const packet = validPacket();
  packet.tasks[1].id = packet.tasks[0].id;

  assert.throws(
    () => validateBenchmarkTaskPacket(packet, plan),
    /task ids must be unique/,
  );
});

test("rejects unsupported assertion operators", () => {
  const packet = validPacket();
  packet.tasks[0].private.assertions[0].operator = "approximately";

  assert.throws(
    () => validateBenchmarkTaskPacket(packet, plan),
    /unsupported assertion operator approximately/,
  );
});

test("rejects expected-outcome leakage into public prompt fields", () => {
  const packet = validPacket();
  packet.tasks[0].public.expected_outcome = { method: "POST" };

  assert.throws(
    () => validateBenchmarkTaskPacket(packet, plan),
    /public task data must not contain expected_outcome/,
  );
});

test("renders the required JSON output without benchmark answers", () => {
  const output = buildRequiredOutputText("request-construction.v1");

  assert.match(output, /Return one JSON object/);
  assert.match(output, /"method": "string"/);
  assert.match(output, /"uncertainties": \[\s*"string"\s*\]/);
  assert.doesNotMatch(output, /(POST|\/users|Authorization)/);
});

test("error contract preserves conditional retry semantics", () => {
  const output = buildRequiredOutputText("error-recovery.v1");

  assert.match(output, /"retry_policy": "string"/);
  assert.doesNotMatch(output, /"retry": (true|false)/);
});

test("retrieval contract exposes cursor and moving-view controls", () => {
  const output = buildRequiredOutputText("retrieval-selection.v1");

  assert.match(output, /"cursor_parameter": "string"/);
  assert.match(output, /"deduplicate_by": "string or null"/);
});

test("request contract separates known client behavior from uncertainties", () => {
  const output = buildRequiredOutputText("request-construction.v1");

  assert.match(output, /"client_behavior": \[/);
  assert.match(output, /"uncertainties": \[/);
});

function validPacket() {
  const definitions = [
    ["request-one", "request_construction", "request-construction.v1"],
    ["response-one", "response_handling", "response-handling.v1"],
    ["error-one", "error_recovery", "error-recovery.v1"],
    ["workflow-one", "workflow_completion", "workflow-completion.v1"],
    ["webhook-one", "webhook_handling", "webhook-handling.v1"],
    ["retrieval-one", "retrieval_selection", "retrieval-selection.v1"],
  ];

  return {
    benchmark_id: plan.benchmark_id,
    api_id: "example-api",
    tasks: definitions.map(([id, taskClass, outputContract]) => ({
      id,
      class: taskClass,
      profile: "full",
      public: {
        user_task: `Complete the ${id} task using only the supplied context.`,
        output_contract: outputContract,
        retrieval: {
          openapi_roots: ["/example"],
          docai_files: ["INDEX.md", "resources/example.md"],
        },
      },
      private: {
        expected_outcome: { result: id },
        assertions: [
          {
            path: "/result",
            operator: "equals",
            value: id,
            failure_category: "task-result",
          },
        ],
        fact_inventory: {
          required: ["fact:example"],
          raw_missing: [],
          sliced_missing: [],
        },
      },
    })),
  };
}
