import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { candidate, profiles, copyCandidate, replace, check, regroup, mutateSource, snapshot }
  from "./helpers/complete-contributor-fixture.mjs";
import { loadDocumentSet } from "../lib/document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../lib/complete-example-adapters.mjs";
import { validateCompleteDocumentSet } from "../lib/validators/complete.mjs";
import { resolveCompleteContextPlacement } from "../lib/complete-context-placement.mjs";
import { auditCompleteWorkflowContributorClosure } from "../lib/complete-workflow-contributor-audit.mjs";
import { restampDocumentSet } from "../restamp-document-set.mjs";

const owners = ["alpha-delivery", "alpha-observability", "state-none", "state-unknown", "state-unsupported"];

function preciseCandidate(t) {
  const directory = copyCandidate(t);
  for (const profile of profiles) for (const owner of owners) {
    const file = `${profile}/workflows/${owner}.md`;
    if (fs.readFileSync(path.join(directory, file), "utf8").split("\n")[0].endsWith("source_refs: all")) {
      replace(directory, file, "source_refs: all", "source_refs: complete-contexts");
    }
  }
  return directory;
}

for (const owner of owners) {
  for (const refs of ["complete-representations", "complete-contexts, storefront-behavior", "all"]) {
    test(`Workflow contributors reject ${owner} refs=${refs}`, (t) => {
      const directory = preciseCandidate(t);
      for (const profile of profiles) replace(directory, `${profile}/workflows/${owner}.md`,
        "source_refs: complete-contexts", `source_refs: ${refs}`);
      const result = check(directory, 1, /workflows\/.*source_refs.*contributors/i);
      assert.ok(result.stderr.includes(`workflows/${owner}.md`), result.stderr);
      assert.match(result.stderr, /full:.*source_refs.*contributors/);
      assert.match(result.stderr, /compact:.*source_refs.*contributors/);
    });
  }
}

test("Workflow contributors accept all five compared section-state roles", (t) => {
  check(preciseCandidate(t), 0);
});

