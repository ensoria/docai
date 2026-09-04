import {
  apiKeyStatus,
  completion,
  fetchProviderJson,
  normalizeUsage,
  providerRequestId,
  renderedProviderPrompt,
} from "./openapi-comparison-v3-provider-adapter-utils.mjs";

const ENDPOINT = "https://api.openai.com/v1/responses";

export function createOpenAIAdapter({ apiKey, fetchImpl = fetch } = {}) {
  return {
    provider: "openai",
    api_key_status: apiKeyStatus(apiKey),
    async execute({ prompt, modelResolution }) {
      if (!apiKey) throw new Error("OPENAI_API_KEY is required");
      const rendered = renderedProviderPrompt(prompt);
      const body = {
        model: modelResolution.requested_model,
        instructions: rendered.system,
        input: rendered.user,
        reasoning: { effort: "medium" },
        max_output_tokens: 8192,
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
      const providerStatus = response.status ?? null;
      const stopReason = response.incomplete_details?.reason ?? null;
      return {
        content_text: extractOpenAIText(response),
        completion: completion({
          providerStatus,
          stopReason,
          successStatuses: ["completed"],
        }),
        usage: normalizeUsage(response.usage),
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
