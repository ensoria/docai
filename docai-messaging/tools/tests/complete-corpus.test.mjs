import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { candidate, copyCandidate, snapshot } from "./helpers/complete-contributor-fixture.mjs";
import { runCompleteFixtureCorpus } from "../lib/complete-corpus.mjs";
import { readCorpusJson } from "../lib/complete-corpus-contract.mjs";
import { validateCompleteFixtureRecipe } from "../lib/complete-fixture-validator.mjs";
import { validateCompleteSourceFixture } from "../lib/complete-source-fixture-validator.mjs";

const checker = fileURLToPath(new URL("../check-complete-fixtures.mjs", import.meta.url));
function sourceFixture(t) {
  const f = fixture(t);
  f.manifest.cases[0].kind = "complete-source-scenario";
  f.manifest.cases[0].rule_ids = ["DM-ADAPTER-001"];
  f.recipe = { mode: "source-scenario", evaluator: "adapter", scenario: {
    docaiMessagingVersion: "0.17.1", cases: [{ caseId: "default-schema", adapterClass: "schema",
      sourceSpecification: "AsyncAPI 3.1.0", schemaFormat: null, publicationMappings: [],
      projected: { caseId: "default-schema", outcome: "supported", resolution: "source-default",
        effectiveTarget: "application/vnd.aai.asyncapi+json;version=3.1.0",
        ruleId: "direct-asyncapi-schema-object-3.1.0", ruleVersion: "0.17.1",
        ordinaryReaderRequirement: "normalized-contract-only" }
    }] }, assertions: [{ pointer: "/adapterSourceExpectations/0/resolution", equals: "source-default" }] };
  return f;
}
function saveSource(f) {
  write(f.root, "cases.json", f.manifest);
  write(f.root, f.manifest.cases[0].path, f.recipe);
}
test("source scenario derives adapter facts from source and preserves input bytes", t => {
  const f = sourceFixture(t); saveSource(f);
  const before = snapshot(f.root), result = runCompleteFixtureCorpus(f.root);
  assert.equal(result.passed, 1, result.report);
  assert.match(result.report, /mode=source-scenario/);
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(runCompleteFixtureCorpus(f.root, { requireComplete: true }).exitCode, 1);
});
test("source scenario rejects an incorrectly projected adapter with its primary diagnostic", t => {
  const f = sourceFixture(t);
  f.recipe.scenario.cases[0].projected.resolution = "direct";
  f.manifest.cases[0].expected = "invalid";
  f.manifest.cases[0].path = "focused/invalid/source.json";
  f.manifest.cases[0].expected_rule_ids = ["DM-ADAPTER-001"];
  saveSource(f);
  const result = runCompleteFixtureCorpus(f.root);
  assert.equal(result.passed, 1, result.report);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.cases[0].diagnostics.map(item => item.ruleId), ["DM-ADAPTER-001"]);
});
test("source scenario cannot use a supplied projection as authority after source changes", t => {
  const f = sourceFixture(t);
  f.recipe.scenario.cases[0].sourceSpecification = "AsyncAPI 3.0.0";
  saveSource(f);
  const result = runCompleteFixtureCorpus(f.root);
  assert.equal(result.failed, 1, result.report);
  assert.deepEqual(result.cases[0].diagnostics.map(item => item.ruleId), ["DM-ADAPTER-001"]);
});
test("missing source expectations are setup failures, not successful negative witnesses", t => {
  const f = sourceFixture(t);
  delete f.recipe.scenario.cases[0].projected;
  f.manifest.cases[0].expected = "invalid";
  f.manifest.cases[0].path = "focused/invalid/missing-expectation.json";
  f.manifest.cases[0].expected_rule_ids = ["DM-ADAPTER-001"];
  saveSource(f);
  const result = runCompleteFixtureCorpus(f.root);
  assert.equal(result.failed, 1, result.report);
  assert.match(result.report, /source expectation/);
});
for (const [id, group, key] of [
  ["source-schema-adapter-targets-valid", "cases", "projected"],
  ["source-payload-media-identity-valid", "cases", "projectedIdentity"],
  ["source-adapter-publication-scope-valid", "selectionCases", "projectedSelection"],
  ["source-adapter-publication-scope-valid", "publicationCases", "projectedPublication"],
  ["source-adapter-publication-scope-valid", "actorCases", "projectedActors"]
]) test(`source expectation container ${key} must be an explicit object`, t => {
  const root = copyCandidate(t), manifest = readCorpusJson(path.join(root, "cases.json"));
  const entry = manifest.cases.find(item => item.id === id);
  for (const value of [undefined, null, []]) {
    const recipe = readCorpusJson(path.join(candidate, entry.path));
    if (value === undefined) delete recipe.scenario[group][0][key];
    else recipe.scenario[group][0][key] = value;
    write(root, entry.path, recipe);
    assert.throws(() => validateCompleteSourceFixture(root, entry), /source expectation/);
  }
});
test("primary Message binding witness has one defect and repairing it restores validity", t => {
  const root = copyCandidate(t), manifest = readCorpusJson(path.join(root, "cases.json"));
  const entry = manifest.cases.find(item => item.id === "binding-message-invalid");
  const original = validateCompleteFixtureRecipe(root, entry);
  assert.deepEqual(original.diagnostics.map(item => item.ruleId), ["DM-MSG-002"]);
  const recipe = readCorpusJson(path.join(root, entry.path));
  recipe.changes[0].to = recipe.changes[0].to.replace("| Other | Property | Value / Rule |", "| Protocol | Property | Value / Rule |");
  write(root, entry.path, recipe);
  assert.deepEqual(validateCompleteFixtureRecipe(root, entry).diagnostics, []);
});
test("repairing only the beyond-IEEE754 example restores pair equivalence", t => {
  const root = copyCandidate(t), manifest = readCorpusJson(path.join(root, "cases.json"));
  const entry = manifest.cases.find(item => item.id === "exact-pair-beyond-ieee-invalid");
  assert.deepEqual(validateCompleteFixtureRecipe(root, entry).diagnostics.map(item => item.ruleId), ["DM-PROFILE-003"]);
  const recipe = readCorpusJson(path.join(root, entry.path));
  recipe.changes.find(item => item.profile === "compact").to = recipe.changes.find(item => item.profile === "compact").to
    .replace('{"n":9007199254740993,', '{"n":9007199254740992,');
  write(root, entry.path, recipe);
  assert.deepEqual(validateCompleteFixtureRecipe(root, entry).diagnostics, []);
});
for (const [label, mutate, pattern] of [
  ["unknown evaluator", f => { f.recipe.evaluator = "constructor"; }, /evaluator/],
  ["wrong layer", f => { f.recipe.mode = "whole-set"; }, /mode/],
  ["unexpected envelope field", f => { f.recipe.changes = []; }, /keys|field/],
  ["empty source cases", f => { f.recipe.scenario.cases = []; }, /nonempty|non-empty/],
  ["duplicate source identity", f => { f.recipe.scenario.cases.push(f.recipe.scenario.cases[0]); }, /unique|duplicate/],
  ["source version drift", f => { f.recipe.scenario.docaiMessagingVersion = "0.17.2"; }, /version/],
  ["false literal fact", f => { f.recipe.assertions[0].equals = "direct"; }, /fact-mismatch/],
  ["missing literal facts", f => { f.recipe.assertions = []; }, /assertion/],
  ["unknown adapter class", f => { f.recipe.scenario.cases[0].adapterClass = "custom-code"; }, /adapter class/]
]) test(`source scenario fails closed for ${label}`, t => {
  const f = sourceFixture(t); mutate(f); saveSource(f);
  const result = runCompleteFixtureCorpus(f.root);
  assert.equal(result.failed, 1, result.report);
  assert.match(result.report, pattern);
});
const requirementIds = [...Array.from({ length: 38 }, (_, n) => `R8-COMPLETE-${String(n + 1).padStart(3, "0")}`),
  "R8-1X-001", "R8-1X-002", "RELEASE-HDR-001"];
