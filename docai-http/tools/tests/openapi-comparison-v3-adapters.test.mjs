import assert from "node:assert/strict";
import test from "node:test";

import { createAnthropicAdapter } from "../openapi-comparison-v3-anthropic-adapter.mjs";
import { createGoogleAdapter } from "../openapi-comparison-v3-google-adapter.mjs";
import { createOpenAIAdapter } from "../openapi-comparison-v3-openai-adapter.mjs";
import { buildCalibrationPromptRecords } from "../openapi-comparison-v3-prompt.mjs";
import { providerRequestId } from "../openapi-comparison-v3-provider-adapter-utils.mjs";
import {
  ProviderResponseError,
  ProviderTransportError,
} from "../openapi-comparison-v3-provider-errors.mjs";

const PROMPT = buildCalibrationPromptRecords()[0];
const SECRET = "do-not-expose-this-key";

const PROVIDERS = [
  {
    name: "OpenAI",
    create: createOpenAIAdapter,
    expectedUrl: "https://api.openai.com/v1/responses",
    response: {
      id: "resp_openai_123",
      model: "gpt-test-resolved",
      status: "completed",
      output_text: '{"answer":"openai"}',
      usage: { input_tokens: 12, output_tokens: 34 },
    },
    assertBody(body) {
      assert.deepEqual(body, {
        model: "openai-requested",
        instructions: PROMPT.prompt.system,
        input: promptUser(),
        reasoning: { effort: "medium" },
        max_output_tokens: 8192,
      });
    },
  },
  {
    name: "Anthropic",
    create: createAnthropicAdapter,
    expectedUrl: "https://api.anthropic.com/v1/messages",
    response: {
      id: "msg_anthropic_123",
      model: "claude-test-resolved",
      stop_reason: "end_turn",
      content: [{ type: "text", text: '{"answer":"anthropic"}' }],
      usage: { input_tokens: 12, output_tokens: 34 },
    },
    assertBody(body) {
      assert.deepEqual(body, {
        model: "anthropic-requested",
        max_tokens: 8192,
        system: PROMPT.prompt.system,
        messages: [{ role: "user", content: promptUser() }],
        thinking: { type: "adaptive" },
      });
    },
  },
  {
    name: "Google",
    create: createGoogleAdapter,
    expectedUrl: "https://generativelanguage.googleapis.com/v1beta/interactions",
    response: {
      requestId: "google-request-123",
      modelVersion: "gemini-test-resolved",
      stopReason: "STOP",
      output_text: '{"answer":"google"}',
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 },
    },
    assertBody(body) {
      assert.deepEqual(body, {
        model: "google-requested",
        system_instruction: PROMPT.prompt.system,
        input: promptUser(),
        generation_config: {
          thinking_level: "medium",
          max_output_tokens: 8192,
        },
      });
    },
  },
];

test("every v3 adapter sends the completion-safe provider body through injected fetch", async (t) => {
  for (const provider of PROVIDERS) {
    await t.test(provider.name, async () => {
      const calls = [];
      const adapter = provider.create({
        apiKey: SECRET,
        fetchImpl: injectedFetch(calls, provider.response),
      });

      const result = await adapter.execute({
        prompt: PROMPT,
        modelResolution: modelResolution(provider.name.toLowerCase()),
      });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, provider.expectedUrl);
      assert.equal(calls[0].options.method, "POST");
      const body = JSON.parse(calls[0].options.body);
      provider.assertBody(body);
      assertSamplingToolsGroundingAndSchemaAreDisabled(body);
      assert.deepEqual(result, {
        content_text: `{"answer":"${provider.name.toLowerCase()}"}`,
        completion: {
          complete: true,
          category: "completed",
          provider_status: provider.name === "OpenAI" ? "completed" : null,
          stop_reason: provider.name === "OpenAI" ? null : provider.name === "Anthropic" ? "end_turn" : "STOP",
        },
        usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 },
        resolved_model: provider.response.model ?? provider.response.modelVersion,
        provider_request_id: provider.response.id ?? provider.response.requestId,
        raw_response: provider.response,
      });
    });
  }
});

