import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FileRunStore,
  MemoryRunStore,
  ProviderResponseError,
  ProviderTransportError,
  runApprovedBatch,
  selectBatchPrompts,
} from "../openapi-comparison-v2-runner.mjs";
import { createOpenAIAdapter } from "../openapi-comparison-v2-openai-adapter.mjs";
import { createAnthropicAdapter } from "../openapi-comparison-v2-anthropic-adapter.mjs";
import { createGoogleAdapter } from "../openapi-comparison-v2-google-adapter.mjs";
import { checkRunState } from "../check-openapi-comparison-v2-runs.mjs";

test("selects exactly one frozen batch", () => {
  const plan = makePlan(2);
  const prompts = [
    makePrompt(1, "b01"),
    makePrompt(2, "b01"),
    makePrompt(3, "b02"),
  ];

  assert.deepEqual(
    selectBatchPrompts({ plan, prompts, batchId: "b01" }).map((prompt) => prompt.run_id),
    ["run-1", "run-2"],
  );
  assert.throws(
    () => selectBatchPrompts({ plan, prompts, batchId: ["b01", "b02"] }),
    /exactly one batch/,
  );
  assert.throws(
    () => selectBatchPrompts({ plan, prompts, batchId: "b99" }),
    /unknown batch/,
  );
});

test("refuses execution without matching batch approval", async () => {
  await assert.rejects(
    () => runApprovedBatch(makeRunOptions({
      plan: makePlan(1),
      prompts: [makePrompt(1)],
      store: new MemoryRunStore(),
      adapters: { openai: { execute: async () => successfulResponse() } },
      approvedBatchId: "b02",
    })),
    /requires matching explicit approval/,
  );
});

test("resume skips completed run identities without another provider call", async () => {
  const plan = makePlan(2);
  const prompts = [makePrompt(1), makePrompt(2)];
  const store = new MemoryRunStore();
  let calls = 0;
  const adapters = {
    openai: {
      execute: async () => {
        calls += 1;
        return successfulResponse();
      },
    },
  };

  await runApprovedBatch(makeRunOptions({ plan, prompts, store, adapters }));
  const resumed = await runApprovedBatch(makeRunOptions({ plan, prompts, store, adapters }));

  assert.equal(calls, 2);
  assert.equal(store.listRuns("b01").length, 2);
  assert.equal(resumed.report.skipped_completed, 2);
  assert.equal(resumed.checkpoint.status, "complete");
});

test("retries one pre-response transport failure and retains both attempts", async () => {
  const plan = makePlan(1);
  const prompts = [makePrompt(1), makePrompt(99, "b02")];
  const store = new MemoryRunStore();
  let calls = 0;
  const adapters = {
    openai: {
      execute: async () => {
        calls += 1;
        if (calls === 1) throw new ProviderTransportError("connection reset");
        return successfulResponse();
      },
    },
  };

  const result = await runApprovedBatch(makeRunOptions({ plan, prompts, store, adapters }));

  assert.equal(calls, 2);
  assert.deepEqual(
    store.listAttempts("b01").map((attempt) => attempt.status),
    ["transport_error", "response"],
  );
  assert.equal(store.listRuns("b01")[0].status, "pass");
  assert.equal(result.report.counts.retried_attempts, 1);
});

test("resume does not retry a retained runner defect", async () => {
  const plan = makePlan(1);
  const prompts = [makePrompt(1), makePrompt(99, "b02")];
  const store = new MemoryRunStore();
  let calls = 0;
  const options = makeRunOptions({
    plan,
    prompts,
    store,
    taskForPrompt: () => {
      throw new Error("fixture lookup failed");
    },
    adapters: {
      openai: {
        execute: async () => {
          calls += 1;
          return successfulResponse();
        },
      },
    },
  });

  const first = await runApprovedBatch(options);
  const resumed = await runApprovedBatch(options);

  assert.equal(calls, 0);
  assert.equal(store.listAttempts("b01").length, 1);
  assert.equal(first.checkpoint.stop_reason, "fixture_or_grader_defect");
  assert.equal(resumed.checkpoint.stop_reason, "fixture_or_grader_defect");
});

