import assert from "node:assert/strict";
import test from "node:test";
import { documentedNativeResponse } from "./calibration4-evidence-helpers.mjs";

import { createAnthropicAdapter } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/anthropic-adapter.mjs";
import { createGoogleAdapter } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/google-adapter.mjs";
import { createOpenAIAdapter } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/openai-adapter.mjs";
import {
  ProviderResponseError,
  ProviderTransportError,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/provider-errors.mjs";
import { buildCalibrationPrompts } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/prompt.mjs";
import { readTaskPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/contract.mjs";
import { readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/paths.mjs";
import { promptMessages } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/prompt.mjs";

const SECRET = "calibration4-test-secret";
const plan = readPlan();
const prompt = buildCalibrationPrompts({ plan, packet: readTaskPacket(plan) })[0];

test("fix1 Google documented thought summaries and signatures never enter final model-output text", async () => {
  const raw = documentedNativeResponse("google", "gemini-3.8-flash", "final answer");
  raw.steps[2].content = [{ type: "text", text: "final" }, { type: "text", text: "answer" }];
  const adapter = createGoogleAdapter({ apiKey: SECRET, fetchImpl: async () => response(raw) });
  const result = await adapter.execute({ prompt, modelResolution: { requested_model: "gemini-3.8-flash", resolved_model: "gemini-3.8-flash" } });
  assert.equal(result.content_text, "final\nanswer");
  assert.equal(result.usage.output_tokens, 2); assert.equal(result.usage.reasoning_tokens, 1);
  assert.deepEqual(result.raw_response, raw);
});

test("sends exact payload/headers with 16384 cap and preserved reasoning, synthetic resolutions only", async () => {
  const messages = promptMessages(prompt);
  for (const model of providers.map(p => resolution(p.name.toLowerCase()))) {
    const provider = providers.find((row) => row.name.toLowerCase() === model.provider);
    let body, headers;
    await provider.create({ apiKey: SECRET, fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      headers = options.headers;
      assert.equal(options.method, "POST");
      return response(provider.response);
    } }).execute({ prompt, modelResolution: model });
    assert.equal(body.model, model.requested_model);
    for (const field of ["temperature", "top_p", "top_k", "tools", "response_format"]) assert.equal(Object.hasOwn(body, field), false, field);
    if (model.provider === "openai") {
      assert.deepEqual(body, { model: model.requested_model, instructions: messages[0].content, input: messages[1].content,
        reasoning: { effort: "medium" }, max_output_tokens: 16384 });
      assert.deepEqual(headers, { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" });
    } else if (model.provider === "anthropic") {
      assert.deepEqual(body, { model: model.requested_model, system: messages[0].content,
        messages: [{ role: "user", content: messages[1].content }], thinking: { type: "adaptive" }, max_tokens: 16384 });
      assert.deepEqual(headers, { "x-api-key": SECRET, "Content-Type": "application/json", "anthropic-version": "2023-06-01" });
    } else {
      assert.deepEqual(body, { model: model.requested_model, system_instruction: messages[0].content, input: messages[1].content,
        generation_config: { max_output_tokens: 16384, thinking_level: "medium" } });
      assert.deepEqual(headers, { "x-goog-api-key": SECRET, "Content-Type": "application/json" });
      assert.equal(Object.hasOwn(body, "grounding"), false);
    }
  }
});

const providers = [
  {
    name: "OpenAI",
    create: createOpenAIAdapter,
    url: "https://api.openai.com/v1/responses",
    response: { id: "openai-id", model: "openai-model", status: "completed", output_text: "{}", usage: { input_tokens: 1, output_tokens: 2, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } } },
  },
  {
    name: "Anthropic",
    create: createAnthropicAdapter,
    url: "https://api.anthropic.com/v1/messages",
    response: { id: "anthropic-id", model: "anthropic-model", stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 2 } },
  },
  {
    name: "Google",
    create: createGoogleAdapter,
    url: "https://generativelanguage.googleapis.com/v1beta/interactions",
    response: { requestId: "google-id", modelVersion: "google-model", status: "completed", output_text: "{}", usage: { total_input_tokens: 1, total_output_tokens: 1, total_thought_tokens: 1, total_cached_tokens: 0, total_tool_use_tokens: 0 } },
  },
];

test("calibration.4 adapters use injected fetch and normalize complete responses", async (t) => {
  for (const provider of providers) {
    await t.test(provider.name, async () => {
      const calls = [];
      const result = await provider.create({
        apiKey: SECRET,
        fetchImpl: async (url, options) => {
          calls.push({ url, options });
          return response(provider.response);
        },
      }).execute({ prompt, modelResolution: resolution(provider.name.toLowerCase()) });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, provider.url);
      assert.equal(result.content_text, "{}");
      assert.equal(result.usage.usage_version, "2");
      assert.equal(result.usage.input_tokens, 1);
      assert.equal(result.usage.output_tokens, 2);
      assert.equal(result.usage.total_tokens, 3);
      assert.equal(result.usage.accounting_status, "complete");
      assert.deepEqual(result.raw_response, provider.response);
      assert.equal(result.completion.complete, true);
      assert.doesNotMatch(JSON.stringify(result), new RegExp(SECRET));
    });
  }
});

test("adapters reject absent API keys before transport", async (t) => {
  for (const provider of providers) {
    await t.test(provider.name, async () => {
      let calls = 0;
      const adapter = provider.create({ fetchImpl: async () => { calls += 1; throw new Error("unexpected transport"); } });
      await assert.rejects(adapter.execute({ prompt, modelResolution: resolution("test") }), /API_KEY is required/);
      assert.equal(calls, 0);
    });
  }
});

test("OpenAI sends the configured credential while exposing presence only", async () => {
  let authorization = null;
  const adapter = createOpenAIAdapter({
    apiKey: SECRET,
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return response(providers[0].response);
    },
  });
  const result = await adapter.execute({ prompt, modelResolution: resolution("openai") });
  assert.equal(adapter.api_key_status, "present");
  assert.equal(authorization, `Bearer ${SECRET}`);
  assert.equal(JSON.stringify({ api_key_status: adapter.api_key_status, result }).includes(SECRET), false);
});

