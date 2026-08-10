import { diagnostic } from "./diagnostics.mjs";

const SEGMENT = /^[A-Za-z0-9._-]+$/;

function sourceLine(input) {
  if (typeof input === "string") return { text: input, file: "<input>", line: 1 };
  return { text: input.text, file: input.file ?? "<input>", line: input.line ?? 1 };
}

function failure(source, message) {
  return {
    value: null,
    diagnostics: [diagnostic("DM-PARSE-PATH", source.file, source.line, message)]
  };
}

function validSegments(segments) {
  return segments.length > 0
    && segments.every((segment) => segment !== "" && segment !== "." && segment !== ".." && SEGMENT.test(segment));
}

export function parseDocsPath(input) {
  const source = sourceLine(input);
  const value = source.text;
  if (typeof value !== "string" || value.length === 0) return failure(source, "Path must be non-empty.");
  if (/[?#]/.test(value)) return failure(source, "Path must not contain a query or fragment.");
  if (value.includes("\\")) return failure(source, "Path must not use a backslash separator.");
  if (value.startsWith("/")) return failure(source, "Path must not be absolute.");

  if (value.endsWith("/")) {
    let remainder = value;
    while (remainder.startsWith("../")) remainder = remainder.slice(3);
    const directory = remainder.slice(0, -1);
    if (!validSegments(directory.split("/"))) {
      return failure(source, "Profile link contains an empty, dot, dot-dot, or invalid segment.");
    }
    return {
      value: { path: value, kind: "profile-link", sentinelCollision: false },
      diagnostics: []
    };
  }

  if (!validSegments(value.split("/"))) {
    return failure(source, "Docs-root-relative path contains an empty, dot, dot-dot, or invalid segment.");
  }
  return {
    value: {
      path: value,
      kind: "docs-root-relative",
      sentinelCollision: value === "none"
    },
    diagnostics: []
  };
}
