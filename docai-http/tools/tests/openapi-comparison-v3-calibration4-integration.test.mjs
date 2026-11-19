import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fixture, predecessor, watchWrites } from "./calibration4-stop-helpers.mjs";
import { documentedNativeResponse } from "./calibration4-evidence-helpers.mjs";

let f;
before(async () => { f = await fixture(); });
after(() => f?.cleanup());

for (const provider of ["openai", "google"]) test(`fix1 documented ${provider} native envelope through actual adapter and shared verifier`, async () => {
  const prompt = f.prompts.find(p => p.target.provider === provider);
  const model = f.models.targets.find(t => t.provider === provider);
  const expected = JSON.stringify(f.tasks.find(t => t.id === prompt.task_id).private.expected_outcome);
  const raw = documentedNativeResponse(provider, model.resolved_model, expected);
  assert.equal(Object.hasOwn(raw, "output_text"), false);
  const module = await f.load(provider + "-adapter");
  const create = provider === "openai" ? module.createOpenAIAdapter : module.createGoogleAdapter;
  const adapter = create({ apiKey: "fake-fix1-key", fetchImpl: async () => new Response(JSON.stringify(raw), { status: 200 }) });
  const response = await adapter.execute({ prompt, modelResolution: model });
  assert.equal(response.content_text, expected);
  const { reconstructAttemptAccounting } = await f.load("record");
  const account = reconstructAttemptAccounting({ provider, targetId: prompt.target.id, rawResponse: response.raw_response });
  assert.equal(account.charge.status, "complete", JSON.stringify(account.charge.issues));
  assert.equal(account.usage.output_tokens, 2);
  if (provider === "google") {
    assert.equal(account.usage.reasoning_tokens, 1); assert.equal(account.usage.final_output_tokens, 1);
    assert.equal(account.charge.estimated_usd, (0.75 + 2 * 3.75) / 1000000);
  }
  const options = f.execution(async ({ prompt: current }) => current.run_id === prompt.run_id ? response : f.response(current));
  const result = await f.runner.runApprovedCalibration(options);
  assert.equal(result.checkpoint.status, "complete");
  assert.deepEqual(f.verifier.verifyCalibrationEvidence(f.ledger(options.store)).failures, []);
});

test("fix1 documented shapes remain closed to changed settings, tool steps and misplaced signatures", async () => {
  const { reconstructAttemptAccounting } = await f.load("record");
  for (const provider of ["openai", "google"]) {
    const prompt = f.prompts.find(p => p.target.provider === provider), model = f.models.targets.find(t => t.provider === provider);
    const raw = documentedNativeResponse(provider, model.resolved_model, "{}");
    const mutations = provider === "openai" ? [
      r => { r.text.verbosity = "high"; }, r => { r.text.verbosity = null; },
      r => { r.text.billing_addon = null; }, r => { r.text.format.future_billing = 0; },
      r => { r.output[0].content[0].logprobs = null; }, r => { r.output[0].content[0].logprobs = [{}]; },
      r => { r.output[0].content[0].billing_addon = null; },
    ] : [
      r => { r.steps = null; }, r => { r.steps[0] = null; },
      r => { r.steps[2].type = "function_call"; }, r => { r.steps[0].type = "google_search_call"; },
      r => { r.steps[0].signature = null; }, r => { delete r.steps[0].signature; },
      r => { r.steps[0].billing_addon = null; }, r => { r.steps[0].summary = null; },
      r => { r.steps[1].summary[0].type = "image"; }, r => { r.steps[1].summary[0].billing_addon = null; },
      r => { r.steps[2].signature = "misplaced"; }, r => { r.steps[2].content[0].signature = "misplaced"; },
      r => { r.steps[2].content[0].billing_addon = null; }, r => { r.usage.total_thought_tokens = null; },
      r => { r.steps[2].content = {}; }, r => { r.steps[2].content[0].text = null; },
      r => { r.object = "different"; }, r => { r.created = false; },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(raw); mutate(changed);
      assert.equal(reconstructAttemptAccounting({ provider, targetId: prompt.target.id, rawResponse: changed }).charge.estimated_usd, null);
    }
  }
  // Google-only step discriminants cannot leak into OpenAI/Anthropic shapes.
  for (const provider of ["openai", "anthropic"]) {
    for (const type of ["model_output", "thought"]) {
      const prompt = f.prompts.find(p => p.target.provider === provider), response = f.response(prompt);
      response.raw_response[provider === "openai" ? "output" : "content"] = [{ type, content: [{ type: "text", text: "{}" }], signature: "synthetic" }];
      assert.equal(reconstructAttemptAccounting({ provider, targetId: prompt.target.id, rawResponse: response.raw_response }).charge.estimated_usd, null);
    }
  }
});

