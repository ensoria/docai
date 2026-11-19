import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProviderUsage, validateUsageLedger } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/provider-usage.mjs";

const normalize = (provider, nativeUsage) => normalizeProviderUsage({ provider, nativeUsage });
const openai = () => ({ input_tokens: 100, output_tokens: 100, total_tokens: 200,
  input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 80 } });
const anthropic = () => ({ input_tokens: 100, cache_creation_input_tokens: 30, cache_read_input_tokens: 70, output_tokens: 20 });
const google = () => ({ total_input_tokens: 100, total_output_tokens: 20, total_thought_tokens: 80, total_tokens: 200, total_cached_tokens: 0, total_tool_use_tokens: 0 });

test("Google final 20 plus thoughts 80 is generated 100, total 200", () => {
  const usage = normalize("google", google());
  assert.equal(usage.usage_version, "2");
  assert.equal(usage.input_tokens, 100);
  assert.equal(usage.output_tokens, 100);
  assert.equal(usage.final_output_tokens, 20);
  assert.equal(usage.reasoning_tokens, 80);
  assert.equal(usage.reasoning_in_output, false);
  assert.equal(usage.total_tokens, 200);
  assert.equal(usage.native_total_tokens, 200);
  assert.equal(usage.total_provenance, "native");
  assert.equal(usage.accounting_status, "complete");
  assert.deepEqual(validateUsageLedger(usage), { valid: true, issues: [] });
});

test("Anthropic uncached 100 plus write 30 plus read 70 is input 200, total 220", () => {
  const native = anthropic();
  const original = structuredClone(native);
  const usage = normalize("anthropic", native);
  assert.equal(usage.input_tokens, 200);
  assert.equal(usage.output_tokens, 20);
  assert.equal(usage.total_tokens, 220);
  assert.equal(usage.native_total_tokens, null);
  assert.equal(usage.total_provenance, "derived");
  assert.equal(usage.reasoning_in_output, true);
  assert.equal(usage.reasoning_tokens, null);
  assert.equal(usage.final_output_tokens, null);
  assert.deepEqual(usage.input_components, [
    { kind: "uncached", tokens: 100, ttl_seconds: null, pricing_key: "input_uncached" },
    { kind: "cache-read", tokens: 70, ttl_seconds: null, pricing_key: "input_cache_read" },
    { kind: "cache-write", tokens: 30, ttl_seconds: 300, pricing_key: "input_cache_write_300s" },
  ]);
  assert.equal(usage.accounting_status, "complete");
  assert.deepEqual(native, original);
});

test("OpenAI output 100 already contains reasoning 80, never total 280", () => {
  const usage = normalize("openai", openai());
  assert.equal(usage.output_tokens, 100);
  assert.equal(usage.reasoning_tokens, 80);
  assert.equal(usage.final_output_tokens, 20);
  assert.equal(usage.reasoning_in_output, true);
  assert.equal(usage.total_tokens, 200);
  assert.equal(usage.accounting_status, "complete");
});

test("OpenAI read/write subsets are disjoint; aggregate writes are not charged again", () => {
  const native = openai();
  native.input_tokens_details = { cached_tokens: 40, cache_write_tokens: 50,
    cache_write_tokens_details: { ttl_30m_tokens: 20, ttl_12h_tokens: 30 } };
  const usage = normalize("openai", native);
  assert.deepEqual(usage.input_components.map(c => [c.kind, c.tokens, c.ttl_seconds]), [
    ["uncached", 10, null], ["cache-read", 40, null], ["cache-write", 20, 1800], ["cache-write", 30, 43200],
  ]);
  assert.equal(usage.accounting_status, "complete");
  delete native.input_tokens_details.cache_write_tokens_details;
  assert.equal(normalize("openai", native).input_components[2].ttl_seconds, 1800);
});

test("Anthropic duration breakdown replaces, not adds to, aggregate writes", () => {
  const native = { ...anthropic(), cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 20 } };
  const usage = normalize("anthropic", native);
  assert.equal(usage.input_tokens, 200);
  assert.deepEqual(usage.input_components.slice(2).map(c => [c.tokens, c.ttl_seconds]), [[10, 300], [20, 3600]]);
  assert.equal(usage.accounting_status, "complete");
  native.cache_creation.ephemeral_1h_input_tokens = 21;
  assert.equal(normalize("anthropic", native).accounting_status, "invalid");
});

test("Google generateContent counts use the same reviewed inclusion relationship", () => {
  const usage = normalize("google", { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 80,
    totalTokenCount: 200, cachedContentTokenCount: 25, toolUsePromptTokenCount: 0 });
  assert.equal(usage.output_tokens, 100);
  assert.deepEqual(usage.input_components.map(c => c.tokens), [75, 25]);
  assert.equal(usage.accounting_status, "complete");
});

