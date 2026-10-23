#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrustedCompleteExampleAdapterOptions } from "./lib/complete-example-adapters.mjs";
import { auditCompleteCandidateSources } from "./lib/complete-candidate-source-audit.mjs";
import { auditCompleteCompactPolicy } from "./lib/complete-compact-policy-audit.mjs";
import { auditCompleteCatalogPolicy } from "./lib/complete-catalog-policy-audit.mjs";
import { auditCompleteCatalogPlacement } from "./lib/complete-catalog-placement-audit.mjs";
import { auditCompleteChannelPlacement } from "./lib/complete-channel-placement-audit.mjs";
import { auditCompleteRelatedPolicy } from "./lib/complete-related-policy-audit.mjs";
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

  const sourceIssues = auditCompleteCandidateSources(candidatePath, {
    full: fullDocumentSet,
    compact: compactDocumentSet
  }, options);
  if (sourceIssues.length > 0) {
    fail(sourceIssues.map((issue) => `Complete source traceability: ${issue}`));
    return;
  }

  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
  if (manifest?.generator?.id === "docai-messaging-complete-fixture-projector") {
    const catalogIssues = [["full", fullDocumentSet], ["compact", compactDocumentSet]]
      .flatMap(([profile, set]) => auditCompleteCatalogPolicy(
        manifest.publicationPolicy?.catalogSummaries, set, options
      ).map((issue) => `${profile}: ${issue}`));
    if (catalogIssues.length > 0) {
      fail(catalogIssues.map((issue) => `Complete catalog policy: ${issue}`));
      return;
    }
    const placementIssues = [["full", fullDocumentSet], ["compact", compactDocumentSet]]
      .flatMap(([profile, set]) => auditCompleteCatalogPlacement(
        manifest.publicationPolicy?.catalogPlacement, set, options
      ).map((issue) => `${profile}: ${issue}`));
    if (placementIssues.length > 0) {
      fail(placementIssues.map((issue) => `Complete catalog placement: ${issue}`));
      return;
    }
    const channelIssues = [["full", fullDocumentSet], ["compact", compactDocumentSet]]
      .flatMap(([profile, set]) => auditCompleteChannelPlacement(
        manifest.publicationPolicy?.channelPlacement, set, options
      ).map((issue) => `${profile}: ${issue}`));
    if (channelIssues.length > 0) {
      fail(channelIssues.map((issue) => `Complete channel placement: ${issue}`));
      return;
    }
    const syntheticSources = ["complete-contexts.json", "complete-representations.json"]
      .map((filename) => JSON.parse(fs.readFileSync(path.join(candidatePath, "source", filename), "utf8")));
    const relatedIssues = [["full", fullDocumentSet], ["compact", compactDocumentSet]]
      .flatMap(([profile, set]) => auditCompleteRelatedPolicy(
        manifest.publicationPolicy?.relatedNavigation, syntheticSources, set, options
      ).map((issue) => `${profile}: ${issue}`));
    if (relatedIssues.length > 0) {
      fail(relatedIssues.map((issue) => `Complete Related policy: ${issue}`));
      return;
    }
    const policyIssues = auditCompleteCompactPolicy(compactDocumentSet);
    if (policyIssues.length > 0) {
      fail(policyIssues.map((issue) => `Complete compact policy: ${issue}`));
      return;
    }
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
