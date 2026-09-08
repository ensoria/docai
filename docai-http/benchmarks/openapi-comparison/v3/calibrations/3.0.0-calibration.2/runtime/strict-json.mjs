import { types } from "node:util";

export function assertPlainJson(value, location = "value", ancestors = new Set()) {
  if (types.isProxy(value)) {
    throw new TypeError(`${location} must be plain JSON; Proxy values are not allowed`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError(`${location} must be plain JSON; non-finite numbers are not allowed`);
  }
  if (typeof value !== "object") throw new TypeError(`${location} must be plain JSON`);
  if (ancestors.has(value)) throw new TypeError(`${location} must be plain JSON; cycles are not allowed`);
  if (Array.isArray(value) && Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${location} must be a plain JSON array`);
  }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${location} must be a plain JSON object`);
  }

  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${location} must be plain JSON; symbol keys are not allowed`);
  }
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || !keys.every((key, index) => key === String(index))) {
      throw new TypeError(`${location} must be plain JSON; arrays must contain only own indexed data`);
    }
  }
  Object.entries(descriptors).forEach(([key, descriptor]) => {
    if (Array.isArray(value) && key === "length") return;
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${location}.${key} must be a plain JSON value`);
    }
    assertPlainJson(descriptor.value, Array.isArray(value) ? `${location}[${key}]` : `${location}.${key}`, ancestors);
  });
  ancestors.delete(value);
}

export function clonePlainJson(value, location = "value") {
  assertPlainJson(value, location);
  return structuredClone(value);
}
