import {
  fetchProviderJson,
  normalizeUsage,
  parseContentJson,
  providerRequestId,
  renderedProviderPrompt,
} from "./openapi-comparison-v2-provider-adapter-utils.mjs";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

export function createGoogleAdapter({
  apiKey,
  fetchImpl = fetch,
} = {}) {
  return {
    provider: "google",
    async execute({ prompt, modelResolution }) {
      if (!apiKey) throw new Error("GOOGLE_API_KEY is required");
      const rendered = renderedProviderPrompt(prompt);
      const settings = modelResolution.request_settings;
      const body = {
        model: modelResolution.requested_model,
        system_instruction: rendered.system,
        input: rendered.user,
        generation_config: {
          thinking_level: settings.thinking_level,
          max_output_tokens: settings.max_output_tokens,
        },
      };
      const response = await fetchProviderJson({
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
      const contentText = extractGoogleText(response);
      return {
        content_json: parseContentJson(contentText),
        content_text: contentText,
        usage: normalizeUsage(
          response.usage_metadata ?? response.usageMetadata ?? response.usage,
        ),
        resolved_model: response.model ?? modelResolution.resolved_model,
        provider_request_id: providerRequestId(response),
        stop_reason: response.stop_reason ?? response.stopReason ?? null,
        raw_response: response,
      };
    },
  };
}

function extractGoogleText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return collectText(response.steps ?? response.outputs ?? response.output ?? []);
}

function collectText(value) {
  if (Array.isArray(value)) {
    return value.map(collectText).filter(Boolean).join("\n");
  }
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  return collectText(value.content ?? value.output ?? value.outputs ?? []);
}