test("adapters preserve incomplete provider text and completion metadata", async (t) => {
  const cases = [
    {
      name: "OpenAI incomplete response",
      create: createOpenAIAdapter,
      response: {
        id: "resp_openai_incomplete",
        model: "gpt-test-resolved",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: '{"partial":',
        usage: { input_tokens: 1, output_tokens: 8192 },
      },
      expectedProviderStatus: "incomplete",
      expectedReason: "max_output_tokens",
    },
    {
      name: "Anthropic max_tokens response",
      create: createAnthropicAdapter,
      response: {
        id: "msg_anthropic_incomplete",
        model: "claude-test-resolved",
        stop_reason: "max_tokens",
        content: [{ type: "text", text: '{"partial":' }],
        usage: { input_tokens: 1, output_tokens: 8192 },
      },
      expectedProviderStatus: null,
      expectedReason: "max_tokens",
    },
    {
      name: "Google token-limit finish reason",
      create: createGoogleAdapter,
      response: {
        requestId: "google-request-incomplete",
        modelVersion: "gemini-test-resolved",
        candidates: [{
          finishReason: "MAX_TOKENS",
          content: { parts: [{ text: '{"partial":' }] },
        }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 8192 },
      },
      expectedProviderStatus: null,
      expectedReason: "MAX_TOKENS",
    },
  ];

  for (const expected of cases) {
    await t.test(expected.name, async () => {
      const calls = [];
      const result = await expected.create({
        apiKey: SECRET,
        fetchImpl: injectedFetch(calls, expected.response),
      }).execute({ prompt: PROMPT, modelResolution: modelResolution("test") });

      assert.equal(calls.length, 1);
      assert.equal(result.content_text, '{"partial":');
      assert.deepEqual(result.completion, {
        complete: false,
        category: "incomplete",
        provider_status: expected.expectedProviderStatus,
        stop_reason: expected.expectedReason,
      });
      assert.deepEqual(result.usage, { input_tokens: 1, output_tokens: 8192, total_tokens: 8193 });
      assert.equal(result.provider_request_id, expected.response.id ?? expected.response.requestId);
      assert.deepEqual(result.raw_response, expected.response);
    });
  }
});

test("adapters retain empty complete text and normalize provider-specific usage aliases", async (t) => {
  const cases = [
    [createOpenAIAdapter, { id: "openai-empty", status: "completed", usage: { prompt_tokens: 2, completion_tokens: 3 } }],
    [createAnthropicAdapter, { id: "anthropic-empty", stop_reason: "end_turn", content: [], usage: { input_token_count: 2, output_token_count: 3 } }],
    [createGoogleAdapter, { requestId: "google-empty", stopReason: "STOP", usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 } }],
  ];

  for (const [create, response] of cases) {
    await t.test(create.name, async () => {
      const result = await create({ apiKey: SECRET, fetchImpl: injectedFetch([], response) })
        .execute({ prompt: PROMPT, modelResolution: modelResolution("test") });
      assert.equal(result.content_text, "");
      assert.equal(result.completion.complete, true);
      assert.deepEqual(result.usage, { input_tokens: 2, output_tokens: 3, total_tokens: 5 });
    });
  }
});

test("adapters expose only API-key presence state", () => {
  for (const provider of PROVIDERS) {
    const present = provider.create({ apiKey: SECRET, fetchImpl: failIfCalled });
    const absent = provider.create({ fetchImpl: failIfCalled });

    assert.equal(present.api_key_status, "present", provider.name);
    assert.equal(absent.api_key_status, "absent", provider.name);
    assert.doesNotMatch(JSON.stringify(present), new RegExp(SECRET), provider.name);
    assert.doesNotMatch(JSON.stringify(absent), new RegExp(SECRET), provider.name);
  }
});

test("a missing API key prevents every adapter from reaching transport", async () => {
  for (const provider of PROVIDERS) {
    let calls = 0;
    const adapter = provider.create({
      fetchImpl: async () => {
        calls += 1;
        throw new Error("network access is forbidden in adapter tests");
      },
    });

    await assert.rejects(
      adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") }),
      /API_KEY is required/,
      provider.name,
    );
    assert.equal(calls, 0, provider.name);
  }
});

