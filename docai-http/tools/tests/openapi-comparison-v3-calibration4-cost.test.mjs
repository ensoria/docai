import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildModelResolutions, buildCostEstimate, validateModelResolutions, validateCostEstimate } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/estimate-cost.mjs";
import { PACKAGE_DIR, readPlan, buildCalibrationSchedule } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/paths.mjs";
import { validatePlan, FROZEN_ARTIFACT_CLASSES } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/check-plan.mjs";
import { validateLivePreflight } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/runner.mjs";

const plan = readPlan();
const estimatedAt = "2026-11-13T00:00:00Z";
const offline = { checkedOn: "2026-11-13" };
const models = () => buildModelResolutions(plan);
function metrics() {
  return {
    metric_version: "1", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version,
    methodology: { approximate_tokens: "ceil(characters / 4); descriptive only, not a provider tokenizer count." },
    rows: buildCalibrationSchedule(plan).map(row => ({ ...row, prompt_sha256: "a".repeat(64),
      prompt_characters: 4, prompt_utf8_bytes: 4, prompt_approx_tokens_chars_div_4: 1,
      context_characters: 1, context_utf8_bytes: 1, context_approx_tokens_chars_div_4: 1 })),
  };
}
const inputs = () => ({ plan, modelResolutions: models(), metricsPacket: metrics(), estimatedAt });

test("candidate validation accepts null draft targets without granting freeze authorization", () => {
  const packet = models();
  assert.doesNotThrow(() => validateModelResolutions(plan, packet, offline));
  assert.equal(packet.status, "candidate");
  assert.equal(packet.catalog_checked_on, "2026-11-13");
  assert.deepEqual(packet.targets.map(t => [t.requested_model, t.resolved_model, t.request_settings.max_output_tokens]), [
    ["gpt-5.6-sol", "gpt-5.6-sol", 16384], ["claude-sonnet-5", "claude-sonnet-5", 16384], ["gemini-3.8-flash", "gemini-3.8-flash", 16384],
  ]);
  assert.throws(() => validatePlan(plan, { requireFrozen: true }), /calibration-frozen/);
  const future = structuredClone(plan);
  future.status = "calibration-frozen";
  future.targets.forEach((t, i) => { t.model_id = packet.targets[i].resolved_model; });
  future.freeze = { manifest: "freeze-manifest.json", frozen_at: estimatedAt, artifact_set_sha256: "a".repeat(64), required_artifact_classes: [...FROZEN_ARTIFACT_CLASSES] };
  assert.doesNotThrow(() => validateModelResolutions(future, packet, offline));
  future.targets[0].model_id = "unapproved-model";
  assert.throws(() => validateModelResolutions(future, packet, offline), /model_id/);
});

test("rejects stale identity, prices, settings, evidence and accounting policies", () => {
  for (const mutate of [
    p => { p.plan_version = "3.0.0-calibration.3"; },
    p => { p.catalog_checked_on = "2026-11-10"; },
    p => { p.targets[0].resolved_model += "-latest"; },
    p => { p.targets[0].request_settings.max_output_tokens = 8192; },
    p => { p.targets[2].request_settings.thinking_level = "high"; },
    p => { p.targets[1].policy_id = "calibration4-anthropic-messages-default5m-v2"; },
    p => { p.targets[0].pricing.usd_per_million_tokens.input_cache_write_43200s = 5; },
    p => { delete p.targets[1].pricing.usd_per_million_tokens.input_cache_write_3600s; },
    p => { delete p.targets[2].pricing.usd_per_million_tokens.input_cache_read; },
    p => { p.targets[1].request_settings.api_version = "2026-10-21"; },
    p => { p.targets[0].official_sources = []; },
    p => { p.targets[2] = structuredClone(p.targets[0]); },
    p => { p.targets[0].pricing_scope.geography = "regional"; },
  ]) {
    const packet = models(); mutate(packet);
    assert.throws(() => validateModelResolutions(plan, packet, offline), /model resolution/);
  }
  assert.throws(() => validateModelResolutions(plan, models(), { checkedOn: "2026-12-01" }), /expired|recheck/);
});

