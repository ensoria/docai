import { buildModelResolutions } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/estimate-cost.mjs";
import { nativeAccountingForAttempt } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/record.mjs";
import { normalizeProviderUsage } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/provider-usage.mjs";
import { providerCompletion } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/provider-adapter-utils.mjs";

export function nativeResponse(prompt, task, plan) {
  const provider = prompt.target.provider;
  const model = buildModelResolutions(plan).targets.find(t => t.target_id === prompt.target.id).resolved_model;
  const usage = provider === "openai" ? { input_tokens: 10, output_tokens: 20, total_tokens: 30, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } }
    : provider === "anthropic" ? { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
      : { total_input_tokens: 10, total_output_tokens: 20, total_thought_tokens: 0, total_cached_tokens: 0, total_tool_use_tokens: 0, total_tokens: 30 };
  const raw = { id: `response-${prompt.calibration_ordinal}`, model, usage,
    ...(provider === "anthropic" ? { stop_reason: "end_turn" } : { status: "completed" }) };
  return { content_text: JSON.stringify(task.private.expected_outcome), completion: providerCompletion(provider, raw),
    usage: normalizeProviderUsage({ provider, nativeUsage: usage }), resolved_model: model,
    provider_request_id: `request-${prompt.calibration_ordinal}`, raw_response: raw };
}

export function nativeAttempt(prompt, tasks, plan, revision) {
  const attempt = {
    record_version: "2", benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, batch_id: "calibration", run_id: prompt.run_id,
    api_id: prompt.api_id, task_id: prompt.task_id, target_id: prompt.target.id, provider: prompt.target.provider, condition: prompt.condition,
    repetition: prompt.repetition, attempt_number: 1, started_at: "2026-11-13T00:00:00.000Z", ended_at: "2026-11-13T00:00:01.000Z",
    status: "response", provider_call: true, response: nativeResponse(prompt, tasks.find(t => t.id === prompt.task_id), plan), error: null, runner_revision: revision,
  };
  attempt.accounting = nativeAccountingForAttempt(attempt);
  return attempt;
}

export function documentedNativeResponse(provider, model, text) {
  if (provider === "openai") return {
    id: "synthetic-openai-response", object: "response", model, status: "completed",
    text: { format: { type: "text" }, verbosity: "medium" },
    output: [{ id: "synthetic-message", type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", text, annotations: [], logprobs: [] }] }],
    usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } },
  };
  if (provider === "google") return {
    id: "synthetic-google-response", object: "interaction", model, status: "completed",
    created: "2026-11-13T12:00:00Z", updated: "2026-11-13T12:00:00Z",
    steps: [{ type: "thought", signature: "synthetic-signature-only" },
      { type: "thought", signature: "synthetic-signature", summary: [{ type: "text", text: "Synthetic thought summary, not the answer." }] },
      { type: "model_output", content: [{ type: "text", text }] }],
    usage: { total_input_tokens: 1, total_output_tokens: 1, total_thought_tokens: 1,
      total_cached_tokens: 0, total_tool_use_tokens: 0, total_tokens: 3 },
  };
  throw new Error("documented response fixture requires OpenAI or Google");
}