test("adapter errors are redacted and retain calibration.1-compatible status shapes", async () => {
  const transport = createOpenAIAdapter({
    apiKey: SECRET,
    fetchImpl: async () => { throw new Error(`network ${SECRET}`); },
  });
  await assert.rejects(
    transport.execute({ prompt, modelResolution: resolution("test") }),
    (error) => error instanceof ProviderTransportError
      && error.name === "ProviderTransportError"
      && error.category === "transport_error"
      && error.retryable === true
      && error.usable_response === false
      && !JSON.stringify(error).includes(SECRET),
  );

  const provider = createOpenAIAdapter({
    apiKey: SECRET,
    fetchImpl: async () => response({ message: SECRET, nested: { value: SECRET } }, 401, { "x-request-id": `id-${SECRET}` }),
  });
  await assert.rejects(
    provider.execute({ prompt, modelResolution: resolution("test") }),
    (error) => error instanceof ProviderResponseError
      && error.name === "ProviderResponseError"
      && error.category === "authentication_error"
      && error.retryable === false
      && error.usable_response === true
      && !JSON.stringify(error).includes(SECRET),
  );
});

test("incomplete and unknown stop reasons retain usage and original status without retry", async () => {
  for (const provider of providers) {
    for (const stop of ["max_tokens", "new_unknown_stop"]) {
      let calls = 0;
      const native = { ...provider.response, status: "incomplete", stop_reason: stop, incomplete_details: { reason: stop } };
      const result = await provider.create({ apiKey: SECRET, fetchImpl: async () => { calls++; return response(native); } })
        .execute({ prompt, modelResolution: resolution(provider.name.toLowerCase()) });
      assert.equal(calls, 1);
      assert.equal(result.completion.complete, false);
      assert.equal(result.completion.provider_status, "incomplete");
      assert.equal(result.completion.stop_reason, stop);
      assert.equal(result.usage.accounting_status, "complete");
      assert.deepEqual(result.raw_response, native);
    }
  }
});

