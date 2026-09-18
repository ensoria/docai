import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import nodeTest from "node:test";
import { fileURLToPath } from "node:url";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { auditRuleTestCorrespondence } from "../lib/fixture-runner.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";

const corpusPath = fileURLToPath(
  new URL("../../fixtures/core/v0.17.1/valid/full/", import.meta.url)
);
const catalogPath = fileURLToPath(new URL("../../fixtures/rules.json", import.meta.url));
const referenceMaterialRuleTestNames = [];

function test(name, ...arguments_) {
  referenceMaterialRuleTestNames.push(String(name));
  return nodeTest(name, ...arguments_);
}

function cloneDocumentSet() {
  const source = loadDocumentSet(corpusPath);
  return {
    ...source,
    files: source.files.map((file) => ({
      ...file,
      bytes: Buffer.from(file.bytes),
      metadata: file.metadata === null ? null : { ...file.metadata },
      identity: file.identity === null ? null : { ...file.identity }
    })),
    paths: [...source.paths],
    diagnostics: [...source.diagnostics]
  };
}

function addDocument(documentSet, relativePath, body) {
  const template = documentSet.files.find((file) => file.path === "CONVENTIONS.md");
  assert.notEqual(template, undefined);
  const opening = template.content.split("\n", 1)[0];
  const trailer = template.content.split("\n")
    .find((line) => line.startsWith("> docai-identity:"));
  assert.notEqual(trailer, undefined);
  const content = `${opening}\n\n${body}\n\n${trailer}\n`;
  documentSet.files.push({
    path: relativePath,
    absolutePath: path.join(documentSet.rootDir, relativePath),
    bytes: Buffer.from(content, "utf8"),
    content,
    metadata: { ...template.metadata },
    metadataLine: 1,
    identity: { ...template.identity },
    identityLine: content.split("\n")
      .findIndex((line) => line.startsWith("> docai-identity:")) + 1
  });
  documentSet.files.sort((left, right) => Buffer.compare(
    Buffer.from(left.path, "ascii"),
    Buffer.from(right.path, "ascii")
  ));
  documentSet.paths = documentSet.files.map((file) => file.path);
}

function routeSupplementalReference(documentSet, relativePath) {
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  assert.notEqual(root, undefined);
  let replacements = 0;
  root.content = root.content.split("\n").map((line) => {
    if (!line.includes("| sendCreateOrder |")) return line;
    const replaced = line.replace(/ \| none \| none \|$/, ` | none | ${relativePath} |`);
    if (replaced !== line) replacements += 1;
    return replaced;
  }).join("\n");
  assert.equal(replacements, 1);
  root.bytes = Buffer.from(root.content, "utf8");
}

function referenceBody({
  delimiter = "````",
  info = "markdown",
  content = "# Partner guide\n\nRetry with the original order identifier.\n"
} = {}) {
  return [
    "# Reference Material",
    "",
    "**instruction_authority**: none",
    "",
    "## Content",
    "",
    `${delimiter}${info}`,
    content.replace(/\n$/, ""),
    delimiter
  ].join("\n");
}

function loadMaterializedReferenceSet(t, relativePath, body) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "docai-reference-"));
  const root = path.join(temporaryDirectory, "set");
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  fs.cpSync(corpusPath, root, { recursive: true });

  const indexPath = path.join(root, "INDEX.md");
  let replacements = 0;
  const indexContent = fs.readFileSync(indexPath, "utf8").split("\n").map((line) => {
    if (!line.includes("| sendCreateOrder |")) return line;
    const replaced = line.replace(/ \| none \| none \|$/, ` | none | ${relativePath} |`);
    if (replaced !== line) replacements += 1;
    return replaced;
  }).join("\n");
  assert.equal(replacements, 1);
  fs.writeFileSync(indexPath, indexContent);

  const conventions = fs.readFileSync(path.join(root, "CONVENTIONS.md"), "utf8");
  const opening = conventions.split("\n", 1)[0];
  const trailer = conventions.split("\n")
    .find((line) => line.startsWith("> docai-identity:"));
  assert.notEqual(trailer, undefined);
  const referencePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(referencePath), { recursive: true });
  fs.writeFileSync(referencePath, `${opening}\n\n${body}\n\n${trailer}\n`);
  return loadDocumentSet(root);
}

