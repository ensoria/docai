#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
import { loadDocumentSet, validateDocumentSet } from "./lib/document-set.mjs";
import {
  computeSetDigest,
  deriveShortId,
  parseIdentityTrailer,
  scanUtf8Lines,
  stampIdentityTrailer
} from "./lib/identity.mjs";

function usageError(message) {
  throw new TypeError(`${message}\nUsage: restamp-document-set.mjs [--write] --projection-manifest <path> <document-set-root>`);
}

function parseArguments(arguments_) {
  let write = false;
  let projectionManifest = null;
  let rootDir = null;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--write") {
      if (write) usageError("--write may appear only once.");
      write = true;
      continue;
    }
    if (argument === "--projection-manifest") {
      if (projectionManifest !== null) usageError("--projection-manifest may appear only once.");
      projectionManifest = arguments_[index + 1] ?? null;
      if (projectionManifest === null || projectionManifest.startsWith("--")) {
        usageError("--projection-manifest requires an explicit path.");
      }
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) usageError(`Unknown option '${argument}'.`);
    if (rootDir !== null) usageError("Exactly one explicit document-set root is required.");
    rootDir = argument;
  }
  if (projectionManifest === null) usageError("--projection-manifest is required; it is never auto-discovered.");
  if (rootDir === null) usageError("An explicit document-set root is required.");
  return { write, projectionManifest, rootDir };
}

function pathIsInside(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function projectionIdentity(manifestPath) {
  let descriptor = null;
  let bytes;
  let stat;
  let realPath;
  try {
    descriptor = fs.openSync(
      manifestPath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)
    );
    stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new Error("not a regular file");
    bytes = fs.readFileSync(descriptor);
    realPath = fs.realpathSync(manifestPath);
    if (!isSamePhysicalFile(stat, fs.statSync(manifestPath))) {
      throw new Error("manifest path changed while its descriptor was being read");
    }
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    throw new TypeError(`Projection manifest cannot be read as a regular file: ${error.code ?? error.message}.`);
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fs.closeSync(descriptor);
    throw new TypeError("Projection manifest must contain valid UTF-8 bytes.");
  }
  const projectionDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  return {
    descriptor,
    projectionDigest,
    projectionId: deriveShortId(projectionDigest),
    realPath,
    stat
  };
}

function statHasFileIdentity(stat) {
  return stat.dev !== undefined
    && stat.ino !== undefined
    && stat.ino !== 0
    && stat.ino !== 0n;
}

function isSamePhysicalFile(left, right) {
  return statHasFileIdentity(left)
    && statHasFileIdentity(right)
    && left.dev === right.dev
    && left.ino === right.ino;
}

function revalidateWriteInputs({
  manifestPath,
  manifestIdentity,
  physicalRoot,
  rootIdentity,
  statPath
}) {
  let currentManifestRealPath;
  let currentManifestStat;
  let currentRootRealPath;
  let currentRootStat;
  try {
    currentManifestRealPath = fs.realpathSync(manifestPath);
    currentManifestStat = statPath(manifestPath);
    currentRootRealPath = fs.realpathSync(physicalRoot);
    currentRootStat = statPath(physicalRoot);
  } catch (error) {
    throw new TypeError(`Restamp inputs changed before write: ${error.code ?? error.message}.`);
  }
  if (!isSamePhysicalFile(manifestIdentity.stat, currentManifestStat)) {
    throw new TypeError("Projection manifest path changed and no longer names the same opened file.");
  }
  if (pathIsInside(currentManifestRealPath, physicalRoot)) {
    throw new TypeError("Projection manifest must remain outside the document-set root.");
  }
  if (currentRootRealPath !== physicalRoot || !isSamePhysicalFile(rootIdentity, currentRootStat)) {
    throw new TypeError("Document-set root changed after canonical resolution and before write.");
  }
}

function closeManifestDescriptor(manifestIdentity, failure = null) {
  try {
    fs.closeSync(manifestIdentity.descriptor);
  } catch (closeError) {
    if (failure !== null) {
      throw new AggregateError(
        [failure, closeError],
        `Restamp failed and the projection manifest descriptor could not be closed: ${failure.message}`
      );
    }
    throw closeError;
  }
}

