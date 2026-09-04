import {
  apiKeyStatus,
  completion,
  fetchProviderJson,
  normalizeUsage,
  providerRequestId,
  renderedProviderPrompt,
} from "./openapi-comparison-v3-provider-adapter-utils.mjs";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

export function createGoogleAdapter({ apiKey, fetchImpl = fetch } = {}) {
  return {
    provider: "google",
    api_key_status: apiKeyStatus(apiKey),
    async execute({ prompt, modelResolution }) {
      if (!apiKey) throw new Error("GOOGLE_API_KEY is required");
      const rendered = renderedProviderPrompt(prompt);
      const body = {
        model: modelResolution.requested_model,
        system_instruction: rendered.system,
        input: rendered.user,
        generation_config: {
          thinking_level: "medium",
          max_output_tokens: 8192,
        },
      };
      const fetched = await fetchProviderJson({
        fetchImpl,
        url: ENDPOINT,
        provider: "Google",
        apiKey,
        options: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
        },
      });
      const response = fetched.body;
      const providerStatus = response.status ?? null;
      const stopReason = response.stop_reason
        ?? response.stopReason
        ?? response.candidates?.[0]?.finishReason
        ?? null;
      return {
        content_text: extractGoogleText(response),
        completion: completion({
          providerStatus,
          stopReason,
          successStatuses: ["completed"],
          successStopReasons: ["STOP"],
          failureStatuses: ["incomplete", "failed", "queued", "in_progress"],
          failureStopReasons: ["MAX_TOKENS", "max_tokens", "max_output_tokens"],
        }),
        usage: normalizeUsage(response.usage_metadata ?? response.usageMetadata ?? response.usage),
        resolved_model: response.model ?? response.modelVersion ?? modelResolution.resolved_model,
        provider_request_id: fetched.provider_request_id ?? providerRequestId(response, undefined, apiKey),
        raw_response: fetched.raw_response,
      };
    },
  };
}

function extractGoogleText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return collectText(response.steps ?? response.outputs ?? response.output ?? response.candidates ?? []);
}

function collectText(value) {
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  return collectText(value.parts ?? value.content ?? value.output ?? value.outputs ?? []);
}
