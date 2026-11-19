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

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export function createAnthropicAdapter(input = {}) {
  const { apiKey, fetchImpl } = readAdapterOptions(input, "Anthropic adapter options");
  return {
    provider: "anthropic",
    api_key_status: apiKeyStatus(apiKey),
    async execute(input) {
      assertPlainJson(input, "Anthropic execution input");
      const { prompt, modelResolution } = input;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
      const rendered = renderedProviderPrompt(prompt);
      const body = {
        model: modelResolution.requested_model,
        max_tokens: 16384,
        system: rendered.system,
        messages: [{ role: "user", content: rendered.user }],
        thinking: { type: "adaptive" },
      };
      const fetched = await fetchProviderJson({
        fetchImpl,
        url: ENDPOINT,
        provider: "Anthropic",
        apiKey,
        options: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
        },
      });
      const response = fetched.body;
      return {
        content_text: (response.content ?? [])
          .filter((content) => content.type === "text")
          .map((content) => content.text ?? "")
          .filter(Boolean)
          .join("\n"),
        completion: providerCompletion("anthropic", response),
        usage: normalizeProviderUsage({ provider: "anthropic", nativeUsage: nativeProviderUsage("anthropic", response) }),
        resolved_model: response.model ?? modelResolution.resolved_model,
        provider_request_id: fetched.provider_request_id ?? providerRequestId(response, undefined, apiKey),
        raw_response: fetched.raw_response,
      };
    },
  };
}
