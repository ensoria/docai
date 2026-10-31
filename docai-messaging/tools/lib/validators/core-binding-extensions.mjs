import { postTableMarkerKind } from "./core-marker-order.mjs";

// Call only for a Bindings unit after leading deviations have been consumed.
// Tables retain their complete tail: post-table adjacency and ordering apply there.
// The caller still validates the remaining core, including unknown adjacency.
export function bindingCoreLines(lines) {
  // Pipe tables allow surrounding ASCII spaces; do not normalize other whitespace.
  if (lines[0]?.text.replace(/^ +/, "").startsWith("|")) return lines;
  let end = lines.length;
  while (end > 0 && postTableMarkerKind(lines[end - 1].text)?.type === "extension") end -= 1;
  return lines.slice(0, end);
}
