import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { diagnostic } from "./diagnostics.mjs";
import { parseDocsPath } from "./paths.mjs";

const IDENTITY_PREFIX = "> docai-identity: ";
const SHORT_ID_PATTERN = /^b32:[a-z2-7]{26}$/;
const FULL_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function sourceLine(input) {
  if (typeof input === "string") return { text: input, file: "<input>", line: 1 };
  return { text: input.text, file: input.file ?? "<input>", line: input.line ?? 1 };
}

function utf8Bytes(input) {
  if (typeof input === "string") return Buffer.from(input, "utf8");
  if (!(input instanceof Uint8Array)) throw new TypeError("UTF-8 input must be a string or byte array.");
  return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

export function decodeUtf8Bytes(input) {
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(utf8Bytes(input));
}

export function scanUtf8Lines(input) {
  const bytes = utf8Bytes(input);
  decodeUtf8Bytes(bytes);
  const lines = [];
  let start = 0;
  let line = 1;
  for (let index = 0; index < bytes.length;) {
    if (bytes[index] !== 0x0a && bytes[index] !== 0x0d) {
      index += 1;
      continue;
    }
    const end = index;
    const separatorEnd = bytes[index] === 0x0d && bytes[index + 1] === 0x0a
      ? index + 2
      : index + 1;
    lines.push({
      text: decodeUtf8Bytes(bytes.subarray(start, end)),
      start,
      end,
      separatorEnd,
      line
    });
    start = separatorEnd;
    line += 1;
    index = separatorEnd;
  }
  lines.push({
    text: decodeUtf8Bytes(bytes.subarray(start)),
    start,
    end: bytes.length,
    separatorEnd: bytes.length,
    line
  });
  return { bytes, lines };
}

function identityFailure(source, message) {
  return {
    value: null,
    diagnostics: [diagnostic("DM-ID-001", source.file, source.line, message)]
  };
}

export function parseIdentityTrailer(input, { root = false } = {}) {
  const source = sourceLine(input);
  if (typeof source.text !== "string" || /[\r\n]/.test(source.text)) {
    return identityFailure(source, "The identity trailer must occupy exactly one source line.");
  }
  if (!source.text.startsWith(IDENTITY_PREFIX)) {
    return identityFailure(source, `The identity trailer must begin with '${IDENTITY_PREFIX}'.`);
  }

  const expectedKeys = root
    ? ["set_id", "projection_id", "set_digest", "projection_digest"]
    : ["set_id", "projection_id"];
  const pairs = source.text.slice(IDENTITY_PREFIX.length).split(" | ");
  if (pairs.length !== expectedKeys.length) {
    return identityFailure(
      source,
      root
        ? "The root INDEX identity trailer must contain exactly four standard pairs."
        : "A non-root identity trailer must contain exactly two standard pairs."
    );
  }

  const entries = [];
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const separator = pairs[index].indexOf(": ");
    const key = separator < 0 ? "" : pairs[index].slice(0, separator);
    const value = separator < 0 ? "" : pairs[index].slice(separator + 2);
    if (key !== expectedKeys[index]) {
      return identityFailure(source, "Identity keys are missing, extended, or out of canonical order.");
    }
    const valid = key.endsWith("_id")
      ? SHORT_ID_PATTERN.test(value)
      : FULL_DIGEST_PATTERN.test(value);
    if (!valid) {
      return identityFailure(source, `Identity value '${key}' does not use its exact constrained ASCII form.`);
    }
    entries.push([key, value]);
  }

  return { value: Object.fromEntries(entries), diagnostics: [] };
}

export function deriveShortId(fullDigest) {
  if (typeof fullDigest !== "string" || !FULL_DIGEST_PATTERN.test(fullDigest)) {
    throw new TypeError("A full digest must use the exact lowercase sha256:<64-hex> form.");
  }

  const digestBytes = Buffer.from(fullDigest.slice("sha256:".length), "hex").subarray(0, 16);
  let accumulator = 0;
  let bits = 0;
  let encoded = "";
  for (const byte of digestBytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      encoded += BASE32_ALPHABET[(accumulator >>> bits) & 31];
      accumulator &= (1 << bits) - 1;
    }
  }
  if (bits > 0) encoded += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  return `b32:${encoded}`;
}

