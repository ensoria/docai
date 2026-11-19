import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProviderUsage } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/provider-usage.mjs";
import { priceUsage } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/billing.mjs";

const usage = normalizeProviderUsage({ provider: "anthropic", nativeUsage: {
  input_tokens: 100, cache_creation_input_tokens: 30, cache_read_input_tokens: 70, output_tokens: 20,
  cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 20 },
} });
const pricing = () => ({ policy_id: usage.policy_id, provider: "anthropic", model_resolution_id: "synthetic-test-only",
  usd_per_million_tokens: { input_uncached: 2, input_cache_read: 0.2, input_cache_write_300s: 2.5, input_cache_write_3600s: 4, output: 10 } });

test("prices every disjoint input category plus generated output exactly once", () => {
  assert.deepEqual(priceUsage({ usage, pricing: pricing() }), { status: "complete", estimated_usd: 0.000519, issues: [] });
});

test("OpenAI lifetime rates must be explicit; no write-rate fallback to ordinary input", () => {
  const ledger = normalizeProviderUsage({ provider: "openai", nativeUsage: { input_tokens: 100, output_tokens: 100,
    input_tokens_details: { cached_tokens: 40, cache_write_tokens: 50, cache_write_tokens_details: { ttl_30m_tokens: 20, ttl_12h_tokens: 30 } },
    output_tokens_details: { reasoning_tokens: 80 } } });
  const prices = { provider: "openai", policy_id: ledger.policy_id, model_resolution_id: "synthetic-only",
    usd_per_million_tokens: { input_uncached: 4, input_cache_read: 0.4, input_cache_write_1800s: 5, input_cache_write_43200s: 10, output: 20 } };
  assert.equal(priceUsage({ usage: ledger, pricing: prices }).estimated_usd, 0.002456);
  delete prices.usd_per_million_tokens.input_cache_write_1800s;
  assert.equal(priceUsage({ usage: ledger, pricing: prices }).status, "unknown");
});

test("unknown usage/rates never produce zero charge", () => {
  const unknown = normalizeProviderUsage({ provider: "anthropic", nativeUsage: { output_tokens: 20 } });
  assert.equal(priceUsage({ usage: unknown, pricing: pricing() }).estimated_usd, null);
  assert.equal(priceUsage({ usage, pricing: null }).status, "unknown");
  const prices = pricing();
  delete prices.usd_per_million_tokens.input_cache_read;
  assert.equal(priceUsage({ usage, pricing: prices }).status, "unknown");
  assert.equal(priceUsage({ usage, pricing: prices }).estimated_usd, null);
  prices.usd_per_million_tokens.input_cache_read = null;
  assert.equal(priceUsage({ usage, pricing: prices }).status, "unknown");
});

test("invalid rates, ledger, and identity mismatches cannot be priced", () => {
  for (const value of [-1, NaN, Infinity, "2"]) {
    const prices = pricing();
    prices.usd_per_million_tokens.output = value;
    assert.equal(priceUsage({ usage, pricing: prices }).status, "invalid");
  }
  for (const change of [{ policy_id: "old" }, { provider: "google" }, { model_resolution_id: "" }]) {
    assert.equal(priceUsage({ usage, pricing: { ...pricing(), ...change } }).status, "invalid");
  }
  assert.equal(priceUsage({ usage: { ...usage, input_tokens: -1 }, pricing: pricing() }).status, "invalid");
});

test("zero rates are explicit; tiny charges remain unrounded for stop comparisons", () => {
  const prices = pricing();
  for (const key of Object.keys(prices.usd_per_million_tokens)) prices.usd_per_million_tokens[key] = 0;
  assert.equal(priceUsage({ usage, pricing: prices }).estimated_usd, 0);
  prices.usd_per_million_tokens.output = 0.000001;
  const charge = priceUsage({ usage, pricing: prices }).estimated_usd;
  assert.equal(charge, 2e-11);
  assert.ok(charge * 100 > 1e-9);
});

test("nonfinite accumulated cost is invalid, not complete", () => {
  const prices = pricing();
  prices.usd_per_million_tokens.output = Number.MAX_VALUE;
  assert.equal(priceUsage({ usage, pricing: prices }).status, "invalid");
});

test("hostile pricing and top-level inputs have no observable access", () => {
  let calls = 0;
  const proxy = new Proxy({}, { get() { calls++; }, ownKeys() { calls++; } });
  for (const input of [proxy, { usage, pricing: proxy }, { usage, pricing: { get provider() { calls++; return "anthropic"; } } }]) {
    assert.throws(() => priceUsage(input));
  }
  assert.equal(calls, 0);
});

test("fix1 Anthropic thinking is priced once; iterations never return a partial charge", () => {
  const native = { input_tokens: 100, cache_creation_input_tokens: 30, cache_read_input_tokens: 70, output_tokens: 20,
    cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 20 }, output_tokens_details: { thinking_tokens: 8 } };
  const ledger = normalizeProviderUsage({ provider: "anthropic", nativeUsage: native });
  assert.deepEqual(priceUsage({ usage: ledger, pricing: pricing() }), { status: "complete", estimated_usd: 0.000519, issues: [] });
  for (const iterations of [[], [{ type: "message", ...native }],
    [{ type: "compaction", input_tokens: 180000, output_tokens: 3500 }],
    [{ type: "advisor_message", model: "synthetic-advisor", input_tokens: 823, output_tokens: 1612 }]]) {
    const unknown = normalizeProviderUsage({ provider: "anthropic", nativeUsage: { ...native, iterations } });
    const result = priceUsage({ usage: unknown, pricing: pricing() });
    assert.equal(result.status, "unknown");
    assert.equal(result.estimated_usd, null);
  }
});