for (const [provider, fixture, field] of [["openai", openai, "input_tokens"], ["anthropic", anthropic, "cache_read_input_tokens"], ["google", google, "total_thought_tokens"]]) {
  for (const bad of [-1, 1.5, Infinity, NaN, "10", {}, Number.MAX_SAFE_INTEGER + 1]) {
    test(`${provider} rejects invalid ${field}: ${String(bad)}`, () => {
      const usage = normalize(provider, { ...fixture(), [field]: bad });
      assert.equal(usage.accounting_status, "invalid");
      assert.ok(usage.issues.length > 0);
      assert.equal(validateUsageLedger(usage).valid, false);
    });
  }
  test(`${provider} missing counters stay unknown instead of becoming zero`, () => {
    const native = fixture();
    delete native[field];
    const usage = normalize(provider, native);
    assert.equal(usage.accounting_status, "unknown");
    assert.ok(usage.issues.length > 0);
    assert.equal(validateUsageLedger(usage).valid, true);
  });
}

test("missing usage is typed unknown; explicit zero is complete", () => {
  for (const provider of ["openai", "anthropic", "google"]) {
    const missing = normalizeProviderUsage({ provider });
    assert.equal(missing.input_tokens, null);
    assert.equal(missing.output_tokens, null);
    assert.equal(missing.total_provenance, "unknown");
    assert.equal(missing.accounting_status, "unknown");
  }
  const usage = normalize("openai", { input_tokens: 0, output_tokens: 0, total_tokens: 0,
    input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } });
  assert.equal(usage.accounting_status, "complete");
  assert.equal(usage.output_tokens, 0);
  assert.equal(usage.reasoning_tokens, null);
});

test("absent native total is derived; inconsistent total, subset and overflow are invalid", () => {
  const native = openai();
  delete native.total_tokens;
  assert.equal(normalize("openai", native).total_provenance, "derived");
  for (const nativeUsage of [
    { ...openai(), total_tokens: 280 },
    { ...openai(), input_tokens_details: { cached_tokens: 90, cache_write_tokens: 20 } },
    { ...openai(), output_tokens_details: { reasoning_tokens: 101 } },
    { ...openai(), input_tokens: Number.MAX_SAFE_INTEGER },
    { ...openai(), input_tokens_details: { cached_tokens: 0, cache_write_tokens: 5, cache_write_tokens_details: { ttl_30m_tokens: 2, ttl_12h_tokens: 2 } } },
  ]) assert.equal(normalize("openai", nativeUsage).accounting_status, "invalid");
});

test("unsupported billing fields, ambiguous Google aliases and tool usage block acceptance", () => {
  for (const [provider, nativeUsage] of [
    ["openai", { ...openai(), input_tokens_details: { ...openai().input_tokens_details, new_billable_tokens: 3 } }],
    ["anthropic", { ...anthropic(), server_tool_use: { web_search_requests: 1 } }],
    ["google", { ...google(), total_tool_use_tokens: 3 }],
    ["google", { ...google(), promptTokenCount: 100 }],
  ]) assert.notEqual(normalize(provider, nativeUsage).accounting_status, "complete");
});

test("ledger validation rejects legacy, tampered policy/components, and false complete claims", () => {
  assert.equal(validateUsageLedger({ input_tokens: 1, output_tokens: 2, total_tokens: 3 }).valid, false);
  const usage = normalize("openai", openai());
  for (const change of [
    { policy_id: "unreviewed" }, { usage_version: "1" }, { total_tokens: 280 },
    { issues: ["unresolved"], accounting_status: "complete" }, { reasoning_in_output: false },
    { input_components: [...usage.input_components, usage.input_components[0]] },
    { input_components: [{ ...usage.input_components[0], pricing_key: "output" }] },
  ]) assert.equal(validateUsageLedger({ ...usage, ...change }).valid, false);
  const unknown = normalize("openai", { input_tokens: 100, output_tokens: 20 });
  assert.equal(validateUsageLedger({ ...unknown, issues: [], accounting_status: "complete" }).valid, false);
});

test("hostile inputs fail before getters, Proxy traps, or coercion", () => {
  let calls = 0;
  const proxy = new Proxy({}, { get() { calls++; }, ownKeys() { calls++; }, getPrototypeOf() { calls++; } });
  const getter = { get input_tokens() { calls++; return 1; } };
  for (const input of [proxy, { provider: "openai", nativeUsage: proxy }, { provider: "openai", nativeUsage: getter },
    { provider: { toString() { calls++; return "openai"; } }, nativeUsage: {} }]) {
    assert.throws(() => normalizeProviderUsage(input));
  }
  assert.throws(() => validateUsageLedger(proxy));
  assert.equal(calls, 0);
});