test("completion classification fails closed and preserves provider status separately from stop reason", async (t) => {
  const cases = [
    ["OpenAI failed", createOpenAIAdapter, { status: "failed", output_text: '{"partial":' }, "failed", null],
    ["OpenAI queued", createOpenAIAdapter, { status: "queued", output_text: '{"partial":' }, "queued", null],
    ["OpenAI unknown", createOpenAIAdapter, { status: "unknown", output_text: '{"partial":' }, "unknown", null],
    ["Anthropic unknown", createAnthropicAdapter, { stop_reason: "unknown", content: [{ type: "text", text: '{"partial":' }] }, null, "unknown"],
    ["Google failed", createGoogleAdapter, { status: "failed", output_text: '{"partial":' }, "failed", null],
    ["Google nonterminal", createGoogleAdapter, { status: "in_progress", output_text: '{"partial":' }, "in_progress", null],
  ];

  for (const [name, create, response, providerStatus, stopReason] of cases) {
    await t.test(name, async () => {
      const result = await create({ apiKey: SECRET, fetchImpl: injectedFetch([], response) })
        .execute({ prompt: PROMPT, modelResolution: modelResolution("test") });
      assert.deepEqual(result.completion, {
        complete: false,
        category: "incomplete",
        provider_status: providerStatus,
        stop_reason: stopReason,
      });
    });
  }
});

test("Google Interactions status, partial text, and token totals use the actual response fields", async () => {
  const response = {
    id: "interaction-header-independent-id",
    status: "completed",
    usage: {
      total_tokens: 4793,
      total_input_tokens: 1843,
      total_output_tokens: 645,
    },
    steps: [{ content: [{ type: "text", text: '{"answer":"interaction"}' }] }],
  };
  const incomplete = {
    id: "interaction-incomplete-id",
    status: "incomplete",
    usage: { total_input_tokens: 3, total_output_tokens: 4 },
    steps: [{ content: [{ type: "text", text: '{"partial":' }] }],
  };
  const adapter = createGoogleAdapter({ apiKey: SECRET, fetchImpl: injectedFetch([], response) });
  const incompleteAdapter = createGoogleAdapter({ apiKey: SECRET, fetchImpl: injectedFetch([], incomplete) });

  const completedResult = await adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") });
  const incompleteResult = await incompleteAdapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") });

  assert.equal(completedResult.content_text, '{"answer":"interaction"}');
  assert.deepEqual(completedResult.completion, {
    complete: true,
    category: "completed",
    provider_status: "completed",
    stop_reason: null,
  });
  assert.deepEqual(completedResult.usage, { input_tokens: 1843, output_tokens: 645, total_tokens: 4793 });
  assert.equal(incompleteResult.content_text, '{"partial":');
  assert.deepEqual(incompleteResult.completion, {
    complete: false,
    category: "incomplete",
    provider_status: "incomplete",
    stop_reason: null,
  });
  assert.deepEqual(incompleteResult.usage, { input_tokens: 3, output_tokens: 4, total_tokens: 7 });
});

test("v3 transport errors deeply redact keys and classify fetch and body-read failures as retryable", async (t) => {
  const fetchFailure = createOpenAIAdapter({
    apiKey: SECRET,
    fetchImpl: async () => { throw new Error(`fetch failed with ${SECRET}`); },
  });
  const bodyFailure = createOpenAIAdapter({
    apiKey: SECRET,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      async text() { throw new Error(`body read failed with ${SECRET}`); },
    }),
  });

  for (const [name, adapter] of [["fetch", fetchFailure], ["body read", bodyFailure]]) {
    await t.test(name, async () => {
      await assert.rejects(
        adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") }),
        (error) => {
          assert.equal(error instanceof ProviderTransportError, true);
          assert.equal(error.category, "transport_error");
          assert.equal(error.retryable, true);
          assert.equal(error.usable_response, false);
          assert.equal(Object.hasOwn(error, "cause"), false);
          assertSecretIsAbsent(error);
          return true;
        },
      );
    });
  }
});

test("v3 provider errors redact nested bodies and retain header-only request IDs", async () => {
  const adapter = createOpenAIAdapter({
    apiKey: SECRET,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      headers: new Headers({ "x-request-id": "header-request-id" }),
      async text() {
        return JSON.stringify({
          message: `denied ${SECRET}`,
          nested: [{ value: SECRET }],
          [`key-${SECRET}`]: "also-secret",
        });
      },
    }),
  });

  await assert.rejects(
    adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") }),
    (error) => {
      assert.equal(error instanceof ProviderResponseError, true);
      assert.equal(error.category, "authentication_error");
      assert.equal(error.provider_request_id, "header-request-id");
      assertSecretIsAbsent(error);
      return true;
    },
  );
});