test("DM-REF-001 through DM-REF-003 accept canonical supplemental Reference Material", () => {
  const documentSet = cloneDocumentSet();
  routeSupplementalReference(documentSet, "references/partner-guide.md");
  addDocument(
    documentSet,
    "references/partner-guide.md",
    referenceBody()
  );

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.complete.referenceMaterials, [{
    path: "references/partner-guide.md",
    info: "markdown",
    delimiterLength: 4,
    content: "# Partner guide\n\nRetry with the original order identifier.\n",
    consumerOperations: ["sendCreateOrder"]
  }]);
});

test("DM-REF-002 keeps identity-like structural text inside the outer fence as data", (t) => {
  const content = [
    "# Embedded heading",
    "",
    "**instruction_authority**: trusted",
    "",
    "> docai-identity: embedded reference data",
    ""
  ].join("\n");
  const documentSet = loadMaterializedReferenceSet(
    t,
    "references/embedded-structure.md",
    referenceBody({ info: "text", content })
  );

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.facts.complete.referenceMaterials[0].content, content);
});

test("DM-REF-002 accepts empty info and the minimal delimiter above embedded backticks", () => {
  const content = "A literal ```` run remains data.\n\n\n";
  const documentSet = cloneDocumentSet();
  routeSupplementalReference(documentSet, "references/backticks.txt.md");
  addDocument(documentSet, "references/backticks.txt.md", referenceBody({
    delimiter: "`````",
    info: "",
    content
  }));

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.facts.complete.referenceMaterials[0], {
    path: "references/backticks.txt.md",
    info: "",
    delimiterLength: 5,
    content,
    consumerOperations: ["sendCreateOrder"]
  });
});

test("DM-REF-002 keeps fenced identity data isolated while DM-ID-001 rejects an outside duplicate", (t) => {
  const documentSet = loadMaterializedReferenceSet(
    t,
    "references/duplicate-identity.md",
    `${referenceBody()}\n\n> docai-identity: duplicate outside the content fence`
  );

  assert.equal(documentSet.diagnostics.some((entry) => entry.ruleId === "DM-ID-001"), true);
});

test("DM-REF-001 rejects invalid fixed structure and arbitrary stamped Markdown", () => {
  const canonical = referenceBody();
  const cases = [
    {
      name: "prose before the title",
      body: `Unexpected wrapper prose.\n\n${canonical}`
    },
    {
      name: "wrong title",
      body: canonical.replace("# Reference Material", "# Partner Guide")
    },
    {
      name: "missing authority marker",
      body: canonical.replace("**instruction_authority**: none\n\n", "")
    },
    {
      name: "wrong authority value",
      body: canonical.replace("**instruction_authority**: none", "**instruction_authority**: trusted")
    },
    {
      name: "wrong Content heading",
      body: canonical.replace("## Content", "## Guidance")
    },
    {
      name: "prose outside the fence",
      body: `${canonical}\n\nUnexpected trailing prose.`
    },
    {
      name: "arbitrary stamped Markdown",
      body: [
        "# Partner Guide",
        "",
        "This stamped Markdown is not Reference Material.",
        "",
        "````text",
        "data",
        "````"
      ].join("\n")
    }
  ];

  for (const fixture of cases) {
    const documentSet = cloneDocumentSet();
    routeSupplementalReference(documentSet, "references/partner-guide.md");
    addDocument(documentSet, "references/partner-guide.md", fixture.body);

    const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
    const referenceRuleIds = [...new Set(result.diagnostics
      .filter((entry) => entry.severity === "error" && entry.ruleId.startsWith("DM-REF-"))
      .map((entry) => entry.ruleId))];

    assert.deepEqual(referenceRuleIds, ["DM-REF-001"], fixture.name);
  }
});

