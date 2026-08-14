import { diagnostic } from "./diagnostics.mjs";

const STANDARD_KEYS = [
  "docai-messaging",
  "profile",
  "perspective",
  "coverage",
  "knowledge",
  "source_refs"
];
const EXTENSION_KEY = /^x-[a-z0-9][a-z0-9._-]*$/;
const FORMAT_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const PROFILES = new Set(["full", "compact"]);
const COVERAGE_VALUES = new Set(["complete", "requires-source"]);
const KNOWLEDGE_VALUES = new Set(["complete", "requires-input"]);

function sourceLine(input) {
  if (typeof input === "string") return { text: input, file: "<input>", line: 1 };
  return { text: input.text, file: input.file ?? "<input>", line: input.line ?? 1 };
}

function failure(source, message, ruleId = "DM-META-001") {
  return {
    value: null,
    diagnostics: [diagnostic(ruleId, source.file, source.line, message)]
  };
}

function pipeIsEscaped(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function splitPairs(body) {
  const pairs = [];
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "|" || pipeIsEscaped(body, index)) continue;
    if (body[index - 1] !== " " || body[index + 1] !== " ") return null;
    pairs.push(body.slice(start, index - 1));
    start = index + 2;
  }
  pairs.push(body.slice(start));
  return pairs;
}

function decodeValue(value) {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\") {
      decoded += value[index];
      continue;
    }
    if (index + 1 === value.length) return { error: "Metadata value has a trailing backslash." };
    const escaped = value[index + 1];
    if (escaped !== "\\" && escaped !== "|") {
      return { error: `Metadata value uses the unknown escape \\${escaped}.` };
    }
    decoded += escaped;
    index += 1;
  }
  return { value: decoded };
}

function validateStandardValues(source, entries) {
  const values = Object.fromEntries(entries);
  if (!FORMAT_VERSION.test(values["docai-messaging"])) {
    return failure(source, "Metadata docai-messaging must use major.minor.patch numeric form.");
  }
  if (!PROFILES.has(values.profile)) {
    return failure(source, "Metadata profile must be 'full' or 'compact'.");
  }
  if (values.perspective === ""
    || values.perspective.startsWith(" ")
    || values.perspective.endsWith(" ")) {
    return failure(source, "Metadata perspective must be non-empty without a leading or trailing ASCII space.");
  }
  if (!COVERAGE_VALUES.has(values.coverage)) {
    return failure(source, "Metadata coverage must be 'complete' or 'requires-source'.");
  }
  if (!KNOWLEDGE_VALUES.has(values.knowledge)) {
    return failure(source, "Metadata knowledge must be 'complete' or 'requires-input'.");
  }
  return null;
}

export function parseOpeningMetadata(input) {
  const source = sourceLine(input);
  if (typeof source.text !== "string" || /[\r\n]/.test(source.text)) {
    return failure(source, "Opening metadata must occupy exactly one source line.");
  }
  if (!source.text.startsWith("> ")) {
    return failure(source, "Opening metadata must begin with the exact Markdown blockquote prefix '> '.");
  }

  const rawPairs = splitPairs(source.text.slice(2));
  if (rawPairs === null) {
    return failure(source, "Metadata pairs must be separated by an unescaped ' | '.");
  }

  const entries = [];
  const seen = new Set();
  for (const pair of rawPairs) {
    const separator = pair.indexOf(": ");
    if (separator <= 0) return failure(source, "Each metadata pair must contain 'key: value'.");
    const key = pair.slice(0, separator);
    if (seen.has(key)) {
      const kind = EXTENSION_KEY.test(key) ? "extension key" : "key";
      return failure(source, `Metadata ${kind} '${key}' is duplicated.`, "DM-META-004");
    }
    seen.add(key);
    const decoded = decodeValue(pair.slice(separator + 2));
    if (decoded.error) return failure(source, decoded.error);
    entries.push([key, decoded.value]);
  }

  for (let index = 0; index < STANDARD_KEYS.length; index += 1) {
    if (entries[index]?.[0] !== STANDARD_KEYS[index]) {
      if (!seen.has(STANDARD_KEYS[index])) {
        return failure(source, `Opening metadata is missing required metadata key '${STANDARD_KEYS[index]}'.`);
      }
      return failure(source, "Opening metadata standard keys are missing or out of canonical order.");
    }
  }
  const invalidStandardValue = validateStandardValues(source, entries);
  if (invalidStandardValue !== null) return invalidStandardValue;
  for (const [key] of entries.slice(STANDARD_KEYS.length)) {
    if (!EXTENSION_KEY.test(key)) {
      return failure(source, `Unknown or invalid metadata key '${key}' is not permitted.`);
    }
  }

  return { value: Object.fromEntries(entries), diagnostics: [] };
}