test("HTTP failures preserve supplied usage and provider completion separately from error classification", async () => {
  for (const provider of providers) {
    let calls = 0;
    const native = { ...provider.response, status: "failed", stop_reason: "unknown_but_retained", message: SECRET };
    await assert.rejects(provider.create({ apiKey: SECRET, fetchImpl: async () => { calls++; return response(native, 429); } })
      .execute({ prompt, modelResolution: resolution(provider.name.toLowerCase()) }), error => {
      assert.ok(error instanceof ProviderResponseError);
      assert.equal(error.category, "rate_limit");
      assert.equal(error.stop_reason, "rate_limit");
      assert.equal(error.completion.provider_status, "failed");
      assert.equal(error.completion.stop_reason, "unknown_but_retained");
      assert.equal(error.completion.complete, false);
      assert.equal(error.usage.usage_version, "2");
      assert.equal(error.usage.total_tokens, 3);
      assert.equal(error.raw_response.message, "<redacted>");
      assert.deepEqual(error.response_body, error.raw_response);
      assert.equal(error.retryable, false);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test("missing/invalid response usage is retained as typed accounting failure", async () => {
  for (const nativeUsage of [null, { input_tokens: -1, output_tokens: 2 }]) {
    const native = { ...providers[0].response, usage: nativeUsage };
    const result = await createOpenAIAdapter({ apiKey: SECRET, fetchImpl: async () => response(native) })
      .execute({ prompt, modelResolution: resolution("openai") });
    assert.equal(result.usage.accounting_status, nativeUsage === null ? "unknown" : "invalid");
    assert.deepEqual(result.raw_response.usage, nativeUsage);
    assert.equal(result.completion.complete, true);
  }
});

test("adapter factories reject hostile construction input before observable coercion", () => {
  for (const provider of providers) {
    const { proxy, calls } = countedProxy({});
    assert.throws(() => provider.create(proxy), /Proxy/);
    assert.equal(calls(), 0);
    assert.throws(() => provider.create({ apiKey: new String("unsafe") }), /string/);
  }
});

test("contradictory completion signals and unknown stops cannot report complete", async () => {
  for (const provider of providers) {
    const native = { ...provider.response, status: "completed", stop_reason: "new_unknown_stop", incomplete_details: { reason: "new_unknown_stop" } };
    const result = await provider.create({ apiKey: SECRET, fetchImpl: async () => response(native) })
      .execute({ prompt, modelResolution: resolution(provider.name.toLowerCase()) });
    assert.equal(result.completion.complete, false);
    assert.equal(result.completion.provider_status, "completed");
    assert.equal(result.completion.stop_reason, "new_unknown_stop");
  }
});

test("multiple Google usage envelopes are ambiguous, never silently accepted", async () => {
  const native = { ...providers[2].response, usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 900 } };
  const result = await createGoogleAdapter({ apiKey: SECRET, fetchImpl: async () => response(native) })
    .execute({ prompt, modelResolution: resolution("google") });
  assert.equal(result.usage.accounting_status, "unknown");
  assert.ok(result.usage.issues.some(issue => /ambiguous/.test(issue)));
  assert.deepEqual(result.raw_response, native);
});

test("fix1 all populated stop aliases and candidate stops participate in completion", async (t) => {
  const cases = [
    { stop_reason: "STOP", stopReason: "MAX_TOKENS" },
    { stop_reason: "STOP", candidates: [{ finishReason: "MAX_TOKENS" }] },
    { stopReason: "STOP", candidates: [{ finishReason: "MAX_TOKENS" }] },
    { stop_reason: "STOP", candidates: [{ finishReason: "STOP" }, { finishReason: "MAX_TOKENS" }] },
    { stop_reason: "STOP", stopReason: "unrecognized_stop" },
    { incomplete_details: { reason: "STOP" }, stop_reason: "MAX_TOKENS" },
  ];
  for (const signals of cases) {
    await t.test(JSON.stringify(signals), async () => {
      let calls = 0;
      const native = { ...providers[2].response, ...signals };
      const result = await createGoogleAdapter({ apiKey: SECRET, fetchImpl: async () => { calls++; return response(native); } })
        .execute({ prompt, modelResolution: resolution("google") });
      assert.equal(result.completion.complete, false, JSON.stringify(signals));
      assert.equal(result.completion.category, "incomplete");
      assert.equal(result.completion.provider_status, "completed");
      assert.equal(result.completion.stop_reason, "STOP");
      assert.deepEqual(result.raw_response, native);
      assert.equal(calls, 1);
    });
  }
});

test("fix1 agreeing completion aliases keep success and deterministic primary evidence", async () => {
  for (const signals of [
    { stop_reason: "STOP", stopReason: "STOP", candidates: [{ finishReason: "STOP" }, { finishReason: "STOP" }] },
    { stop_reason: null, stopReason: "STOP", candidates: [{ finishReason: "STOP" }] },
    { candidates: [{ finishReason: "STOP" }] },
  ]) {
    const native = { ...providers[2].response, ...signals };
    const result = await createGoogleAdapter({ apiKey: SECRET, fetchImpl: async () => response(native) })
      .execute({ prompt, modelResolution: resolution("google") });
    assert.equal(result.completion.complete, true);
    assert.equal(result.completion.stop_reason, "STOP");
    assert.deepEqual(result.raw_response, native);
  }
});

test("fix1 distinct accepted Anthropic stop aliases conflict rather than erase evidence", async () => {
  const native = { ...providers[1].response, stop_reason: "end_turn", stopReason: "stop_sequence" };
  const result = await createAnthropicAdapter({ apiKey: SECRET, fetchImpl: async () => response(native) })
    .execute({ prompt, modelResolution: resolution("anthropic") });
  assert.equal(result.completion.complete, false);
  assert.equal(result.completion.stop_reason, "end_turn");
  assert.deepEqual(result.raw_response, native);
});

function response(body, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    async text() { return JSON.stringify(body); },
  };
}

function resolution(name) {
  return { provider: name, requested_model: `${name}-requested`, resolved_model: `${name}-model` };
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
