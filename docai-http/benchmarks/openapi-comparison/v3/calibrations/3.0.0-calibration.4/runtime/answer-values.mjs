import { assertPlainJson } from "./strict-json.mjs";
import { isDeepStrictEqual } from "node:util";

export function readAnswerPointer(value, pointer) {
  assertPlainJson(value, "answer value");
  if (typeof pointer !== "string" || !/^(?:\/(?:[^~]|~[01])*)*$/.test(pointer)) {
    throw new TypeError("pointer must be a JSON pointer");
  }
  if (pointer === "") return { found: true, value };
  let current = value;
  for (const token of pointer.slice(1).split("/").map((s) => s.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, token)) return { found: false };
    current = current[token];
  }
  return { found: true, value: current };
}

export function resolveTaskInput(reference, inputs) {
  assertPlainJson(reference, "reference");
  assertPlainJson(inputs, "public inputs");
  referenceIdentity(reference);
  if (reference.kind !== "task-input" || !Object.hasOwn(inputs, reference.name)) {
    throw new Error("task input not supplied publicly");
  }
  return structuredClone(inputs[reference.name]);
}

export function referenceIdentity(reference) {
  assertPlainJson(reference, "reference");
  const fields = {
    "task-input": ["kind", "name"],
    "external-input": ["kind", "name"],
    generated: ["kind", "rule", "scope"],
    "step-output": ["kind", "step", "field"],
  }[reference.kind];
  if (!fields || Object.keys(reference).length !== fields.length || fields.some((key) => !Object.hasOwn(reference, key))
      || fields.some((key) => key === "step" ? !Number.isInteger(reference[key]) : typeof reference[key] !== "string")
      || (reference.kind === "generated" && !["opaque-string", "uuid", "random-bytes"].includes(reference.rule))) {
    throw new TypeError("malformed reference identity");
  }
  return JSON.stringify(fields.map((key) => reference[key]));
}

export function validateAnswerRelations({ answer, task }) {
  const failures = [];
  const fail = (path, category, message) => failures.push({ predicate_id: `language:${category}`, path, category, message });
  const unknown = new Set();
  const steps = answer.steps?.items ?? [];
  const ordinals = new Set();
  for (const [i, step] of steps.entries()) {
    if (step.order !== i + 1 || ordinals.has(step.order)) fail(`/steps/items/${i}/order`, "step-order", "Steps require consecutive unique ordinals in execution order");
    ordinals.add(step.order);
  }
  // Returned-field identities come from the task's source-mapped retention assertions.
  const outputs = new Set();
  for (const a of task.private.assertions) walk(a.value, "", (v) => {
    if (v.kind === "step-output") outputs.add(`${v.step}:${v.field}`);
  });
  walk(answer, "", (v, path) => {
    if (path === "/uncertainties" || path.startsWith("/uncertainties/")) return;
    if (v.status === "unknown" || v.status === "partial") unknown.add(path);
    if (Array.isArray(v.items) && isAnswerCollectionPath(path)) {
      const seen = new Set();
      for (const [i, item] of v.items.entries()) {
        const id = collectionIdentity(item, path);
        if (seen.has(id)) fail(`${path}/items/${i}`, "identity-conflict", "Duplicate or conflicting collection member");
        seen.add(id);
      }
    }
    if (/^(?:\/request|\/steps\/items\/\d+\/request)$/.test(path)) validateRequestMedia(v, path, fail);
    if (v.kind === "task-input" && !Object.hasOwn(task.public.inputs, v.name)) fail(path, "reference", "Task input is not publicly supplied");
    if (v.kind !== "step-output") return;
    const local = path.match(/^\/steps\/items\/(\d+)\/(request|keep)(?:\/|$)/);
    const recovery = path.match(/^\/failure_recovery\/items\/(\d+)\/preserve(?:\/|$)/);
    const operation = recovery ? answer.failure_recovery.items[Number(recovery[1])].operation : null;
    const affected = operation?.status === "known" ? steps.find((s) => isDeepStrictEqual(s.request.method, operation.value.method) && isDeepStrictEqual(s.request.path, operation.value.path)) : null;
    const current = local ? steps[Number(local[1])]?.order : affected?.order;
    const input = local?.[2] === "request" || Boolean(affected);
    if (!ordinals.has(v.step) || !outputs.has(`${v.step}:${v.field}`)) fail(path, "reference", "Output reference has no available producer field");
    if (current !== undefined && (input ? v.step >= current : v.step > current)) fail(path, "reference", "Input dependencies must be backward; retention follows its response");
    if (input && !steps.find((s) => s.order === v.step)?.keep.items.some((r) => isDeepStrictEqual(r, v))) fail(path, "reference", "Referenced output was not retained by its producer");
  });
  const reported = new Set();
  for (const [i, u] of (answer.uncertainties ?? []).entries()) {
    if (!unknown.has(u) || reported.has(u)) fail(`/uncertainties/${i}`, "uncertainty-correspondence", "Uncertainty must identify one unknown value or incomplete collection");
    reported.add(u);
  }
  for (const path of unknown) if (!reported.has(path)) fail(path, "uncertainty-correspondence", "Unknown value or incomplete collection requires uncertainty");
  return failures;
}

