import {
  fetchProviderJson,
  normalizeUsage,
  parseContentJson,
  providerRequestId,
  renderedProviderPrompt,
} from "./openapi-comparison-v2-provider-adapter-utils.mjs";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export function createAnthropicAdapter({
  apiKey,
  fetchImpl = fetch,
} = {}) {
  return {
    provider: "anthropic",
    async execute({ prompt, modelResolution, outputSchema }) {
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
      const rendered = renderedProviderPrompt(prompt);
      const settings = modelResolution.request_settings;
      const body = {
        model: modelResolution.requested_model,
        max_tokens: settings.max_output_tokens,
        system: rendered.system,
        messages: [{ role: "user", content: rendered.user }],
        thinking: { type: settings.thinking },
        output_config: {
          format: {
            type: "json_schema",
            schema: outputSchema,
          },
        },
      };
      const response = await fetchProviderJson({
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
      const contentText = (response.content ?? [])
        .filter((content) => content.type === "text")
        .map((content) => content.text ?? "")
        .filter(Boolean)
        .join("\n");
      return {
        content_json: parseContentJson(contentText),
        content_text: contentText,
        usage: normalizeUsage(response.usage),
        resolved_model: response.model ?? modelResolution.resolved_model,
        provider_request_id: providerRequestId(response),
        stop_reason: response.stop_reason ?? null,
        raw_response: response,
      };
    },
  };
}
