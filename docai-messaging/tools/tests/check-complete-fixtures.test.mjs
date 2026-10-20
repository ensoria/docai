import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { restampDocumentSet } from "../restamp-document-set.mjs";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../lib/complete-example-adapters.mjs";
import { validateCompleteProfilePair } from "../lib/validators/complete-profiles.mjs";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const checkerPath = fileURLToPath(new URL("../check-complete-fixtures.mjs", import.meta.url));
const sourceCandidatePath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/focused/valid/operations-profile-path-parity-valid/",
  import.meta.url
));
const sourceManifestPath = fileURLToPath(new URL(
  "../../fixtures/core/v0.17.1/source/projection-input-manifest.json",
  import.meta.url
));
const defaultCandidatePath = fileURLToPath(new URL(
  "../../fixtures/complete-candidates/v0.17.1/",
  import.meta.url
));

function runChecker(arguments_ = []) {
  return spawnSync(process.execPath, [checkerPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
}

function directorySnapshot(directory, relative = "") {
  const snapshot = {};
  for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
    const entryPath = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      Object.assign(snapshot, directorySnapshot(directory, entryPath));
    } else {
      snapshot[entryPath] = fs.readFileSync(path.join(directory, entryPath));
    }
  }
  return snapshot;
}

function restampCandidate(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-checker-"));
  const candidatePath = path.join(temporaryRoot, "candidate");
  const manifestPath = path.join(temporaryRoot, "projection-input-manifest.json");
  fs.cpSync(sourceCandidatePath, candidatePath, { recursive: true });
  fs.copyFileSync(sourceManifestPath, manifestPath);
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  return { candidatePath, manifestPath };
}

function replaceExactlyOnce(filePath, from, to) {
  const source = fs.readFileSync(filePath, "utf8");
  assert.equal(source.split(from).length - 1, 1, `${from} must occur exactly once`);
  fs.writeFileSync(filePath, source.replace(from, to));
}

function copyVersionedCandidate(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-source-"));
  const candidatePath = path.join(temporaryRoot, "candidate");
  fs.cpSync(defaultCandidatePath, candidatePath, { recursive: true });
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  return candidatePath;
}

function rebindAndRestamp(candidatePath, sourceName) {
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const source = manifest.sources.find((entry) => entry.location === sourceName);
  assert.notEqual(source, undefined);
  source.sha256 = `sha256:${createHash("sha256")
    .update(fs.readFileSync(path.join(candidatePath, "source", sourceName)))
    .digest("hex")}`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
}

const compactJsonExample = '{"status":"created","event_id":"evt_04"}';
const jsonFieldTable = [
  "| Field | Type | Required | Nullable | Constraints / Meaning |",
  "|---|---|---|---|---|",
  "| $ | object | yes | no | Additional properties are forbidden. |",
  "| event_id | string | yes | no | Synthetic event identifier |",
  "| status | string | yes | no | Lifecycle status |"
].join("\n");
const defaultedJsonTable = [
  "**field_defaults**: Required=yes | Nullable=no", "",
  "| Field | Type | Constraints / Meaning |", "|---|---|---|",
  "| $ | object | Additional properties are forbidden. |",
  "| event_id | string | Synthetic event identifier |",
  "| status | string | Lifecycle status |"
].join("\n");
const sameAsJson = "**same_as**: Operation r-json-original-operation Message json-original-message Payload application/json";
const expandedJson = [
  "**media_type**: application/json", "", "**payload_nullable**: no", "",
  "```json", compactJsonExample, "```", "", jsonFieldTable
].join("\n");

function ordinaryPairValid(candidatePath) {
  const full = loadDocumentSet(path.join(candidatePath, "full"));
  const compact = loadDocumentSet(path.join(candidatePath, "compact"));
  const options = loadTrustedCompleteExampleAdapterOptions(candidatePath, [full, compact]);
  assert.deepEqual(validateCompleteProfilePair(full, compact, options).diagnostics, []);
}

// Publication policy inputs are authored independently of emitted root rows.
const catalogSummaries = {
  sourceShards: [
    { details: "indexes/sources-contexts-behavior.md", summary: "Complete contexts and behavior sources" },
    { details: "indexes/sources-asyncapi.md", summary: "AsyncAPI contract source" }
  ],
  operationShards: [
    { details: "indexes/operations-broad.md", summary: "Broad operation range" },
    { details: "indexes/operations-middle.md", summary: "Middle operation range" }
  ]
};

function mutateCatalogPolicy(candidatePath, mutate = () => {}) {
  const file = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Object.hasOwn(manifest.publicationPolicy, "catalogSummaries")) {
    manifest.publicationPolicy.catalogSummaries = structuredClone(catalogSummaries);
  }
  mutate(manifest.publicationPolicy);
  fs.writeFileSync(file, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), file, { write: true });
  }
}

function replaceCatalogSummary(candidatePath, kind, details, summary) {
  for (const profile of ["full", "compact"]) {
    const root = path.join(candidatePath, profile);
    const file = path.join(root, "INDEX.md");
    const row = fs.readFileSync(file, "utf8").split("\n")
      .find((line) => line.endsWith(`| ${details} |`));
    assert.ok(row);
    const cells = row.split("|");
    cells[kind === "sourceShards" ? 4 : 9] = ` ${summary} `;
    replaceExactlyOnce(file, row, cells.join("|"));
    restampDocumentSet(root, path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
}

function assertCatalogPolicyResult(candidatePath, status) {
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);
  const result = runChecker([candidatePath]);
  assert.equal(result.status, status, result.stderr || result.stdout);
  if (status !== 0) {
    assert.match(result.stderr, /Complete catalog policy: full:/);
    assert.match(result.stderr, /Complete catalog policy: compact:/);
  }
  assert.doesNotMatch(result.stderr, /TypeError/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
}

for (const [kind, entries] of Object.entries(catalogSummaries)) {
  for (const { details } of entries) {
    for (const [mode, value] of [["missing", undefined], ["null", null], ["empty", ""],
      ["non-string", ["summary"]], ["LF", "summary\nnext"], ["CR", "summary\rnext"],
      ["tab", "summary\tpart"], ["padding", " summary "], ["stale output", "Revised shard summary"]]) {
      test(`rejects catalog Summary policy ${kind} ${details}: ${mode}`, (t) => {
        const candidatePath = copyVersionedCandidate(t);
        mutateCatalogPolicy(candidatePath, (policy) => {
          const entry = policy.catalogSummaries[kind].find((entry) => entry.details === details);
          if (mode === "missing") delete entry.summary;
          else entry.summary = value;
        });
        assertCatalogPolicyResult(candidatePath, 1);
      });
    }
    test(`rejects catalog Summary policy stale projected ${details}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      mutateCatalogPolicy(candidatePath);
      replaceCatalogSummary(candidatePath, kind, details, "Unsourced projected shard summary");
      assertCatalogPolicyResult(candidatePath, 1);
    });
    test(`accepts catalog Summary policy matching revised ${details}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      mutateCatalogPolicy(candidatePath, (policy) => {
        policy.catalogSummaries[kind].find((entry) => entry.details === details).summary = "Revised synthetic shard summary";
      });
      replaceCatalogSummary(candidatePath, kind, details, "Revised synthetic shard summary");
      assertCatalogPolicyResult(candidatePath, 0);
    });
  }
  for (const [mode, mutate] of [
    ["missing group", (policy) => { delete policy[kind]; }],
    ["null group", (policy) => { policy[kind] = null; }],
    ["object group", (policy) => { policy[kind] = {}; }],
    ["missing entry", (policy) => { policy[kind].pop(); }],
    ["extra entry", (policy) => { policy[kind].push({ details: "indexes/extra.md", summary: "Extra shard" }); }],
    ["duplicate path", (policy) => { policy[kind].push({ ...policy[kind][0] }); }],
    ["unknown path", (policy) => { policy[kind][0].details = "indexes/not-owned.md"; }],
    ["missing path", (policy) => { delete policy[kind][0].details; }],
    ["non-string path", (policy) => { policy[kind][0].details = [policy[kind][0].details]; }],
    ["null entry", (policy) => { policy[kind][0] = null; }],
    ["unexpected entry field", (policy) => { policy[kind][0].fallbackSummary = "Alternate summary"; }],
    ["swapped summaries", (policy) => {
      [policy[kind][0].summary, policy[kind][1].summary] = [policy[kind][1].summary, policy[kind][0].summary];
    }]
  ]) {
    test(`rejects catalog Summary policy ${kind}: ${mode}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      mutateCatalogPolicy(candidatePath, (policy) => mutate(policy.catalogSummaries));
      assertCatalogPolicyResult(candidatePath, 1);
    });
  }
  test(`accepts catalog Summary policy ${kind} in reverse declaration order`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateCatalogPolicy(candidatePath, (policy) => { policy.catalogSummaries[kind].reverse(); });
    assertCatalogPolicyResult(candidatePath, 0);
  });
}

for (const [mode, mutate] of [
  ["missing block", (policy) => { delete policy.catalogSummaries; }],
  ["null block", (policy) => { policy.catalogSummaries = null; }],
  ["array block", (policy) => { policy.catalogSummaries = []; }],
  ["string block", (policy) => { policy.catalogSummaries = "none"; }],
  ["unknown group", (policy) => { policy.catalogSummaries.workflowShards = []; }],
  ["swapped kinds", (policy) => {
    const value = policy.catalogSummaries;
    [value.sourceShards, value.operationShards] = [value.operationShards, value.sourceShards];
  }]
]) {
  test(`rejects catalog Summary policy ${mode}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateCatalogPolicy(candidatePath, mutate);
    assertCatalogPolicyResult(candidatePath, 1);
  });
}

test("accepts catalog Summary policy with Unicode and a decoded pipe", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateCatalogPolicy(candidatePath, (policy) => {
    policy.catalogSummaries.sourceShards[0].summary = "Café synthetic sources | behavior inputs";
  });
  replaceCatalogSummary(candidatePath, "sourceShards", "indexes/sources-contexts-behavior.md",
    "Café synthetic sources \\| behavior inputs");
  assertCatalogPolicyResult(candidatePath, 0);
});

// Intended fixture labels are independent inputs, not recovered from projection bytes.
const workflowLabels = [
  ["alpha-delivery", "Alpha delivery", "Deliver alpha and record the middle event", "Alpha delivery across operation boundaries"],
  ["alpha-observability", "Alpha observability", "Observe alpha delivery with synthetic traces", "Alpha observability guidance"],
  ["state-none", "State none", "Exercise every workflow section's none state", "Workflow section none states"],
  ["state-unknown", "State unknown", "Exercise every workflow section's whole-section unknown state", "Workflow section unknown states"],
  ["state-unsupported", "State unsupported", "Exercise every workflow section's replacement unsupported state", "Workflow section unsupported states"]
];
const workflowLabelAuthority = { factDomain: "workflow-labels", sourceOrder: ["complete-contexts"] };

function mutateWorkflowLabelSource(candidatePath, mutate = () => {}) {
  const file = path.join(candidatePath, "source", "complete-contexts.json");
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [id, , summary, displayTitle] of workflowLabels) {
    for (const [field, value] of [["summary", summary], ["displayTitle", displayTitle]]) {
      if (!Object.hasOwn(source.workflows[id], field)) source.workflows[id][field] = value;
    }
  }
  const manifestFile = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (!manifest.precedence.some((entry) => entry.factDomain === "workflow-labels")) {
    manifest.precedence.push(workflowLabelAuthority);
  }
  mutate(source, manifest);
  fs.writeFileSync(file, JSON.stringify(source));
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  rebindAndRestamp(candidatePath, "complete-contexts.json");
}