for (const owner of owners) {
  test(`Workflow contributors follow relocated owner ${owner}`, (t) => {
    const directory = preciseCandidate(t);
    const from = `workflows/${owner}.md`;
    const to = `workflows/relocated-${owner}.md`;
    const file = path.join(directory, "source/projection-input-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file));
    manifest.publicationPolicy.contextPlacement.workflows.find((entry) => entry.id === owner).details = to;
    fs.writeFileSync(file, JSON.stringify(manifest));
    for (const profile of profiles) {
      const root = path.join(directory, profile);
      fs.renameSync(path.join(root, from), path.join(root, to));
      for (const name of fs.readdirSync(root, { recursive: true })) {
        const target = path.join(root, name);
        if (!fs.statSync(target).isFile()) continue;
        const text = fs.readFileSync(target, "utf8");
        if (!text.includes(from)) continue;
        fs.writeFileSync(target, text.replaceAll(from, to).replace(
          /workflows\/[A-Za-z0-9._/-]+\.md(?:, (?:workflows|references)\/[A-Za-z0-9._/-]+\.md)+/g,
          (list) => list.split(", ").sort().join(", ")));
      }
    }
    check(directory, 0);
  });
}

test("Workflow contributors accept source and placement declaration order changes", (t) => {
  const directory = preciseCandidate(t);
  mutateSource(directory, "complete-contexts.json", (source) => {
    source.workflows = Object.fromEntries(Object.entries(source.workflows).reverse());
  });
  const file = path.join(directory, "source/projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(file));
  manifest.sources.reverse();
  manifest.publicationPolicy.contextPlacement.workflows.reverse();
  fs.writeFileSync(file, JSON.stringify(manifest));
  check(directory, 0);
});

for (const owner of ["state-none", "state-unknown", "state-unsupported"]) {
  test(`Workflow contributors do not import shadow Steps for ${owner}`, (t) => {
    const directory = preciseCandidate(t);
    mutateSource(directory, "complete-contexts.json", (source) => {
      source.workflows[owner].steps = ["SEND orders.commands (sendCreateOrder)"];
    });
    check(directory, 0);
  });
}

test("Workflow contributors do not import a referenced multi-source channel body", (t) => {
  const directory = preciseCandidate(t);
  regroup(directory, { "a-operation": "channels/orders.md" }, {
    "channels/orders.md": "complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior"
  });
  check(directory, 0);
});

function crossSourceStep(directory) {
  const from = "SEND a.events (a-operation)";
  const to = "SEND orders.commands (sendCreateOrder)";
  mutateSource(directory, "complete-contexts.json", (source) => {
    source.workflows["alpha-observability"].steps = [to];
    source.workflows["alpha-observability"].transitions[0].trigger = to;
  });
  for (const profile of profiles) {
    const workflow = path.join(directory, profile, "workflows/alpha-observability.md");
    const body = fs.readFileSync(workflow, "utf8");
    assert.equal(body.split(from).length - 1, 2);
    fs.writeFileSync(workflow, body.replaceAll(from, to));
    const channel = path.join(directory, profile, "channels/orders.md");
    const text = fs.readFileSync(channel, "utf8");
    const at = text.indexOf("## SEND orders.commands (sendCreateOrder)");
    const section = text.slice(at);
    assert.equal(section.split("### Related\n\nnone").length - 1, 1);
    fs.writeFileSync(channel, text.slice(0, at) + section.replace("### Related\n\nnone",
      "### Related\n\nworkflows/alpha-observability.md"));
  }
}

for (const [refs, status] of [["complete-contexts", 0],
  ["complete-contexts, storefront-asyncapi-3.1.0, storefront-behavior", 1]]) {
  test(`Workflow contributors source-authored cross-source Step refs=${refs}`, (t) => {
    const directory = preciseCandidate(t);
    crossSourceStep(directory);
    if (refs !== "complete-contexts") for (const profile of profiles) {
      replace(directory, `${profile}/workflows/alpha-observability.md`, "source_refs: complete-contexts", `source_refs: ${refs}`);
    }
    check(directory, status, /alpha-observability\.md.*source_refs.*contributors/i);
  });
}

test("Workflow contributors preserve prior source-body mismatch diagnostic", (t) => {
  const directory = preciseCandidate(t);
  mutateSource(directory, "complete-contexts.json", (source) => {
    source.workflows["alpha-delivery"].purpose = "Deliver another synthetic event and finish its coordination.";
  });
  const result = check(directory, 1, /alpha-delivery introduction/);
  assert.doesNotMatch(result.stderr, /source_refs.*contributors/);
});

test("Workflow contributors preserve prior profile mismatch diagnostic", (t) => {
  const directory = preciseCandidate(t);
  replace(directory, "compact/workflows/alpha-delivery.md", "source_refs: complete-contexts", "source_refs: all");
  const result = check(directory, 1, /DM-PROFILE-001/, false);
  assert.doesNotMatch(result.stderr, /source_refs.*contributors/);
});

function helperInput() {
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, "source/projection-input-manifest.json")));
  const sources = new Map(manifest.sources.map((entry) => [entry.sourceId,
    JSON.parse(fs.readFileSync(path.join(candidate, "source", entry.location)))]));
  const contextPaths = resolveCompleteContextPlacement(manifest.publicationPolicy.contextPlacement,
    [sources.get("complete-contexts"), sources.get("complete-representations")]);
  assert.deepEqual(contextPaths.issues, []);
  const set = loadDocumentSet(path.join(candidate, "full"));
  const result = validateCompleteDocumentSet(set, loadTrustedCompleteExampleAdapterOptions(candidate, [set]));
  assert.deepEqual(result.diagnostics, []);
  for (const file of set.files.filter((entry) => entry.path.startsWith("workflows/"))) file.metadata.source_refs = "complete-contexts";
  return { sources, ids: manifest.sources.map((entry) => entry.sourceId), paths: contextPaths.paths, set, complete: result.facts.complete };
}

