import { isDeepStrictEqual } from "node:util";

const C = "complete-contexts", R = "complete-representations";
const A = "storefront-asyncapi-3.1.0", B = "storefront-behavior";
const authorities = {
  "api-identity": [A, B], "authorization": [A, B],
  "behavior-and-failure-handling": [B], "complete-contexts": [C],
  "convention-dependencies": [C, R], "conventions": [B, A],
  "environment-and-protocol": [A, B], "message-contracts-and-examples": [R, A],
  "operation-routing-and-message-selection": [C, R, A],
  "operation-summaries": [C, R, A], "operation-tasks": [C, R, B],
  "storefront-context-selection": [B], "workflow-labels": [C]
};
const adapters = [
  ["behavior-source", "complete-contexts@fixture-1", "1.0.0"],
  ["behavior-source", "complete-representations@fixture-1", "1.0.0"],
  ["behavior-source", "behavior-configuration@fixture-1", "1.0.0"],
  ["header-encoding", "kafka-record-headers;value-encoding=utf-8", "1.0.0"],
  ["payload-wire", "application/json", "docai-messaging-0.17.1"],
  ["payload-wire", "text/csv;charset=utf-8", "complete-fixture-csv-1.0.0"],
  ["schema", "application/vnd.aai.asyncapi+json;version=3.1.0", "docai-messaging-0.17.1"],
  ["source", "AsyncAPI 3.1.0", "1.0.0"]
];
const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, names) => record(v) && isDeepStrictEqual(Object.keys(v).sort(), [...names].sort());
const empty = v => Array.isArray(v) && v.length === 0;
const application = v => typeof v === "string" && v.length > 0
  && !v.startsWith(" ") && !v.endsWith(" ") && !/[\r\n]/.test(v);
const prefix = issue => `manifest contract: ${issue}`;
const authorityLabel = domain => ({
  "operation-tasks": "operation labels operation-tasks",
  "operation-summaries": "operation labels operation-summaries",
  "workflow-labels": "Workflow labels",
  "storefront-context-selection": "storefront context selection",
  "convention-dependencies": "convention dependencies precedence"
})[domain] ?? domain;

function resolveLocal(source, value) {
  const seen = new Set();
  while (record(value) && Object.hasOwn(value, "$ref")) {
    const ref = value.$ref;
    if (typeof ref !== "string" || !ref.startsWith("#/") || seen.has(ref)) return null;
    seen.add(ref);
    const tokens = ref.slice(2).split("/");
    if (tokens.some(token => /~(?![01])/.test(token))) return null;
    value = tokens.reduce((node, token) => {
      const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
      return record(node) && Object.hasOwn(node, key) ? node[key] : undefined;
    }, source);
  }
  return record(value) ? value : null;
}