function replaceWorkflowLabel(candidatePath, id, field, value) {
  for (const profile of ["full", "compact"]) {
    const root = path.join(candidatePath, profile);
    if (field === "displayTitle") {
      const file = path.join(root, "workflows", `${id}.md`);
      const title = fs.readFileSync(file, "utf8").split("\n").find((line) => line.startsWith("# "));
      assert.ok(title);
      replaceExactlyOnce(file, title, `# ${value}`);
    } else {
      const file = path.join(root, "INDEX.md");
      const row = fs.readFileSync(file, "utf8").split("\n")
        .find((line) => line.endsWith(`| workflows/${id}.md |`));
      assert.ok(row);
      const cells = row.split("|");
      cells[field === "name" ? 1 : 2] = ` ${value} `;
      replaceExactlyOnce(file, row, cells.join("|"));
    }
    restampDocumentSet(root, path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
}

function assertWorkflowLabelResult(candidatePath, status, pattern) {
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);
  const result = runChecker([candidatePath]);
  assert.equal(result.status, status, result.stderr || result.stdout);
  if (pattern) assert.match(result.stderr, pattern);
  assert.doesNotMatch(result.stderr, /TypeError/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
}

for (const [id] of workflowLabels) {
  for (const field of ["name", "summary", "displayTitle"]) {
    test(`rejects Workflow labels stale ${id} ${field}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      mutateWorkflowLabelSource(candidatePath, (source) => { source.workflows[id][field] += " revised"; });
      assertWorkflowLabelResult(candidatePath, 1, /Workflow labels|routing name/);
    });
  }
}

for (const id of ["alpha-delivery", "state-none"]) {
  for (const field of ["name", "summary", "displayTitle"]) {
    for (const [mode, value] of [["missing", undefined], ["null", null], ["empty", ""],
      ["non-string", ["label"]], ["LF", "label\nsecond line"], ["CR", "label\rsecond line"],
      ["tab", "label\tpart"], ["padding", " label "]]) {
      test(`rejects Workflow labels ${id} ${field} ${mode}`, (t) => {
        const candidatePath = copyVersionedCandidate(t);
        mutateWorkflowLabelSource(candidatePath, (source) => {
          if (mode === "missing") delete source.workflows[id][field];
          else source.workflows[id][field] = value;
        });
        assertWorkflowLabelResult(candidatePath, 1, /Workflow labels|routing name/);
      });
    }
  }
}

for (const field of ["name", "summary", "displayTitle"]) {
  test(`rejects Workflow labels ${field} attached to another owner`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateWorkflowLabelSource(candidatePath, (source) => {
      const a = source.workflows["alpha-delivery"], b = source.workflows["alpha-observability"];
      [a[field], b[field]] = [b[field], a[field]];
    });
    assertWorkflowLabelResult(candidatePath, 1, /Workflow labels/);
  });
}

for (const [left, right] of [["name", "summary"], ["name", "displayTitle"], ["summary", "displayTitle"]]) {
  test(`rejects Workflow labels roles swapped ${left}/${right}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateWorkflowLabelSource(candidatePath, (source) => {
      const facts = source.workflows["alpha-delivery"];
      [facts[left], facts[right]] = [facts[right], facts[left]];
    });
    assertWorkflowLabelResult(candidatePath, 1, /Workflow labels/);
  });
}

for (const mode of ["missing", "wrong source", "duplicate"]) {
  test(`rejects Workflow labels authority ${mode}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateWorkflowLabelSource(candidatePath, (_source, manifest) => {
      manifest.precedence = manifest.precedence.filter((entry) => entry.factDomain !== "workflow-labels");
      if (mode !== "missing") manifest.precedence.push({ ...workflowLabelAuthority,
        sourceOrder: mode === "wrong source" ? ["storefront-behavior"] : ["complete-contexts"] });
      if (mode === "duplicate") manifest.precedence.push(workflowLabelAuthority);
    });
    assertWorkflowLabelResult(candidatePath, 1, /Workflow labels authority/);
  });
}

test("rejects Workflow labels routed to the wrong owner path", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateWorkflowLabelSource(candidatePath);
  for (const profile of ["full", "compact"]) {
    const file = path.join(candidatePath, profile, "INDEX.md");
    const content = fs.readFileSync(file, "utf8").replaceAll("| workflows/alpha-delivery.md |", "| workflow-placeholder |")
      .replaceAll("| workflows/alpha-observability.md |", "| workflows/alpha-delivery.md |")
      .replaceAll("| workflow-placeholder |", "| workflows/alpha-observability.md |");
    fs.writeFileSync(file, content);
    restampDocumentSet(path.join(candidatePath, profile),
      path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
  assertWorkflowLabelResult(candidatePath, 1, /Workflow labels/);
});

for (const id of ["alpha-delivery", "state-none"]) {
  for (const field of ["name", "summary", "displayTitle"]) {
    test(`accepts Workflow labels matching revised ${id} ${field}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      const original = workflowLabels.find((entry) => entry[0] === id);
      const value = `${original[["name", "summary", "displayTitle"].indexOf(field) + 1]} revised`;
      mutateWorkflowLabelSource(candidatePath, (source) => { source.workflows[id][field] = value; });
      replaceWorkflowLabel(candidatePath, id, field, value);
      assertWorkflowLabelResult(candidatePath, 0);
    });
  }
}

for (const [mode, value] of [["missing", undefined], ["null", null], ["array", []], ["string", "none"]]) {
  test(`rejects Workflow labels with ${mode} source registry without crashing`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateWorkflowLabelSource(candidatePath, (source) => {
      if (mode === "missing") delete source.workflows;
      else source.workflows = value;
    });
    assertWorkflowLabelResult(candidatePath, 1, /Workflow labels source registry/);
  });
}

test("rejects Workflow labels with a null source owner without crashing", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateWorkflowLabelSource(candidatePath, (source) => { source.workflows["alpha-delivery"] = null; });
  assertWorkflowLabelResult(candidatePath, 1, /Workflow labels alpha-delivery/);
});

test("rejects Workflow labels on a projected path without a source owner", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateWorkflowLabelSource(candidatePath);
  for (const profile of ["full", "compact"]) {
    const root = path.join(candidatePath, profile);
    fs.copyFileSync(path.join(root, "workflows", "alpha-observability.md"),
      path.join(root, "workflows", "alpha-extra.md"));
    const index = path.join(root, "INDEX.md");
    const anchor = "| Alpha observability | Observe alpha delivery with synthetic traces | workflows/alpha-observability.md |";
    replaceExactlyOnce(index, anchor,
      `${anchor}\n| Alpha supplemental | Extra workflow | workflows/alpha-extra.md |`);
    restampDocumentSet(root, path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
  assertWorkflowLabelResult(candidatePath, 1, /Workflow labels routing paths/);
});

test("accepts Workflow labels whose explicit display title equals its routing name", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateWorkflowLabelSource(candidatePath, (source) => {
    source.workflows["alpha-delivery"].displayTitle = "Alpha delivery";
  });
  replaceWorkflowLabel(candidatePath, "alpha-delivery", "displayTitle", "Alpha delivery");
  assertWorkflowLabelResult(candidatePath, 0);
});

test("accepts Workflow labels with Unicode and a decoded summary pipe", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateWorkflowLabelSource(candidatePath, (source) => {
    source.workflows["alpha-delivery"].name = "Alpha delivery Café";
    source.workflows["alpha-delivery"].summary = "Record alpha | synthetic progress";
    source.workflows["alpha-delivery"].displayTitle = "Alpha delivery — Café coordination";
  });
  replaceWorkflowLabel(candidatePath, "alpha-delivery", "name", "Alpha delivery Café");
  replaceWorkflowLabel(candidatePath, "alpha-delivery", "summary", "Record alpha \\| synthetic progress");
  replaceWorkflowLabel(candidatePath, "alpha-delivery", "displayTitle", "Alpha delivery — Café coordination");
  assertWorkflowLabelResult(candidatePath, 0);
});

test("rejects Workflow labels differing only by Unicode normalization", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateWorkflowLabelSource(candidatePath, (source) => {
    source.workflows["alpha-delivery"].displayTitle = "Alpha delivery Café";
  });
  replaceWorkflowLabel(candidatePath, "alpha-delivery", "displayTitle", "Alpha delivery Cafe\u0301");
  assertWorkflowLabelResult(candidatePath, 1, /Workflow labels alpha-delivery/);
});

// Authored scenario labels, not values recovered from a generated table.
const operationLabels = [
  ["a-operation", "alpha task", "Handles the alpha event range"],
  ["m-operation", "middle task", "Handles the middle event range"],
  ["z-operation", "zeta task", "Handles the zeta event range"],
  ["r-csv-operation", "representation task", "Sends one adapter-defined CSV record"],
  ["r-json-original-operation", "representation task", "Sends the canonical reusable JSON record"],
  ["r-json-reuse-operation", "representation task", "Sends the reused JSON record"],
  ["r-raw-operation", "representation task", "Sends an opaque raw receipt"],
  ["r-tagged-operation", "representation task", "Sends a tagged lifecycle event"],
  ["r-untagged-operation", "representation task", "Receives an untagged lifecycle event"],
  ["receiveOrderCreated", "update storefront order state", "Update storefront state after an order is created."],
  ["sendCreateOrder", "submit an order", "Submit an order and receive its acceptance reply."]
];
const labelAuthorities = [
  { factDomain: "operation-tasks", sourceOrder: ["complete-contexts", "complete-representations", "storefront-behavior"] },
  { factDomain: "operation-summaries", sourceOrder: ["complete-contexts", "complete-representations", "storefront-asyncapi-3.1.0"] }
];

function labelSourceContract(sources, operation, field) {
  if (operation.startsWith("r-")) return sources["complete-representations.json"].representations
    .find((entry) => entry.operation === operation);
  if (operation.endsWith("-operation")) return sources["complete-contexts.json"].operations[operation];
  return field === "task" ? sources["storefront-behavior.json"].operationBehavior[operation]
    : sources["storefront.asyncapi.json"].operations[operation];
}

function mutateOperationLabelSources(candidatePath, mutate = () => {}) {
  const filenames = ["complete-contexts.json", "complete-representations.json",
    "storefront-behavior.json", "storefront.asyncapi.json"];
  const sources = Object.fromEntries(filenames.map((filename) => [filename,
    JSON.parse(fs.readFileSync(path.join(candidatePath, "source", filename), "utf8"))]));
  // Seed the approved contract only where absent so historical RED remains reproducible.
  for (const [operation, task, summary] of operationLabels) {
    for (const [field, value] of [["task", task], ["summary", summary]]) {
      const contract = labelSourceContract(sources, operation, field);
      if (!Object.hasOwn(contract, field)) contract[field] = value;
    }
  }
  mutate(sources);
  const manifestFile = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  for (const authority of labelAuthorities) {
    if (!manifest.precedence.some((entry) => entry.factDomain === authority.factDomain)) {
      manifest.precedence.push(authority);
    }
  }
  for (const filename of filenames) {
    const bytes = JSON.stringify(sources[filename]);
    fs.writeFileSync(path.join(candidatePath, "source", filename), bytes);
    manifest.sources.find((entry) => entry.location === filename).sha256 =
      `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestFile, { write: true });
  }
}

function assertOperationLabelResult(candidatePath, status, pattern) {
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);
  const result = runChecker([candidatePath]);
  assert.equal(result.status, status, result.stderr || result.stdout);
  if (pattern) assert.match(result.stderr, pattern);
  assert.doesNotMatch(result.stderr, /TypeError/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
}

for (const [operation] of operationLabels) {
  for (const field of ["task", "summary"]) {
    test(`rejects operation labels stale ${operation} ${field}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      mutateOperationLabelSources(candidatePath, (sources) => {
        labelSourceContract(sources, operation, field)[field] += " revised";
      });
      assertOperationLabelResult(candidatePath, 1, /operation labels| Summary/);
    });
  }
}

for (const operation of ["a-operation", "r-csv-operation", "receiveOrderCreated"]) {
  for (const field of ["task", "summary"]) {
    // Storefront Summary already has a source comparison; it is characterized below.
    if (operation === "receiveOrderCreated" && field === "summary") continue;
    for (const [mode, value] of [["missing", undefined], ["null", null], ["empty", ""],
      ["non-string", ["label"]], ["multiline", "label\nsecond line"], ["padding", " label "]]) {
      test(`rejects operation labels ${operation} ${field} ${mode}`, (t) => {
        const candidatePath = copyVersionedCandidate(t);
        mutateOperationLabelSources(candidatePath, (sources) => {
          const contract = labelSourceContract(sources, operation, field);
          if (mode === "missing") delete contract[field];
          else contract[field] = value;
        });
        assertOperationLabelResult(candidatePath, 1, /operation labels/);
      });
    }
  }
}

