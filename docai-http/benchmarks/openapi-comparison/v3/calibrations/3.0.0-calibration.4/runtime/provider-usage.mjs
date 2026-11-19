import { types } from "node:util";

export const USAGE_POLICY_IDS = Object.freeze({
  openai: "calibration4-openai-responses-default30m-v2",
  anthropic: "calibration4-anthropic-messages-2023-06-01-default5m-v2",
  google: "calibration4-google-text-no-tools-v2",
});
const COUNT_KEYS = ["input_tokens", "output_tokens", "total_tokens", "native_total_tokens", "reasoning_tokens", "final_output_tokens"];
const LEDGER_KEYS = ["usage_version", "policy_id", "provider", ...COUNT_KEYS, "total_provenance", "input_components", "reasoning_in_output", "accounting_status", "issues"];
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const component = (kind, tokens, ttl = null) => ({ kind, tokens, ttl_seconds: ttl,
  pricing_key: kind === "uncached" ? "input_uncached" : kind === "cache-read" ? "input_cache_read" : `input_cache_write_${ttl}s` });

// Inspect descriptors before reading values; numeric validity is a separate accounting concern.
export function assertAccountingData(value, ancestors = new Set()) {
  if (types.isProxy(value)) throw new TypeError("accounting input must not contain Proxy values");
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object") throw new TypeError("accounting input must contain only plain data");
  if (ancestors.has(value)) throw new TypeError("accounting input must not contain cycles");
  if (Object.getPrototypeOf(value) !== (Array.isArray(value) ? Array.prototype : Object.prototype)) {
    throw new TypeError("accounting input must contain only plain objects/arrays");
  }
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value) && (Object.keys(value).length !== value.length
    || !Object.keys(value).every((key, i) => key === String(i)))) throw new TypeError("accounting arrays must be dense indexed data");
  for (const key of Reflect.ownKeys(descriptors)) {
    if (Array.isArray(value) && key === "length") continue;
    const d = descriptors[key];
    if (typeof key !== "string" || !d.enumerable || !("value" in d)) throw new TypeError("accounting input must be own enumerable data");
    assertAccountingData(d.value, ancestors);
  }
  ancestors.delete(value);
}