test("Task5 retains v4 records, v2 native charges and all canonical outcomes", async () => {
  let calls = 0;
  const options = f.execution(async ({ prompt }) => { calls++; return f.response(prompt); });
  const result = await f.runner.runApprovedCalibration(options);
  assert.equal(calls, 24);
  assert.equal(result.checkpoint.status, "complete");
  assert.ok(options.store.listRuns().every(r => r.record_version === "4" && r.contract_status === "valid"));
  assert.ok(options.store.listAttempts().every(a => a.record_version === "2" && a.accounting.usage.usage_version === "2" && a.accounting.charge.status === "complete"));
  assert.equal(result.report.usage.unknown_attempts, 0);
  assert.ok(result.report.usage.estimated_usd > 0);
});

test("Task5 accepts fixed OpenAI request echoes but not changed billing/settings fields", async () => {
  const echoes = { object: "response", background: false, instructions: "synthetic instructions", max_output_tokens: 16384,
    max_tool_calls: null, parallel_tool_calls: true, previous_response_id: null, prompt_cache_key: null, prompt_cache_retention: null,
    reasoning: { effort: "medium", summary: null }, store: true, temperature: 1, top_p: 1, top_logprobs: 0,
    text: { format: { type: "text" } }, tool_choice: "auto", tools: [], truncation: "disabled", user: null, metadata: {} };
  const options = f.execution(async ({ prompt }) => f.response(prompt, undefined, prompt.target.provider === "openai" ? echoes : {}));
  const result = await f.runner.runApprovedCalibration(options);
  assert.equal(result.checkpoint.status, "complete");
  assert.equal(options.store.listAttempts().length, 24);
  const account = (await f.load("record")).reconstructAttemptAccounting;
  const first = options.store.listAttempts()[0];
  for (const extra of [{ reasoning: { effort: "high" } }, { tools: [{ type: "web_search" }] }, { max_output_tokens: 8192 }]) {
    const retained = account({ provider: first.provider, targetId: first.target_id, rawResponse: { ...first.response.raw_response, ...extra } });
    assert.equal(retained.charge.estimated_usd, null);
  }
});

for (const location of ["response", "usage"]) for (const iterations of [null, [], {}, [{ input_tokens: 1 }]]) test(`Task5 iterations ${JSON.stringify(iterations)} at ${location} stop durably and survive both crash windows`, async () => {
  let calls = 0;
  const options = f.execution(async ({ prompt }) => {
    calls++;
    const extra = location === "response" ? { iterations } : { usage: { ...f.response(prompt).raw_response.usage, iterations } };
    return f.response(prompt, undefined, prompt.target.provider === "anthropic" ? extra : {});
  });
  const result = await f.runner.runApprovedCalibration(options);
  assert.equal(calls, 5);
  assert.equal(result.checkpoint.stop_reason, "accounting-unknown");
  const terminal = options.store.listAttempts().at(-1);
  assert.deepEqual((location === "usage" ? terminal.response.raw_response.usage : terminal.response.raw_response).iterations, iterations);
  assert.equal(terminal.accounting.charge.estimated_usd, null);
  assert.equal(result.report.usage.complete, false);
  assert.equal(result.report.usage.known_total_tokens, 15, "known native counters from the unpriced attempt remain visible");
  const retained = f.ledger(options.store), writes = watchWrites(options.store);
  await f.runner.runApprovedCalibration(options);
  assert.equal(calls, 5); assert.equal(writes(), 0);
  for (const missing of [true, false]) {
    const ledger = structuredClone(retained);
    ledger.checkpoint = predecessor(ledger);
    if (missing) ledger.runs.pop();
    const recovered = f.verifier.reconcileCalibrationEvidence(ledger);
    assert.deepEqual(recovered.failures, []);
    assert.equal(recovered.reconciliation.checkpoint.stop_reason, "accounting-unknown");
  }
});