function validateRequestMedia(request, path, fail) {
  const known = (record) => record?.status === "known";
  const reject = (field, message) => fail(`${path}/${field}`, "request-media-type", message);
  const type = known(request.content_type) ? request.content_type.value : undefined;
  const header = request.headers.items.find((h) => h.name.toLowerCase() === "content-type");
  if (header && known(header.scheme) && header.scheme.value !== null) reject("headers", "Content-Type cannot carry an authorization scheme");
  if (header && known(header.value) && type !== undefined && header.value.value !== type) reject("content_type", "Content-Type header and request media type disagree");
  if (known(request.body) && request.body.value !== null && type !== undefined && type !== "application/json") reject("body", "JSON body and request media type disagree");
  if (request.parts.items.length > 0 && type !== undefined && type !== "multipart/form-data") reject("parts", "Multipart parts and request media type disagree");
  const mode = known(request.boundary.mode) ? request.boundary.mode.value : undefined;
  const boundary = known(request.boundary.value) ? request.boundary.value.value : undefined;
  if (type === "multipart/form-data") {
    if (known(request.body) && request.body.value !== null) reject("body", "Multipart parts cannot also claim a JSON body");
    if (mode === "not-applicable") reject("boundary/mode", "Multipart requires boundary handling");
    if (mode === "library-managed" && boundary !== undefined && boundary !== null) reject("boundary/value", "Library-managed boundary cannot also specify a literal boundary");
    if (mode === "caller-specified" && boundary === null) reject("boundary/value", "Caller-specified boundary requires a value");
  } else if (type !== undefined) {
    if (mode !== undefined && mode !== "not-applicable") reject("boundary/mode", "Non-multipart request cannot claim multipart boundary handling");
    if (boundary !== undefined && boundary !== null) reject("boundary/value", "Non-multipart request cannot specify a multipart boundary");
  }
}

export function isAnswerCollectionPath(path) {
  if (/^(?:\/request|\/steps\/items\/\d+\/request)\/(?:path_parameters|query|headers|parts|validation)$/.test(path)) return true;
  if (/^\/(?:retry|failure_recovery)\/items\/\d+\/preserve$/.test(path)) return true;
  if (/^\/errors\/items\/\d+\/recovery\/preserve$/.test(path)) return true;
  if (/^\/steps\/items\/\d+\/(?:keep|states_after_success)$/.test(path)) return true;
  if (/^\/(?:webhook_reconciliation|webhook\/reconciliation)\/items\/\d+\/(?:match_by|record_states)$/.test(path)) return true;
  return new Set(["/steps", "/errors", "/retry", "/failure_recovery", "/webhook_reconciliation",
    "/response/body/fields", "/response/headers", "/response/relations", "/response/retained_fields",
    "/webhook/headers", "/webhook/payload/fields", "/webhook/payload/metadata/allowed_actions", "/webhook/reconciliation"]).has(path);
}

export function collectionIdentity(item, path) {
  if (item && typeof item === "object") {
    if (Object.hasOwn(item, "name")) return `name:${path.endsWith("/headers") ? item.name.toLowerCase() : item.name}`;
    if (Object.hasOwn(item, "subject")) return `subject:${item.subject}`;
    if (Object.hasOwn(item, "constraint")) return stableJson([item.target, item.constraint]);
    if (Object.hasOwn(item, "order")) return `order:${item.order}`;
    if (Object.hasOwn(item, "trigger")) return stableJson([item.trigger, item.operation]);
    if (Object.hasOwn(item, "recovery")) return stableJson([item.status, item.code]);
    if (Object.hasOwn(item, "event")) return stableJson(item.event);
    if (Object.hasOwn(item, "target")) return stableJson([item.target, item.field]);
  }
  return stableJson(item);
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function walk(value, path, visit) {
  if (!value || typeof value !== "object") return;
  visit(value, path);
  for (const [key, child] of Object.entries(value)) walk(child, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, visit);
}
