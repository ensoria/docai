import assert from "node:assert/strict";
import test from "node:test";

import { createAnthropicAdapter } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/anthropic-adapter.mjs";
import { createGoogleAdapter } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/google-adapter.mjs";
import { createOpenAIAdapter } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/openai-adapter.mjs";
import {
  ProviderResponseError,
  ProviderTransportError,
} from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/provider-errors.mjs";
import { buildCalibrationPrompts } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/prompt.mjs";
import { readTaskPacket } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/contract.mjs";
import { readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";

const SECRET = "calibration2-test-secret";
const plan = readPlan();
const prompt = buildCalibrationPrompts({ plan, packet: readTaskPacket(plan) })[0];

const providers = [
  {
    name: "OpenAI",
    create: createOpenAIAdapter,
    url: "https://api.openai.com/v1/responses",
    response: { id: "openai-id", model: "openai-model", status: "completed", output_text: "{}", usage: { input_tokens: 1, output_tokens: 2 } },
  },
  {
    name: "Anthropic",
    create: createAnthropicAdapter,
    url: "https://api.anthropic.com/v1/messages",
    response: { id: "anthropic-id", model: "anthropic-model", stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1, output_tokens: 2 } },
  },
  {
    name: "Google",
    create: createGoogleAdapter,
    url: "https://generativelanguage.googleapis.com/v1beta/interactions",
    response: { requestId: "google-id", modelVersion: "google-model", stopReason: "STOP", output_text: "{}", usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 } },
  },
];

test("calibration.2 adapters use injected fetch and normalize complete responses", async (t) => {
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
      assert.deepEqual(result.usage, { input_tokens: 1, output_tokens: 2, total_tokens: 3 });
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

test("adapter factories reject hostile construction input before observable coercion", () => {
  for (const provider of providers) {
    const { proxy, calls } = countedProxy({});
    assert.throws(() => provider.create(proxy), /Proxy/);
    assert.equal(calls(), 0);
    assert.throws(() => provider.create({ apiKey: new String("unsafe") }), /string/);
  }
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
  return { requested_model: `${name}-requested`, resolved_model: `${name}-model` };
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
