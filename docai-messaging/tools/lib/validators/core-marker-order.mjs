const COLLECTION_UNKNOWN = /^\*\*unknown\*\*: additional unnamed (?:field|header|parameter) requires .+$/;
const EXTENSION = /^\*\*x-[A-Za-z0-9._-]+\*\*: .+$/;

function unicodeScalarCompare(left, right) {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0));
  const rightScalars = Array.from(right, (value) => value.codePointAt(0));
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index += 1) {
    if (leftScalars[index] !== rightScalars[index]) return leftScalars[index] - rightScalars[index];
  }
  return leftScalars.length - rightScalars.length;
}

export function postTableMarkerKind(text) {
  if (COLLECTION_UNKNOWN.test(text)) return { rank: 0, type: "collection-unknown" };
  if (text.startsWith("**unknown**: ") && text.length > "**unknown**: ".length) {
    return { rank: 1, type: "unknown" };
  }
  const unsupported = "**unsupported**: localized: ";
  if (text.startsWith(unsupported) && text.length > unsupported.length) {
    return { rank: 2, type: "unsupported" };
  }
  if (EXTENSION.test(text)) return { rank: 3, type: "extension" };
  return null;
}

export function collectPostTableMarkers(lines, table) {
  const markers = [];
  let expectedLine = table.endLine + 1;
  while (true) {
    const line = lines.find((entry) => entry.line === expectedLine);
    if (line === undefined || line.text === "") break;
    const kind = postTableMarkerKind(line.text);
    if (kind === null) break;
    markers.push({ ...line, kind });
    expectedLine += 1;
  }
  return markers;
}

export function validPostTableMarkerOrder(markers) {
  if (markers.filter((marker) => marker.kind.type === "collection-unknown").length > 1) {
    return false;
  }
  for (let index = 1; index < markers.length; index += 1) {
    const previous = markers[index - 1];
    const current = markers[index];
    if (current.kind.rank < previous.kind.rank) return false;
    if (current.kind.rank === previous.kind.rank
      && unicodeScalarCompare(previous.text, current.text) >= 0) return false;
  }
  return true;
}
