export function assertFinitePlainJson(value, label = "value") {
  validateValue(value, label, new WeakSet());
  return value;
}

export function cloneFinitePlainJson(value, label = "value") {
  assertFinitePlainJson(value, label);
  return cloneValue(value);
}

export function canonicalJson(value, label = "value") {
  assertFinitePlainJson(value, label);
  return serializeCanonical(value);
}

function validateValue(value, label, ancestors) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite plain JSON`);
    return;
  }
  if (typeof value !== "object") throw new TypeError(`${label} must be finite plain JSON`);
  if (ancestors.has(value)) throw new TypeError(`${label} must not contain cycles`);
  ancestors.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(`${label} must contain only plain objects and arrays`);
    }
    const expectedKeys = Array.from({ length: value.length }, (_, index) => String(index)).concat("length");
    const ownKeys = Reflect.ownKeys(value);
    if (!sameKeys(ownKeys, expectedKeys)) {
      throw new TypeError(`${label} must contain dense arrays without hidden or symbol keys`);
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
        throw new TypeError(`${label} must contain enumerable data properties only`);
      }
      validateValue(descriptor.value, `${label}[${index}]`, ancestors);
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${label} must contain only plain objects and arrays`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new TypeError(`${label} must not contain symbol keys`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
        throw new TypeError(`${label} must contain enumerable data properties only`);
      }
      validateValue(descriptor.value, `${label}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

function cloneValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  const clone = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
  for (const key of Object.keys(value)) {
    Object.defineProperty(clone, key, {
      value: cloneValue(value[key]),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return clone;
}

function serializeCanonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serializeCanonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${serializeCanonical(value[key])}`
  )).join(",")}}`;
}

function sameKeys(left, right) {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}