test("Task5 exact native identity requires all supplied Google model aliases and never requested fallback", async () => {
  const { reconstructAttemptAccounting } = await f.load("record");
  for (const provider of ["openai", "anthropic", "google"]) {
    const prompt = f.prompts.find(p => p.target.provider === provider);
    const response = f.response(prompt);
    const base = { provider, targetId: prompt.target.id };
    const missing = structuredClone(response.raw_response); delete missing.model;
    assert.equal(reconstructAttemptAccounting({ ...base, rawResponse: missing }).charge.estimated_usd, null);
    if (provider === "google") {
      const alias = { ...missing, modelVersion: response.resolved_model };
      assert.equal(reconstructAttemptAccounting({ ...base, rawResponse: alias }).charge.status, "complete");
      assert.equal(reconstructAttemptAccounting({ ...base, rawResponse: { ...alias, model: "different" } }).charge.estimated_usd, null);
      assert.equal(reconstructAttemptAccounting({ ...base, rawResponse: { ...alias, model: null } }).charge.estimated_usd, null);
    }
  }
});

for (const extra of [{ model: null }, { model: "wrong" }, { modelVersion: "wrong" }, { service_tier: "priority" }, { iterations: [] }, { unknown_billing_feature: null },
  { output: [{ type: "message", content: [{ type: "output_text", text: "safe", billing_addon: null }] }] }]) {
  test(`Task5 rejects whole-response/model policy ${JSON.stringify(extra)} without losing native response`, async () => {
    let calls = 0;
    const options = f.execution(async ({ prompt }) => { calls++; return f.response(prompt, undefined, extra); });
    const result = await f.runner.runApprovedCalibration(options);
    assert.equal(calls, 1);
    assert.equal(result.checkpoint.stop_reason, "accounting-unknown");
    assert.deepEqual(options.store.listAttempts()[0].response.raw_response, { ...f.response(f.prompts[0]).raw_response, ...extra });
    assert.equal(options.store.listAttempts()[0].accounting.charge.estimated_usd, null);
    if (Object.hasOwn(extra, "model")) assert.equal(options.store.listRuns()[0].resolved_model, null);
  });
}

test("Task5 re-derives charges and rejects forged policy, rates, totals and opaque evidence", async () => {
  const options = f.execution(async ({ prompt }) => f.response(prompt));
  await f.runner.runApprovedCalibration(options);
  const original = f.ledger(options.store);
  for (const mutate of [
    a => { a.response.usage.total_tokens++; },
    a => { a.accounting.charge.estimated_usd = 0; },
    a => { a.accounting.pricing.usd_per_million_tokens.output = 0; },
    a => { a.accounting.policy_id = "forged"; },
    a => { a.response.raw_response.usage.input_tokens++; },
  ]) {
    const ledger = structuredClone(original); mutate(ledger.attempts[0]);
    assert.equal(f.verifier.verifyCalibrationEvidence(ledger).evidence, null);
  }
  const evidence = f.verifier.verifyCalibrationEvidence(original).evidence;
  assert.ok(evidence);
  for (const forged of [{ ...evidence }, structuredClone(evidence), new Proxy(evidence, {})]) {
    assert.throws(() => f.verifier.requireVerifiedEvidence(forged));
    assert.throws(() => f.runner.buildCalibrationReport({ evidence: forged }));
  }
  assert.throws(() => { evidence.attempts[0].accounting.charge.estimated_usd = 0; });
});