test("provider errors redact API-key-bearing body and header request IDs across their complete enumerable graph", async (t) => {
  const cases = [
    {
      name: "HTTP error body ID",
      response: {
        ok: false,
        status: 401,
        headers: new Headers({ "x-request-id": "ordinary-header-id" }),
        async text() { return JSON.stringify({ id: `body-${SECRET}`, message: "denied" }); },
      },
      expectedId: "body-<redacted>",
      category: "authentication_error",
    },
    {
      name: "HTTP error header ID",
      response: {
        ok: false,
        status: 401,
        headers: new Headers({ "x-request-id": `header-${SECRET}` }),
        async text() { return JSON.stringify({ message: "denied" }); },
      },
      expectedId: "header-<redacted>",
      category: "authentication_error",
    },
    {
      name: "successful HTTP malformed response header ID",
      response: {
        ok: true,
        status: 200,
        headers: new Headers({ "x-request-id": `malformed-${SECRET}` }),
        async text() { return "not JSON"; },
      },
      expectedId: "malformed-<redacted>",
      category: "provider_response_format",
    },
  ];

  for (const expected of cases) {
    await t.test(expected.name, async () => {
      const adapter = createOpenAIAdapter({
        apiKey: SECRET,
        fetchImpl: async () => expected.response,
      });

      await assert.rejects(
        adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") }),
        (error) => {
          assert.equal(error instanceof ProviderResponseError, true);
          assert.equal(error.category, expected.category);
          assert.equal(error.provider_request_id, expected.expectedId);
          assertSecretIsAbsent(error);
          return true;
        },
      );
    });
  }
});

test("request ID extraction accepts only normalized scalar audit IDs", () => {
  const cases = [
    ["ordinary string", "request-123", "request-123"],
    ["finite number", 123, "123"],
    ["empty string", "", null],
    ["boolean", true, null],
    ["array", [SECRET], null],
    ["object", { nested: SECRET }, null],
    ["NaN", Number.NaN, null],
    ["infinity", Infinity, null],
  ];

  for (const [name, id, expected] of cases) {
    assert.equal(providerRequestId({ id }), expected, name);
  }
});

test("request ID extraction skips invalid candidates in body and header precedence order", () => {
  const cases = [
    {
      name: "request_id after empty id",
      body: { id: "", request_id: "snake-id", requestId: "camel-id" },
      headers: { "x-request-id": "header-id" },
      expected: "snake-id",
    },
    {
      name: "requestId after invalid earlier body aliases",
      body: { id: false, request_id: { invalid: true }, requestId: 42 },
      headers: { "x-request-id": "header-id" },
      expected: "42",
    },
    {
      name: "header after invalid body aliases",
      body: { id: [], request_id: Number.NaN, requestId: Infinity },
      headers: { "x-request-id": "header-id" },
      expected: "header-id",
    },
    {
      name: "later header after invalid earlier headers",
      body: {},
      headers: {
        "x-request-id": false,
        "request-id": [],
        "x-goog-request-id": "google-header-id",
      },
      expected: "google-header-id",
    },
  ];

  for (const { name, body, headers, expected } of cases) {
    assert.equal(providerRequestId(body, headers), expected, name);
  }
});

test("object and array request IDs are absent from complete serialized provider-error and success results", async (t) => {
  const values = [
    ["object", { nested: SECRET }],
    ["array", [SECRET]],
  ];
  const fields = ["id", "request_id", "requestId"];

  for (const [kind, value] of values) {
    for (const field of fields) {
      await t.test(`provider error ${field} ${kind}`, async () => {
        const adapter = createOpenAIAdapter({
          apiKey: SECRET,
          fetchImpl: injectedFetch([], { [field]: value, message: "denied" }, {}, 401),
        });
        await assert.rejects(
          adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") }),
          (error) => {
            assert.equal(error instanceof ProviderResponseError, true);
            assert.equal(error.provider_request_id, null);
            assertSecretIsAbsent(error);
            return true;
          },
        );
      });

      await t.test(`successful response ${field} ${kind}`, async () => {
        const adapter = createOpenAIAdapter({
          apiKey: SECRET,
          fetchImpl: injectedFetch([], {
            [field]: value,
            status: "completed",
            output_text: "{}",
          }),
        });
        const result = await adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") });

        assert.equal(result.provider_request_id, null);
        assertSecretIsAbsent(result);
      });
    }
  }
});