function fileBytes(file) {
  const source = file.bytes ?? file.content;
  if (typeof source === "string") return Buffer.from(source, "utf8");
  if (!(source instanceof Uint8Array)) {
    throw new TypeError(`File '${file.path ?? "<unknown>"}' must provide UTF-8 content or bytes.`);
  }
  try {
    const bytes = utf8Bytes(source);
    decodeUtf8Bytes(bytes);
    return bytes;
  } catch {
    throw new TypeError(`File '${file.path ?? "<unknown>"}' is not valid UTF-8.`);
  }
}

function finalNonEmptyLine(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].end > lines[index].start) return lines[index];
  }
  return null;
}

function replaceSetHandlesWithSelf(file) {
  const content = fileBytes(file);
  const scanned = scanUtf8Lines(content);
  const line = finalNonEmptyLine(scanned.lines);
  const root = file.path === "INDEX.md";
  if (line === null) throw new TypeError(`File '${file.path}' has no identity trailer.`);
  const parsed = parseIdentityTrailer(line.text, { root });
  if (parsed.value === null) throw new TypeError(`File '${file.path}' has no valid identity trailer.`);

  let replacement = line.text.replace(
    `${IDENTITY_PREFIX}set_id: ${parsed.value.set_id}`,
    `${IDENTITY_PREFIX}set_id: SELF`
  );
  if (root) {
    replacement = replacement.replace(
      ` | set_digest: ${parsed.value.set_digest}`,
      " | set_digest: SELF"
    );
  }
  return Buffer.concat([
    content.subarray(0, line.start),
    Buffer.from(replacement, "ascii"),
    content.subarray(line.end)
  ]);
}

function lengthPrefixed(bytes) {
  return Buffer.concat([Buffer.from(`${bytes.length}:`, "ascii"), bytes]);
}

function compareAsciiPaths(left, right) {
  return Buffer.compare(Buffer.from(left.path, "ascii"), Buffer.from(right.path, "ascii"));
}

export function computeSetDigest(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new TypeError("A document set must contain at least one file.");
  }

  const seen = new Set();
  const orderedFiles = files.map((file) => {
    const parsedPath = parseDocsPath(file?.path);
    if (parsedPath.value === null || parsedPath.value.kind !== "docs-root-relative") {
      throw new TypeError(`File path '${file?.path ?? "<missing>"}' is not docs-root-relative.`);
    }
    if (seen.has(file.path)) throw new TypeError(`Document-set path '${file.path}' is duplicated.`);
    seen.add(file.path);
    return file;
  }).sort(compareAsciiPaths);

  const manifestParts = [];
  for (const file of orderedFiles) {
    const pathBytes = Buffer.from(file.path, "utf8");
    const fileDigest = Buffer.from(
      createHash("sha256").update(replaceSetHandlesWithSelf(file)).digest("hex"),
      "ascii"
    );
    manifestParts.push(lengthPrefixed(pathBytes), lengthPrefixed(fileDigest));
  }
  return `sha256:${createHash("sha256").update(Buffer.concat(manifestParts)).digest("hex")}`;
}

export function stampIdentityTrailer(content, values, { root = false } = {}) {
  let bytes;
  try {
    bytes = utf8Bytes(content);
    decodeUtf8Bytes(bytes);
  } catch {
    throw new TypeError("Cannot stamp content that is not valid UTF-8.");
  }
  const line = finalNonEmptyLine(scanUtf8Lines(bytes).lines);
  if (line === null) throw new TypeError("Cannot stamp a document without an identity trailer.");
  const parsed = parseIdentityTrailer(line.text, { root });
  if (parsed.value === null) throw new TypeError("Cannot stamp an invalid identity trailer.");

  const next = { ...parsed.value, ...values };
  const replacement = root
    ? `${IDENTITY_PREFIX}set_id: ${next.set_id} | projection_id: ${next.projection_id} | set_digest: ${next.set_digest} | projection_digest: ${next.projection_digest}`
    : `${IDENTITY_PREFIX}set_id: ${next.set_id} | projection_id: ${next.projection_id}`;
  if (parseIdentityTrailer(replacement, { root }).value === null) {
    throw new TypeError("Cannot stamp invalid identity values.");
  }
  return Buffer.concat([
    bytes.subarray(0, line.start),
    Buffer.from(replacement, "ascii"),
    bytes.subarray(line.end)
  ]);
}
