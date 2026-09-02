const SOURCE_API_UNKNOWN_MARKER = /^\*\*unknown\*\*: API (?:contract version|identity) for source [A-Za-z0-9._-]+ requires .+$/;

export function isSourceApiUnknownMarker(value) {
  return typeof value === "string" && SOURCE_API_UNKNOWN_MARKER.test(value);
}
