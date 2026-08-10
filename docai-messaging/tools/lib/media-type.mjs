const UTF8 = new TextDecoder("utf-8", { fatal: true });

function invalid(message) {
  throw new SyntaxError(`Invalid media type: ${message}`);
}

function requireScalarString(value) {
  if (typeof value !== "string") invalid("source value must be a string");
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const following = value.charCodeAt(index + 1);
      if (following >= 0xdc00 && following <= 0xdfff) {
        index += 1;
        continue;
      }
      invalid("source value contains an unpaired UTF-16 surrogate");
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) {
      invalid("source value contains an unpaired UTF-16 surrogate");
    }
  }
}

function isOws(octet) {
  return octet === 0x20 || octet === 0x09;
}

function isTchar(octet) {
  return (octet >= 0x30 && octet <= 0x39)
    || (octet >= 0x41 && octet <= 0x5a)
    || (octet >= 0x61 && octet <= 0x7a)
    || octet === 0x21
    || octet === 0x23
    || octet === 0x24
    || octet === 0x25
    || octet === 0x26
    || octet === 0x27
    || octet === 0x2a
    || octet === 0x2b
    || octet === 0x2d
    || octet === 0x2e
    || octet === 0x5e
    || octet === 0x5f
    || octet === 0x60
    || octet === 0x7c
    || octet === 0x7e;
}

function isQdtext(octet) {
  return octet === 0x09
    || octet === 0x20
    || octet === 0x21
    || (octet >= 0x23 && octet <= 0x5b)
    || (octet >= 0x5d && octet <= 0x7e)
    || octet >= 0x80;
}

function isQuotedPairValue(octet) {
  return octet === 0x09 || octet === 0x20 || (octet >= 0x21 && octet <= 0x7e) || octet >= 0x80;
}

function asciiLower(bytes) {
  return Buffer.from(bytes.map((octet) => (
    octet >= 0x41 && octet <= 0x5a ? octet + 0x20 : octet
  ))).toString("ascii");
}

function readToken(bytes, cursor) {
  const start = cursor;
  while (cursor < bytes.length && isTchar(bytes[cursor])) cursor += 1;
  if (cursor === start) invalid("expected a non-empty token");
  return { bytes: bytes.subarray(start, cursor), cursor };
}

function readQuotedString(bytes, cursor) {
  const decoded = [];
  cursor += 1;
  while (cursor < bytes.length) {
    const octet = bytes[cursor];
    if (octet === 0x22) {
      const value = Uint8Array.from(decoded);
      try {
        UTF8.decode(value);
      } catch {
        invalid("decoded parameter value is not valid UTF-8");
      }
      return { bytes: value, cursor: cursor + 1 };
    }
    if (octet === 0x5c) {
      if (cursor + 1 >= bytes.length || !isQuotedPairValue(bytes[cursor + 1])) {
        invalid("quoted parameter has a trailing or invalid escape");
      }
      decoded.push(bytes[cursor + 1]);
      cursor += 2;
      continue;
    }
    if (!isQdtext(octet)) invalid("quoted parameter contains an invalid octet");
    decoded.push(octet);
    cursor += 1;
  }
  invalid("quoted parameter is not terminated");
}

function renderValue(value) {
  if (value.length > 0 && value.every(isTchar)) return Buffer.from(value);
  const rendered = [0x22];
  for (const octet of value) {
    if (octet === 0x22 || octet === 0x5c) rendered.push(0x5c);
    rendered.push(octet);
  }
  rendered.push(0x22);
  return Buffer.from(rendered);
}

export function canonicalizeMediaType(sourceValue) {
  requireScalarString(sourceValue);
  const source = Buffer.from(sourceValue, "utf8");
  let cursor = 0;

  const type = readToken(source, cursor);
  cursor = type.cursor;
  if (source[cursor] !== 0x2f) invalid("type and subtype must be separated by '/'");
  cursor += 1;
  const subtype = readToken(source, cursor);
  cursor = subtype.cursor;

  const parameters = [];
  const names = new Set();
  while (cursor < source.length) {
    while (cursor < source.length && isOws(source[cursor])) cursor += 1;
    if (cursor === source.length) invalid("optional whitespace is not followed by a semicolon");
    if (source[cursor] !== 0x3b) invalid("unexpected octet after subtype or parameter");
    cursor += 1;
    while (cursor < source.length && isOws(source[cursor])) cursor += 1;
    if (cursor === source.length || source[cursor] === 0x3b) continue;

    const parameterName = readToken(source, cursor);
    cursor = parameterName.cursor;
    if (source[cursor] !== 0x3d) invalid("parameter name and value must use '=' without whitespace");
    cursor += 1;

    let parameterValue;
    if (source[cursor] === 0x22) {
      parameterValue = readQuotedString(source, cursor);
    } else {
      parameterValue = readToken(source, cursor);
    }
    cursor = parameterValue.cursor;

    const name = asciiLower(parameterName.bytes);
    if (names.has(name)) invalid(`duplicate parameter '${name}'`);
    names.add(name);
    parameters.push({ name, value: parameterValue.bytes });
  }

  parameters.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  const chunks = [
    Buffer.from(asciiLower(type.bytes), "ascii"),
    Buffer.from("/", "ascii"),
    Buffer.from(asciiLower(subtype.bytes), "ascii")
  ];
  for (const parameter of parameters) {
    chunks.push(Buffer.from(`;${parameter.name}=`, "ascii"), renderValue(parameter.value));
  }

  const canonical = Buffer.concat(chunks);
  try {
    return UTF8.decode(canonical);
  } catch {
    invalid("canonical result is not valid UTF-8");
  }
}