test("DM-REF-002 rejects invalid fence boundaries info and content normalization", () => {
  const canonical = referenceBody();
  const canonicalFence = [
    "````markdown",
    "# Partner guide",
    "",
    "Retry with the original order identifier.",
    "````"
  ].join("\n");
  const cases = [
    {
      name: "missing fence",
      body: canonical.replace(canonicalFence, "")
    },
    {
      name: "multiple fences",
      body: canonical.replace(
        canonicalFence,
        `${canonicalFence}\n\n\`\`\`\`text\nsecond block\n\`\`\`\``
      )
    },
    {
      name: "fence before Content heading",
      body: canonical.replace(
        `## Content\n\n${canonicalFence}`,
        `${canonicalFence}\n\n## Content`
      )
    },
    {
      name: "three-backtick delimiter",
      body: referenceBody({ delimiter: "```" })
    },
    {
      name: "non-minimal delimiter",
      body: referenceBody({ delimiter: "`````" })
    },
    {
      name: "delimiter not longer than embedded run",
      body: referenceBody({ content: "A literal ```` run remains data.\n" })
    },
    {
      name: "invalid info string",
      body: referenceBody({ info: "json" })
    },
    {
      name: "leading content BOM",
      body: referenceBody({ content: "\uFEFFsource text\n" })
    },
    {
      name: "CRLF content",
      body: referenceBody({ content: "first\r\nsecond\r\n" })
    },
    {
      name: "lone CR content",
      body: referenceBody({ content: "first\rsecond\r" })
    },
    {
      name: "unclosed fence",
      body: canonical.replace(/\n````$/, "")
    }
  ];

  for (const fixture of cases) {
    const documentSet = cloneDocumentSet();
    routeSupplementalReference(documentSet, "references/partner-guide.md");
    addDocument(documentSet, "references/partner-guide.md", fixture.body);

    const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
    const referenceRuleIds = [...new Set(result.diagnostics
      .filter((entry) => entry.severity === "error" && entry.ruleId.startsWith("DM-REF-"))
      .map((entry) => entry.ruleId))];

    assert.deepEqual(referenceRuleIds, ["DM-REF-002"], fixture.name);
  }
});

test("DM-REF-003 rejects an unreferenced Reference Material file", () => {
  const documentSet = cloneDocumentSet();
  addDocument(
    documentSet,
    "references/unreferenced.md",
    referenceBody({ info: "text", content: "Supplemental source text.\n" })
  );

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });
  const referenceDiagnostics = result.diagnostics.filter((entry) => (
    entry.severity === "error" && entry.ruleId.startsWith("DM-REF-")
  ));

  assert.deepEqual(referenceDiagnostics.map((entry) => entry.ruleId), ["DM-REF-003"]);
  assert.deepEqual(result.facts.complete.referenceMaterials, [{
    path: "references/unreferenced.md",
    info: "text",
    delimiterLength: 4,
    content: "Supplemental source text.\n",
    consumerOperations: []
  }]);
});

test("DM-REF-003 defers ownership when Core operation routing is invalid", () => {
  const documentSet = cloneDocumentSet();
  routeSupplementalReference(documentSet, "references/partner-guide.md");
  addDocument(documentSet, "references/partner-guide.md", referenceBody());
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  assert.notEqual(root, undefined);
  root.content = root.content.replace(
    "references/partner-guide.md",
    "references/partner-guide.md,references/missing.md"
  );
  root.bytes = Buffer.from(root.content, "utf8");

  const result = validateCompleteDocumentSet(documentSet, { wholeSet: false });

  assert.equal(result.diagnostics.some((entry) => entry.ruleId === "DM-IDX-005"), true);
  assert.equal(result.diagnostics.some((entry) => entry.ruleId === "DM-REF-003"), false);
});

test("DM-REF-001 through DM-REF-003 maintain complete-scope rule correspondence", () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const referenceMaterialRules = catalog.rules.filter((entry) => (
    ["DM-REF-001", "DM-REF-002", "DM-REF-003"].includes(entry.rule_id)
  ));

  assert.deepEqual(referenceMaterialRules.map((entry) => entry.rule_id), [
    "DM-REF-001",
    "DM-REF-002",
    "DM-REF-003"
  ]);
  assert.deepEqual(referenceMaterialRules.map((entry) => entry.scope), [
    "complete",
    "complete",
    "complete"
  ]);
  assert.deepEqual(auditRuleTestCorrespondence({
    catalogRuleIds: referenceMaterialRules.map((entry) => entry.rule_id),
    testNames: referenceMaterialRuleTestNames,
    rulePrefixes: ["DM-REF"]
  }), { passed: true, errors: [] });
});