test("does not retry provider responses or content failures", async () => {
  const plan = makePlan(2);
  const prompts = [makePrompt(1), makePrompt(2), makePrompt(99, "b02")];
  const store = new MemoryRunStore();
  let calls = 0;
  const adapters = {
    openai: {
      execute: async ({ prompt }) => {
        calls += 1;
        if (prompt.run_id === "run-1") {
          throw new ProviderResponseError("server rejected request", {
            httpStatus: 500,
            category: "provider_error",
          });
        }
        return successfulResponse({ result: "wrong" });
      },
    },
  };

  await runApprovedBatch(makeRunOptions({ plan, prompts, store, adapters }));

  assert.equal(calls, 2);
  assert.equal(store.listAttempts("b01").length, 2);
  assert.deepEqual(
    store.listRuns("b01").map((run) => run.status),
    ["blocked", "fail"],
  );
});

test("enforces the 100-attempt hard cap across the whole batch", async () => {
  const plan = makePlan(51);
  const prompts = Array.from({ length: 51 }, (_, index) => makePrompt(index + 1));
  const store = new MemoryRunStore();
  const adapters = {
    openai: {
      execute: async () => {
        throw new ProviderTransportError("connection reset");
      },
    },
  };

  const result = await runApprovedBatch(makeRunOptions({ plan, prompts, store, adapters }));

  assert.equal(store.listAttempts("b01").length, 100);
  assert.equal(store.listRuns("b01").length, 50);
  assert.equal(result.checkpoint.status, "stopped");
  assert.equal(result.checkpoint.stop_reason, "attempt_cap");
});

for (const stopReason of ["billing_error", "model_unavailable", "authentication_error"]) {
  test(`stops immediately on ${stopReason}`, async () => {
    const plan = makePlan(2);
    const prompts = [makePrompt(1), makePrompt(2)];
    const store = new MemoryRunStore();
    let calls = 0;
    const adapters = {
      openai: {
        execute: async () => {
          calls += 1;
          throw new ProviderResponseError(stopReason, {
            category: stopReason,
            stopReason,
          });
        },
      },
    };

    const result = await runApprovedBatch(makeRunOptions({ plan, prompts, store, adapters }));

    assert.equal(calls, 1);
    assert.equal(result.checkpoint.status, "stopped");
    assert.equal(result.checkpoint.stop_reason, stopReason);
  });
}

test("stops after a repeated rate limit without retrying either response", async () => {
  const plan = makePlan(3);
  const prompts = [makePrompt(1), makePrompt(2), makePrompt(3)];
  const store = new MemoryRunStore();
  let calls = 0;
  const adapters = {
    openai: {
      execute: async () => {
        calls += 1;
        throw new ProviderResponseError("rate limited", {
          httpStatus: 429,
          category: "rate_limit",
          stopReason: "rate_limit",
        });
      },
    },
  };

  const result = await runApprovedBatch(makeRunOptions({ plan, prompts, store, adapters }));

  assert.equal(calls, 2);
  assert.equal(store.listAttempts("b01").length, 2);
  assert.equal(result.checkpoint.stop_reason, "repeated_rate_limit");
});

test("completes the batch and raises a review gate when exceptional results exceed five percent", async () => {
  const plan = makePlan(72);
  const prompts = Array.from({ length: 72 }, (_, index) => makePrompt(index + 1));
  const store = new MemoryRunStore();
  let calls = 0;
  const adapters = {
    openai: {
      execute: async () => {
        calls += 1;
        return successfulResponse({ result: "malformed" });
      },
    },
  };
  const grader = () => ({
    status: "malformed",
    reasons: ["bad output"],
    failure_categories: ["output-format"],
    manual_review_required: false,
  });

  const result = await runApprovedBatch(makeRunOptions({
    plan,
    prompts,
    store,
    adapters,
    grader,
  }));

  assert.equal(calls, 72);
  assert.equal(result.checkpoint.status, "complete");
  assert.equal(result.checkpoint.stop_reason, null);
  assert.deepEqual(result.report.review_gate, {
    required: true,
    reasons: ["malformed_plus_inconclusive_limit"],
  });
});

test("stops and retains the provider response when the grader throws", async () => {
  const plan = makePlan(2);
  const prompts = [makePrompt(1), makePrompt(2)];
  const store = new MemoryRunStore();
  const adapters = { openai: { execute: async () => successfulResponse() } };

  const result = await runApprovedBatch(makeRunOptions({
    plan,
    prompts,
    store,
    adapters,
    grader: () => {
      throw new Error("fixture assertion is invalid");
    },
  }));

  assert.equal(store.listAttempts("b01").length, 1);
  assert.equal(store.listAttempts("b01")[0].status, "response");
  assert.equal(result.checkpoint.stop_reason, "fixture_or_grader_defect");
});