test("malformed ledger JSON returns validation issues instead of throwing", () => {
  const usage = normalize("openai", openai());
  for (const input_components of [[null], [5], ["bad"], [{}], [null, ...usage.input_components],
    [{ kind: "cache-write", tokens: 0, ttl_seconds: { toString: 0 }, pricing_key: "bad" }]]) {
    assert.equal(validateUsageLedger({ ...usage, input_components }).valid, false);
  }
});

test("Anthropic iterations remain outside the fixed non-beta request policy", () => {
  for (const extra of [{ iterations: [] }, { iterations: null },
    { iterations: [{ type: "message", ...anthropic() }] },
    { iterations: [{ type: "compaction", input_tokens: 180000, output_tokens: 3500 }, { type: "message", ...anthropic() }] },
    { iterations: [{ type: "advisor_message", model: "synthetic-advisor", input_tokens: 823, output_tokens: 1612 }] }]) {
    const usage = normalize("anthropic", { ...anthropic(), ...extra });
    assert.equal(usage.accounting_status, "unknown");
    assert.equal(usage.reasoning_tokens, null);
    assert.ok(usage.issues.some(issue => issue.startsWith("unsupported")));
  }
  const usage = normalize("anthropic", anthropic());
  assert.equal(validateUsageLedger({ ...usage, reasoning_tokens: 10, final_output_tokens: 10 }).valid, false);
});

test("fix1 Anthropic thinking details decompose inclusive output without exact final-output inference", () => {
  const native = { ...anthropic(), output_tokens_details: { thinking_tokens: 8 } };
  const original = structuredClone(native);
  const usage = normalize("anthropic", native);
  assert.equal(usage.policy_id, "calibration4-anthropic-messages-2023-06-01-default5m-v2");
  assert.equal(usage.accounting_status, "complete");
  assert.equal(usage.output_tokens, 20);
  assert.equal(usage.reasoning_tokens, 8);
  assert.equal(usage.final_output_tokens, null);
  assert.equal(usage.reasoning_in_output, true);
  assert.equal(usage.total_tokens, 220);
  assert.deepEqual(validateUsageLedger(usage), { valid: true, issues: [] });
  assert.deepEqual(native, original);
});

test("fix1 Anthropic thinking detail zero, absence, malformed and unknown fields stay distinct", () => {
  const zero = normalize("anthropic", { ...anthropic(), output_tokens_details: { thinking_tokens: 0 } });
  assert.equal(zero.reasoning_tokens, 0);
  assert.equal(zero.accounting_status, "complete");
  for (const details of [null, {}]) {
    const usage = normalize("anthropic", { ...anthropic(), output_tokens_details: details });
    assert.equal(usage.reasoning_tokens, null);
    assert.equal(usage.final_output_tokens, null);
    assert.equal(usage.accounting_status, "complete");
  }
  for (const thinking_tokens of [-1, 1.5, Infinity, NaN, "8", 21]) {
    assert.equal(normalize("anthropic", { ...anthropic(), output_tokens_details: { thinking_tokens } }).accounting_status, "invalid");
  }
  assert.equal(normalize("anthropic", { ...anthropic(), output_tokens_details: { thinking_tokens: 8, new_tokens: 1 } }).accounting_status, "unknown");
});

test("every required native counter distinguishes null/missing from invalid", () => {
  for (const [provider, fixture, keys] of [
    ["openai", openai, ["input_tokens", "output_tokens"]],
    ["anthropic", anthropic, ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]],
    ["google", google, ["total_input_tokens", "total_output_tokens", "total_thought_tokens", "total_cached_tokens", "total_tool_use_tokens"]],
  ]) {
    for (const key of keys) {
      for (const invalid of [-1, 0.5, Infinity, "0"]) {
        assert.equal(normalize(provider, { ...fixture(), [key]: invalid }).accounting_status, "invalid", `${provider}/${key}`);
      }
      assert.equal(normalize(provider, { ...fixture(), [key]: null }).accounting_status, "unknown", `${provider}/${key}`);
      const zero = Object.fromEntries(Object.keys(fixture()).map(key => [key, 0]));
      if (provider === "openai") zero.input_tokens_details = { cached_tokens: 0, cache_write_tokens: 0 };
      if (provider === "openai") zero.output_tokens_details = { reasoning_tokens: 0 };
      assert.equal(normalize(provider, zero).accounting_status, "complete", provider);
    }
  }
});
