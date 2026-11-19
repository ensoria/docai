import { assertAccountingData, validateUsageLedger } from "./provider-usage.mjs";

export function priceUsage(input) {
  assertAccountingData(input);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("pricing input must be an object");
  const { usage, pricing = null } = input;
  const validation = validateUsageLedger(usage ?? null);
  const result = (status, issues, estimated_usd = null) => ({ status, estimated_usd, issues });
  if (!validation.valid) return result("invalid", validation.issues);
  if (usage.accounting_status !== "complete") return result("unknown", [...usage.issues]);
  if (pricing === null) return result("unknown", ["missing pricing packet"]);
  if (typeof pricing !== "object" || Array.isArray(pricing)) return result("invalid", ["invalid pricing packet"]);
  if (pricing.provider !== usage.provider || pricing.policy_id !== usage.policy_id
    || typeof pricing.model_resolution_id !== "string" || pricing.model_resolution_id.trim() === "") {
    return result("invalid", ["pricing requires matching provider/policy and exact model_resolution_id"]);
  }
  const rates = pricing.usd_per_million_tokens;
  if (rates == null) return result("unknown", ["missing usd_per_million_tokens"]);
  if (typeof rates !== "object" || Array.isArray(rates)) return result("invalid", ["invalid rate table"]);
  const issues = [];
  let status = "complete";
  for (const [key, rate] of Object.entries(rates)) {
    if (rate === null) continue;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0) {
      status = "invalid"; issues.push(`invalid rate ${key}`);
    }
  }
  const charges = [...usage.input_components.map(c => ({ key: c.pricing_key, tokens: c.tokens })), { key: "output", tokens: usage.output_tokens }];
  let total = 0;
  for (const { key, tokens } of charges) {
    if (!Object.hasOwn(rates, key) || rates[key] === null) {
      if (status !== "invalid") status = "unknown";
      issues.push(`missing explicit rate ${key}`);
    } else if (typeof rates[key] === "number" && Number.isFinite(rates[key]) && rates[key] >= 0) total += tokens * rates[key];
  }
  if (!Number.isFinite(total)) return result("invalid", [...issues, "nonfinite accumulated charge"]);
  // Preserve all precision for the caller's accumulated budget stop; format only at display time.
  return status === "complete" ? result("complete", [], total / 1_000_000) : result(status, issues);
}
