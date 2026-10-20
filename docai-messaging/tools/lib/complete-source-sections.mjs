import { scanMarkdown } from "./markdown.mjs";

// Candidate source auditing extracts standard sections without interpreting
// fenced data as headings. Ordinary validation remains the syntax gate.
export function extractSourceSection(text, heading) {
  if (typeof text !== "string") return null;
  const markdown = scanMarkdown(text).value;
  if (markdown === null) return null;
  const start = markdown.headings.find((entry) => `${"#".repeat(entry.level)} ${entry.text}` === heading);
  if (start === undefined) return null;
  const end = markdown.headings.find((entry) => entry.line > start.line && entry.level <= start.level)?.line
    ?? markdown.lines.length + 1;
  return markdown.lines.filter((entry) => entry.line > start.line && entry.line < end)
    .filter((entry) => entry.inFence || !entry.text.startsWith("> docai-identity:"))
    .map((entry) => entry.text).join("\n").trim();
}
