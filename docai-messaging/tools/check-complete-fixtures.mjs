#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrustedCompleteExampleAdapterOptions } from "./lib/complete-example-adapters.mjs";
import { loadDocumentSet } from "./lib/document-set.mjs";
import { validateCompleteProfilePair } from "./lib/validators/complete-profiles.mjs";

const defaultCandidatePath = fileURLToPath(
  new URL("../fixtures/complete-candidates/v0.17.1/", import.meta.url)
);
const usage = "Usage: node docai-messaging/tools/check-complete-fixtures.mjs [candidate-root]";

function fail(lines) {
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exitCode = 1;
}

function directoryExists(directory) {
  try {
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

function formattedDiagnostic(entry) {
  return `${entry.ruleId} ${entry.file}:${entry.line} ${entry.message}`;
}

function checkCompleteFixtures(candidatePath) {
  const fullPath = path.join(candidatePath, "full");
  const compactPath = path.join(candidatePath, "compact");
  if (!directoryExists(fullPath) || !directoryExists(compactPath)) {
    throw new Error(
      `Complete candidate requires full and compact document-set roots: ${candidatePath}`
    );
  }

  const fullDocumentSet = loadDocumentSet(fullPath);
  const compactDocumentSet = loadDocumentSet(compactPath);
  const options = loadTrustedCompleteExampleAdapterOptions(
    candidatePath,
    [fullDocumentSet, compactDocumentSet]
  );
  const result = validateCompleteProfilePair(fullDocumentSet, compactDocumentSet, options);
  if (result.diagnostics.length > 0) {
    fail(result.diagnostics.map(formattedDiagnostic));
    return;
  }

  process.stdout.write(
    `Complete fixture check passed: ${result.facts.completeProfilePair.paths.length} paths, `
      + "full/compact pair equivalent.\n"
  );
}

const arguments_ = process.argv.slice(2);
if (arguments_.length > 1) {
  fail([usage]);
} else {
  try {
    checkCompleteFixtures(path.resolve(arguments_[0] ?? defaultCandidatePath));
  } catch (error) {
    fail([error instanceof Error ? error.stack ?? error.message : String(error)]);
  }
}
