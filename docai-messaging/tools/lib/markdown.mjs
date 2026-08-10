import { diagnostic } from "./diagnostics.mjs";

function sourceDocument(input) {
  if (typeof input === "string") return { text: input, file: "<input>" };
  return { text: input.text, file: input.file ?? "<input>" };
}

function closingFence(text, delimiterLength) {
  const match = text.match(/^(`{3,}) *$/);
  return match !== null && match[1].length === delimiterLength;
}

export function scanMarkdown(input) {
  const source = sourceDocument(input);
  const texts = source.text.split(/\r\n|\n|\r/);
  const lines = [];
  const headings = [];
  const fences = [];
  let openFence = null;

  for (let index = 0; index < texts.length; index += 1) {
    const text = texts[index];
    const line = index + 1;
    if (openFence !== null) {
      lines.push({ text, line, inFence: true });
      if (closingFence(text, openFence.delimiterLength)) {
        fences.push({ ...openFence, endLine: line });
        openFence = null;
      }
      continue;
    }

    lines.push({ text, line, inFence: false });
    const fence = text.match(/^(`{3,})([^`]*)$/);
    if (fence !== null) {
      openFence = {
        delimiterLength: fence[1].length,
        info: fence[2].replace(/^ +/, "").replace(/ +$/, ""),
        startLine: line
      };
      continue;
    }
    const heading = text.match(/^(#{1,6}) (.+)$/);
    if (heading !== null) headings.push({ level: heading[1].length, text: heading[2], line });
  }

  if (openFence !== null) {
    return {
      value: null,
      diagnostics: [diagnostic(
        "DM-PARSE-001",
        source.file,
        openFence.startLine,
        "Fenced block opened on this line is not closed."
      )]
    };
  }
  return { value: { lines, headings, fences }, diagnostics: [] };
}
