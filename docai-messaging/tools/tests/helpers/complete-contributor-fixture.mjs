import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentSet } from "../../lib/document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "../../lib/complete-example-adapters.mjs";
import { validateCompleteProfilePair } from "../../lib/validators/complete-profiles.mjs";
import { restampDocumentSet } from "../../restamp-document-set.mjs";

export const candidate = fileURLToPath(new URL("../../../fixtures/complete-candidates/v0.17.1/", import.meta.url));
const checker = fileURLToPath(new URL("../../check-complete-fixtures.mjs", import.meta.url));
export const profiles = ["full", "compact"];

export function copyCandidate(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "docai-contributors-"));
  const directory = path.join(temporary, "candidate");
  fs.cpSync(candidate, directory, { recursive: true });
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  return directory;
}

export function snapshot(directory) {
  return Object.fromEntries(fs.readdirSync(directory, { recursive: true })
    .filter((name) => fs.statSync(path.join(directory, name)).isFile())
    .map((name) => [name, fs.readFileSync(path.join(directory, name))]));
}

export function replace(directory, relative, from, to) {
  const file = path.join(directory, relative);
  const text = fs.readFileSync(file, "utf8");
  assert.equal(text.split(from).length - 1, 1, `${relative}: exact mutation anchor`);
  fs.writeFileSync(file, text.replace(from, to));
}

export function check(directory, status, diagnostic = /source_refs.*contributors/i, ordinary = true) {
  const manifest = path.join(directory, "source/projection-input-manifest.json");
  for (const profile of profiles) restampDocumentSet(path.join(directory, profile), manifest, { write: true });
  if (ordinary) {
    const full = loadDocumentSet(path.join(directory, "full"));
    const compact = loadDocumentSet(path.join(directory, "compact"));
    const options = loadTrustedCompleteExampleAdapterOptions(directory, [full, compact]);
    assert.deepEqual(validateCompleteProfilePair(full, compact, options).diagnostics, []);
  }
  const before = snapshot(directory);
  const result = spawnSync(process.execPath, [checker, directory], { encoding: "utf8" });
  assert.deepEqual(snapshot(directory), before, "checker is read-only");
  assert.equal(result.status, status, result.stderr || result.stdout);
  if (status !== 0) assert.match(result.stderr, diagnostic);
  return result;
}

export function regroup(directory, moves, expectedRefs) {
  const manifestFile = path.join(directory, "source/projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const initialPlacement = manifest.publicationPolicy.channelPlacement;
  const destination = new Map(initialPlacement.flatMap((entry) => entry.members
    .map((name) => [name, moves[name] ?? entry.details])));
  const groups = new Map();
  for (const [name, file] of destination) {
    if (!groups.has(file)) groups.set(file, []);
    groups.get(file).push(name);
  }
  for (const profile of profiles) {
    const root = path.join(directory, profile);
    const blocks = new Map();
    const texts = new Map(initialPlacement.map((entry) => [entry.details,
      fs.readFileSync(path.join(root, entry.details), "utf8")]));
    for (const text of texts.values()) {
      for (const match of text.matchAll(/^## (?:SEND|RECEIVE) [^\n]+ \(([^)]+)\)\n[\s\S]*?(?=^## |^> docai-identity:)/gm)) {
        blocks.set(match[1], match[0].trimEnd());
      }
    }
    for (const [file, members] of groups) {
      const origin = initialPlacement.find((entry) => entry.members.includes(members[0])).details;
      const base = texts.get(origin);
      let metadata = base.split("\n")[0];
      if (expectedRefs[file]) metadata = metadata.replace(/source_refs: [^|]+?(?= \||$)/,
        `source_refs: ${expectedRefs[file]}`);
      if (members.includes("r-json-reuse-operation") && profile === "compact"
          && !metadata.includes("x-retrieval-unit")) metadata += " | x-retrieval-unit: channel-file";
      const trailer = base.slice(base.lastIndexOf("> docai-identity:")).trimEnd();
      const bodies = [...members].sort().map((name) => {
        assert.ok(blocks.has(name), name);
        return blocks.get(name);
      });
      fs.writeFileSync(path.join(root, file), `${metadata}\n\n${bodies.join("\n\n")}\n\n${trailer}\n`);
    }
    for (const { details } of initialPlacement) if (!groups.has(details)) fs.rmSync(path.join(root, details));
    for (const relative of ["indexes/operations-broad.md", "indexes/operations-middle.md"]) {
      const file = path.join(root, relative);
      const text = fs.readFileSync(file, "utf8");
      const rows = text.split("\n").filter((line) => /^\| (SEND|RECEIVE) \|/.test(line));
      const header = text.split("\n").find((line) => line.startsWith("| Action |"));
      const separator = text.split("\n").find((line) => line.startsWith("|---"));
      const byFile = new Map();
      for (const row of rows) {
        const name = row.split("|")[3].trim();
        const target = destination.get(name);
        assert.ok(target);
        if (!byFile.has(target)) byFile.set(target, []);
        byFile.get(target).push(row);
      }
      const sections = [...byFile].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([target, entries]) => `### ${target}\n\n${header}\n${separator}\n${entries.join("\n")}`);
      fs.writeFileSync(file, text.slice(0, text.indexOf("### ")) + sections.join("\n\n")
        + "\n\n" + text.slice(text.lastIndexOf("> docai-identity:")));
    }
  }
  manifest.publicationPolicy.channelPlacement = [...groups].map(([details, members]) => ({ details, members }));
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
}

export function mutateSource(directory, filename, mutate) {
  const file = path.join(directory, "source", filename);
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  mutate(source);
  fs.writeFileSync(file, JSON.stringify(source));
  const manifestFile = path.join(directory, "source/projection-input-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  manifest.sources.find((entry) => entry.location === filename).sha256
    = `sha256:${createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
}
