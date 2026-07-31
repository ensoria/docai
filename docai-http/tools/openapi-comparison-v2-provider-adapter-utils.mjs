import {
  ProviderResponseError,
  ProviderTransportError,
} from "./openapi-comparison-v2-provider-errors.mjs";
import { promptMessages } from "./openapi-comparison-v2-prompt.mjs";

export function renderedProviderPrompt(prompt) {
  const messages = promptMessages(prompt);
  return {
    system: messages.find((message) => message.role === "system")?.content ?? "",
    user: messages.find((message) => message.role === "user")?.content ?? "",
  };
}

export async function fetchProviderJson({
  fetchImpl,
  url,
  options,
  provider,
  apiKey,
}) {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    throw new ProviderTransportError(`${provider} transport failed: ${redact(error.message, apiKey)}`, {
      cause: error,
    });
  }

  const text = await response.text();
  const body = parseJsonOrText(text);
  if (!response.ok) {
    const classification = classifyProviderError(response.status, body);
    throw new ProviderResponseError(
      `${provider} API HTTP ${response.status}: ${redact(summarize(body), apiKey).slice(0, 1000)}`,
      {
        httpStatus: response.status,
        category: classification.category,
        stopReason: classification.stopReason,
        providerRequestId: providerRequestId(body),
        responseBody: body,
      },
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProviderResponseError(`${provider} API returned a non-object response`, {
      httpStatus: response.status,
      category: "provider_response_format",
      responseBody: body,
    });
  }
  return body;
}

export function parseContentJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function normalizeUsage(usage = {}) {
  const input = usage.input_tokens
    ?? usage.input_token_count
    ?? usage.prompt_tokens
    ?? usage.promptTokenCount
    ?? null;
  const output = usage.output_tokens
    ?? usage.output_token_count
    ?? usage.completion_tokens
    ?? usage.candidatesTokenCount
    ?? null;
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: usage.total_tokens
      ?? usage.total_token_count
      ?? usage.totalTokenCount
      ?? (input !== null && output !== null ? input + output : null),
  };
}

export function providerRequestId(body) {
  return body?.id ?? body?.request_id ?? body?.requestId ?? null;
}

function parseJsonOrText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function classifyProviderError(status, body) {
  const message = summarize(body).toLowerCase();
  if (status === 401 || status === 403) {
    return { category: "authentication_error", stopReason: "authentication_error" };
  }
  if (
    status === 402
    || /\b(credit balance|billing|payment required|insufficient quota)\b/.test(message)
  ) {
    return { category: "billing_error", stopReason: "billing_error" };
  }
  if (status === 429) {
    return { category: "rate_limit", stopReason: "rate_limit" };
  }
  if (
    status === 404
    || /\b(model).*(unavailable|not found|does not exist|not supported)\b/.test(message)
  ) {
    return { category: "model_unavailable", stopReason: "model_unavailable" };
  }
  return { category: "provider_error", stopReason: null };
}

function summarize(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function redact(value, secret) {
  if (!secret) return String(value);
  return String(value).split(secret).join("<redacted>");
}