export function normalizeProviderUsage(input) {
  assertAccountingData(input);
  if (!isObject(input) || typeof input.provider !== "string") throw new TypeError("usage input requires a provider string");
  const { provider } = input;
  const ledger = { usage_version: "2", policy_id: Object.hasOwn(USAGE_POLICY_IDS, provider) ? USAGE_POLICY_IDS[provider] : null, provider,
    input_tokens: null, output_tokens: null, total_tokens: null, native_total_tokens: null,
    total_provenance: "unknown", input_components: [], reasoning_tokens: null, final_output_tokens: null,
    reasoning_in_output: provider === "google" ? false : ["openai", "anthropic"].includes(provider) ? true : null,
    accounting_status: "complete", issues: [] };
  const issue = (message, status = "unknown") => {
    ledger.issues.push(message);
    if (ledger.accounting_status !== "invalid") ledger.accounting_status = status;
  };
  const counter = (object, key, required = true) => {
    const value = object?.[key];
    if (value === undefined || value === null) {
      if (required) issue(`missing ${key}`);
      return null;
    }
    if (!isCount(value)) { issue(`invalid ${key}: expected nonnegative safe integer`, "invalid"); return null; }
    return value;
  };
  const sum = (...values) => {
    if (values.includes(null)) return null;
    const result = values.reduce((a, b) => a + b, 0);
    if (!isCount(result)) { issue("token sum exceeds safe integer range", "invalid"); return null; }
    return result;
  };
  const difference = (whole, ...parts) => {
    const subtotal = sum(...parts);
    if (whole === null || subtotal === null) return null;
    if (subtotal > whole) { issue("token subsets exceed containing total", "invalid"); return null; }
    return whole - subtotal;
  };
  const fields = (value, allowed, label) => {
    if (!isObject(value)) { issue(`invalid ${label}: expected object`, "invalid"); return {}; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) issue(`unsupported ${label}.${key}`);
    return value;
  };
  const writeComponents = (aggregate, breakdown, keys, ttls) => {
    if (breakdown === undefined || breakdown === null) return [component("cache-write", aggregate, ttls[0])];
    const detail = fields(breakdown, keys, "cache write breakdown");
    const amounts = keys.map(key => counter(detail, key));
    const total = sum(...amounts);
    if (aggregate !== null && total !== null && total !== aggregate) issue("cache write breakdown differs from aggregate", "invalid");
    return amounts.map((amount, i) => component("cache-write", amount, ttls[i]));
  };
  const native = input.nativeUsage ?? null;
  if (!Object.hasOwn(USAGE_POLICY_IDS, provider)) { issue("unsupported provider", "invalid"); return ledger; }
  if (native === null) { issue("missing native usage"); return ledger; }
  if (!isObject(native)) { issue("native usage must be an object", "invalid"); return ledger; }

  if (provider === "openai") {
    const n = fields(native, ["input_tokens", "output_tokens", "total_tokens", "input_tokens_details", "output_tokens_details"], "usage");
    ledger.input_tokens = counter(n, "input_tokens");
    ledger.output_tokens = counter(n, "output_tokens");
    ledger.native_total_tokens = counter(n, "total_tokens", false);
    const details = n.input_tokens_details == null ? {} : fields(n.input_tokens_details,
      ["cached_tokens", "cache_write_tokens", "cache_write_tokens_details"], "input_tokens_details");
    const read = counter(details, "cached_tokens");
    const write = counter(details, "cache_write_tokens");
    ledger.input_components = [component("uncached", difference(ledger.input_tokens, read, write)), component("cache-read", read),
      ...writeComponents(write, details.cache_write_tokens_details, ["ttl_30m_tokens", "ttl_12h_tokens"], [1800, 43200])];
    if (n.output_tokens_details != null) {
      const output = fields(n.output_tokens_details, ["reasoning_tokens"], "output_tokens_details");
      ledger.reasoning_tokens = counter(output, "reasoning_tokens", false);
      ledger.final_output_tokens = difference(ledger.output_tokens, ledger.reasoning_tokens);
    }
  } else if (provider === "anthropic") {
    const n = fields(native, ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "cache_creation",
      "service_tier", "inference_geo", "speed", "output_tokens_details"], "usage");
    for (const [key, accepted] of [["service_tier", "standard"], ["inference_geo", "global"], ["speed", "standard"]]) {
      if (n[key] != null && n[key] !== accepted) issue(`unsupported pricing dimension ${key}`);
    }
    const uncached = counter(n, "input_tokens");
    const read = counter(n, "cache_read_input_tokens");
    const write = counter(n, "cache_creation_input_tokens");
    ledger.input_tokens = sum(uncached, read, write);
    ledger.output_tokens = counter(n, "output_tokens");
    if (n.output_tokens_details != null) {
      const detail = fields(n.output_tokens_details, ["thinking_tokens"], "output_tokens_details");
      ledger.reasoning_tokens = counter(detail, "thinking_tokens", false);
      if (ledger.reasoning_tokens !== null && ledger.output_tokens !== null && ledger.reasoning_tokens > ledger.output_tokens) {
        issue("thinking tokens exceed inclusive output", "invalid");
      }
      // The provider documents only an approximate non-reasoning remainder.
      ledger.final_output_tokens = null;
    }
    ledger.input_components = [component("uncached", uncached), component("cache-read", read),
      ...writeComponents(write, n.cache_creation, ["ephemeral_5m_input_tokens", "ephemeral_1h_input_tokens"], [300, 3600])];
  } else {
    const interactions = Object.keys(native).some(key => key.startsWith("total_"));
    const names = interactions
      ? ["total_input_tokens", "total_output_tokens", "total_thought_tokens", "total_tokens", "total_cached_tokens", "total_tool_use_tokens"]
      : ["promptTokenCount", "candidatesTokenCount", "thoughtsTokenCount", "totalTokenCount", "cachedContentTokenCount", "toolUsePromptTokenCount"];
    const modalityFields = interactions ? ["input_tokens_by_modality", "output_tokens_by_modality", "cached_tokens_by_modality", "tool_use_tokens_by_modality"]
      : ["promptTokensDetails", "candidatesTokensDetails", "cacheTokensDetails", "toolUsePromptTokensDetails"];
    const n = fields(native, [...names, ...modalityFields], "usage");
    ledger.input_tokens = counter(n, names[0]);
    ledger.final_output_tokens = counter(n, names[1]);
    ledger.reasoning_tokens = counter(n, names[2]);
    ledger.output_tokens = sum(ledger.final_output_tokens, ledger.reasoning_tokens);
    ledger.native_total_tokens = counter(n, names[3], false);
    const read = counter(n, names[4]);
    const tools = counter(n, names[5]);
    if (tools !== null && tools !== 0) issue("tool-use accounting is unsupported by text/no-tools policy");
    ledger.input_components = [component("uncached", difference(ledger.input_tokens, read)), component("cache-read", read)];
    for (const key of modalityFields) {
      if (n[key] === undefined) continue;
      if (!Array.isArray(n[key])) { issue(`invalid ${key}`, "invalid"); continue; }
      for (const row of n[key]) {
        const detail = fields(row, ["modality", interactions ? "tokens" : "tokenCount"], key);
        counter(detail, interactions ? "tokens" : "tokenCount");
        if (detail.modality !== (interactions ? "text" : "TEXT")) issue(`unsupported ${key} modality`);
      }
    }
  }
  const derived = sum(ledger.input_tokens, ledger.output_tokens);
  if (ledger.native_total_tokens !== null) {
    ledger.total_tokens = ledger.native_total_tokens;
    ledger.total_provenance = "native";
    if (derived !== null && derived !== ledger.native_total_tokens) issue("native total differs from input plus generated output", "invalid");
  } else if (derived !== null) {
    ledger.total_tokens = derived;
    ledger.total_provenance = "derived";
  }
  return ledger;
}