function write(root, name, data) {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), JSON.stringify(data, null, 2) + "\n");
}
function fixture(t) {
  const root = copyCandidate(t);
  const baseFiles = Object.fromEntries(Object.entries(snapshot(root))
    .filter(([name]) => /^(?:full|compact|source)\//.test(name))
    .map(([name, bytes]) => [name, createHash("sha256").update(bytes).digest("hex")]));
  const manifest = { schema_version: 1, docai_messaging: "0.17.1", scope: "complete-candidate", base_files: baseFiles,
    requirements: requirementIds.map(id => ({ id, facets_complete: false, facets: [] })),
    cases: [{ id: "baseline", kind: "complete-pair", path: "focused/valid/baseline.json", expected: "valid",
      expected_rule_ids: [], rule_ids: ["DM-PROFILE-001"], facets: [] }] };
  write(root, "cases.json", manifest);
  const recipe = { mode: "whole-set", changes: [], assertions: [
    { pointer: "/completeProfilePair/projection/docaiMessaging", equals: "0.17.1" }
  ] };
  write(root, manifest.cases[0].path, recipe);
  return { root, manifest, recipe };
}
test("complete corpus verifies a pinned whole-set base, literal facts and read-only replay", (t) => {
  const { root } = fixture(t), before = snapshot(root);
  const result = runCompleteFixtureCorpus(root);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.coverage.open.length, 38);
  assert.equal(result.coverage.conditional.length, 3);
  assert.equal(result.publicationReady, false);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(snapshot(root), before);
});
test("complete corpus strict mode cannot turn partial inventory into publication readiness", (t) => {
  const { root } = fixture(t);
  assert.equal(runCompleteFixtureCorpus(root, { requireComplete: true }).exitCode, 1);
});
test("complete corpus uses the tool's trusted catalog rather than a case-local rules override", (t) => {
  const f = fixture(t);
  write(f.root, "rules.json", { rules: [{ rule_id: "DM-FAKE-999" }] });
  f.manifest.cases[0].rule_ids = ["DM-FAKE-999"];
  write(f.root, "cases.json", f.manifest);
  assert.throws(() => runCompleteFixtureCorpus(f.root), /unknown rule/);
});
test("strict declared coverage witnesses do not certify publication readiness", (t) => {
  const { root, manifest } = fixture(t);
  for (const row of manifest.requirements.filter(row => row.id.startsWith("R8-COMPLETE-"))) {
    row.facets_complete = true; row.facets = ["synthetic-witness"];
  }
  const refs = manifest.requirements.filter(row => row.id.startsWith("R8-COMPLETE-"))
    .map(row => ({ requirement: row.id, facet: "synthetic-witness" }));
  manifest.cases[0].facets = refs;
  manifest.cases.push({ id: "negative-witness", kind: "complete-pair", path: "focused/invalid/witness.json", expected: "invalid",
    expected_rule_ids: ["DM-PROFILE-001"], rule_ids: ["DM-PROFILE-001"], facets: refs });
  write(root, "cases.json", manifest);
  write(root, "focused/invalid/witness.json", { mode: "task-scoped", changes: [
    { profile: "full", path: "INDEX.md", operation: "replace", from: "Compact set: ../compact/", to: "Compact set: ../other/" }
  ], assertions: [] });
  const result = runCompleteFixtureCorpus(root, { requireComplete: true });
  assert.equal(result.exitCode, 0, result.report);
  assert.equal(result.coverage.open.length, 0);
  assert.equal(result.publicationReady, false);
});
test("failed negative witnesses keep their facet open", (t) => {
  const { root, manifest } = fixture(t);
  manifest.requirements[0] = { id: "R8-COMPLETE-001", facets_complete: true, facets: ["paired-roots"] };
  manifest.cases[0].facets = [{ requirement: "R8-COMPLETE-001", facet: "paired-roots" }];
  write(root, "cases.json", manifest);
  const result = runCompleteFixtureCorpus(root, { requireComplete: true });
  assert.ok(result.coverage.open.some(row => row.id === "R8-COMPLETE-001"));
  assert.equal(result.exitCode, 1);
});
test("complete corpus rejects invalid UTF-8 recipes rather than normalizing source bytes", (t) => {
  const { root, recipe, manifest } = fixture(t);
  manifest.cases[0].kind = "complete-full";
  write(root, "cases.json", manifest);
  recipe.mode = "task-scoped";
  recipe.changes = [{ profile: "full", path: "workflows/alpha-delivery.md", operation: "replace",
    from: "Deliver the alpha event and record the correlated middle event.", to: "Retain the SENTINEL event." }];
  recipe.assertions = [{ pointer: "/complete/workflows/form", equals: "direct" }];
  const encoded = JSON.stringify(recipe).split("SENTINEL");
  fs.writeFileSync(path.join(root, "focused/valid/baseline.json"), Buffer.concat([Buffer.from(encoded[0]), Buffer.from([255]), Buffer.from(encoded[1])]));
  const result = runCompleteFixtureCorpus(root);
  assert.equal(result.failed, 1);
  assert.match(result.report, /encoded data|utf-8|UTF-8/);
});
test("complete corpus still validates base identity after a changed file's pin is rebound", (t) => {
  const { root, manifest } = fixture(t);
  const file = path.join(root, "full/workflows/alpha-delivery.md");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Deliver the alpha event", "Retain the alpha event"));
  manifest.base_files["full/workflows/alpha-delivery.md"] = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  write(root, "cases.json", manifest);
  assert.throws(() => runCompleteFixtureCorpus(root), /base whole-set validation.*DM-ID-003/);
});
for (const literal of ["1.0000000000000001", "1e-400", "9007199254740990.1", "9007199254740992", "-9007199254740992"]) {
  test(`complete corpus rejects exact non-safe-integer literal ${literal} before native rounding`, (t) => {
    const { root } = fixture(t), file = path.join(root, "numbers.json");
    fs.writeFileSync(file, `{"n":${literal}}`);
    assert.throws(() => readCorpusJson(file), /safe integer/);
  });
}
test("complete corpus retains exact safe-integer boundaries and equivalent integer spellings", (t) => {
  const { root } = fixture(t), file = path.join(root, "numbers.json");
  fs.writeFileSync(file, '{"values":[9007199254740991,-9007199254740991,1.0,1e0,0e-400]}');
  assert.deepEqual(readCorpusJson(file).values, [9007199254740991, -9007199254740991, 1, 1, 0]);
});
test("rounded literal cannot create a false-positive actual fact witness", (t) => {
  const { root, manifest, recipe } = fixture(t);
  manifest.cases[0].kind = "complete-full";
  write(root, "cases.json", manifest);
  recipe.assertions = [{ pointer: "/fileCount", equals: 17 }];
  fs.writeFileSync(path.join(root, "focused/valid/baseline.json"), JSON.stringify(recipe).replace('"equals":17', '"equals":17.000000000000001'));
  const result = runCompleteFixtureCorpus(root);
  assert.equal(result.failed, 1);
  assert.match(result.report, /safe integer/);
});
for (const operation of ["replace", "add"]) {
  test(`complete corpus rejects an unpaired surrogate in ${operation} contents`, (t) => {
    const { root, manifest, recipe } = fixture(t);
    manifest.cases[0].kind = "complete-full";
    recipe.mode = "task-scoped";
    const source = fs.readFileSync(path.join(root, "full/workflows/alpha-delivery.md"), "utf8");
    if (operation === "replace") {
      recipe.changes = [{ profile: "full", path: "workflows/alpha-delivery.md", operation,
        from: "Deliver the alpha event and record the correlated middle event.", to: "Retain the \ud800 event." }];
      recipe.assertions = [{ pointer: "/complete/workflows/form", equals: "direct" }];
    } else {
      manifest.cases[0].expected = "invalid";
      manifest.cases[0].expected_rule_ids = ["DM-WF-002"];
      manifest.cases[0].rule_ids = ["DM-WF-002"];
      manifest.cases[0].path = "focused/invalid/surrogate.json";
      recipe.changes = [{ profile: "full", path: "workflows/extra.md", operation, content: source.replace("# Alpha delivery across operation boundaries", "# Extra \ud800") }];
      recipe.assertions = [];
    }
    write(root, "cases.json", manifest);
    write(root, manifest.cases[0].path, recipe);
    const result = runCompleteFixtureCorpus(root);
    assert.equal(result.failed, 1, result.report);
    assert.match(result.report, /surrogate/);
  });
}
for (const text of ["\ud83d\ude00", "\\ud800"]) {
  test(`complete corpus preserves valid Unicode and literal escaped source ${JSON.stringify(text)}`, (t) => {
    const { root, manifest, recipe } = fixture(t);
    manifest.cases[0].kind = "complete-full";
    recipe.mode = "task-scoped";
    const introduction = `Retain the ${text} event.`;
    recipe.changes = [{ profile: "full", path: "workflows/alpha-delivery.md", operation: "replace",
      from: "Deliver the alpha event and record the correlated middle event.", to: introduction }];
    recipe.assertions = [{ pointer: "/complete/workflowDefinitions/0/introduction", equals: introduction }];
    write(root, "cases.json", manifest); write(root, manifest.cases[0].path, recipe);
    const result = runCompleteFixtureCorpus(root);
    assert.equal(result.passed, 1, result.report);
  });
}
test("complete corpus fails a literal fact mismatch without inventing a diagnostic", (t) => {
  const { root, recipe } = fixture(t);
  recipe.assertions[0].equals = "1.0.0";
  write(root, "focused/valid/baseline.json", recipe);
  const result = runCompleteFixtureCorpus(root);
  assert.equal(result.failed, 1);
  assert.match(result.report, /fact-mismatch/);
});
test("complete corpus reloads exact semantic mutations and preserves the original base", (t) => {
  const { root, manifest } = fixture(t);
  manifest.cases = [{ id: "profile-link", kind: "complete-pair", path: "focused/invalid/link.json", expected: "invalid",
    expected_rule_ids: ["DM-PROFILE-001"], rule_ids: ["DM-PROFILE-001"], facets: [] }];
  write(root, "cases.json", manifest);
  write(root, manifest.cases[0].path, { mode: "task-scoped", changes: [
    { profile: "full", path: "INDEX.md", operation: "replace", from: "Compact set: ../compact/", to: "Compact set: ../other/" }
  ], assertions: [] });
  const before = snapshot(root), result = runCompleteFixtureCorpus(root);
  assert.equal(result.passed, 1, result.report);
  assert.deepEqual(snapshot(root), before);
});
for (const [name, mutate, pattern] of [
  ["unknown manifest fields", f => { f.manifest.surprise = true; }, /manifest/],
  ["missing requirement", f => { f.manifest.requirements.pop(); }, /requirement/],
  ["duplicate requirement", f => { f.manifest.requirements.push(f.manifest.requirements[0]); }, /requirement/],
  ["unknown rule", f => { f.manifest.cases[0].rule_ids = ["DM-FAKE-999"]; }, /rule/],
  ["duplicate case", f => { f.manifest.cases.push(f.manifest.cases[0]); }, /case/],
  ["escaping case path", f => { f.manifest.cases[0].path = "../outside.json"; }, /path/],
  ["missing base member", f => { delete f.manifest.base_files["full/INDEX.md"]; }, /base/],
  ["wrong base hash", f => { f.manifest.base_files["full/INDEX.md"] = "0".repeat(64); }, /base/],
  ["unknown facet reference", f => { f.manifest.cases[0].facets = [{ requirement: "R8-COMPLETE-001", facet: "unknown" }]; }, /facet/],
  ["empty complete facet inventory", f => { f.manifest.requirements[0].facets_complete = true; }, /facet/]
]) test(`complete corpus rejects ${name}`, (t) => {
  const f = fixture(t); mutate(f); write(f.root, "cases.json", f.manifest);
  assert.throws(() => runCompleteFixtureCorpus(f.root), pattern);
});
for (const [name, mutate, pattern] of [
  ["unknown recipe fields", r => { r.extra = true; }, /recipe/],
  ["whole-set mutation masquerade", r => { r.changes = [{ profile: "full", path: "INDEX.md", operation: "remove" }]; }, /mode/],
  ["missing fact pointer", r => { r.assertions[0].pointer = "/missing"; }, /fact-mismatch/],
  ["escaping mutation path", r => { r.mode = "task-scoped"; r.changes = [{ profile: "full", path: "../outside.md", operation: "remove" }]; }, /path/],
  ["non-exact mutation anchor", r => { r.mode = "task-scoped"; r.changes = [{ profile: "full", path: "INDEX.md", operation: "replace", from: "missing anchor", to: "none" }]; }, /anchor/]
]) test(`complete corpus fails ${name}`, (t) => {
  const { root, recipe } = fixture(t); mutate(recipe); write(root, "focused/valid/baseline.json", recipe);
  const result = runCompleteFixtureCorpus(root);
  assert.equal(result.failed, 1);
  assert.match(result.report, pattern);
});
test("complete corpus CLI exposes incomplete coverage and strict failure without writing inputs", (t) => {
  const { root } = fixture(t), before = snapshot(root);
  const loose = spawnSync(process.execPath, [checker, "--corpus", root], { encoding: "utf8" });
  assert.equal(loose.status, 0, loose.stderr);
  assert.match(loose.stdout, /38.*open/);
  assert.match(loose.stdout, /not publication-ready/);
  const strict = spawnSync(process.execPath, [checker, "--corpus", root, "--require-complete"], { encoding: "utf8" });
  assert.equal(strict.status, 1);
  assert.deepEqual(snapshot(root), before);
});
test("initial versioned complete corpus exercises all fifteen complete rules with positive and negative evidence", () => {
  const before = snapshot(candidate);
  const result = runCompleteFixtureCorpus(candidate);
  assert.equal(result.failed, 0, result.report);
  assert.equal(result.exitCode, 0, result.report);
  const rules = JSON.parse(fs.readFileSync(new URL("../../fixtures/rules.json", import.meta.url), "utf8"))
    .rules.filter(entry => entry.scope === "complete").map(entry => entry.rule_id);
  assert.equal(rules.length, 15);
  for (const rule of rules) {
    assert.ok(result.ruleCoverage[rule].valid.length > 0, `${rule}: missing positive evidence`);
    assert.ok(result.ruleCoverage[rule].invalid.length > 0, `${rule}: missing negative evidence`);
  }
  assert.equal(result.coverage.open.length, 38);
  assert.equal(result.publicationReady, false);
  assert.deepEqual(snapshot(candidate), before);
});
test("versioned source and document witnesses exercise promoted contract facets", () => {
  const result = runCompleteFixtureCorpus(candidate);
  for (const id of ["source-schema-adapter-targets-valid", "source-adapter-publication-scope-valid",
    "source-payload-media-identity-projection-invalid", "binding-operation-valid", "binding-reply-message-invalid",
    "binding-common-failure-valid", "binding-inline-failure-valid", "tagged-number-valid", "tagged-boolean-valid",
    "tagged-escaped-string-valid", "untagged-delimiter-invalid", "raw-structured-invalid",
    "exact-pair-numeric-spelling-valid", "exact-pair-beyond-ieee-invalid", "exact-variant-const-invalid",
    "exact-same-as-valid", "exact-array-order-invalid", "exact-duplicate-name-invalid",
    "exact-variant-numeric-spelling-valid", "exact-variant-beyond-ieee-invalid",
    "raw-xml-invalid", "raw-yaml-invalid", "raw-parameterized-json-invalid",
    "binding-server-valid", "binding-server-invalid"]) {
    assert.equal(result.cases.find(item => item.id === id)?.passed, true, `${id}\n${result.report}`);
  }
  assert.equal(result.failed, 0, result.report);
  assert.equal(result.coverage.open.length, 38);
});