test("successful responses skip invalid request ID candidates and retain the first valid fallback", async (t) => {
  const cases = [
    {
      name: "request_id after empty id",
      ids: { id: "", request_id: "success-snake-id", requestId: "ignored-camel-id" },
      headers: { "x-request-id": "ignored-header-id" },
      expected: "success-snake-id",
    },
    {
      name: "requestId after boolean and object aliases",
      ids: { id: false, request_id: { nested: SECRET }, requestId: 84 },
      headers: { "x-request-id": "ignored-header-id" },
      expected: "84",
    },
    {
      name: "header after invalid body aliases",
      ids: { id: [SECRET], request_id: {}, requestId: null },
      headers: { "x-request-id": "success-header-id" },
      expected: "success-header-id",
    },
  ];

  for (const expected of cases) {
    await t.test(expected.name, async () => {
      const adapter = createOpenAIAdapter({
        apiKey: SECRET,
        fetchImpl: injectedFetch([], {
          ...expected.ids,
          status: "completed",
          output_text: "{}",
        }, expected.headers),
      });
      const result = await adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") });

      assert.equal(result.provider_request_id, expected.expected);
      assertSecretIsAbsent(result);
    });
  }
});

test("provider errors skip invalid request ID candidates and redact the selected fallback", async (t) => {
  const cases = [
    {
      name: "request_id after empty id",
      ids: { id: "", request_id: `error-${SECRET}`, requestId: "ignored-camel-id" },
      headers: { "x-request-id": "ignored-header-id" },
      expected: "error-<redacted>",
    },
    {
      name: "requestId after boolean and object aliases",
      ids: { id: false, request_id: { nested: SECRET }, requestId: 84 },
      headers: { "x-request-id": "ignored-header-id" },
      expected: "84",
    },
    {
      name: "header after invalid body aliases",
      ids: { id: [SECRET], request_id: {}, requestId: null },
      headers: { "x-request-id": `header-${SECRET}` },
      expected: "header-<redacted>",
    },
  ];

  for (const expected of cases) {
    await t.test(expected.name, async () => {
      const adapter = createOpenAIAdapter({
        apiKey: SECRET,
        fetchImpl: injectedFetch([], {
          ...expected.ids,
          message: "denied",
        }, expected.headers, 401),
      });

      await assert.rejects(
        adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") }),
        (error) => {
          assert.equal(error instanceof ProviderResponseError, true);
          assert.equal(error.provider_request_id, expected.expected);
          assertSecretIsAbsent(error);
          return true;
        },
      );
    });
  }
});

test("successful responses retain a header-only request ID", async () => {
  const adapter = createOpenAIAdapter({
    apiKey: SECRET,
    fetchImpl: injectedFetch([], { status: "completed", output_text: "{}" }, {
      "x-request-id": "header-success-id",
    }),
  });
  const result = await adapter.execute({ prompt: PROMPT, modelResolution: modelResolution("test") });

  assert.equal(result.provider_request_id, "header-success-id");
});

function promptUser() {
  return [
    "# Documentation",
    "",
    PROMPT.prompt.documentation.trimEnd(),
    "",
    "# Task",
    "",
    PROMPT.prompt.task,
    "",
    "# Required Output",
    "",
    PROMPT.prompt.required_output,
  ].join("\n");
}

function modelResolution(provider) {
  return {
    requested_model: `${provider}-requested`,
    resolved_model: `${provider}-fallback`,
    request_settings: {
      max_output_tokens: 1,
      reasoning_effort: "low",
      thinking: "enabled",
      thinking_level: "low",
    },
  };
}

function injectedFetch(calls, response, headers = {}, status = 200) {
  return async (url, options) => {
    calls.push({ url, options });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(headers),
      async text() { return JSON.stringify(response); },
    };
  };
}

function failIfCalled() {
  throw new Error("network access is forbidden in adapter tests");
}

function assertSamplingToolsGroundingAndSchemaAreDisabled(body) {
  [
    "temperature",
    "top_p",
    "top_k",
    "tools",
    "tool_choice",
    "tool_config",
    "grounding",
    "response_format",
    "response_schema",
    "response_mime_type",
  ].forEach((field) => assert.equal(Object.hasOwn(body, field), false, field));
}

function assertSecretIsAbsent(value) {
  if (typeof value?.message === "string") {
    assert.doesNotMatch(value.message, new RegExp(SECRET));
  }
  assert.doesNotMatch(JSON.stringify(value), new RegExp(SECRET));
  assert.doesNotMatch(JSON.stringify(Object.fromEntries(Object.entries(value))), new RegExp(SECRET));
  assert.doesNotMatch(JSON.stringify(value?.response_body ?? null), new RegExp(SECRET));
}