for (const field of ["task", "summary"]) {
  test(`rejects operation labels ${field} moved to another owner`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateOperationLabelSources(candidatePath, (sources) => {
      const a = labelSourceContract(sources, "a-operation", field);
      const z = labelSourceContract(sources, "z-operation", field);
      [a[field], z[field]] = [z[field], a[field]];
    });
    assertOperationLabelResult(candidatePath, 1, /operation labels/);
  });
}

for (const authority of labelAuthorities) {
  for (const mode of ["missing", "wrong source", "duplicate"]) {
    test(`rejects operation labels ${authority.factDomain} authority ${mode}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      mutateOperationLabelSources(candidatePath);
      const file = path.join(candidatePath, "source", "projection-input-manifest.json");
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      manifest.precedence = manifest.precedence.filter((entry) => entry.factDomain !== authority.factDomain);
      if (mode !== "missing") manifest.precedence.push({ ...authority,
        sourceOrder: mode === "wrong source" ? ["storefront-behavior"] : authority.sourceOrder });
      if (mode === "duplicate") manifest.precedence.push(authority);
      fs.writeFileSync(file, JSON.stringify(manifest));
      for (const profile of ["full", "compact"]) {
        restampDocumentSet(path.join(candidatePath, profile), file, { write: true });
      }
      assertOperationLabelResult(candidatePath, 1, /operation labels.*authority/);
    });
  }
}

function replaceOperationLabelRoute(candidatePath, operation, field, value) {
  const shard = operation === "m-operation" ? "operations-middle.md" : "operations-broad.md";
  for (const profile of ["full", "compact"]) {
    const root = path.join(candidatePath, profile);
    const file = path.join(root, "indexes", shard);
    const row = fs.readFileSync(file, "utf8").split("\n")
      .find((line) => line.includes(`| ${operation} |`));
    assert.ok(row);
    const cells = row.split("|");
    cells[field === "task" ? 5 : 6] = ` ${value} `;
    replaceExactlyOnce(file, row, cells.join("|"));
    if (field === "task") {
      const tasks = fs.readFileSync(file, "utf8").split("\n")
        .filter((line) => /^\| (SEND|RECEIVE) \|/.test(line))
        .flatMap((line) => line.split("|")[5].trim().split("; "));
      const index = path.join(root, "INDEX.md");
      const aggregate = fs.readFileSync(index, "utf8").split("\n")
        .find((line) => line.endsWith(`| indexes/${shard} |`));
      assert.ok(aggregate);
      const aggregateCells = aggregate.split("|");
      aggregateCells[1] = ` ${[...new Set(tasks)].sort().join("; ")} `;
      replaceExactlyOnce(index, aggregate, aggregateCells.join("|"));
    }
    restampDocumentSet(root, path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
}

for (const operation of ["a-operation", "r-csv-operation", "receiveOrderCreated"]) {
  for (const field of ["task", "summary"]) {
    test(`accepts operation labels matching revised ${operation} ${field}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      const value = field === "task" ? "alternate task" : "Revised synthetic routing description.";
      mutateOperationLabelSources(candidatePath, (sources) => {
        labelSourceContract(sources, operation, field)[field] = value;
      });
      replaceOperationLabelRoute(candidatePath, operation, field, value);
      assertOperationLabelResult(candidatePath, 0);
    });
  }
}

test("rejects operation labels with Task and Summary source columns swapped", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateOperationLabelSources(candidatePath, (sources) => {
    const contract = sources["complete-contexts.json"].operations["a-operation"];
    [contract.task, contract.summary] = [contract.summary, contract.task];
  });
  assertOperationLabelResult(candidatePath, 1, /operation labels/);
});

test("rejects operation labels after a missing behavior owner registry without crashing", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateOperationLabelSources(candidatePath, (sources) => {
    delete sources["storefront-behavior.json"].operationBehavior;
  });
  assertOperationLabelResult(candidatePath, 1, /storefront context selection owners/);
});

for (const field of ["task", "summary"]) {
  test(`rejects operation labels storefront ${field} with only a non-authoritative shadow`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateOperationLabelSources(candidatePath, (sources) => {
      const authority = labelSourceContract(sources, "receiveOrderCreated", field);
      const shadow = field === "task" ? sources["storefront.asyncapi.json"].operations.receiveOrderCreated
        : sources["storefront-behavior.json"].operationBehavior.receiveOrderCreated;
      shadow[field] = authority[field];
      delete authority[field];
    });
    assertOperationLabelResult(candidatePath, 1, /operation labels/);
  });
}

test("accepts operation labels from storefront authorities despite conflicting shadow labels", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateOperationLabelSources(candidatePath, (sources) => {
    sources["storefront.asyncapi.json"].operations.receiveOrderCreated.task = "untrusted shadow task";
    sources["storefront-behavior.json"].operationBehavior.receiveOrderCreated.summary = "Untrusted shadow summary.";
  });
  assertOperationLabelResult(candidatePath, 0);
});

test("accepts operation labels with Unicode and a decoded pipe", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateOperationLabelSources(candidatePath, (sources) => {
    sources["complete-contexts.json"].operations["a-operation"].task = "alpha Café task";
    sources["complete-contexts.json"].operations["a-operation"].summary = "Alpha | synthetic control signal";
  });
  replaceOperationLabelRoute(candidatePath, "a-operation", "task", "alpha Café task");
  replaceOperationLabelRoute(candidatePath, "a-operation", "summary", "Alpha \\| synthetic control signal");
  assertOperationLabelResult(candidatePath, 0);
});

function mutateStorefrontContextSource(candidatePath, mutate) {
  const file = path.join(candidatePath, "source", "storefront-behavior.json");
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  // Explicit intended fixture facts make the pre-gate RED reproducible.
  for (const operation of ["receiveOrderCreated", "sendCreateOrder"]) {
    for (const field of ["requiredContexts", "supplementalContexts"]) {
      if (!Object.hasOwn(source.operationBehavior[operation], field)) {
        source.operationBehavior[operation][field] = [];
      }
    }
  }
  mutate(source);
  fs.writeFileSync(file, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "storefront-behavior.json");
}