test("Task5 HTTP errors are charge-bearing; ambiguous transports stop unknown with no retry", async () => {
  for (const transport of [false, true]) {
    let calls = 0;
    const options = f.execution(async ({ prompt }) => {
      calls++;
      if (transport) throw new f.errors.ProviderTransportError("delivery unknown");
      const response = f.response(prompt);
      throw new f.errors.ProviderResponseError("charged HTTP failure", { category: "billing_error", responseBody: response.raw_response, usage: response.usage, completion: { ...response.completion, complete: false, category: "incomplete" } });
    });
    const result = await f.runner.runApprovedCalibration(options);
    assert.equal(calls, 1);
    assert.equal(result.checkpoint.stop_reason, transport ? "accounting-unknown" : "billing_error");
    assert.equal(result.report.usage.unknown_attempts, transport ? 1 : 0);
    assert.equal(result.report.usage.estimated_usd === null, transport);
    await f.runner.runApprovedCalibration(options); assert.equal(calls, 1);
  }
});

test("Task5 exact USD budget includes cache lifetimes and every HTTP charge", async () => {
  let calls = 0;
  const options = f.execution(async ({ prompt }) => {
    calls++;
    const n = calls <= 2 ? 250000 : calls === 3 ? 67060 : calls === 9 ? 1 : 0;
    const response = f.response(prompt, { input_tokens: n, output_tokens: 0, total_tokens: n,
      ...(prompt.target.provider === "openai" ? { input_tokens_details: { cached_tokens: 0, cache_write_tokens: n, cache_write_tokens_details: { ttl_30m_tokens: 0, ttl_12h_tokens: n } } } : {}) });
    if (calls === 2) throw new f.errors.ProviderResponseError("charged nonfatal HTTP error", { category: "rate_limit", responseBody: response.raw_response });
    return response;
  });
  const result = await f.runner.runApprovedCalibration(options);
  assert.equal(calls, 9, "near budget must permit the next request; exact budget must stop");
  assert.equal(result.checkpoint.stop_reason, "cost-ceiling");
  assert.equal(result.report.usage.estimated_usd, f.cost.calibration.cost_ceiling_usd);
  assert.equal(options.store.listAttempts()[1].status, "provider-error");
  const retained = f.ledger(options.store);
  for (const missing of [true, false]) {
    const ledger = structuredClone(retained); ledger.checkpoint = predecessor(ledger);
    if (missing) ledger.runs.pop();
    const recovered = f.verifier.reconcileCalibrationEvidence(ledger);
    assert.deepEqual(recovered.failures, []);
    assert.equal(recovered.reconciliation.checkpoint.stop_reason, "cost-ceiling");
  }
  const writes = watchWrites(options.store);
  await f.runner.runApprovedCalibration(options); assert.equal(calls, 9); assert.equal(writes(), 0);
});

test("Task5 near and exact token budget uses unrounded cumulative native usage", async () => {
  let calls = 0;
  const options = f.execution(async ({ prompt }) => {
    calls++;
    const n = calls <= 2 ? 215609 : calls === 3 ? 215608 : 1;
    return f.response(prompt, { input_tokens: n, output_tokens: 0, total_tokens: n });
  });
  const result = await f.runner.runApprovedCalibration(options);
  assert.equal(calls, 4);
  assert.equal(result.checkpoint.stop_reason, "token-ceiling");
  assert.equal(result.report.usage.total_tokens, f.cost.calibration.total_tokens_ceiling);
  await f.runner.runApprovedCalibration(options); assert.equal(calls, 4);
});

test("Task5 unknown usage preserves partial response and never parses or retries it", async () => {
  let calls = 0;
  const options = f.execution(async ({ prompt }) => {
    calls++;
    const response = f.response(prompt, undefined, { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, usage: null });
    response.content_text = '{"schema_version":"4",';
    return response;
  });
  const result = await f.runner.runApprovedCalibration(options);
  assert.equal(calls, 1); assert.equal(result.checkpoint.stop_reason, "accounting-unknown");
  const run = options.store.listRuns()[0];
  assert.equal(run.transport_status, "incomplete"); assert.equal(run.format_status, "incomplete");
  assert.equal(run.content_json, null); assert.equal(run.raw_response.usage, null);
  assert.equal(result.report.usage.total_tokens, null, "unknown totals are not zero");
  await f.runner.runApprovedCalibration(options); assert.equal(calls, 1);
});

