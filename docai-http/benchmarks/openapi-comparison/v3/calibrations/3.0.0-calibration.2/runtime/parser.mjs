import { assertPlainJson } from "./strict-json.mjs";

const EMPTY_ERROR = { code: "empty", message: "Provider response text is empty." };
const INCOMPLETE_ERROR = {
  code: "incomplete",
  message: "Provider response is incomplete; partial text was not parsed.",
};
const INVALID_JSON_ERROR = {
  code: "invalid-json",
  message: "Provider response must be one JSON object or one json fence.",
};

export function parseProviderText(text, options = {}) {
  if (typeof text !== "string") throw new TypeError("text must be a string");
  assertPlainJson(options, "parser options");
  requireExactKeys(options, "parser options", ["incomplete"]);
  const incomplete = options.incomplete ?? false;
  if (typeof incomplete !== "boolean") throw new TypeError("parser options.incomplete must be a boolean");

  if (incomplete) return result("incomplete", text, null, INCOMPLETE_ERROR);
  const trimmed = text.trim();
  if (trimmed === "") return result("empty", text, null, EMPTY_ERROR);
  const fenced = trimmed.match(/^```json\n([\s\S]*)\n```$/);
  if (fenced !== null) {
    const contentJson = parseJsonObject(fenced[1]);
    if (contentJson !== null) return result("fenced-json", text, contentJson, null);
  }
  const contentJson = parseJsonObject(trimmed);
  if (contentJson !== null) return result("raw-json", text, contentJson, null);
  return result("invalid-json", text, null, INVALID_JSON_ERROR);
}

function parseJsonObject(text) {
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    assertPlainJson(value, "provider response JSON");
    return value;
  } catch {
    return null;
  }
}

function result(formatStatus, contentText, contentJson, parseError) {
  return { format_status: formatStatus, content_json: contentJson, content_text: contentText, parse_error: parseError };
}

function requireExactKeys(value, name, keys) {
  const actual = Object.keys(value);
  if (actual.some((key) => !keys.includes(key)) || actual.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`${name} has unknown keys`);
  }
}
