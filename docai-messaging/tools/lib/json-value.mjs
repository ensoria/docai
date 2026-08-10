function numberTuple(token) {
  const negative = token[0] === "-";
  const unsigned = negative ? token.slice(1) : token;
  const exponentIndex = unsigned.search(/[eE]/);
  const mantissa = exponentIndex === -1 ? unsigned : unsigned.slice(0, exponentIndex);
  const explicitExponent = exponentIndex === -1 ? 0n : BigInt(unsigned.slice(exponentIndex + 1));
  const decimalIndex = mantissa.indexOf(".");
  const integer = decimalIndex === -1 ? mantissa : mantissa.slice(0, decimalIndex);
  const fraction = decimalIndex === -1 ? "" : mantissa.slice(decimalIndex + 1);
  const allDigits = integer + fraction;

  let first = 0;
  while (first < allDigits.length && allDigits[first] === "0") first += 1;
  if (first === allDigits.length) {
    return { kind: "number", sign: 0, coefficient: "0", exponent: 0n };
  }

  let last = allDigits.length;
  while (allDigits[last - 1] === "0") last -= 1;
  const removedTrailingZeros = allDigits.length - last;
  const exponent = explicitExponent - BigInt(fraction.length) + BigInt(removedTrailingZeros);
  return {
    kind: "number",
    sign: negative ? -1 : 1,
    coefficient: allDigits.slice(first, last),
    exponent
  };
}

class ExactJsonParser {
  constructor(source) {
    if (typeof source !== "string") throw new TypeError("Exact JSON source must be a string.");
    this.source = source;
    this.cursor = 0;
  }

  fail(message) {
    throw new SyntaxError(`Invalid JSON at offset ${this.cursor}: ${message}`);
  }

  skipWhitespace() {
    while (this.cursor < this.source.length && /[\u0009\u000a\u000d\u0020]/.test(this.source[this.cursor])) {
      this.cursor += 1;
    }
  }

  parse() {
    this.skipWhitespace();
    const value = this.readValue();
    this.skipWhitespace();
    if (this.cursor !== this.source.length) this.fail("unexpected trailing content");
    return value;
  }

  readValue() {
    const character = this.source[this.cursor];
    if (character === '"') return this.readString();
    if (character === "[") return this.readArray();
    if (character === "{") return this.readObject();
    if (character === "-" || (character >= "0" && character <= "9")) return this.readNumber();
    if (this.source.startsWith("true", this.cursor)) {
      this.cursor += 4;
      return true;
    }
    if (this.source.startsWith("false", this.cursor)) {
      this.cursor += 5;
      return false;
    }
    if (this.source.startsWith("null", this.cursor)) {
      this.cursor += 4;
      return null;
    }
    this.fail("expected a JSON value");
  }

  readString() {
    this.cursor += 1;
    let value = "";
    while (this.cursor < this.source.length) {
      const character = this.source[this.cursor];
      if (character === '"') {
        this.cursor += 1;
        return value;
      }
      if (character === "\\") {
        this.cursor += 1;
        const escape = this.source[this.cursor];
        const simple = {
          '"': '"',
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t"
        };
        if (Object.hasOwn(simple, escape)) {
          value += simple[escape];
          this.cursor += 1;
          continue;
        }
        if (escape !== "u") this.fail("unknown string escape");
        const digits = this.source.slice(this.cursor + 1, this.cursor + 5);
        if (!/^[0-9A-Fa-f]{4}$/.test(digits)) this.fail("invalid Unicode escape");
        value += String.fromCharCode(parseInt(digits, 16));
        this.cursor += 5;
        continue;
      }
      if (character.charCodeAt(0) < 0x20) this.fail("unescaped control character in string");
      value += character;
      this.cursor += 1;
    }
    this.fail("unterminated string");
  }

  readNumber() {
    const start = this.cursor;
    if (this.source[this.cursor] === "-") this.cursor += 1;

    if (this.source[this.cursor] === "0") {
      this.cursor += 1;
    } else if (this.source[this.cursor] >= "1" && this.source[this.cursor] <= "9") {
      while (this.source[this.cursor] >= "0" && this.source[this.cursor] <= "9") this.cursor += 1;
    } else {
      this.fail("invalid integer part");
    }

    if (this.source[this.cursor] === ".") {
      this.cursor += 1;
      const fractionStart = this.cursor;
      while (this.source[this.cursor] >= "0" && this.source[this.cursor] <= "9") this.cursor += 1;
      if (this.cursor === fractionStart) this.fail("fraction requires a digit");
    }

    if (this.source[this.cursor] === "e" || this.source[this.cursor] === "E") {
      this.cursor += 1;
      if (this.source[this.cursor] === "+" || this.source[this.cursor] === "-") this.cursor += 1;
      const exponentStart = this.cursor;
      while (this.source[this.cursor] >= "0" && this.source[this.cursor] <= "9") this.cursor += 1;
      if (this.cursor === exponentStart) this.fail("exponent requires a digit");
    }

    return numberTuple(this.source.slice(start, this.cursor));
  }

  readArray() {
    this.cursor += 1;
    const values = [];
    this.skipWhitespace();
    if (this.source[this.cursor] === "]") {
      this.cursor += 1;
      return values;
    }
    while (true) {
      values.push(this.readValue());
      this.skipWhitespace();
      if (this.source[this.cursor] === "]") {
        this.cursor += 1;
        return values;
      }
      if (this.source[this.cursor] !== ",") this.fail("expected ',' or ']' in array");
      this.cursor += 1;
      this.skipWhitespace();
    }
  }

  readObject() {
    this.cursor += 1;
    const members = new Map();
    this.skipWhitespace();
    if (this.source[this.cursor] === "}") {
      this.cursor += 1;
      return members;
    }
    while (true) {
      if (this.source[this.cursor] !== '"') this.fail("object member name must be a string");
      const name = this.readString();
      if (members.has(name)) this.fail(`duplicate object member name ${JSON.stringify(name)}`);
      this.skipWhitespace();
      if (this.source[this.cursor] !== ":") this.fail("expected ':' after object member name");
      this.cursor += 1;
      this.skipWhitespace();
      members.set(name, this.readValue());
      this.skipWhitespace();
      if (this.source[this.cursor] === "}") {
        this.cursor += 1;
        return members;
      }
      if (this.source[this.cursor] !== ",") this.fail("expected ',' or '}' in object");
      this.cursor += 1;
      this.skipWhitespace();
    }
  }
}

function isNumberTuple(value) {
  return value !== null && !Array.isArray(value) && !(value instanceof Map) && value.kind === "number";
}

export function parseExactJson(source) {
  return new ExactJsonParser(source).parse();
}

export function equalExactJson(left, right) {
  if (left === right) return true;
  if (isNumberTuple(left) || isNumberTuple(right)) {
    return isNumberTuple(left)
      && isNumberTuple(right)
      && left.sign === right.sign
      && left.coefficient === right.coefficient
      && left.exponent === right.exponent;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => equalExactJson(value, right[index]));
  }
  if (left instanceof Map || right instanceof Map) {
    if (!(left instanceof Map) || !(right instanceof Map) || left.size !== right.size) return false;
    for (const [name, value] of left) {
      if (!right.has(name) || !equalExactJson(value, right.get(name))) return false;
    }
    return true;
  }
  return false;
}
