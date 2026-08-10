import { diagnostic } from "./diagnostics.mjs";

const TERMINATOR = /[.!?。！？]/g;
const FINAL_TERMINATOR = /[.!?。！？]$/;

function sourceLine(input) {
  if (typeof input === "string") return { text: input, file: "<input>", line: 1 };
  return { text: input.text, file: input.file ?? "<input>", line: input.line ?? 1 };
}

function failure(source, message) {
  return {
    value: null,
    diagnostics: [diagnostic("DM-PARSE-004", source.file, source.line, message)]
  };
}

export function validateSentenceLine(input, min, max) {
  const source = sourceLine(input);
  if (typeof source.text !== "string" || source.text.length === 0) {
    return failure(source, "Sentence prose must be a non-empty source line.");
  }
  if (/[\r\n]/.test(source.text)) {
    return failure(source, "Sentence prose must occupy exactly one source line.");
  }
  if (!FINAL_TERMINATOR.test(source.text)) {
    return failure(source, "Sentence prose final character must be a canonical terminator.");
  }
  const count = source.text.match(TERMINATOR)?.length ?? 0;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || count < min || count > max) {
    return failure(source, `Sentence prose must contain between ${min} and ${max} literal terminators.`);
  }
  return { value: { line: source.text, count }, diagnostics: [] };
}