function temporarySibling(target, kind) {
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.docai-restamp-${randomUUID()}.${kind}`
  );
}

function removeFileIfPresent(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function stageFile(file, openFile) {
  const targetStat = fs.statSync(file.absolutePath);
  const stagePath = temporarySibling(file.absolutePath, "stage");
  let descriptor = null;
  try {
    descriptor = openFile(stagePath, "wx", targetStat.mode & 0o777);
    fs.writeFileSync(descriptor, file.bytes);
    fs.fchmodSync(descriptor, targetStat.mode & 0o7777);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;

    const stageStat = fs.statSync(stagePath);
    if (stageStat.dev !== targetStat.dev) {
      throw new Error(`Staging file for '${file.path}' is not on the target filesystem.`);
    }
    const stagedBytes = fs.readFileSync(stagePath);
    if (!stagedBytes.equals(file.bytes)) {
      throw new Error(`Staged bytes for '${file.path}' do not match the computed output.`);
    }
    return { ...file, bytes: stagedBytes, stagePath, targetStat };
  } catch (error) {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the staging failure; cleanup below remains best-effort.
      }
    }
    try {
      removeFileIfPresent(stagePath);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Staging '${file.path}' failed and its temporary file could not be removed.`
      );
    }
    throw error;
  }
}

function parsedIdentity(file) {
  const lines = scanUtf8Lines(file.bytes).lines;
  const identityLines = lines.filter((line) => line.text.startsWith("> docai-identity:"));
  const finalNonEmpty = lines.findLast((line) => line.end > line.start);
  if (identityLines.length !== 1 || identityLines[0] !== finalNonEmpty) {
    throw new Error(`Staged file '${file.path}' has no unique final identity trailer.`);
  }
  const parsed = parseIdentityTrailer(identityLines[0].text, { root: file.path === "INDEX.md" });
  if (parsed.value === null) throw new Error(`Staged file '${file.path}' has an invalid identity trailer.`);
  return { value: parsed.value, line: identityLines[0].line };
}

function validateStagedSet(documentSet, stampedFiles, stagedFiles, expectedSetDigest) {
  const stagedByPath = new Map(stagedFiles.map((file) => [file.path, file]));
  const stampedByPath = new Map(stampedFiles.map((file) => [file.path, file]));
  const candidateFiles = documentSet.files.map((original) => {
    const candidate = stagedByPath.get(original.path) ?? stampedByPath.get(original.path);
    const identity = parsedIdentity(candidate);
    return {
      ...original,
      bytes: candidate.bytes,
      identity: identity.value,
      identityLine: identity.line
    };
  });
  const result = validateDocumentSet(
    { ...documentSet, files: candidateFiles, diagnostics: [] },
    { wholeSet: true }
  );
  if (result.diagnostics.length > 0 || result.facts.computedSetDigest !== expectedSetDigest) {
    const ruleIds = result.diagnostics.map((entry) => entry.ruleId).join(", ") || "digest mismatch";
    throw new Error(`Staged document set failed final identity validation: ${ruleIds}.`);
  }
}

