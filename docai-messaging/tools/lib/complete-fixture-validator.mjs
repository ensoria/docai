import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { loadDocumentSet } from "./document-set.mjs";
import { loadTrustedCompleteExampleAdapterOptions } from "./complete-example-adapters.mjs";
import { validateCompleteDocumentSet } from "./validators/complete.mjs";
import { validateCompleteProfilePair } from "./validators/complete-profiles.mjs";
import { decodeUtf8Bytes } from "./identity.mjs";
import { containedPath, objectKeys, readCorpusJson, requireValue, safeRelative } from "./complete-corpus-contract.mjs";

function exactMutationText(text) {
  requireValue(decodeUtf8Bytes(Buffer.from(text, "utf8")) === text,
    "unpaired surrogate in mutation contents cannot be represented as exact UTF-8");
  return text;
}

function atPointer(facts, pointer) {
  requireValue(typeof pointer === "string" && (pointer === "" || pointer.startsWith("/"))
    && !/~(?![01])/.test(pointer), "invalid facts pointer");
  let value = facts;
  for (const key of pointer === "" ? [] : pointer.slice(1).split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) return { found: false };
    value = value[key];
  }
  return { found: true, value };
}
export function validateCompleteFixtureRecipe(root, entry) {
  const recipe = readCorpusJson(containedPath(root, entry.path));
  objectKeys(recipe, ["mode", "changes", "assertions"], [], "recipe");
  requireValue(Array.isArray(recipe.changes) && Array.isArray(recipe.assertions), "recipe changes/assertions must be arrays");
  requireValue(recipe.mode === (recipe.changes.length === 0 ? "whole-set" : "task-scoped"), "recipe mode differs from mutation layer");
  requireValue(entry.expected !== "valid" || recipe.assertions.length > 0, "valid recipe needs a literal fact assertion");
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "docai-complete-corpus-"));
  try {
    for (const profile of ["full", "compact"]) fs.cpSync(path.join(root, profile), path.join(temporary, profile), { recursive: true });
    for (const change of recipe.changes) {
      objectKeys(change, ["profile", "path", "operation"], ["from", "to", "content"], "recipe change");
      requireValue(["full", "compact"].includes(change.profile) && ["replace", "add", "remove"].includes(change.operation), "invalid change operation/profile");
      safeRelative(change.path);
      requireValue(change.path.endsWith(".md"), "recipe changes require document paths");
      if (entry.kind !== "complete-pair") requireValue(change.profile === entry.kind.slice("complete-".length), "change escapes selected profile");
      const target = containedPath(path.join(temporary, change.profile), change.path, { exists: change.operation !== "add" });
      if (change.operation === "replace") {
        objectKeys(change, ["profile", "path", "operation", "from", "to"], [], "replace change");
        requireValue(typeof change.from === "string" && change.from.length > 0 && typeof change.to === "string", "invalid replacement");
        const original = fs.readFileSync(target, "utf8");
        requireValue(original.split(change.from).length - 1 === 1, `exact anchor mismatch: ${change.profile}/${change.path}`);
        fs.writeFileSync(target, original.replace(change.from, () => exactMutationText(change.to)));
      } else if (change.operation === "add") {
        objectKeys(change, ["profile", "path", "operation", "content"], [], "add change");
        requireValue(!fs.existsSync(target) && typeof change.content === "string", "add requires absent path and text content");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, exactMutationText(change.content));
      } else {
        objectKeys(change, ["profile", "path", "operation"], [], "remove change");
        requireValue(fs.statSync(target).isFile(), "remove requires a file");
        fs.unlinkSync(target);
      }
    }
    const full = loadDocumentSet(path.join(temporary, "full"));
    const compact = loadDocumentSet(path.join(temporary, "compact"));
    const options = { ...loadTrustedCompleteExampleAdapterOptions(root, [full, compact]), wholeSet: recipe.mode === "whole-set" };
    const result = entry.kind === "complete-pair" ? validateCompleteProfilePair(full, compact, options)
      : validateCompleteDocumentSet(entry.kind === "complete-full" ? full : compact, options);
    for (const assertion of recipe.assertions) {
      objectKeys(assertion, ["pointer", "equals"], [], "fact assertion");
      const actual = atPointer(result.facts, assertion.pointer);
      requireValue(actual.found && isDeepStrictEqual(actual.value, assertion.equals), `fact-mismatch:${assertion.pointer}`);
    }
    return { ...result, mode: recipe.mode };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