for (const [label, mutate] of [
  ["missing source owner", (input) => delete input.sources.get("complete-contexts").workflows["state-none"]],
  ["unexamined owner", (input) => input.sources.get("complete-contexts").workflows.extra = { purpose: "Unexamined workflow." }],
  ["null owner", (input) => input.sources.get("complete-contexts").workflows["state-none"] = null],
  ["other-source owner", (input) => input.sources.get("complete-representations").workflows = { extra: {} }],
  ["source owner transfer", (input) => {
    input.sources.get("complete-representations").workflows = { "state-none": input.sources.get("complete-contexts").workflows["state-none"] };
    delete input.sources.get("complete-contexts").workflows["state-none"];
  }],
  ["missing path owner", (input) => input.paths.workflows.delete("state-none")],
  ["extra path owner", (input) => input.paths.workflows.set("extra", "workflows/extra.md")],
  ["duplicate path", (input) => input.paths.workflows.set("state-none", "workflows/state-unknown.md")],
  ["unowned path", (input) => input.paths.workflows.set("state-none", "workflows/extra.md")],
  ["missing routing row", (input) => input.complete.workflows.rows.pop()],
  ["duplicate routing row", (input) => input.complete.workflows.rows.push(input.complete.workflows.rows[0])],
  ["missing definition", (input) => input.complete.workflowDefinitions.pop()],
  ["duplicate definition", (input) => input.complete.workflowDefinitions.push(input.complete.workflowDefinitions[0])],
  ["missing file", (input) => input.set.files = input.set.files.filter((file) => file.path !== "workflows/state-none.md")],
  ["duplicate file", (input) => input.set.files.push(input.set.files.find((file) => file.path === "workflows/state-none.md"))],
  ["extra file", (input) => input.set.files.push({ path: "workflows/extra.md", metadata: { source_refs: "complete-contexts" } })]
]) {
  test(`Workflow contributors reject ${label} closure`, () => {
    const input = helperInput();
    mutate(input);
    assert.match(auditCompleteWorkflowContributorClosure(input.sources, input.ids, input.paths, input.set, input.complete).join("\n"),
      /Workflow source_refs contributors.*closure/);
  });
}

for (const label of ["missing source ID", "duplicate source ID", "missing source map entry"]) {
  test(`Workflow contributors reject ${label}`, () => {
    const input = helperInput();
    if (label === "missing source ID") input.ids.pop();
    if (label === "duplicate source ID") input.ids.push(input.ids[0]);
    if (label === "missing source map entry") input.sources.delete("storefront-behavior");
    assert.match(auditCompleteWorkflowContributorClosure(input.sources, input.ids, input.paths, input.set, input.complete).join("\n"), /source registry/);
  });
}

for (const label of ["empty refs", "missing file", "extra file"]) {
  test(`Workflow contributors defer ${label} to ordinary writer and CLI rejection`, (t) => {
    const directory = preciseCandidate(t);
    for (const profile of profiles) {
      const root = path.join(directory, profile);
      if (label === "empty refs") replace(directory, `${profile}/workflows/alpha-delivery.md`, "source_refs: complete-contexts", "source_refs: ");
      if (label === "missing file") fs.rmSync(path.join(root, "workflows/alpha-delivery.md"));
      if (label === "extra file") fs.copyFileSync(path.join(root, "workflows/alpha-delivery.md"), path.join(root, "workflows/extra.md"));
    }
    const before = snapshot(directory);
    for (const profile of profiles) {
      assert.throws(() => restampDocumentSet(path.join(directory, profile),
        path.join(directory, "source/projection-input-manifest.json"), { write: true }), /DM-/);
      assert.deepEqual(snapshot(directory), before);
    }
    const checker = fileURLToPath(new URL("../check-complete-fixtures.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [checker, directory], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /DM-/);
    assert.doesNotMatch(result.stderr, /source_refs.*contributors|TypeError/);
    assert.deepEqual(snapshot(directory), before);
  });
}