test("batch report contains counts, usage, cost, resolved models, and remaining batches", async () => {
  const plan = makePlan(1);
  const prompts = [makePrompt(1)];
  const store = new MemoryRunStore();
  const adapters = {
    openai: {
      execute: async () => successfulResponse(
        { result: "ok" },
        { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
      ),
    },
  };

  const result = await runApprovedBatch(makeRunOptions({
    plan,
    prompts,
    store,
    adapters,
    priceByTarget: {
      "openai-frontier": { input: 5, output: 30 },
    },
  }));

  assert.equal(result.report.counts.attempted, 1);
  assert.equal(result.report.counts.pass, 1);
  assert.equal(result.report.usage.input_tokens, 100);
  assert.equal(result.report.usage.output_tokens, 20);
  assert.equal(result.report.cost_usd, 0.0011);
  assert.deepEqual(result.report.resolved_models, ["gpt-5.6-sol"]);
  assert.deepEqual(result.report.runner_revisions, ["test-runner-revision"]);
  assert.equal(result.report.started_at, "2026-07-31T00:00:00.000Z");
  assert.equal(result.report.ended_at, "2026-07-31T00:00:01.000Z");
  assert.deepEqual(result.report.remaining_batches, ["b02"]);
});

test("stops when actual provider usage exceeds the approved batch ceiling by twenty percent", async () => {
  const plan = makePlan(1);
  const result = await runApprovedBatch(makeRunOptions({
    plan,
    prompts: [makePrompt(1)],
    store: new MemoryRunStore(),
    adapters: {
      openai: {
        execute: async () => successfulResponse(
          { result: "ok" },
          { input_tokens: 1000, output_tokens: 1000, total_tokens: 2000 },
        ),
      },
    },
    priceByTarget: {
      "openai-frontier": { input: 5, output: 30 },
    },
    batchCostCeiling: 0.01,
  }));

  assert.equal(result.checkpoint.stop_reason, "projected_spend_limit");
});

test("file store appends logs and persists an atomic checkpoint", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v2-runs-"));
  try {
    const store = new FileRunStore(root);
    store.appendAttempt({ batch_id: "b01", run_id: "run-1", attempt_number: 1 });
    store.appendAttempt({ batch_id: "b01", run_id: "run-1", attempt_number: 2 });
    store.appendRun({ batch_id: "b01", run_id: "run-1", status: "pass" });
    store.writeCheckpoint("b01", { batch_id: "b01", status: "complete" });

    assert.equal(store.listAttempts("b01").length, 2);
    assert.equal(store.listRuns("b01").length, 1);
    assert.equal(store.readCheckpoint("b01").status, "complete");
    assert.equal(
      fs.readFileSync(path.join(root, "b01", "attempts.jsonl"), "utf8").trim().split("\n").length,
      2,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("run checker accepts a completed batch", async () => {
  const plan = makePlan(1);
  const prompts = [makePrompt(1), makePrompt(99, "b02")];
  const store = new MemoryRunStore();
  await runApprovedBatch(makeRunOptions({
    plan,
    prompts,
    store,
    adapters: { openai: { execute: async () => successfulResponse() } },
  }));

  const result = checkRunState({ plan, prompts, store });

  assert.deepEqual(result.failures, []);
  assert.equal(result.batches.find((batch) => batch.batch_id === "b01").status, "complete");
});

test("run checker rejects a report that suppresses the exceptional-output review gate", async () => {
  const plan = makePlan(20);
  const prompts = Array.from({ length: 20 }, (_, index) => makePrompt(index + 1));
  const store = new MemoryRunStore();
  const result = await runApprovedBatch(makeRunOptions({
    plan,
    prompts,
    store,
    adapters: { openai: { execute: async () => successfulResponse() } },
    grader: () => ({
      status: "inconclusive",
      reasons: ["review needed"],
      failure_categories: ["uncertainty"],
      manual_review_required: true,
    }),
  }));
  store.writeReport("b01", {
    ...result.report,
    review_gate: { required: false, reasons: [] },
  });

  const failures = checkRunState({ plan, prompts, store }).failures.join("\n");

  assert.match(failures, /report review_gate does not match run counts/);
});

test("run checker rejects duplicate attempt numbers and a false complete checkpoint", () => {
  const plan = makePlan(2);
  const prompts = [makePrompt(1), makePrompt(2), makePrompt(99, "b02")];
  const store = new MemoryRunStore();
  store.appendAttempt({
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: "b01",
    run_id: "run-1",
    attempt_number: 1,
    status: "transport_error",
  });
  store.appendAttempt({
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: "b01",
    run_id: "run-1",
    attempt_number: 1,
    status: "response",
  });
  store.appendRun({
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: "b01",
    run_id: "run-1",
    status: "pass",
  });
  store.writeCheckpoint("b01", {
    benchmark_id: plan.benchmark_id,
    plan_version: plan.plan_version,
    batch_id: "b01",
    status: "complete",
    attempt_count: 2,
    completed_run_ids: ["run-1"],
  });

  const result = checkRunState({ plan, prompts, store });
  const failures = result.failures.join("\n");

  assert.match(failures, /attempt numbers must be contiguous/);
  assert.match(failures, /complete checkpoint requires 2 run records/);
});

test("run checker rejects records without a runner revision", async () => {
  const plan = makePlan(1);
  const prompts = [makePrompt(1), makePrompt(99, "b02")];
  const store = new MemoryRunStore();
  await runApprovedBatch(makeRunOptions({
    plan,
    prompts,
    store,
    runnerRevision: null,
    adapters: { openai: { execute: async () => successfulResponse() } },
  }));

  const failures = checkRunState({ plan, prompts, store }).failures.join("\n");

  assert.match(failures, /runner_revision is required/);
});

test("OpenAI adapter uses prompt-only JSON without a provider output schema", async () => {
  const requests = [];
  const adapter = createOpenAIAdapter({
    apiKey: "test-openai-key",
    fetchImpl: fakeFetch(requests, {
      id: "resp_1",
      model: "gpt-5.6-sol",
      output: [{ content: [{ type: "output_text", text: "{\"result\":\"ok\"}" }] }],
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
    }),
  });

  const result = await adapter.execute(adapterInput("openai-frontier", "gpt-5.6-sol"));
  const body = JSON.parse(requests[0].options.body);

  assert.equal(body.reasoning.effort, "medium");
  assert.equal(body.max_output_tokens, 4096);
  assert.equal(Object.hasOwn(body, "text"), false);
  assert.equal(Object.hasOwn(body, "temperature"), false);
  assert.equal(result.content_json.result, "ok");
  assert.equal(result.usage.input_tokens, 10);
});

test("Anthropic adapter uses prompt-only JSON without a provider output schema", async () => {
  const requests = [];
  const adapter = createAnthropicAdapter({
    apiKey: "test-anthropic-key",
    fetchImpl: fakeFetch(requests, {
      id: "msg_1",
      model: "claude-sonnet-5",
      content: [{ type: "text", text: "{\"result\":\"ok\"}" }],
      usage: { input_tokens: 12, output_tokens: 3 },
    }),
  });

  const result = await adapter.execute(adapterInput("anthropic-balanced", "claude-sonnet-5"));
  const body = JSON.parse(requests[0].options.body);

  assert.deepEqual(body.thinking, { type: "adaptive" });
  assert.equal(body.max_tokens, 4096);
  assert.equal(Object.hasOwn(body, "output_config"), false);
  assert.equal(Object.hasOwn(body, "temperature"), false);
  assert.equal(result.resolved_model, "claude-sonnet-5");
});

test("Google adapter uses prompt-only JSON without a provider output schema", async () => {
  const requests = [];
  const adapter = createGoogleAdapter({
    apiKey: "test-google-key",
    fetchImpl: fakeFetch(requests, {
      id: "int_1",
      model: "gemini-3.6-flash",
      steps: [{ type: "model_output", content: [{ type: "text", text: "{\"result\":\"ok\"}" }] }],
      usage: { prompt_tokens: 14, completion_tokens: 4, total_tokens: 18 },
    }),
  });

  const result = await adapter.execute(adapterInput("google-stable-agentic", "gemini-3.6-flash"));
  const body = JSON.parse(requests[0].options.body);

  assert.equal(body.generation_config.thinking_level, "medium");
  assert.equal(body.generation_config.max_output_tokens, 4096);
  assert.equal(Object.hasOwn(body, "response_format"), false);
  assert.equal(Object.hasOwn(body.generation_config, "temperature"), false);
  assert.equal(result.usage.total_tokens, 18);
});

test("provider adapters retain successful responses without output text", async () => {
  const adapters = [
    {
      adapter: createOpenAIAdapter({
        apiKey: "test-openai-key",
        fetchImpl: fakeFetch([], { id: "resp-empty", model: "gpt-5.6-sol", output: [] }),
      }),
      input: adapterInput("openai-frontier", "gpt-5.6-sol"),
    },
    {
      adapter: createAnthropicAdapter({
        apiKey: "test-anthropic-key",
        fetchImpl: fakeFetch([], { id: "msg-empty", model: "claude-sonnet-5", content: [] }),
      }),
      input: adapterInput("anthropic-balanced", "claude-sonnet-5"),
    },
    {
      adapter: createGoogleAdapter({
        apiKey: "test-google-key",
        fetchImpl: fakeFetch([], { id: "int-empty", model: "gemini-3.6-flash", steps: [] }),
      }),
      input: adapterInput("google-stable-agentic", "gemini-3.6-flash"),
    },
  ];

  for (const { adapter, input } of adapters) {
    const response = await adapter.execute(input);
    assert.equal(response.content_text, "");
    assert.equal(response.content_json, null);
    assert.equal(response.raw_response.id.endsWith("-empty"), true);
  }
});

function makePlan(plannedRequests) {
  return {
    benchmark_id: "docai-http-openapi-comparison-v2",
    plan_version: "2.0.0-frozen.1",
    status: "frozen",
    execution: {
      maximum_attempts_per_work_step: 100,
      approval_required_after_each_batch: true,
      planned_primary_requests: plannedRequests + 1,
      batches: [
        { id: "b01", api: "complete-commerce", repetition: 1, planned_requests: plannedRequests },
        { id: "b02", api: "holdout", repetition: 1, planned_requests: 1 },
      ],
    },
    retry_policy: {
      maximum_transport_retries_per_run: 1,
      retry_only_before_usable_provider_response: true,
      content_or_grader_failure_retry: false,
      all_attempts_count_toward_step_cap: true,
      retain_all_attempts: true,
    },
    stop_rules: {
      maximum_malformed_plus_inconclusive_percent: 5,
      projected_spend_over_estimate_percent: 20,
    },
  };
}

function makePrompt(index, batchId = "b01") {
  return {
    benchmark_id: "docai-http-openapi-comparison-v2",
    plan_version: "2.0.0-frozen.1",
    run_id: `run-${index}`,
    batch_id: batchId,
    batch_ordinal: index,
    repetition: 1,
    api_id: "complete-commerce",
    task_id: `task-${index}`,
    task_class: "request-construction",
    profile: "compact",
    condition: "docai-selected",
    target: {
      id: "openai-frontier",
      provider: "openai",
      planned_model: "gpt-5.6-sol",
    },
    context: {
      media_type: "text/markdown",
      source_files: ["resources/example.md"],
    },
    prompt: {
      system: "System",
      documentation: "Documentation",
      task: "Task",
      required_output: "Output",
    },
  };
}

function makeRunOptions(overrides) {
  return {
    batchId: "b01",
    taskForPrompt: (prompt) => ({ id: prompt.task_id }),
    grader: (contentJson) => ({
      status: contentJson?.result === "ok" ? "pass" : "fail",
      reasons: contentJson?.result === "ok" ? [] : ["wrong"],
      failure_categories: contentJson?.result === "ok" ? [] : ["wrong-result"],
      manual_review_required: false,
    }),
    clock: deterministicClock(),
    priceByTarget: {},
    approvedBatchId: "b01",
    runnerRevision: "test-runner-revision",
    ...overrides,
  };
}

function successfulResponse(
  contentJson = { result: "ok" },
  usage = { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
) {
  return {
    content_json: contentJson,
    content_text: JSON.stringify(contentJson),
    usage,
    resolved_model: "gpt-5.6-sol",
    provider_request_id: "request-1",
    raw_response: { id: "request-1" },
  };
}

function deterministicClock() {
  let second = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 6, 31, 0, 0, second)).toISOString();
    second += 1;
    return value;
  };
}

function adapterInput(targetId, model) {
  return {
    prompt: makePrompt(1),
    modelResolution: {
      target_id: targetId,
      requested_model: model,
      resolved_model: model,
      request_settings: {
        json_output_mode: "prompt-only",
        reasoning_effort: "medium",
        thinking: "adaptive",
        thinking_level: "medium",
        sampling_parameters: "omitted",
        max_output_tokens: 4096,
      },
    },
  };
}

function fakeFetch(requests, responseBody, status = 200) {
  return async (url, options) => {
    requests.push({ url, options });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(responseBody),
    };
  };
}
