import { promptMessages } from "./prompt.mjs";
import { types } from "node:util";
import { normalizeProviderUsage } from "./provider-usage.mjs";
import {
  ProviderResponseError,
  ProviderTransportError,
} from "./provider-errors.mjs";

export function readAdapterOptions(value, label) {
  if (types.isProxy(value)) throw new TypeError(`${label} must not be a Proxy`);
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain object`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !["apiKey", "fetchImpl"].includes(key)) throw new Error(`${label} has an unknown option`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError(`${label}.${key} must be own enumerable data`);
  }
  const apiKey = Object.getOwnPropertyDescriptor(value, "apiKey")?.value;
  const fetchImpl = Object.getOwnPropertyDescriptor(value, "fetchImpl")?.value ?? fetch;
  if (apiKey !== undefined && typeof apiKey !== "string") throw new TypeError("apiKey must be a string");
  if (typeof fetchImpl !== "function" || types.isProxy(fetchImpl)) throw new TypeError("fetchImpl must be a non-Proxy function");
  return { apiKey, fetchImpl };
}

export function renderedProviderPrompt(prompt) {
  const messages = promptMessages(prompt);
  return {
    system: messages.find((message) => message.role === "system")?.content ?? "",
    user: messages.find((message) => message.role === "user")?.content ?? "",
  };
}

export function apiKeyStatus(apiKey) {
  return typeof apiKey === "string" && apiKey.length > 0 ? "present" : "absent";
}

export async function fetchProviderJson({
  fetchImpl,
  url,
  options,
  provider,
  apiKey,
}) {
  let response;
  let text;
  try {
    response = await fetchImpl(url, options);
    text = await response.text();
  } catch (error) {
    throw new ProviderTransportError(
      `${provider} transport failed: ${redactText(error?.message ?? error, apiKey)}`,
    );
  }

  const body = parseJsonOrText(text);
  const requestId = providerRequestId(body, response.headers, apiKey);
  if (!response.ok) {
    const classification = classifyProviderError(response.status, body);
    const responseBody = redactValue(body, apiKey);
    throw new ProviderResponseError(
      `${provider} API HTTP ${response.status}: ${summarize(responseBody).slice(0, 1000)}`,
      {
        httpStatus: response.status,
        category: classification.category,
        stopReason: classification.stopReason,
        providerRequestId: requestId,
        responseBody,
        usage: normalizeProviderUsage({ provider: provider.toLowerCase(), nativeUsage: nativeProviderUsage(provider.toLowerCase(), responseBody) }),
        completion: { ...providerCompletion(provider.toLowerCase(), responseBody), complete: false, category: "incomplete" },
      },
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProviderResponseError(`${provider} API returned a non-object response`, {
      httpStatus: response.status,
      category: "provider_response_format",
      providerRequestId: requestId,
      responseBody: redactValue(body, apiKey),
    });
  }
  return {
    body,
    provider_request_id: requestId,
    raw_response: redactValue(body, apiKey),
  };
}

export function nativeProviderUsage(provider, response) {
  if (provider !== "google") return response?.usage ?? null;
  const keys = ["usage", "usage_metadata", "usageMetadata"].filter(key => response?.[key] != null);
  if (keys.length > 1) return { ambiguous_usage_envelopes: keys };
  return keys.length === 1 ? response[keys[0]] : null;
}

export function providerCompletion(provider, response) {
  const providerStatus = response?.status ?? null;
  const stopReasons = [response?.incomplete_details?.reason, response?.stop_reason, response?.stopReason,
    ...(Array.isArray(response?.candidates) ? response.candidates.map(candidate => candidate?.finishReason) : [])]
    .filter(reason => reason !== null && reason !== undefined);
  return completion({ providerStatus, stopReason: stopReasons[0] ?? null, stopReasons,
    successStatuses: provider === "anthropic" ? [] : ["completed"],
    successStopReasons: provider === "anthropic" ? ["end_turn", "stop_sequence"] : provider === "google" ? ["STOP"] : [],
  });
}

export function providerRequestId(body, headers = undefined, apiKey = undefined) {
  const candidates = [
    body?.id,
    body?.request_id,
    body?.requestId,
    ...["x-request-id", "request-id", "x-goog-request-id"]
      .map((name) => headerValue(headers, name)),
  ];
  for (const candidate of candidates) {
    const value = normalizeProviderRequestId(candidate, apiKey);
    if (value !== null) return value;
  }
  return null;
}

export function completion({
  providerStatus = null,
  stopReason = null,
  stopReasons = stopReason === null ? [] : [stopReason],
  successStatuses = [],
  successStopReasons = [],
  failureStatuses = [],
  failureStopReasons = [],
}) {
  const incomplete = failureStatuses.includes(providerStatus)
    || stopReasons.some(reason => failureStopReasons.includes(reason) || !successStopReasons.includes(reason))
    || new Set(stopReasons).size > 1
    || (providerStatus !== null && !successStatuses.includes(providerStatus))
    || (stopReason !== null && !successStopReasons.includes(stopReason))
    || (!successStatuses.includes(providerStatus) && !successStopReasons.includes(stopReason));
  return {
    complete: !incomplete,
    category: incomplete ? "incomplete" : "completed",
    provider_status: providerStatus,
    stop_reason: stopReason,
  };
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
  if (status === 429) return { category: "rate_limit", stopReason: "rate_limit" };
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

function redactValue(value, apiKey) {
  if (typeof value === "string") return redactText(value, apiKey);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, apiKey));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    redactText(key, apiKey),
    redactValue(child, apiKey),
  ]));
}

function redactText(value, apiKey) {
  const text = String(value);
  return apiKey ? text.split(apiKey).join("<redacted>") : text;
}

function normalizeProviderRequestId(value, apiKey) {
  if (typeof value === "string") return value === "" ? null : redactText(value, apiKey);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1] ?? null;
}