// This is a closed candidate policy, not a schema for arbitrary manifests or a
// general precedence resolver. Values owned by placement/summary gates stay there.
export function auditCompleteManifestShape(m) {
  if (!keys(m, ["adapters", "counterpartMappings", "docaiMessaging", "generator",
    "manifestVersion", "perspective", "precedence", "publicationPolicy", "sources", "stableNameOverrides"])) {
    return [prefix("requires the reviewed ten root settings")];
  }
  const issues = [];
  const require = (ok, message) => { if (!ok) issues.push(prefix(message)); };
  require(m.manifestVersion === "1.0.0" && m.docaiMessaging === "0.17.1", "unsupported manifest or DocAI version");
  require(isDeepStrictEqual(m.generator, {
    id: "docai-messaging-complete-fixture-projector", version: "1.0.5"
  }), "generator identity/version differs from reviewed policy");
  require(keys(m.perspective, ["application", "mode", "sourceApplication"])
    && application(m.perspective.application)
    && m.perspective.application === m.perspective.sourceApplication
    && m.perspective.mode === "source-application-carry-through", "perspective must carry through the source application");
  require(empty(m.counterpartMappings) && empty(m.stableNameOverrides), "counterpartMappings and stableNameOverrides must be empty");
  if (!Array.isArray(m.precedence) || m.precedence.some(e => !keys(e, ["factDomain", "sourceOrder"]))
    || m.precedence.some(e => typeof e.factDomain !== "string" || !Object.hasOwn(authorities, e.factDomain))) {
    issues.push(prefix("precedence requires closed records for known fact domains"));
  }
  for (const [domain, sourceOrder] of Object.entries(authorities)) {
    const entries = Array.isArray(m.precedence) ? m.precedence.filter(e => e?.factDomain === domain) : [];
    require(entries.length === 1 && isDeepStrictEqual(entries[0].sourceOrder, sourceOrder),
      `${authorityLabel(domain)} authority differs from reviewed sourceOrder`);
  }
  const actualAdapters = Array.isArray(m.adapters) && m.adapters.every(e => keys(e, ["class", "target", "ruleVersion"]))
    ? m.adapters.map(e => JSON.stringify([e.class, e.target, e.ruleVersion])).sort() : null;
  require(isDeepStrictEqual(actualAdapters, adapters.map(e => JSON.stringify(e)).sort()), "adapter descriptors differ from reviewed rules");
  require(Array.isArray(m.sources) && m.sources.every(e => keys(e,
    ["sourceId", "location", "revision", "sha256", "specification", "type"])), "unexpected source binding shape");
  const p = m.publicationPolicy;
  require(record(p) && Object.keys(p).every(key => ["id", "version", "catalogSummaries",
    "catalogPlacement", "channelPlacement", "contextPlacement", "relatedNavigation"].includes(key))
    && p.id === "docai-messaging-complete-fixture-publication" && p.version === "1.0.0", "publicationPolicy identity/settings differ from reviewed scope");
  // These blocks already have their own closed-shape and semantic diagnostics.
  // Do not turn their errors into manifest-contract errors or hardcode their values.
  return issues;
}

export function auditCompleteManifestSources(m, sources) {
  if (!(sources instanceof Map) || !record(m) || !record(m.perspective) || !Array.isArray(m.sources)) {
    return [prefix("source registry or perspective is unavailable")];
  }
  const issues = [];
  const api = sources.get(A), behavior = sources.get(B);
  if (!record(behavior) || !application(behavior.perspective)
    || behavior.perspective !== m.perspective.application) issues.push(prefix("perspective differs from behavior source"));
  if (!record(api) || api.asyncapi !== "3.1.0") issues.push(prefix("source adapter target differs from AsyncAPI 3.1.0"));
  const serialization = behavior?.serialization;
  let wireMatches = serialization?.encoding === "UTF-8 JSON" && serialization?.wireMediaType === "application/json";
  for (const name of ["receiveOrderCreated", "sendCreateOrder"]) {
    const operation = resolveLocal(api, api?.operations?.[name]);
    const reply = resolveLocal(api, operation?.reply);
    for (const owner of [operation, reply]) {
      for (const ref of Array.isArray(owner?.messages) ? owner.messages : []) {
        const message = resolveLocal(api, ref);
        // Unresolved/invalid selections are diagnosed by the existing inventory
        // and Message gates; only actually selected targets contribute here.
        if (message && (Object.hasOwn(message, "contentType") ? message.contentType : api?.defaultContentType)
          !== "application/json") wireMatches = false;
      }
    }
  }
  if (!wireMatches) issues.push(prefix("CONVENTIONS Serialization payload-wire target/encoding differs from the reviewed UTF-8 JSON rule"));
  // This fixture's header-encoding rule recognizes this authored encoding and
  // client exposure contract; arbitrary prose is not proof of the same adapter.
  const encoding = behavior?.protocolsAndBindings;
  if (encoding?.protocol !== "kafka"
    || encoding?.headerEncoding !== "Kafka record headers encode each logical header as one UTF-8 value."
    || encoding?.clientExposure !== "Expose logical headers by their documented names.") {
    issues.push(prefix("header-encoding target/exposure differs from the reviewed UTF-8 rule"));
  }
  for (const id of [C, R, A, B]) {
    const entries = m.sources.filter(e => e?.sourceId === id);
    const source = sources.get(id), binding = entries[0];
    if (entries.length !== 1 || !record(source) || binding.type !== (id === A ? "asyncapi" : "behavior-configuration")
      || binding.specification !== (id === A ? "AsyncAPI 3.1.0" : "none")) {
      issues.push(prefix(`${id} source binding type/specification differs from adapter policy`));
    }
  }
  return issues;
}
