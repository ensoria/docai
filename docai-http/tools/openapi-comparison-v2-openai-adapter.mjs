import {
  fetchProviderJson,
  normalizeUsage,
  parseContentJson,
  providerRequestId,
  renderedProviderPrompt,
} from "./openapi-comparison-v2-provider-adapter-utils.mjs";

const ENDPOINT = "https://api.openai.com/v1/responses";

export function createOpenAIAdapter({
  apiKey,
  fetchImpl = fetch,
} = {}) {
  return {
    provider: "openai",
    async execute({ prompt, modelResolution }) {
      if (!apiKey) throw new Error("OPENAI_API_KEY is required");
      const rendered = renderedProviderPrompt(prompt);
      const settings = modelResolution.request_settings;
      const body = {
        model: modelResolution.requested_model,
        instructions: rendered.system,
        input: rendered.user,
        reasoning: {
          effort: settings.reasoning_effort,
        },
        max_output_tokens: settings.max_output_tokens,
      };
      const response = await fetchProviderJson({
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
      const contentText = extractOpenAIText(response);
      return {
        content_json: parseContentJson(contentText),
        content_text: contentText,
        usage: normalizeUsage(response.usage),
        resolved_model: response.model ?? modelResolution.resolved_model,
        provider_request_id: providerRequestId(response),
        stop_reason: response.status ?? null,
        raw_response: response,
      };
    },
  };
}

function extractOpenAIText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const text = (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" || typeof content.text === "string")
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n");
  return text;
}