test("Task5 gate keeps 23/one thresholds and treats 24 semantic failures as automatic decisions", async () => {
  const options = f.execution(async ({ prompt }) => f.response(prompt));
  await f.runner.runApprovedCalibration(options);
  const original = f.ledger(options.store);
  const gate = await f.load("gate");
  const account = (await f.load("record")).nativeAccountingForAttempt;
  function evidence(mutate) {
    const ledger = structuredClone(original); mutate(ledger);
    ledger.runs = ledger.prompts.map((prompt, i) => f.verifier.deriveCanonicalRun({ plan: ledger.plan, prompt, task: ledger.tasks.find(t => t.id === prompt.task_id), attempts: [ledger.attempts[i]], runnerRevision: ledger.expectedRunnerRevision }));
    const result = f.verifier.verifyCalibrationEvidence(ledger);
    assert.deepEqual(result.failures, []);
    return result.evidence;
  }
  const allFail = evidence(l => l.attempts.forEach(a => {
    const answer = JSON.parse(a.response.content_text);
    if (answer.request) answer.request.path.value += "/wrong";
    else answer.steps.items[0].request.path.value += "/wrong";
    a.response.content_text = JSON.stringify(answer);
  }));
  const result = gate.evaluateCalibrationGate(allFail);
  assert.equal(result.passed, true); assert.equal(result.counts.semantic_fails, 24);
  assert.deepEqual(result.thresholds, { automated_decisions_required: 23, exceptional_runs_maximum: 1 });
  const twoInvalid = evidence(l => l.attempts.slice(0, 2).forEach(a => { a.response.content_text = "{}"; }));
  assert.equal(gate.evaluateCalibrationGate(twoInvalid).passed, false);
  assert.equal(gate.evaluateCalibrationGate(twoInvalid).counts.automated_decisions, 22);
  const twoFenced = evidence(l => l.attempts.slice(0, 2).forEach(a => { a.response.content_text = "```json\n" + a.response.content_text + "\n```"; }));
  assert.equal(gate.evaluateCalibrationGate(twoFenced).passed, false);
  const unknown = evidence(l => {
    const a = l.attempts.at(-1); a.response.raw_response.future_billing = true;
    a.accounting = account(a);
    // Reconstruct the genuine unknown terminal envelope, not a claimed free charge.
    l.checkpoint.status = "stopped"; l.checkpoint.stop_reason = "accounting-unknown";
  });
  assert.equal(gate.evaluateCalibrationGate(unknown).passed, false);
});

test("Task5 dated offline evidence remains valid while future frozen preflight and stale capabilities reject", async () => {
  let calls = 0, callbacks = 0;
  const stale = f.execution(async ({ prompt }) => { calls++; return f.response(prompt); });
  const stopped = f.execution(async ({ prompt }) => f.response(prompt, undefined, { iterations: null }));
  await f.runner.runApprovedCalibration(stopped);
  const ledger = f.ledger(stopped.store);
  const before = f.verifier.verifyCalibrationEvidence(ledger);
  assert.deepEqual(before.failures, []);
  try {
    f.setNow("2027-01-10T00:00:00Z");
    const estimate = await f.load("estimate-cost");
    estimate.validateCostEstimate(f.plan, f.cost, f.models, f.metrics, { checkedOn: "2026-11-13" });
    assert.deepEqual(f.verifier.verifyCalibrationEvidence(ledger).evidence, before.evidence);
    assert.throws(() => f.execution(async () => { calls++; }, undefined, () => { callbacks++; return true; }), /expired|valid|date|window|through/i);
    assert.equal(callbacks, 0); assert.equal(calls, 0);
    const writes = watchWrites(stale.store);
    await assert.rejects(f.runner.runApprovedCalibration(stale), /expired|valid|date|window|through/i);
    assert.equal(writes(), 0); assert.equal(calls, 0);
    await assert.rejects(f.runner.runApprovedCalibration({ ...stale, checkedOn: "2026-11-13" }), /unknown option/);
  } finally { f.setNow("2026-11-13T12:00:00.000Z"); }
});