function replaceStagedFiles(stagedFiles, replaceFile, restoreFile) {
  const journal = [];
  try {
    for (const file of stagedFiles) {
      const backupPath = temporarySibling(file.absolutePath, "backup");
      fs.copyFileSync(file.absolutePath, backupPath, fs.constants.COPYFILE_EXCL);
      const entry = { ...file, backupPath, replaced: false, recoveryRetained: false };
      journal.push(entry);
      replaceFile(file.stagePath, file.absolutePath);
      entry.replaced = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of journal.toReversed()) {
      if (!entry.replaced) continue;
      try {
        restoreFile(entry.backupPath, entry.absolutePath);
        entry.backupPath = null;
      } catch (rollbackError) {
        entry.recoveryRetained = true;
        rollbackErrors.push(new Error(
          `Rollback restore for '${entry.absolutePath}' failed; original-byte backup retained at '${entry.backupPath}': ${rollbackError.message}`,
          { cause: rollbackError }
        ));
      }
    }
    for (const entry of journal) {
      try {
        removeFileIfPresent(entry.stagePath);
        if (entry.backupPath !== null && !entry.recoveryRetained) {
          removeFileIfPresent(entry.backupPath);
        }
      } catch (cleanupError) {
        rollbackErrors.push(cleanupError);
      }
    }
    if (rollbackErrors.length > 0) {
      const retainedPaths = journal
        .filter((entry) => entry.recoveryRetained)
        .map((entry) => `'${entry.backupPath}'`)
        .join(", ");
      const recoveryNotice = retainedPaths === ""
        ? ""
        : ` Original-byte recovery backup retained at ${retainedPaths}.`;
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Restamp replacement failed and rollback or cleanup was incomplete: ${error.message}.${recoveryNotice}`
      );
    }
    throw new Error(`Restamp replacement failed and was rolled back: ${error.message}`, { cause: error });
  }

  for (const entry of journal) {
    removeFileIfPresent(entry.stagePath);
    removeFileIfPresent(entry.backupPath);
  }
}

export function restampDocumentSet(
  rootDir,
  projectionManifest,
  {
    write = false,
    openFile = fs.openSync,
    replaceFile = fs.renameSync,
    restoreFile = fs.renameSync,
    statPath = fs.statSync
  } = {}
) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedManifest = path.resolve(projectionManifest);
  let physicalRoot;
  let rootIdentity;
  try {
    physicalRoot = fs.realpathSync(resolvedRoot);
    rootIdentity = fs.statSync(physicalRoot);
  } catch (error) {
    throw new TypeError(`Document-set root cannot be resolved: ${error.code ?? error.message}.`);
  }
  const manifestIdentity = projectionIdentity(resolvedManifest);
  if (pathIsInside(manifestIdentity.realPath, physicalRoot)) {
    closeManifestDescriptor(manifestIdentity);
    throw new TypeError("Projection manifest must remain outside the document-set root.");
  }

  try {
    const { projectionDigest, projectionId } = manifestIdentity;
    const documentSet = loadDocumentSet(physicalRoot);
    if (documentSet.diagnostics.length > 0) {
      const summary = documentSet.diagnostics
        .map((entry) => `${entry.ruleId} ${entry.file}:${entry.line} ${entry.message}`)
        .join("\n");
      throw new TypeError(`Document-set root cannot be restamped until structural errors are fixed:\n${summary}`);
    }
    for (const file of documentSet.files) {
      if (isSamePhysicalFile(manifestIdentity.stat, fs.statSync(file.absolutePath))) {
        throw new TypeError(
          `Projection manifest is the same physical file as document-set member '${file.path}' (hard links are prohibited).`
        );
      }
    }

    const projectionStamped = documentSet.files.map((file) => ({
      ...file,
      bytes: stampIdentityTrailer(
        file.bytes,
        {
          projection_id: projectionId,
          ...(file.path === "INDEX.md" ? { projection_digest: projectionDigest } : {})
        },
        { root: file.path === "INDEX.md" }
      )
    }));
    const setDigest = computeSetDigest(projectionStamped);
    const setId = deriveShortId(setDigest);
    const stampedFiles = projectionStamped.map((file) => ({
      ...file,
      bytes: stampIdentityTrailer(
        file.bytes,
        {
          set_id: setId,
          ...(file.path === "INDEX.md" ? { set_digest: setDigest } : {})
        },
        { root: file.path === "INDEX.md" }
      )
    }));
    const changedFiles = stampedFiles.filter((file) => !file.bytes.equals(documentSet.files.find(
      (original) => original.path === file.path
    ).bytes));

    if (write && changedFiles.length > 0) {
      revalidateWriteInputs({
        manifestPath: resolvedManifest,
        manifestIdentity,
        physicalRoot,
        rootIdentity,
        statPath
      });
      closeManifestDescriptor(manifestIdentity);
      manifestIdentity.descriptor = null;
      const stagedFiles = [];
      try {
        for (const file of changedFiles) stagedFiles.push(stageFile(file, openFile));
        validateStagedSet(documentSet, stampedFiles, stagedFiles, setDigest);
        replaceStagedFiles(stagedFiles, replaceFile, restoreFile);
      } catch (error) {
        for (const file of stagedFiles) removeFileIfPresent(file.stagePath);
        throw error;
      }
    }
    if (manifestIdentity.descriptor !== null) {
      closeManifestDescriptor(manifestIdentity);
      manifestIdentity.descriptor = null;
    }
    return {
      rootDir: physicalRoot,
      projectionManifest: resolvedManifest,
      projectionDigest,
      projectionId,
      setDigest,
      setId,
      write,
      changed: changedFiles.length > 0,
      changedPaths: changedFiles.map((file) => file.path)
    };
  } catch (error) {
    if (manifestIdentity.descriptor !== null) {
      closeManifestDescriptor(manifestIdentity, error);
      manifestIdentity.descriptor = null;
    }
    throw error;
  }
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = restampDocumentSet(
      options.rootDir,
      options.projectionManifest,
      { write: options.write }
    );
    process.stdout.write([
      `projection manifest: ${result.projectionManifest}`,
      `document-set root: ${result.rootDir}`,
      `mode: ${result.write ? "write" : "dry-run"}`,
      `restamp required: ${result.changed ? "yes" : "no"}`,
      ""
    ].join("\n"));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
