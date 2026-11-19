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

const ENDPOINT = "https://api.openai.com/v1/responses";

export function createOpenAIAdapter(input = {}) {
  const { apiKey, fetchImpl } = readAdapterOptions(input, "OpenAI adapter options");
  return {
    provider: "openai",
    api_key_status: apiKeyStatus(apiKey),
    async execute(input) {
      assertPlainJson(input, "OpenAI execution input");
      const { prompt, modelResolution } = input;
      if (!apiKey) throw new Error("OPENAI_API_KEY is required");
      const rendered = renderedProviderPrompt(prompt);
      const body = {
        model: modelResolution.requested_model,
        instructions: rendered.system,
        input: rendered.user,
        reasoning: { effort: "medium" },
        max_output_tokens: 16384,
      };
      const fetched = await fetchProviderJson({
        fetchImpl,
        url: ENDPOINT,
        provider: "OpenAI",
        apiKey,
        options: {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      });
      const response = fetched.body;
      return {
        content_text: extractOpenAIText(response),
        completion: providerCompletion("openai", response),
        usage: normalizeProviderUsage({ provider: "openai", nativeUsage: nativeProviderUsage("openai", response) }),
        resolved_model: response.model ?? modelResolution.resolved_model,
        provider_request_id: fetched.provider_request_id ?? providerRequestId(response, undefined, apiKey),
        raw_response: fetched.raw_response,
      };
    },
  };
}

function extractOpenAIText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" || typeof content.text === "string")
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n");
}
