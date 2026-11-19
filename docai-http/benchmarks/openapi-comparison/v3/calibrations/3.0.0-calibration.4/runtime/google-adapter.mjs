import { assertPlainJson } from "./strict-json.mjs";
import { normalizeProviderUsage } from "./provider-usage.mjs";
import {
  apiKeyStatus,
  providerCompletion,
  fetchProviderJson,
  nativeProviderUsage,
  providerRequestId,
  readAdapterOptions,
  renderedProviderPrompt,
} from "./provider-adapter-utils.mjs";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

export function createGoogleAdapter(input = {}) {
  const { apiKey, fetchImpl } = readAdapterOptions(input, "Google adapter options");
  return {
    provider: "google",
    api_key_status: apiKeyStatus(apiKey),
    async execute(input) {
      assertPlainJson(input, "Google execution input");
      const { prompt, modelResolution } = input;
      if (!apiKey) throw new Error("GOOGLE_API_KEY is required");
      const rendered = renderedProviderPrompt(prompt);
      const body = {
        model: modelResolution.requested_model,
        system_instruction: rendered.system,
        input: rendered.user,
        generation_config: {
          thinking_level: "medium",
          max_output_tokens: 16384,
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
      return {
        content_text: extractGoogleText(response),
        completion: providerCompletion("google", response),
        usage: normalizeProviderUsage({ provider: "google", nativeUsage: nativeProviderUsage("google", response) }),
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