export function validateUsageLedger(ledger) {
  assertAccountingData(ledger);
  const issues = [];
  const add = message => issues.push(message);
  if (!isObject(ledger)) return { valid: false, issues: ["usage ledger must be an object"] };
  if (Object.keys(ledger).length !== LEDGER_KEYS.length || LEDGER_KEYS.some(key => !Object.hasOwn(ledger, key))) add("usage ledger requires exact v2 keys");
  if (ledger.usage_version !== "2") add("usage_version must be 2");
  if (typeof ledger.provider !== "string" || !Object.hasOwn(USAGE_POLICY_IDS, ledger.provider)
    || ledger.policy_id !== USAGE_POLICY_IDS[ledger.provider]) add("unrecognized provider/policy identity");
  for (const key of COUNT_KEYS) if (ledger[key] !== null && !isCount(ledger[key])) add(`invalid ${key}`);
  if (!["native", "derived", "unknown"].includes(ledger.total_provenance)) add("invalid total provenance");
  if (!["complete", "unknown", "invalid"].includes(ledger.accounting_status)) add("invalid accounting status");
  if (!Array.isArray(ledger.issues) || ledger.issues.some(value => typeof value !== "string" || !value)) add("issues must be a string array");
  if (ledger.reasoning_in_output !== (ledger.provider === "google" ? false : true)) add("incorrect native reasoning inclusion");
  if (ledger.provider === "anthropic" && ledger.final_output_tokens !== null) add("exact Anthropic final-output subtotal is unavailable under this policy");
  if (!Array.isArray(ledger.input_components)) add("input_components must be an array");
  else {
    const seen = new Set();
    const ttls = ledger.provider === "openai" ? [1800, 43200] : ledger.provider === "anthropic" ? [300, 3600] : [];
    for (const c of ledger.input_components) {
      if (!isObject(c) || Object.keys(c).length !== 4 || !["kind", "tokens", "ttl_seconds", "pricing_key"].every(key => Object.hasOwn(c, key))) {
        add("invalid input component shape"); continue;
      }
      if (!["uncached", "cache-read", "cache-write"].includes(c.kind) || (c.tokens !== null && !isCount(c.tokens))) {
        add("invalid component kind/tokens"); continue;
      }
      if (c.kind === "cache-write" ? !ttls.includes(c.ttl_seconds) : c.ttl_seconds !== null) {
        add("invalid component lifetime"); continue;
      }
      if (c.pricing_key !== component(c.kind, c.tokens, c.ttl_seconds).pricing_key) add("incorrect component pricing key");
      if (seen.has(c.pricing_key)) add("duplicate overlapping input component");
      seen.add(c.pricing_key);
    }
    if (ledger.input_components.every(c => isObject(c) && isCount(c.tokens)) && isCount(ledger.input_tokens)) {
      const total = ledger.input_components.reduce((sum, c) => sum + c.tokens, 0);
      if (!isCount(total) || total !== ledger.input_tokens) add("input components differ from input total");
    }
  }
  if (issues.length > 0) return { valid: false, issues };
  if (isCount(ledger.input_tokens) && isCount(ledger.output_tokens) && isCount(ledger.total_tokens)
    && ledger.total_tokens !== ledger.input_tokens + ledger.output_tokens) add("inconsistent token total");
  if (ledger.total_provenance === "native" && (!isCount(ledger.native_total_tokens) || ledger.total_tokens !== ledger.native_total_tokens)) add("invalid native total provenance");
  if (ledger.total_provenance === "derived" && (ledger.native_total_tokens !== null || !isCount(ledger.total_tokens)
    || !isCount(ledger.input_tokens) || !isCount(ledger.output_tokens))) add("invalid derived total provenance");
  if (ledger.total_provenance === "unknown" && (ledger.total_tokens !== null || ledger.native_total_tokens !== null)) add("unknown provenance requires null totals");
  if (isCount(ledger.reasoning_tokens) && isCount(ledger.output_tokens) && ledger.reasoning_tokens > ledger.output_tokens) add("reasoning exceeds generated output");
  if (isCount(ledger.final_output_tokens) && isCount(ledger.output_tokens) && ledger.final_output_tokens > ledger.output_tokens) add("final output exceeds generated output");
  if (isCount(ledger.reasoning_tokens) && isCount(ledger.final_output_tokens) && isCount(ledger.output_tokens)
    && ledger.reasoning_tokens + ledger.final_output_tokens !== ledger.output_tokens) add("inconsistent output subtotals");
  if (ledger.accounting_status === "invalid") add("ledger reports invalid accounting");
  if (ledger.accounting_status === "complete") {
    if (ledger.issues?.length !== 0) add("complete accounting must have no issues");
    if (![ledger.input_tokens, ledger.output_tokens, ledger.total_tokens].every(isCount)) add("complete accounting requires totals");
    if (!Array.isArray(ledger.input_components) || ledger.input_components.length < 2
      || ledger.input_components.some(c => !isCount(c.tokens))
      || !ledger.input_components.some(c => c.kind === "uncached") || !ledger.input_components.some(c => c.kind === "cache-read")
      || (ledger.provider !== "google" && !ledger.input_components.some(c => c.kind === "cache-write"))) add("complete accounting requires disjoint input counts");
    if (ledger.provider === "google" && (!isCount(ledger.reasoning_tokens) || !isCount(ledger.final_output_tokens))) add("Google requires both output subtotals");
  } else if (ledger.issues?.length === 0) add("non-complete accounting requires issues");
  return { valid: issues.length === 0, issues };
}