function replaceStorefrontContextRoute(candidatePath, operation, required, supplemental) {
  for (const profile of ["full", "compact"]) {
    const file = path.join(candidatePath, profile, "indexes", "operations-broad.md");
    const row = fs.readFileSync(file, "utf8").split("\n")
      .find((line) => line.includes(`| ${operation} |`));
    assert.ok(row);
    const cells = row.split("|");
    assert.equal(cells.length, 11);
    cells[7] = ` ${required} `;
    cells[8] = ` ${supplemental} `;
    replaceExactlyOnce(file, row, cells.join("|"));
    restampDocumentSet(path.join(candidatePath, profile),
      path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
}

for (const operation of ["receiveOrderCreated", "sendCreateOrder"]) {
  for (const field of ["requiredContexts", "supplementalContexts"]) {
    for (const [label, mutate] of [
      ["missing declaration", (facts) => { delete facts[field]; }],
      ["null declaration", (facts) => { facts[field] = null; }],
      ["string declaration", (facts) => { facts[field] = "none"; }],
      ["non-string ID", (facts) => { facts[field] = [["alpha-delivery"]]; }],
      ["unknown ID", (facts) => { facts[field] = ["unknown-context"]; }],
      ["duplicate ID", (facts) => { facts[field] = ["alpha-delivery", "alpha-delivery"]; }],
      ["stale empty routing", (facts) => { facts[field] = ["alpha-delivery"]; }]
    ]) {
      test(`rejects storefront context selection ${operation} ${field}: ${label}`, (t) => {
        const candidatePath = copyVersionedCandidate(t);
        mutateStorefrontContextSource(candidatePath, (source) => mutate(source.operationBehavior[operation]));
        ordinaryPairValid(candidatePath);
        const before = directorySnapshot(candidatePath);

        const result = runChecker([candidatePath]);

        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, /storefront context selection/);
        assert.doesNotMatch(result.stderr, /TypeError/);
        assert.deepEqual(directorySnapshot(candidatePath), before);
      });
    }
  }
  for (const [label, mutate] of [
    ["required Reference Material", (facts) => { facts.requiredContexts = ["middle-operations"]; }],
    ["cross-column duplicate", (facts) => {
      facts.requiredContexts = ["alpha-delivery"];
      facts.supplementalContexts = ["alpha-delivery"];
    }]
  ]) {
    test(`rejects storefront context selection ${operation}: ${label}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      mutateStorefrontContextSource(candidatePath, (source) => mutate(source.operationBehavior[operation]));
      ordinaryPairValid(candidatePath);
      const before = directorySnapshot(candidatePath);
      const result = runChecker([candidatePath]);
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /storefront context selection/);
      assert.deepEqual(directorySnapshot(candidatePath), before);
    });
  }
  for (const required of [true, false]) {
    test(`rejects storefront context selection unsourced ${required ? "required" : "supplemental"} workflow for ${operation}`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      replaceStorefrontContextRoute(candidatePath, operation,
        required ? "workflows/alpha-delivery.md" : "none",
        required ? "none" : "workflows/alpha-observability.md");
      ordinaryPairValid(candidatePath);
      const before = directorySnapshot(candidatePath);
      const result = runChecker([candidatePath]);
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /storefront context selection/);
      assert.deepEqual(directorySnapshot(candidatePath), before);
    });
  }
}

test("rejects storefront context selection facts attached to a non-storefront owner", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateStorefrontContextSource(candidatePath, (source) => {
    source.operationBehavior["z-operation"] = { requiredContexts: [], supplementalContexts: [] };
  });
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);
  const result = runChecker([candidatePath]);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /storefront context selection/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects storefront context selection moved to the wrong operation", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateStorefrontContextSource(candidatePath, (source) => {
    source.operationBehavior.receiveOrderCreated.requiredContexts = ["alpha-delivery"];
  });
  replaceStorefrontContextRoute(candidatePath, "sendCreateOrder", "workflows/alpha-delivery.md", "none");
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);
  const result = runChecker([candidatePath]);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /storefront context selection/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects storefront context selection moved from required to supplemental", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateStorefrontContextSource(candidatePath, (source) => {
    source.operationBehavior.receiveOrderCreated.requiredContexts = ["alpha-delivery"];
  });
  replaceStorefrontContextRoute(candidatePath, "receiveOrderCreated", "none", "workflows/alpha-delivery.md");
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);
  const result = runChecker([candidatePath]);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /storefront context selection/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects storefront context selection with an ambiguous source ID", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateStorefrontContextSource(candidatePath, (source) => {
    source.operationBehavior.receiveOrderCreated.supplementalContexts = ["alpha-delivery"];
  });
  const file = path.join(candidatePath, "source", "complete-contexts.json");
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  source.referenceMaterials["alpha-delivery"] = { ...source.referenceMaterials["middle-operations"] };
  fs.writeFileSync(file, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "complete-contexts.json");
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);
  const result = runChecker([candidatePath]);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /storefront context selection/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const mode of ["missing", "wrong source", "duplicate"]) {
  test(`rejects storefront context selection authority ${mode}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const file = path.join(candidatePath, "source", "projection-input-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.precedence = manifest.precedence.filter((entry) => entry.factDomain !== "storefront-context-selection");
    if (mode !== "missing") manifest.precedence.push({ factDomain: "storefront-context-selection",
      sourceOrder: [mode === "wrong source" ? "complete-contexts" : "storefront-behavior"] });
    if (mode === "duplicate") manifest.precedence.push({ factDomain: "storefront-context-selection", sourceOrder: ["storefront-behavior"] });
    fs.writeFileSync(file, JSON.stringify(manifest));
    for (const profile of ["full", "compact"]) restampDocumentSet(path.join(candidatePath, profile), file, { write: true });
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);
    const result = runChecker([candidatePath]);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /storefront context selection authority/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [field, target] of [["requiredContexts", "alpha-delivery"], ["supplementalContexts", "alpha-observability"]]) {
  test(`accepts storefront context selection matching sourced ${field}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateStorefrontContextSource(candidatePath, (source) => {
      source.operationBehavior.receiveOrderCreated[field] = [target];
    });
    replaceStorefrontContextRoute(candidatePath, "receiveOrderCreated",
      field === "requiredContexts" ? `workflows/${target}.md` : "none",
      field === "supplementalContexts" ? `workflows/${target}.md` : "none");
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);
    const result = runChecker([candidatePath]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

function addInventoryOperation(candidatePath, target) {
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    const root = path.join(candidatePath, profile);
    const zeta = fs.readFileSync(path.join(root, "channels", "zeta.md"), "utf8");
    const body = zeta.slice(zeta.indexOf("## RECEIVE"), zeta.indexOf("> docai-identity:"))
      .replaceAll("z-operation", "zz-operation").replaceAll("z-message", "zz-message");
    const file = path.join(root, "channels", `${target}.md`);
    replaceExactlyOnce(file, "\n> docai-identity:", `\n${body}> docai-identity:`);
    const indexPath = path.join(root, "indexes", "operations-broad.md");
    const index = fs.readFileSync(indexPath, "utf8");
    const row = index.split("\n").find((line) => line.includes("| z-operation |"));
    const anchor = index.split("\n").find((line) => line.includes(`| ${target === "zeta" ? "z" : "a"}-operation |`));
    assert.ok(row && anchor);
    const extra = row.replaceAll("z-operation", "zz-operation")
      .replaceAll("z-message", "zz-message").replace(/ none \|$/, " all |");
    replaceExactlyOnce(indexPath, anchor, `${anchor}\n${extra}`);
    replaceExactlyOnce(path.join(root, "INDEX.md"),
      "| a-operation | z-operation | CreateOrder | z-message |",
      "| a-operation | zz-operation | CreateOrder | zz-message |");
    restampDocumentSet(root, manifestPath, { write: true });
  }
}

for (const target of ["zeta", "alpha"]) {
  test(`rejects an unowned operation projected in the ${target} channel file`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    addInventoryOperation(candidatePath, target);
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /operation inventory/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects a same-size operation inventory with a replaced source owner", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    for (const relative of ["INDEX.md", "indexes/operations-broad.md", "channels/zeta.md"]) {
      const file = path.join(candidatePath, profile, relative);
      const content = fs.readFileSync(file, "utf8");
      assert.ok(content.includes("z-operation"));
      fs.writeFileSync(file, content.replaceAll("z-operation", "zz-operation")
        .replaceAll("z-message", "zz-message"));
    }
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /operation inventory routing/);
  assert.match(result.stderr, /operation inventory definitions/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects duplicate operation owners before semantic source auditing", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "complete-contexts.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.operations.sendCreateOrder = {};
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "complete-contexts.json");
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /duplicate operation owner/);
  assert.doesNotMatch(result.stderr, /TypeError|convention dependencies model/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("accepts an additional operation declared by its source inventory", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  addInventoryOperation(candidatePath, "zeta");
  const sourcePath = path.join(candidatePath, "source", "complete-contexts.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.operations["zz-operation"] = { ...source.operations["z-operation"], message: "zz-message" };
  source.conventionDependencies.operations["zz-operation"] = [];
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "complete-contexts.json");
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const identity of ["zz-operation", "z-operation"]) {
  test(`rejects an unrouted channel file containing ${identity}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
    for (const profile of ["full", "compact"]) {
      const root = path.join(candidatePath, profile);
      const body = fs.readFileSync(path.join(root, "channels", "zeta.md"), "utf8")
        .replaceAll("z-operation", identity);
      fs.writeFileSync(path.join(root, "channels", "zz-extra.md"), body);
      restampDocumentSet(root, manifestPath, { write: true });
    }
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /operation inventory channel coverage/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects missing operation inventory before malformed owner semantics", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "complete-contexts.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.operations["zz-operation"] = null;
  source.conventionDependencies.operations["zz-operation"] = [];
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "complete-contexts.json");
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /full: operation inventory routing/);
  assert.match(result.stderr, /compact: operation inventory definitions/);
  assert.doesNotMatch(result.stderr, /TypeError/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("accepts operation inventory after moving a routed channel file", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    const root = path.join(candidatePath, profile);
    fs.renameSync(path.join(root, "channels", "zeta.md"), path.join(root, "channels", "zz-routed.md"));
    replaceExactlyOnce(path.join(root, "indexes", "operations-broad.md"),
      "### channels/zeta.md", "### channels/zz-routed.md");
    restampDocumentSet(root, manifestPath, { write: true });
  }
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

const contextConventionDependencies = {
  operations: { "a-operation": [], "m-operation": [], "z-operation": [] },
  workflows: {
    "alpha-delivery": [], "alpha-observability": [], "state-none": [],
    "state-unknown": [], "state-unsupported": []
  },
  sections: {}
};
const representationConventionDependencies = {
  operations: Object.fromEntries([
    "r-csv-operation", "r-json-original-operation", "r-json-reuse-operation",
    "r-raw-operation", "r-tagged-operation", "r-untagged-operation"
  ].map((name) => [name, ["Data Representation"]])),
  workflows: {}, sections: { "Data Representation": [] }
};

function mutateConventionSource(candidatePath, filename, mutate) {
  const file = path.join(candidatePath, "source", filename);
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  // Explicit intended fixtures also let these mutations expose the old gate's RED.
  if (!Object.hasOwn(source, "conventionDependencies")) {
    source.conventionDependencies = structuredClone(filename === "complete-contexts.json"
      ? contextConventionDependencies : representationConventionDependencies);
  }
  mutate(source.conventionDependencies, source);
  fs.writeFileSync(file, JSON.stringify(source));
  rebindAndRestamp(candidatePath, filename);
}

function replaceConventionSelector(candidatePath, operation, selector) {
  for (const profile of ["full", "compact"]) {
    const index = path.join(candidatePath, profile, "indexes",
      operation === "m-operation" ? "operations-middle.md" : "operations-broad.md");
    const row = fs.readFileSync(index, "utf8").split("\n")
      .find((line) => line.includes(`| ${operation} |`));
    assert.ok(row, operation);
    replaceExactlyOnce(index, row, row.replace(/[^|]+\|$/, ` ${selector} |`));
    restampDocumentSet(path.join(candidatePath, profile),
      path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
}

for (const [label, filename, mutate] of [
  ["direct operation dependency", "complete-contexts.json", (deps) => {
    deps.operations["z-operation"] = ["Data Representation"];
  }],
  ["required workflow dependency", "complete-contexts.json", (deps) => {
    deps.workflows["alpha-delivery"] = ["Data Representation"];
  }],
  ["transitive section dependency", "complete-representations.json", (deps) => {
    deps.sections["Data Representation"] = ["Authentication"];
    deps.sections.Authentication = ["Message Envelope"];
    deps.sections["Message Envelope"] = [];
  }],
  ["unknown operation dependency", "complete-contexts.json", (deps) => {
    deps.operations["a-operation"] = null;
  }],
  ["unknown required workflow dependency", "complete-contexts.json", (deps) => {
    deps.workflows["alpha-delivery"] = null;
  }],
  ["unknown section dependency", "complete-representations.json", (deps) => {
    deps.sections["Data Representation"] = null;
  }],
  ["missing section dependency", "complete-representations.json", (deps) => {
    delete deps.sections["Data Representation"];
  }],
  ["missing operation entry", "complete-contexts.json", (deps) => {
    delete deps.operations["z-operation"];
  }],
  ["extra operation entry", "complete-contexts.json", (deps) => {
    deps.operations.extra = [];
  }],
  ["missing workflow entry", "complete-contexts.json", (deps) => {
    delete deps.workflows["alpha-delivery"];
  }],
  ["malformed dependency list", "complete-contexts.json", (deps) => {
    deps.operations["z-operation"] = "none";
  }],
  ["non-string dependency", "complete-contexts.json", (deps) => {
    deps.operations["z-operation"] = [["Data Representation"]];
  }],
  ["duplicate dependency", "complete-representations.json", (deps) => {
    deps.operations["r-csv-operation"] = ["Data Representation", "Data Representation"];
  }],
  ["unknown convention name", "complete-contexts.json", (deps) => {
    deps.operations["z-operation"] = ["not-a-convention"];
  }],
  ["missing dependency model", "complete-contexts.json", (_deps, source) => {
    delete source.conventionDependencies;
  }],
  ["malformed dependency model", "complete-contexts.json", (_deps, source) => {
    source.conventionDependencies = [];
  }],
  ["conflicting section definitions", "complete-contexts.json", (deps) => {
    deps.sections["Data Representation"] = ["Authentication"];
    deps.sections.Authentication = [];
  }],
  ["malformed context container on a workflow step operation", "complete-contexts.json", (_deps, source) => {
    source.operations["m-operation"].requiredContexts = "not-an-array";
  }],
  ["missing required-context fact on an empty-context operation", "complete-contexts.json", (_deps, source) => {
    delete source.operations["m-operation"].requiredContexts;
  }],
  ["duplicate workflow dependency owner", "complete-representations.json", (deps, source) => {
    source.workflows = { "alpha-delivery": {} };
    deps.workflows["alpha-delivery"] = [];
  }]
]) {
  test(`rejects convention closure after source rebinding: ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutateConventionSource(candidatePath, filename, mutate);
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /convention (?:closure|dependencies)/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [label, operation, selector] of [
  ["representation dependency omitted", "r-json-original-operation", "none"],
  ["unproven extra section selected", "r-json-original-operation", "Authentication, Data Representation"],
  ["storefront reduced without proof", "sendCreateOrder", "Data Representation"]
]) {
  test(`rejects matching convention closure selectors: ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceConventionSelector(candidatePath, operation, selector);
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /convention closure/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects convention closure missing an operation used by a required workflow", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  mutateConventionSource(candidatePath, "complete-contexts.json", (deps) => {
    deps.operations["m-operation"] = ["Data Representation"];
  });
  replaceConventionSelector(candidatePath, "m-operation", "Data Representation");
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /a-operation convention closure/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects convention closure when a required source workflow disappears from routing", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  for (const profile of ["full", "compact"]) {
    const file = path.join(candidatePath, profile, "indexes", "operations-broad.md");
    replaceExactlyOnce(file,
      "| workflows/alpha-delivery.md | workflows/alpha-observability.md,",
      "| none | workflows/alpha-observability.md,");
    restampDocumentSet(path.join(candidatePath, profile),
      path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /a-operation convention closure/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

function promoteRequiredWorkflow(candidatePath, id, shadowSteps = false) {
  mutateConventionSource(candidatePath, "complete-contexts.json", (_deps, source) => {
    source.operations["a-operation"].requiredContexts.push(id);
    source.operations["a-operation"].supplementalContexts = source.operations["a-operation"]
      .supplementalContexts.filter((name) => name !== id);
    if (shadowSteps) source.workflows[id].steps = [];
  });
  const beforeSupplemental = ["alpha-observability", "state-none", "state-unknown", "state-unsupported"];
  for (const profile of ["full", "compact"]) {
    const file = path.join(candidatePath, profile, "indexes", "operations-broad.md");
    replaceExactlyOnce(file, "| workflows/alpha-delivery.md |",
      `| workflows/alpha-delivery.md, workflows/${id}.md |`);
    replaceExactlyOnce(file, beforeSupplemental.map((name) => `workflows/${name}.md`).join(", "),
      beforeSupplemental.filter((name) => name !== id).map((name) => `workflows/${name}.md`).join(", "));
    restampDocumentSet(path.join(candidatePath, profile),
      path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
  }
}

for (const [id, shadowSteps] of [["state-unknown", false], ["state-unsupported", false],
  ["state-unknown", true], ["state-none", true]]) {
  test(`rejects convention closure for required ${id} Steps${shadowSteps ? " shadowed by an empty array" : ""}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    promoteRequiredWorkflow(candidatePath, id, shadowSteps);
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /a-operation convention closure/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [id, selector] of [["state-none", "none"], ["state-unknown", "all"], ["state-unsupported", "all"]]) {
  test(`accepts convention closure for required ${id} with ${selector}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    promoteRequiredWorkflow(candidatePath, id);
    replaceConventionSelector(candidatePath, "a-operation", selector);
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const label of ["satisfied transitive cycle", "unknown operation with all",
  "unknown required workflow with all", "required workflow union", "supplemental workflow fallback"]) {
  test(`accepts convention closure with ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    if (label === "satisfied transitive cycle") {
      mutateConventionSource(candidatePath, "complete-representations.json", (deps) => {
        deps.sections["Data Representation"] = ["Authentication"];
        deps.sections.Authentication = ["Data Representation"];
      });
      for (const operation of Object.keys(representationConventionDependencies.operations)) {
        replaceConventionSelector(candidatePath, operation, "Authentication, Data Representation");
      }
    } else if (label === "unknown operation with all") {
      mutateConventionSource(candidatePath, "complete-contexts.json", (deps) => {
        deps.operations["z-operation"] = null;
      });
      replaceConventionSelector(candidatePath, "z-operation", "all");
    } else if (label === "unknown required workflow with all") {
      mutateConventionSource(candidatePath, "complete-contexts.json", (deps) => {
        deps.workflows["alpha-delivery"] = null;
      });
      replaceConventionSelector(candidatePath, "a-operation", "all");
    } else if (label === "required workflow union") {
      mutateConventionSource(candidatePath, "complete-contexts.json", (deps) => {
        deps.workflows["alpha-delivery"] = ["Data Representation"];
        deps.operations["m-operation"] = ["Data Representation"];
      });
      replaceConventionSelector(candidatePath, "a-operation", "Data Representation");
      replaceConventionSelector(candidatePath, "m-operation", "Data Representation");
    } else {
      mutateConventionSource(candidatePath, "complete-contexts.json", (deps) => {
        deps.workflows["alpha-observability"] = null;
      });
    }
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects convention dependencies missing their manifest authority domain", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.precedence = manifest.precedence.filter((entry) => entry.factDomain !== "convention-dependencies");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  ordinaryPairValid(candidatePath);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /convention dependencies precedence/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [label, mutate, expected] of [
  ["expanded defaulted table", (file) => {
    replaceExactlyOnce(file, defaultedJsonTable, jsonFieldTable);
  }, "field_defaults"],
  ["only one default column", (file) => {
    const nullableOnly = [
      "**field_defaults**: Nullable=no", "",
      "| Field | Type | Required | Constraints / Meaning |", "|---|---|---|---|",
      "| $ | object | yes | Additional properties are forbidden. |",
      "| event_id | string | yes | Synthetic event identifier |",
      "| status | string | yes | Lifecycle status |"
    ].join("\n");
    replaceExactlyOnce(file, defaultedJsonTable, nullableOnly);
  }, "field_defaults"],
  ["defaults moved to another representation", (file) => {
    replaceExactlyOnce(file, jsonFieldTable, defaultedJsonTable);
    // The first replacement is the CSV table, not the JSON table.
    const content = fs.readFileSync(file, "utf8");
    const start = content.indexOf("## SEND representations.json-original");
    const at = content.indexOf(defaultedJsonTable, start);
    assert.ok(at > start);
    fs.writeFileSync(file, content.slice(0, at) + jsonFieldTable + content.slice(at + defaultedJsonTable.length));
  }, "field_defaults"],
  ["expanded reuse representation", (file) => {
    replaceExactlyOnce(file, sameAsJson, expandedJson);
  }, "same_as"],
  ["reuse and retrieval unit both removed", (file) => {
    replaceExactlyOnce(file, sameAsJson, expandedJson);
    replaceExactlyOnce(file, " | x-retrieval-unit: channel-file", "");
  }, "same_as"],
  ["multiline JSON target example", (file) => {
    replaceExactlyOnce(file, compactJsonExample, '{\n  "status": "created",\n  "event_id": "evt_04"\n}');
  }, "one-line JSON"],
  ["one-line JSON decoy in an extension", (file) => {
    replaceExactlyOnce(file, compactJsonExample, '{\n  "status": "created",\n  "event_id": "evt_04"\n}');
    replaceExactlyOnce(file, defaultedJsonTable, `${defaultedJsonTable}\n\n##### x-Decoy\n\n\`\`\`json\n${compactJsonExample}\n\`\`\``);
  }, "one-line JSON"],
  ["same_as decoy in an extension fence", (file) => {
    replaceExactlyOnce(file, sameAsJson, `${expandedJson}\n\n##### x-Decoy\n\n\`\`\`text\n${sameAsJson}\n\`\`\``);
  }, "same_as"]
]) {
  test(`rejects compact representative policy loss: ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const file = path.join(candidatePath, "compact", "channels", "representations.md");
    mutate(file);
    restampDocumentSet(path.join(candidatePath, "compact"),
      path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /Complete compact policy:/);
    assert.ok(result.stderr.includes(expected), result.stderr);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [label, mutate] of [
  ["equivalent JSON escape spelling", (file) => {
    replaceExactlyOnce(file, compactJsonExample, '{"event_id":"evt_\\u0030\\u0034","status":"created"}');
  }],
  ["equivalent one-line JSON whitespace", (file) => {
    replaceExactlyOnce(file, compactJsonExample, '{ "status": "created", "event_id": "evt_04" }');
  }],
  ["additional valid defaults on CSV", (file) => {
    replaceExactlyOnce(file, jsonFieldTable, defaultedJsonTable);
  }],
  ["extension shifts representation line numbers", (file) => {
    replaceExactlyOnce(file, defaultedJsonTable, `${defaultedJsonTable}\n\n##### x-Audit\n\nNon-contract note.`);
  }]
]) {
  test(`accepts compact representative policy with ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    mutate(path.join(candidatePath, "compact", "channels", "representations.md"));
    restampDocumentSet(path.join(candidatePath, "compact"),
      path.join(candidatePath, "source", "projection-input-manifest.json"), { write: true });
    ordinaryPairValid(candidatePath);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

const storefrontMeanings = [
  ["CreateOrder", "headers/properties/correlation-id", "Correlates the acceptance reply."],
  ["CreateOrder", "headers/properties/message-id", "Message identifier used for deduplication."],
  ["CreateOrder", "headers/properties/reply-to", "Reply address."],
  ["CreateOrder", "payload/properties/items", "Submitted order items."],
  ["CreateOrder", "payload/properties/items/items/properties/quantity", "Item quantity."],
  ["CreateOrder", "payload/properties/items/items/properties/sku", "SKU identifier."],
  ["CreateOrder", "payload/properties/orderId", "Order identifier."],
  ["CreateOrder", "payload/properties/tenantId", "Storefront tenant identifier."],
  ["OrderAccepted", "headers/properties/correlation-id", "Equals the command correlation-id."],
  ["OrderAccepted", "headers/properties/message-id", "Reply message identifier."],
  ["OrderAccepted", "payload/properties/acceptedAt", "Command acceptance time."],
  ["OrderAccepted", "payload/properties/orderId", "Order identifier."],
  ["OrderAccepted", "payload/properties/status", "Accepted state."],
  ["OrderCreated", "headers/properties/message-id", "Message identifier retained across redelivery."],
  ["OrderCreated", "payload/properties/createdAt", "Order creation time."],
  ["OrderCreated", "payload/properties/orderId", "Order identifier."],
  ["OrderCreated", "payload/properties/status", "Created state."]
];

function storefrontSchema(source, name, schemaPath) {
  return schemaPath.split("/").reduce((node, key) => node[key], source.components.messages[name]);
}

function replaceStorefrontMeaning(file, name, from, to) {
  const content = fs.readFileSync(file, "utf8");
  const heading = `${name === "OrderAccepted" ? "####" : "###"} Message ${name}`;
  const start = content.indexOf(heading);
  const index = content.indexOf(from, start);
  assert.ok(start >= 0 && index > start, `${name}: ${from}`);
  fs.writeFileSync(file, content.slice(0, index) + to + content.slice(index + from.length));
}

for (const [name, schemaPath, prose] of storefrontMeanings) {
  const section = schemaPath.startsWith("headers/") ? "Headers" : "Payload";
  test(`rejects stale storefront field prose ${name} ${schemaPath} after source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    storefrontSchema(source, name, schemaPath).description = "A different fixture meaning.";
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`storefront Message ${name} ${section} schema`));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });

  test(`rejects matching unsourced storefront field prose ${name} ${schemaPath}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
    for (const profile of ["full", "compact"]) {
      replaceStorefrontMeaning(path.join(candidatePath, profile, "channels", "orders.md"),
        name, prose, "A different fixture meaning.");
      restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
    }
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`storefront Message ${name} ${section} schema`));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [label, schemaPath, description] of [
  ["null", "payload/properties/orderId", null],
  ["array", "payload/properties/orderId", []],
  ["number", "payload/properties/orderId", 42],
  ["multiline", "payload/properties/orderId", "First line.\nSecond line."],
  ["header root", "headers", "A header-map description without a projected row."],
  ["payload root", "payload", "Additional source object meaning."],
  ["array item object", "payload/properties/items/items", "Additional source object meaning."]
]) {
  test(`rejects unprojected storefront field prose at ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    storefrontSchema(source, "CreateOrder", schemaPath).description = description;
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /storefront Message CreateOrder (Headers|Payload) schema/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects stale storefront field prose behind the selected alternate Reply component", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.components.messages.OrderAcceptedAlternate = structuredClone(source.components.messages.OrderAccepted);
  source.components.messages.OrderAcceptedAlternate.payload.properties.acceptedAt.description = "A different time.";
  source.channels.orderReplies.messages.orderAccepted.$ref = "#/components/messages/OrderAcceptedAlternate";
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /storefront Message OrderAccepted Payload schema/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("accepts sourced storefront field prose with a table-escaped pipe", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.components.messages.CreateOrder.payload.properties.tenantId.description = "Fixture tenant | documented identifier.";
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  for (const profile of ["full", "compact"]) {
    replaceStorefrontMeaning(path.join(candidatePath, profile, "channels", "orders.md"),
      "CreateOrder", "Storefront tenant identifier.", "Fixture tenant \\| documented identifier.");
  }
  rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("accepts sourced storefront field prose preceding object closure", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.components.messages.CreateOrder.payload.description = "Submitted order contract.";
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  for (const profile of ["full", "compact"]) {
    replaceStorefrontMeaning(path.join(candidatePath, profile, "channels", "orders.md"),
      "CreateOrder", "Additional properties are forbidden.",
      "Submitted order contract. Additional properties are forbidden.");
  }
  rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("accepts storefront field prose table-cell boundary spaces", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceStorefrontMeaning(path.join(candidatePath, profile, "channels", "orders.md"),
      "OrderCreated", "Message identifier retained across redelivery.",
      "Message identifier retained across redelivery.   ");
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

const storefrontBindingScopes = [
  ...["receiveOrderCreated", "sendCreateOrder"].map((name) => ({
    label: `storefront operation ${name} Bindings`,
    owner: (source) => source.operations[name],
    anchor: name === "receiveOrderCreated" ? "## RECEIVE orders.events (receiveOrderCreated)"
      : "## SEND orders.commands (sendCreateOrder)",
    from: "### Operation Bindings\n\nnone", heading: "### Operation Bindings"
  })),
  ...[["orderEvents", "## RECEIVE orders.events (receiveOrderCreated)"],
    ["orderCommands", "## SEND orders.commands (sendCreateOrder)"]].map(([name, anchor]) => ({
    label: `storefront Channel ${name} Bindings`,
    owner: (source) => source.channels[name], anchor,
    from: "- Bindings: none", heading: "\n#### Bindings"
  })),
  ...["OrderCreated", "CreateOrder", "OrderAccepted"].map((name) => {
    const reply = name === "OrderAccepted";
    return {
      label: `storefront Message ${name} Bindings`,
      owner: (source) => source.components.messages[name],
      anchor: `${reply ? "####" : "###"} Message ${name}`,
      from: `${reply ? "#####" : "####"} Bindings\n\nnone`,
      heading: `${reply ? "#####" : "####"} Bindings`
    };
  })
];

function replaceStorefrontBinding(file, scope, replacement) {
  const content = fs.readFileSync(file, "utf8");
  const start = content.indexOf(scope.anchor);
  const index = content.indexOf(scope.from, start);
  const end = content.indexOf("\n## ", start + scope.anchor.length);
  assert.ok(start >= 0 && index > start && (end < 0 || index < end), scope.label);
  fs.writeFileSync(file, content.slice(0, index) + replacement + content.slice(index + scope.from.length));
}

for (const scope of storefrontBindingScopes) {
  test(`rejects stale ${scope.label} known absence after source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    scope.owner(source).bindings = { kafka: { bindingVersion: "0.5.0" } };
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(scope.label));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });

  test(`rejects matching unsourced ${scope.label} table`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
    const table = "| Protocol | Property | Value / Rule |\n|---|---|---|\n| kafka | bindingVersion | 0.5.0 |";
    for (const profile of ["full", "compact"]) {
      replaceStorefrontBinding(path.join(candidatePath, profile, "channels", "orders.md"),
        scope, `${scope.heading}\n\n${table}`);
      restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
    }
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(scope.label));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [index, value] of [[0, null], [2, []], [6, "none"], [5, { kafka: {} }]]) {
  const scope = storefrontBindingScopes[index];
  test(`rejects non-empty-map absence interpretation for ${scope.label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    scope.owner(source).bindings = value;
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(scope.label));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("accepts explicit empty storefront local Bindings maps", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  for (const scope of storefrontBindingScopes) scope.owner(source).bindings = {};
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("accepts headed storefront primary Channel Bindings known absence", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    for (const scope of storefrontBindingScopes.slice(2, 4)) {
      replaceStorefrontBinding(path.join(candidatePath, profile, "channels", "orders.md"),
        scope, `${scope.heading}\n\nnone`);
    }
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [fact, mutate, label] of [
  ["Bindings", (message) => { message.bindings = { kafka: { bindingVersion: "0.5.0" } }; },
    "storefront Message OrderAccepted Bindings"],
  ["schema", (message) => { message.headers.properties["message-id"].minLength = 2; },
    "storefront Message OrderAccepted Headers schema"]
]) {
  test(`rejects stale storefront selected Reply Message ${fact} behind an alternate component`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const message = structuredClone(source.components.messages.OrderAccepted);
    mutate(message);
    source.components.messages.OrderAcceptedAlternate = message;
    source.channels.orderReplies.messages.orderAccepted.$ref = "#/components/messages/OrderAcceptedAlternate";
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(label));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("accepts equivalent storefront selected Reply Message behind an alternate component", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.components.messages.OrderAcceptedAlternate = structuredClone(source.components.messages.OrderAccepted);
  source.channels.orderReplies.messages.orderAccepted.$ref = "#/components/messages/OrderAcceptedAlternate";
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

const structuredSyntheticOperations = [
  "r-csv-operation", "r-json-original-operation", "r-json-reuse-operation"
];
const syntheticRepresentationMutations = [
  ...structuredSyntheticOperations.flatMap((operation) => [
    [operation, "field meaning", (entry) => {
      entry.schema.properties.event_id.description = "A different event identifier";
    }],
    [operation, "field requiredness", (entry) => {
      entry.schema.required = ["status"];
    }],
    [operation, "field type", (entry) => { entry.schema.properties.event_id.type = "number"; }],
    [operation, "unprojected field constraint", (entry) => {
      entry.schema.properties.event_id.maxLength = 99;
    }],
    [operation, "example", (entry) => { entry.example.event_id = "evt_different"; }]
  ]),
  ...[...structuredSyntheticOperations, "r-raw-operation", "r-tagged-operation", "r-untagged-operation"]
    .map((operation) => [operation, "payload presence", (entry) => {
      if (entry.action === "SEND") entry.payloadRequired = "no";
      else entry.payloadPresence = "optional";
    }]),
  ...["r-tagged-operation", "r-untagged-operation"].flatMap((operation) => [0, 1]
    .map((index) => [operation, `variant ${index} example`, (entry) => {
      const example = entry.variants[index].example;
      example[Object.hasOwn(example, "id") ? "id" : "reason"] = "different";
    }])),
  ...["ruleVersion", "fenceInfo", "decodedValueModel"].map((field) => [
    "r-csv-operation", `wire adapter ${field}`, (entry) => { entry.wireAdapter[field] = "different"; }
  ]),
  ...["r-json-original-operation", "r-tagged-operation"].map((operation) => [
    operation, "schema target", (entry) => { entry.schemaFormat = "unknown-schema-target"; }
  ]),
  ["r-tagged-operation", "discriminator", (entry) => { entry.discriminator = "different"; }],
  ["r-tagged-operation", "variant identity", (entry) => { entry.variants[0].value = "different"; }],
  ["r-tagged-operation", "unprojected variant constraint", (entry) => {
    entry.variants[0].schema.properties.id.maxLength = 99;
  }],
  ["r-untagged-operation", "variant label", (entry) => { entry.variants[0].label = "different"; }],
  ["r-untagged-operation", "selection rule", (entry) => {
    entry.selectionRule = "The receiver selects a different lifecycle contract.";
  }],
  ["r-raw-operation", "raw form", (entry) => { entry.form = "structured-json"; }],
  ["r-raw-operation", "raw description", (entry) => { entry.description = "Different receipt bytes."; }],
  ["r-csv-operation", "channel", (entry) => { entry.channel = "representations.different"; }],
  ["r-json-reuse-operation", "Message identity", (entry) => { entry.message = "different-message"; }]
];

for (const [operation, fact, mutate] of syntheticRepresentationMutations) {
  test(`rejects stale synthetic representation ${operation} ${fact} after source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "complete-representations.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    mutate(source.representations.find((entry) => entry.operation === operation));
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "complete-representations.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`${operation}.*representation`));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects a missing synthetic representation source entry even when projections agree", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "complete-representations.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.representations = source.representations.filter((entry) => (
    entry.operation !== "r-json-reuse-operation"
  ));
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "complete-representations.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /operation inventory/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const kind of ["CSV", "JSON reuse"]) {
  test(`rejects matching synthetic representation ${kind} examples unsupported by source`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
    for (const profile of ["full", "compact"]) {
      const file = path.join(candidatePath, profile, "channels", "representations.md");
      const content = fs.readFileSync(file, "utf8");
      const from = kind === "CSV" ? "evt_03" : "evt_04";
      assert.equal(content.split(from).length - 1, kind === "JSON reuse" && profile === "full" ? 2 : 1);
      fs.writeFileSync(file, content.replaceAll(from, "evt_wrong"));
      restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
    }
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /representation.*example/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("accepts equivalent synthetic representation CSV with reordered wire columns", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  replaceExactlyOnce(path.join(candidatePath, "compact", "channels", "representations.md"),
    "event_id,status\nevt_03,created", "status,event_id\ncreated,evt_03");
  restampDocumentSet(path.join(candidatePath, "compact"), manifestPath, { write: true });
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects an extra projected synthetic representation without a source entry", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    const file = path.join(candidatePath, profile, "channels", "representations.md");
    const content = fs.readFileSync(file, "utf8");
    const start = content.indexOf("## SEND representations.json-original (r-json-original-operation)");
    const end = content.indexOf("## SEND representations.json-reuse (r-json-reuse-operation)");
    assert.ok(start >= 0 && end > start);
    const extra = content.slice(start, end).replaceAll("json-original", "json-other");
    fs.writeFileSync(file, content.slice(0, end) + extra + content.slice(end));
    const indexPath = path.join(candidatePath, profile, "indexes", "operations-broad.md");
    const rows = fs.readFileSync(indexPath, "utf8");
    const row = rows.split("\n").find((line) => line.includes("| r-json-original-operation |"));
    assert.ok(row);
    replaceExactlyOnce(indexPath, row, `${row}\n${row.replaceAll("json-original", "json-other")}`);
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /operation inventory/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const extension of ["prose trailing spaces", "x-marker", "x-section with fenced data"]) {
  test(`accepts synthetic representation ${extension} excluded by canonical comparison`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
    const file = path.join(candidatePath, "compact", "channels", "representations.md");
    if (extension === "prose trailing spaces") {
      const prose = "The receiver identifies the applicable lifecycle shape from the complete decoded value.";
      replaceExactlyOnce(file, prose, `${prose}  `);
    } else {
      const row = "| status | string | yes | no | Lifecycle status |";
      const extra = extension === "x-marker" ? "**x-audit**: Non-contract fixture note."
        : '##### x-Audit\n\n```json\n{"extra":"not a payload example"}\n```';
      replaceExactlyOnce(file, `${row}\n\n### Reply`, `${row}\n\n${extra}\n\n### Reply`);
    }
    restampDocumentSet(path.join(candidatePath, "compact"), manifestPath, { write: true });
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects a non-string synthetic representation schema required entry", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "complete-representations.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.representations[0].schema.required = [["event_id"], "status"];
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  for (const profile of ["full", "compact"]) {
    const file = path.join(candidatePath, profile, "channels", "representations.md");
    const content = fs.readFileSync(file, "utf8");
    const end = content.indexOf("## SEND representations.json-original (r-json-original-operation)");
    assert.ok(end > 0);
    const csv = content.slice(0, end);
    const row = "| event_id | string | yes | no | Synthetic event identifier |";
    assert.equal(csv.split(row).length - 1, 1);
    fs.writeFileSync(file, csv.replace(row, row.replace("| yes |", "| no |")) + content.slice(end));
  }
  rebindAndRestamp(candidatePath, "complete-representations.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /r-csv-operation.*representation.*schema/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const message of ["CreateOrder", "OrderCreated", "OrderAccepted"]) {
  for (const [fact, mutate] of [
    ["header type", (entry) => { entry.headers.properties["message-id"].type = "integer"; }],
    ["header requiredness", (entry) => {
      entry.headers.required = entry.headers.required.filter((name) => name !== "message-id");
    }],
    ["header constraint", (entry) => { entry.headers.properties["message-id"].minLength = 2; }],
    ["header-root constraint", (entry) => { entry.headers.const = entry.examples[0].headers; }],
    ["header inventory", (entry) => { entry.headers.properties.extra = { type: "string" }; }],
    ["payload requiredness", (entry) => {
      entry.payload.required = entry.payload.required.filter((name) => name !== "orderId");
    }],
    ["payload nullability", (entry) => { entry.payload.type = ["object", "null"]; }],
    ["payload openness", (entry) => { entry.payload.additionalProperties = true; }],
    ["payload constraint", (entry) => {
      entry.payload.properties.orderId.pattern = "^ord_[A-Z]+$";
    }],
    ["payload example", (entry) => { entry.examples[0].payload.orderId = "ord_OTHER"; }]
  ]) {
    test(`rejects stale storefront Message ${message} ${fact} after source rebinding`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
      const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
      mutate(source.components.messages[message]);
      fs.writeFileSync(sourcePath, JSON.stringify(source));
      rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
      const before = directorySnapshot(candidatePath);

      const result = runChecker([candidatePath]);

      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, new RegExp(`storefront Message ${message}`));
      assert.deepEqual(directorySnapshot(candidatePath), before);
    });
  }
}

for (const [fact, mutate] of [
  ["array bound", (entry) => { entry.payload.properties.items.minItems = 0; }],
  ["nested item bound", (entry) => {
    entry.payload.properties.items.items.properties.quantity.minimum = 2;
  }],
  ["unprojected schema keyword", (entry) => {
    entry.payload.properties.orderId.maxLength = 99;
  }]
]) {
  test(`rejects stale storefront Message CreateOrder ${fact} after source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    mutate(source.components.messages.CreateOrder);
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /storefront Message CreateOrder/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [fact, from, to] of [
  ["constraint", "`minimum=1`; Item quantity.", "`minimum=0`; Item quantity."],
  ["example", '"acceptedAt": "2026-01-02T03:04:05Z"',
    '"acceptedAt": "2026-01-03T03:04:05Z"']
]) {
  test(`rejects matching storefront Message ${fact} unsupported by source`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
    for (const profile of ["full", "compact"]) {
      replaceExactlyOnce(path.join(candidatePath, profile, "channels", "orders.md"),
        profile === "compact" ? from.replaceAll(": ", ":") : from,
        profile === "compact" ? to.replaceAll(": ", ":") : to);
      restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
    }
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /storefront Message/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects storefront Message example drift beyond IEEE 754 precision", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  replaceExactlyOnce(path.join(candidatePath, "source", "storefront.asyncapi.json"),
    '"quantity": 2', '"quantity": 9007199254740993');
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(path.join(candidatePath, profile, "channels", "orders.md"),
      profile === "compact" ? '"quantity":2' : '"quantity": 2',
      profile === "compact" ? '"quantity":9007199254740992' : '"quantity": 9007199254740992');
  }
  rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /storefront Message CreateOrder/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("accepts storefront Message example object order and exact number spelling differences", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  replaceExactlyOnce(path.join(candidatePath, "compact", "channels", "orders.md"),
    '{"items":[{"quantity":2,"sku":"sku_demo_01"}],"orderId":"ord_01HXYZ","tenantId":"tenant_demo"}',
    '{"tenantId":"tenant_demo","orderId":"ord_01HXYZ","items":[{"sku":"sku_demo_01","quantity":2e0}]}');
  restampDocumentSet(path.join(candidatePath, "compact"), manifestPath, { write: true });
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects matching storefront Message header duplicates that hide a missing source header", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(path.join(candidatePath, profile, "channels", "orders.md"),
      "| message-id | string | yes | no | `minLength=1`; Message identifier used for deduplication. |",
      "| correlation-id | string | yes | no | `minLength=1`; Correlates the acceptance reply. |");
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /storefront Message CreateOrder Headers schema/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects candidate source bytes outside the manifest digest even when profiles agree", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  replaceExactlyOnce(
    path.join(candidatePath, "source", "complete-contexts.json"),
    "Publish the payload-free alpha control signal.",
    "Publish an altered payload-free alpha control signal."
  );
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /complete-contexts.*source digest/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects a restamped versioned candidate with a different generator identity", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.generator.id = "different-projector";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /generator identity/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects a manifest Sources revision that differs from the bound source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.sources.find((entry) => entry.sourceId === "complete-contexts").revision = "fixture-2";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /complete-contexts.*Sources.*Revision/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects an undeclared fifth source binding in the candidate manifest", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.sources.push({
    ...manifest.sources.find((entry) => entry.sourceId === "storefront-behavior"),
    sourceId: "unexpected-fifth-source"
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /unexpected source binding/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects matching profile Sources rows that disagree with the bound source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "indexes", "sources-contexts-behavior.md"),
      "| complete-contexts | behavior-configuration | none | none | none | complete-contexts.json | fixture-1 |",
      "| complete-contexts | behavior-configuration | none | none | none | complete-contexts.json | fixture-2 |"
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /complete-contexts.*Sources.*revision/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects an unrelated source_ref on a Sources shard after both profiles are restamped", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "indexes", "sources-asyncapi.md"),
      "source_refs: storefront-asyncapi-3.1.0",
      "source_refs: complete-contexts, storefront-asyncapi-3.1.0"
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /sources-asyncapi\.md.*source_refs/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [label, file, from, to, mismatch] of [
  ["primary Message identity", "complete-contexts.json", '"message": "a-message"',
    '"message": "a-renamed-message"', /a-operation.*Message/i],
  ["expanded Workflow precondition", "complete-contexts.json",
    "Caller-local alpha event data is validated", "Caller-local alpha event data is not validated",
    /alpha-delivery.*Preconditions/i],
  ["variant field meaning", "complete-representations.json",
    '"description": "Archival reason"', '"description": "Altered archival reason"',
    /r-untagged-operation.*variant/i],
  ["known absence", "complete-contexts.json",
    '"failureHandling": "none"', '"failureHandling": "unknown"',
    /failure handling/i],
  ["storefront operation summary", "storefront.asyncapi.json",
    '"summary": "Submit an order and receive its acceptance reply."',
    '"summary": "Submit a changed order and receive its acceptance reply."',
    /sendCreateOrder.*Summary/i]
]) {
  test(`rejects a restamped pair that disagrees with source ${label}`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", file), from, to);
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, mismatch);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [heading, from, to] of [
  ["Connection and Session",
    "Reconnect with bounded exponential backoff from 100 milliseconds to 10 seconds.",
    "Reconnect with bounded exponential backoff from 200 milliseconds to 10 seconds."],
  ["Data Representation", '"role": "constraint"', '"role": "annotation"'],
  ["Empty and Omitted Values",
    "Only fields not listed as required may be omitted.",
    "All fields may be omitted."],
  ["Rate Limits and Quotas", '"applies": false', '"applies": true']
]) {
  test(`rejects stale ${heading} after behavior source rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(
      path.join(candidatePath, "source", "storefront-behavior.json"), from, to
    );
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`CONVENTIONS.*${heading}`, "i"));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [heading, file, from, to] of [
  ["Environments", "storefront.asyncapi.json",
    '"host": "broker.example.invalid:9092"', '"host": "broker.changed.example.invalid:9092"'],
  ["Environments", "storefront-behavior.json",
    "Use the production server for this corpus scenario.",
    "Use the production server only for this corpus scenario."],
  ["Protocols and Bindings", "storefront-behavior.json",
    '"protocolVersion": "3.6.0"', '"protocolVersion": "3.7.0"'],
  ["Protocols and Bindings", "storefront.asyncapi.json",
    '"protocolVersion": "3.6.0"', '"protocolVersion": "3.7.0"'],
  ["Serialization", "storefront-behavior.json",
    '"wireMediaType": "application/json"',
    '"wireMediaType": "application/cloudevents+json"'],
  ["Serialization", "storefront.asyncapi.json",
    '"defaultContentType": "application/json"',
    '"defaultContentType": "application/cloudevents+json"']
]) {
  test(`rejects stale ${heading} after ${file} rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", file), from, to);
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`CONVENTIONS.*${heading}`, "i"));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const messageName of ["CreateOrder", "OrderAccepted"]) {
  test(`rejects Serialization when selected AsyncAPI ${messageName} content type differs`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront.asyncapi.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    assert.notEqual(source.components.messages[messageName], undefined);
    source.components.messages[messageName].contentType = "application/cloudevents+json";
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Serialization/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Protocols and Bindings prose unsupported by either source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "and clients expose logical headers by their documented names.",
      "and clients expose logical headers by their documented names. All headers are encrypted."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Protocols and Bindings/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [label, file, mutate] of [
  ["behavior scheme", "storefront-behavior.json", (source) => {
    source.authentication.scheme = "changedOAuth";
  }],
  ["behavior credential acquisition", "storefront-behavior.json", (source) => {
    source.authentication.credentialAcquisition = "Obtain a token from a separate authorization service.";
  }],
  ["behavior credential rotation", "storefront-behavior.json", (source) => {
    source.authentication.credentialRotation = "Acquire a replacement token two minutes before expiry.";
  }],
  ["AsyncAPI token URL", "storefront.asyncapi.json", (source) => {
    source.operations.sendCreateOrder.security[0].flows.clientCredentials.tokenUrl
      = "https://auth.changed.example.invalid/oauth/token";
  }],
  ["AsyncAPI operation scope", "storefront.asyncapi.json", (source) => {
    source.operations.sendCreateOrder.security[0].scopes = ["orders:read"];
  }],
  ["behavior operation scope", "storefront-behavior.json", (source) => {
    source.authorization.sendCreateOrder = ["orders:read"];
  }]
]) {
  test(`rejects stale Authentication after ${label} rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", file);
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    mutate(source);
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Authentication/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Authentication prose unsupported by either source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "and acquire a replacement token before the current token expires.",
      "and acquire a replacement token before the current token expires. Share it across tenants."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Authentication/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [fact, from, to] of [
  ["retry action",
    "Negative-acknowledge retryable failures; reject non-retryable failures.",
    "Negative-acknowledge all failures; reject none."],
  ["maximum delivery attempts", '"maxDeliveryAttempts": 5', '"maxDeliveryAttempts": 6'],
  ["dead-letter channel", '"deadLetterChannel": "orders.dead-letter"',
    '"deadLetterChannel": "orders.changed-dead-letter"'],
  ["terminal action",
    "Publish the failed envelope and diagnostic code to the dead-letter channel.",
    "Publish only the diagnostic code to the dead-letter channel."]
]) {
  test(`rejects stale Error Handling after ${fact} source rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(
      path.join(candidatePath, "source", "storefront-behavior.json"), from, to
    );
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Error Handling/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Error Handling prose unsupported by the behavior source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "publish the failed envelope and diagnostic code to `orders.dead-letter`.",
      "publish the failed envelope and diagnostic code to `orders.dead-letter`. Discard every retry."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Error Handling/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [fact, file, from, to] of [
  ["behavior reply channel", "storefront-behavior.json",
    '"replyChannel": "orders.replies"', '"replyChannel": "orders.changed-replies"'],
  ["behavior correlation", "storefront-behavior.json",
    "The reply correlation-id equals the command correlation-id.",
    "The reply correlation-id differs from the command correlation-id."],
  ["behavior timeout", "storefront-behavior.json",
    '"timeout": "5 seconds"', '"timeout": "7 seconds"'],
  ["behavior timeout meaning", "storefront-behavior.json",
    "command outcome is unknown to the caller.", "command outcome is known to the caller."],
  ["AsyncAPI reply channel address", "storefront.asyncapi.json",
    '"address": "orders.replies"', '"address": "orders.changed-replies"']
]) {
  test(`rejects stale Request-Reply after ${fact} source rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", file), from, to);
    rebindAndRestamp(candidatePath, file);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Request-Reply/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Request-Reply prose unsupported by either source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "the command outcome is unknown to the caller.",
      "the command outcome is unknown to the caller. Retry with a new correlation-id."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Request-Reply/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [fact, from, to] of [
  ["compatibility policy",
    "Additive optional fields are backward compatible; removing or changing a required field requires a new contract version.",
    "Removing optional fields is backward compatible; changing a required field requires a new contract version."],
  ["logical API identity", '"logicalApi": "urn:example:storefront-order-messaging"',
    '"logicalApi": "urn:example:changed-order-messaging"'],
  ["contract version", '"contractVersion": "1.0.0"',
    '"contractVersion": "1.0.1"']
]) {
  test(`rejects stale Schema Evolution after behavior ${fact} rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(
      path.join(candidatePath, "source", "storefront-behavior.json"), from, to
    );
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /CONVENTIONS.*Schema Evolution/i);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects stale Schema Evolution after AsyncAPI identity and Sources rows are updated", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  replaceExactlyOnce(
    path.join(candidatePath, "source", "storefront.asyncapi.json"),
    '"id": "urn:example:storefront-order-messaging"',
    '"id": "urn:example:changed-order-messaging"'
  );
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "indexes", "sources-asyncapi.md"),
      "| urn:example:storefront-order-messaging |",
      "| urn:example:changed-order-messaging |"
    );
  }
  rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Schema Evolution/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects stale Schema Evolution after AsyncAPI version and Sources bindings are updated", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  replaceExactlyOnce(
    path.join(candidatePath, "source", "storefront.asyncapi.json"),
    '"version": "1.0.0"', '"version": "1.0.1"'
  );
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.sources.find((entry) => entry.sourceId === "storefront-asyncapi-3.1.0").revision
    = "1.0.1";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "indexes", "sources-asyncapi.md"),
      "| 1.0.0 | storefront.asyncapi.json | 1.0.0 |",
      "| 1.0.1 | storefront.asyncapi.json | 1.0.1 |"
    );
  }
  rebindAndRestamp(candidatePath, "storefront.asyncapi.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Schema Evolution/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects matching Schema Evolution prose unsupported by either source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "and this corpus projects contract version `1.0.0`.",
      "and this corpus projects contract version `1.0.0`. Every change is compatible."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Schema Evolution/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [name, field, replacement] of [
  ["receiveOrderCreated", "sideEffects", "Delete the storefront order state."],
  ["sendCreateOrder", "idempotency", "Use a fresh message-id for every retry."],
  ["receiveOrderCreated", "preconditions", "No subscription is required."],
  ["sendCreateOrder", "authorization", "OAuth2 scope orders:read is required."],
  ["receiveOrderCreated", "delivery", "at-most-once -- Never redeliver."],
  ["sendCreateOrder", "ordering", "Publish commands in arbitrary order."]
]) {
  test(`rejects stale storefront Behavior ${name} ${field} after source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront-behavior.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    source.operationBehavior[name][field] = replacement;
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`${name} Behavior`));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching storefront Behavior prose unsupported by its source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "channels", "orders.md"),
      "- side_effects: Update the storefront order state to created.",
      "- side_effects: Delete the storefront order state."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /receiveOrderCreated Behavior/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects storefront Behavior authorization that contradicts its sourced scope", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "storefront-behavior.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.operationBehavior.sendCreateOrder.authorization = "OAuth2 scope orders:read is required.";
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "channels", "orders.md"),
      "- authorization: OAuth2 scope orders:write is required.",
      "- authorization: OAuth2 scope orders:read is required."
    );
  }
  rebindAndRestamp(candidatePath, "storefront-behavior.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /sendCreateOrder Behavior authorization/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const name of ["receiveOrderCreated", "sendCreateOrder"]) {
  for (const [field, replacement] of [
    ["failure", "unrecognized failure"],
    ["signal", "an unrelated error signal"],
    ["condition", "The operation has a different precondition."],
    ["action", "Ignore the failure and continue."]
  ]) {
    test(`rejects stale ${name} Failure Handling ${field} after source rebinding`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      const sourcePath = path.join(candidatePath, "source", "storefront-behavior.json");
      const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
      source.operationFailures[name][0][field] = replacement;
      fs.writeFileSync(sourcePath, JSON.stringify(source));
      rebindAndRestamp(candidatePath, "storefront-behavior.json");
      const before = directorySnapshot(candidatePath);

      const result = runChecker([candidatePath]);

      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, new RegExp(`${name} Failure Handling`));
      assert.deepEqual(directorySnapshot(candidatePath), before);
    });
  }
}

test("rejects matching storefront Failure Handling prose unsupported by the source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(path.join(candidatePath, profile, "channels", "orders.md"),
      "| retryable handler failure | handler returns a retryable error |",
      "| retryable handler failure | handler returns a different error |"
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /receiveOrderCreated Failure Handling/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [change, mutate] of [
  ["row order", (failures) => failures.reverse()],
  ["row count", (failures) => failures.pop()]
]) {
  test(`rejects stale sendCreateOrder Failure Handling ${change} after source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront-behavior.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    mutate(source.operationFailures.sendCreateOrder);
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /sendCreateOrder Failure Handling/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [fact, mutate, label] of [
  ["routing name", (source) => {
    source.workflows["state-none"].name = "Different state name";
  }, "state-none routing name"],
  ["introduction", (source) => {
    source.workflows["state-unsupported"].purpose =
      "A different unrepresentable workflow purpose.";
  }, "state-unsupported introduction"],
  ["none section state", (source) => {
    source.workflows["state-none"].sections.Preconditions = {
      state: "unknown", requiredInput: "authoritative preconditions"
    };
  }, "state-none Preconditions"],
  ["extra section", (source) => {
    source.workflows["state-none"].sections.Extra = "none";
  }, "state-none sections"]
]) {
  test(`rejects stale incomplete Workflow ${fact} after source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "complete-contexts.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    mutate(source);
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "complete-contexts.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(label));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const heading of ["Preconditions", "Steps", "State Transitions", "Failure and Recovery"]) {
  for (const [state, field, replacement] of [
    ["unknown", "requiredInput", `revised ${heading.toLowerCase()} input`],
    ["unsupported", "feature", `revised ${heading.toLowerCase()} feature`]
  ]) {
    test(`rejects stale incomplete Workflow ${state} ${heading} after source rebinding`, (t) => {
      const candidatePath = copyVersionedCandidate(t);
      const sourcePath = path.join(candidatePath, "source", "complete-contexts.json");
      const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
      source.workflows[`state-${state}`].sections[heading][field] = replacement;
      fs.writeFileSync(sourcePath, JSON.stringify(source));
      rebindAndRestamp(candidatePath, "complete-contexts.json");
      const before = directorySnapshot(candidatePath);

      const result = runChecker([candidatePath]);

      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, new RegExp(`state-${state} ${heading}`));
      assert.deepEqual(directorySnapshot(candidatePath), before);
    });
  }
}

for (const [state, from, to, label] of [
  ["unknown", "workflow Preconditions require the authoritative preconditions",
    "workflow Preconditions require an unrelated checklist", "state-unknown Preconditions"],
  ["unsupported", "complete-contexts.json#/workflows/state-unsupported/sections/Preconditions",
    "complete-contexts.json#/workflows/state-unsupported/sections/Steps",
    "state-unsupported Preconditions"]
]) {
  test(`rejects matching incomplete Workflow ${state} marker unsupported by source`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
    for (const profile of ["full", "compact"]) {
      replaceExactlyOnce(path.join(candidatePath, profile, "workflows", `state-${state}.md`),
        from, to);
      restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
    }
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(label));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [fact, mutate] of [
  ["raw content", (source) => {
    source.referenceMaterials["middle-operations"].rawContent =
      source.referenceMaterials["middle-operations"].rawContent.replace(
        "Use only synthetic identifiers", "Use real identifiers"
      );
  }],
  ["fence-driving backtick run", (source) => {
    source.referenceMaterials["middle-operations"].rawContent =
      source.referenceMaterials["middle-operations"].rawContent.replace(
        "literal ```` run", "literal ````` run"
      );
  }],
  ["decomposed Unicode", (source) => {
    source.referenceMaterials["middle-operations"].rawContent =
      source.referenceMaterials["middle-operations"].rawContent.replace("Cafe\u0301", "Café");
  }],
  ["trailing blank line", (source) => {
    source.referenceMaterials["middle-operations"].rawContent =
      source.referenceMaterials["middle-operations"].rawContent.replace(/\r\n$/, "");
  }],
  ["info string", (source) => {
    source.referenceMaterials["middle-operations"].info = "text";
  }],
  ["instruction authority", (source) => {
    source.referenceMaterials["middle-operations"].instructionAuthority = "trusted";
  }],
  ["extra Reference Material", (source) => {
    source.referenceMaterials.extra = {
      instructionAuthority: "none", info: "text", rawContent: "Extra reference."
    };
  }]
]) {
  test(`rejects stale Reference Material ${fact} after source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "complete-contexts.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    mutate(source);
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, "complete-contexts.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /Reference Material/);
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Reference Material content unsupported by source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "references", "middle-operations.md"),
      "Use only synthetic identifiers", "Use real identifiers"
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Reference Material/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects matching Reference Material source_refs with unrelated sources", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "references", "middle-operations.md"),
      "source_refs: complete-contexts", "source_refs: all"
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Reference Material.*source_refs/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("accepts equivalent Reference Material after BOM and lone-CR normalization", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const sourcePath = path.join(candidatePath, "source", "complete-contexts.json");
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  source.referenceMaterials["middle-operations"].rawContent =
    source.referenceMaterials["middle-operations"].rawContent
      .replace(/^\uFEFF/, "").replace(/\r\n/g, "\r");
  fs.writeFileSync(sourcePath, JSON.stringify(source));
  rebindAndRestamp(candidatePath, "complete-contexts.json");
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [fact, sourceName, mutate, label] of [
  ["receive known no-reply", "storefront-behavior.json", (source) => {
    source.operationBehavior.receiveOrderCreated.noReply = false;
  }, "receiveOrderCreated Reply"],
  ["send reply meaning", "storefront-behavior.json", (source) => {
    source.operationBehavior.sendCreateOrder.reply =
      "The orderAccepted reply confirms final fulfillment.";
  }, "sendCreateOrder purpose"],
  ["selected reply Message", "storefront.asyncapi.json", (source) => {
    source.channels.orderReplies.messages.orderAccepted.$ref =
      "#/components/messages/OrderCreated";
  }, "sendCreateOrder Reply Message"],
  ["reply Channel binding", "storefront.asyncapi.json", (source) => {
    source.channels.orderReplies.bindings = { kafka: { topic: "orders.replies" } };
  }, "sendCreateOrder Reply Channel"]
]) {
  test(`rejects stale storefront Reply after ${fact} source rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", sourceName);
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    mutate(source);
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    rebindAndRestamp(candidatePath, sourceName);
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(label));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

for (const [fact, sourceValue, conventionFrom, conventionTo, label] of [
  ["correlation", "The reply correlation-id differs from the command correlation-id.",
    "The reply `correlation-id` equals the command `correlation-id`.",
    "The reply `correlation-id` differs from the command `correlation-id`.",
    "sendCreateOrder Reply correlation"],
  ["timeout", "7 seconds", "Wait 5 seconds for a reply", "Wait 7 seconds for a reply",
    "sendCreateOrder Reply timeout"]
]) {
  test(`rejects stale storefront Reply ${fact} after matching convention rebinding`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    const sourcePath = path.join(candidatePath, "source", "storefront-behavior.json");
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    source.requestReply[fact] = sourceValue;
    fs.writeFileSync(sourcePath, JSON.stringify(source));
    for (const profile of ["full", "compact"]) {
      replaceExactlyOnce(path.join(candidatePath, profile, "CONVENTIONS.md"),
        conventionFrom, conventionTo);
    }
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(label));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching storefront Reply channel unsupported by either source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(path.join(candidatePath, profile, "channels", "orders.md"),
      "- channel: orders.replies", "- channel: orders.unrelated");
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /sendCreateOrder Reply channel/);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects matching Ordering prose that disagrees with the behavior source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "There is no ordering guarantee across distinct `orderId` values.",
      "There is an ordering guarantee across distinct `orderId` values."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Ordering/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects unsourced Data Representation prose after the format table", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      '| "date-time" | constraint | An RFC 3339 date-time string with an explicit offset. |',
      '| "date-time" | constraint | An RFC 3339 date-time string with an explicit offset. |\n\nAll formats are optional.'
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Data Representation/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

for (const [heading, from, to] of [
  ["Delivery Semantics",
    "A redelivery retains the original message-id.",
    "A redelivery retains the original message-id and sequence."],
  ["Idempotency and Deduplication",
    '"scope": "per storefront tenant"',
    '"scope": "per storefront region"']
]) {
  test(`rejects stale ${heading} after behavior source rebinding and restamp`, (t) => {
    const candidatePath = copyVersionedCandidate(t);
    replaceExactlyOnce(path.join(candidatePath, "source", "storefront-behavior.json"), from, to);
    rebindAndRestamp(candidatePath, "storefront-behavior.json");
    const before = directorySnapshot(candidatePath);

    const result = runChecker([candidatePath]);

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`CONVENTIONS.*${heading}`, "i"));
    assert.deepEqual(directorySnapshot(candidatePath), before);
  });
}

test("rejects matching Message Envelope prose unsupported by the behavior source", (t) => {
  const candidatePath = copyVersionedCandidate(t);
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  for (const profile of ["full", "compact"]) {
    replaceExactlyOnce(
      path.join(candidatePath, profile, "CONVENTIONS.md"),
      "Use `message-id` as the message identifier, `correlation-id` as the correlation identifier, and `reply-to` as the reply address.",
      "Use `message-id` as the message identifier, `correlation-id` as the correlation identifier, and `reply-to` as the reply address. All messages are encrypted."
    );
    restampDocumentSet(path.join(candidatePath, profile), manifestPath, { write: true });
  }
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /CONVENTIONS.*Message Envelope/i);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("checks one whole-set complete full and compact pair without modifying it", (t) => {
  const { candidatePath } = restampCandidate(t);
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    "Complete fixture check passed: 7 paths, full/compact pair equivalent.\n"
  );
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("checks the versioned complete candidate by default without modifying it", () => {
  const before = fs.existsSync(defaultCandidatePath)
    ? directorySnapshot(defaultCandidatePath)
    : null;

  const result = runChecker();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.match(
    result.stdout,
    /^Complete fixture check passed: \d+ paths, full\/compact pair equivalent\.\n$/
  );
  assert.notEqual(before, null, "the versioned complete candidate exists");
  assert.deepEqual(directorySnapshot(defaultCandidatePath), before);
});

test("rejects a restamped complete pair with a compact contract mismatch", (t) => {
  const { candidatePath, manifestPath } = restampCandidate(t);
  replaceExactlyOnce(
    path.join(candidatePath, "compact", "channels", "alpha.md"),
    "Documents the selected messaging operation.",
    "Documents a different selected messaging operation."
  );
  restampDocumentSet(path.join(candidatePath, "compact"), manifestPath, { write: true });
  const before = directorySnapshot(candidatePath);

  const result = runChecker([candidatePath]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /DM-PROFILE-003 compact\/channels\/alpha\.md:1 /);
  assert.deepEqual(directorySnapshot(candidatePath), before);
});

test("rejects an invalid complete-checker argument count", () => {
  const result = runChecker(["first", "second"]);

  assert.equal(result.status, 1, result.stdout);
  assert.equal(
    result.stderr,
    "Usage: node docai-messaging/tools/check-complete-fixtures.mjs [candidate-root]\n"
  );
});

test("rejects a candidate root without both profile roots", (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-checker-"));
  fs.mkdirSync(path.join(temporaryRoot, "full"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const result = runChecker([temporaryRoot]);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Complete candidate requires full and compact document-set roots/);
});