test("includes disjoint cache rates and exact version-bound Anthropic policy", () => {
  const packet = models();
  assert.deepEqual(packet.targets.map(t => t.pricing.usd_per_million_tokens), [
    { input_uncached: 4, input_cache_read: 0.4, input_cache_write_1800s: 5, input_cache_write_43200s: 10, output: 20 },
    { input_uncached: 2, input_cache_read: 0.2, input_cache_write_300s: 2.5, input_cache_write_3600s: 4, output: 10 },
    { input_uncached: 0.75, input_cache_read: 0.075, output: 3.75 },
  ]);
  assert.equal(packet.targets[1].policy_id, "calibration4-anthropic-messages-2023-06-01-default5m-v2");
  assert.equal(packet.targets[0].model_limits.input_tokens, 922000);
});

test("prices 393216 generated tokens once and bounds all supported input categories", () => {
  const estimate = buildCostEstimate(inputs());
  assert.equal(estimate.calibration.requests, 24);
  assert.equal(estimate.calibration.input_tokens_estimate, 24);
  assert.equal(estimate.calibration.input_tokens_ceiling, 48);
  assert.equal(estimate.calibration.output_tokens_ceiling, 393216);
  assert.equal(estimate.calibration.total_tokens_ceiling, 393264);
  // Eight calls/provider, two input tokens/call after ceil(1 * 1.1).
  // Max supported input rates: 10, 4, .75; output: 20, 10, 3.75.
  assert.equal(estimate.calibration.cost_ceiling_usd, 4.423916);
  estimate.calibration.targets.forEach((t, i) => {
    assert.ok(Math.abs(t.cost_ceiling_usd - [2.6216, 1.310784, 0.491532][i]) < 1e-14);
  });
  assert.doesNotThrow(() => validateCostEstimate(plan, estimate, models(), metrics(), offline));
});

test("validates complete canonical schedule and per-prompt approximate counts", () => {
  for (const mutate of [
    m => m.rows.pop(),
    m => { m.rows[1].run_id = m.rows[0].run_id; },
    m => { m.rows[0].provider = "google"; },
    m => { m.rows[0].prompt_approx_tokens_chars_div_4 = 0; },
    m => { m.rows[0].prompt_characters = -1; },
    m => { m.rows[0].prompt_sha256 = "not-a-hash"; },
    m => { m.rows[0].context_characters = 5; },
  ]) {
    const input = inputs(); mutate(input.metricsPacket);
    assert.throws(() => buildCostEstimate(input), /metrics|24|canonical/);
  }
});

test("rejects cap, contingency, price-tier and effective-date drift", () => {
  assert.throws(() => buildCostEstimate({ ...inputs(), outputTokensPerRequestCeiling: 8192 }), /output-token/);
  assert.throws(() => buildCostEstimate({ ...inputs(), inputContingencyPercent: 0 }), /contingency/);
  assert.throws(() => buildCostEstimate({ ...inputs(), estimatedAt: "2026-12-01T00:00:00Z" }), /expired|recheck/);
  const input = inputs();
  input.metricsPacket.rows[0].prompt_characters = 1_100_000;
  input.metricsPacket.rows[0].prompt_utf8_bytes = 1_100_000;
  input.metricsPacket.rows[0].prompt_approx_tokens_chars_div_4 = 275000;
  assert.throws(() => buildCostEstimate(input), /tier|272000/);
});

test("recomputes costs and rejects coherent lower envelopes or substituted metrics", () => {
  const input = inputs();
  const estimate = buildCostEstimate(input);
  for (const mutate of [
    e => { e.calibration.cost_ceiling_usd -= 1; },
    e => { e.calibration.targets[0].cost_ceiling_usd -= 1; e.calibration.cost_ceiling_usd -= 1; },
    e => { e.model_resolutions_sha256 = "b".repeat(64); },
    e => { e.metrics_sha256 = "b".repeat(64); },
    e => { e.calibration.output_tokens_ceiling = 196608; },
  ]) {
    const changed = structuredClone(estimate); mutate(changed);
    assert.throws(() => validateCostEstimate(plan, changed, input.modelResolutions, input.metricsPacket, offline), /cost estimate/);
  }
  input.metricsPacket.rows[0].prompt_sha256 = "b".repeat(64);
  assert.throws(() => validateCostEstimate(plan, estimate, input.modelResolutions, input.metricsPacket, offline), /cost estimate/);
});

test("rejects hostile inputs before getters, coercions or Proxy traps", () => {
  let calls = 0;
  const proxy = new Proxy({}, { ownKeys() { calls++; return []; }, get() { calls++; }, getPrototypeOf() { calls++; return Object.prototype; } });
  assert.throws(() => validateModelResolutions(plan, proxy), /Proxy/);
  assert.throws(() => buildCostEstimate(proxy), /Proxy/);
  const accessor = {};
  Object.defineProperty(accessor, "plan", { enumerable: true, get() { calls++; return plan; } });
  assert.throws(() => buildCostEstimate(accessor), /plain JSON/);
  assert.equal(calls, 0);
});

test("checked-in candidate data reproduce against generated full-payload metrics", () => {
  const read = relative => JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, relative), "utf8"));
  const packet = read("model-resolutions.json");
  assert.deepEqual(packet, models());
  assert.doesNotThrow(() => validateCostEstimate(plan, read("cost-estimate.json"), packet, read("private/contexts/calibration-metrics.json"), offline));
});

test("dated integrity remains reproducible while default UTC eligibility expires", () => {
  const input = inputs();
  const estimate = buildCostEstimate(input);
  for (const [clock, eligible] of [
    ["2026-11-13T12:00:00Z", true],
    ["2026-11-30T23:59:59Z", true],
    ["2026-12-01T00:00:00Z", false],
    ["2027-01-01T12:00:00Z", false],
  ]) withClock(clock, () => {
    assert.doesNotThrow(() => validateModelResolutions(plan, input.modelResolutions, offline));
    assert.doesNotThrow(() => validateCostEstimate(plan, estimate, input.modelResolutions, input.metricsPacket, offline));
    assert.deepEqual(buildCostEstimate(input), estimate);
    for (const validate of [
      () => validateModelResolutions(plan, input.modelResolutions),
      () => validateCostEstimate(plan, estimate, input.modelResolutions, input.metricsPacket),
    ]) {
      if (eligible) assert.doesNotThrow(validate, clock);
      else assert.throws(validate, /expired|recheck/, clock);
    }
  });
});

test("dated future-clock checks still diagnose model, envelope and metric tampering", () => {
  for (const clock of ["2026-12-01T12:00:00Z", "2027-01-01T12:00:00Z"]) withClock(clock, () => {
    const input = inputs();
    const estimate = buildCostEstimate(input);
    const badModel = structuredClone(input.modelResolutions);
    badModel.targets[0].resolved_model += "-unapproved";
    assert.throws(() => validateCostEstimate(plan, estimate, badModel, input.metricsPacket, offline), /model resolution identity/);
    const badEstimate = structuredClone(estimate);
    badEstimate.calibration.cost_ceiling_usd -= 1;
    assert.throws(() => validateCostEstimate(plan, badEstimate, input.modelResolutions, input.metricsPacket, offline), /cost estimate differs/);
    input.metricsPacket.rows[0].prompt_sha256 = "b".repeat(64);
    assert.throws(() => validateCostEstimate(plan, estimate, input.modelResolutions, input.metricsPacket, offline), /cost estimate differs/);
    assert.throws(() => validateCostEstimate(plan, estimate, input.modelResolutions, input.metricsPacket, { checkedOn: "2026-12-01" }), /expired|recheck/);
  });
});

test("successful dated checks cannot authorize future draft preflight callbacks or transport", () => {
  withClock("2026-12-01T12:00:00Z", () => {
    const input = inputs();
    const estimate = buildCostEstimate(input);
    assert.equal(validateModelResolutions(plan, input.modelResolutions, offline), undefined);
    assert.equal(validateCostEstimate(plan, estimate, input.modelResolutions, input.metricsPacket, offline), undefined);
    assert.throws(() => validateModelResolutions(plan, input.modelResolutions), /expired|recheck/);
    assert.throws(() => validateCostEstimate(plan, estimate, input.modelResolutions, input.metricsPacket), /expired|recheck/);
    let callbacks = 0;
    let transports = 0;
    const preflightInput = {
      plan, prompts: [], modelResolutions: input.modelResolutions, costEstimate: estimate, metricsPacket: input.metricsPacket,
      freezeManifest: null, runnerRevision: null,
      adapters: { openai: { execute() { transports++; } } },
      validateFreezeArtifacts() { callbacks++; return true; },
    };
    assert.throws(() => validateLivePreflight(preflightInput), /complete frozen calibration\.4 plan/);
    assert.throws(() => validateLivePreflight({ ...preflightInput, checkedOn: offline.checkedOn }), /unknown option/);
    assert.equal(callbacks, 0);
    assert.equal(transports, 0);
  });
});

function withClock(now, operation) {
  const RealDate = globalThis.Date;
  try {
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return new RealDate(now).getTime(); }
    };
    return operation();
  } finally { globalThis.Date = RealDate; }
}
