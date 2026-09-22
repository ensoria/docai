import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { diagnostic } from "../diagnostics.mjs";
import { validateCompleteDocumentSet } from "./complete.mjs";
import {
  canonicalRepresentationView,
  compareExpandedProfileFiles
} from "./complete-profile-comparison.mjs";
import { collectPayloadRepresentations } from "./complete-same-as.mjs";

function shardPaths(catalog) {
  return (catalog?.shards ?? [])
    .map((route) => route.path)
    .sort((left, right) => Buffer.compare(
      Buffer.from(left, "ascii"),
      Buffer.from(right, "ascii")
    ));
}

function catalogFacts(result) {
  const core = result.facts.core;
  const complete = result.facts.complete;
  return {
    sources: {
      form: core.sources.form,
      shardPaths: shardPaths(core.sources)
    },
    operations: {
      form: core.operations.form,
      shardPaths: shardPaths(core.operations)
    },
    workflows: {
      form: complete.workflows.form,
      shardPaths: shardPaths(complete.workflows),
      routes: complete.workflows.rows.map(({ name, path }) => ({ name, path }))
    },
    unprojectedOperations: {
      form: core.unprojectedOperations.form,
      shardPaths: shardPaths(core.unprojectedOperations)
    }
  };
}

function profileFacts(documentSet, result) {
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  return {
    profileLink: result.facts.core.profileLink,
    setId: result.facts.setId,
    setDigest: result.facts.setDigest,
    catalogs: catalogFacts(result),
    root
  };
}

function sameStringArray(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function correspondingMetadataMatches(fullDocumentSet, compactDocumentSet) {
  const compactByPath = new Map(compactDocumentSet.files.map((file) => [file.path, file]));
  return fullDocumentSet.files.every((fullFile) => {
    const compactFile = compactByPath.get(fullFile.path);
    return compactFile !== undefined
      && ["coverage", "knowledge", "source_refs"].every((field) => (
        fullFile.metadata[field] === compactFile.metadata[field]
      ));
  });
}

function representationWithIdentity(representations, identity) {
  return representations.find((entry) => (
    entry.kind === "expanded"
      && entry.operation === identity.operation
      && entry.message === identity.message
      && entry.reply === identity.reply
      && entry.mediaType === identity.mediaType
  ));
}

function validatePairedFullSameAs(fullDocumentSet, sameAsFacts) {
  const diagnostics = [];
  const representationsByPath = new Map();
  for (const fact of sameAsFacts) {
    const fullFile = fullDocumentSet.files.find((file) => file.path === fact.path);
    if (fullFile === undefined) continue;
    let representations = representationsByPath.get(fact.path);
    if (representations === undefined) {
      representations = collectPayloadRepresentations(fullFile);
      representationsByPath.set(fact.path, representations);
    }
    const target = representationWithIdentity(representations, fact.target);
    const reference = representationWithIdentity(representations, fact.reference);
    const canonicalMatch = target !== undefined
      && reference !== undefined
      && isDeepStrictEqual(
        canonicalRepresentationView(fullFile, target.line, target.endLine),
        canonicalRepresentationView(fullFile, reference.line, reference.endLine)
      );
    if (!canonicalMatch) {
      diagnostics.push(diagnostic(
        "DM-PROFILE-005",
        `compact/${fact.path}`,
        fact.line,
        "same_as requires canonically identical expanded target and referring representations in the paired full file."
      ));
    }
  }
  return diagnostics;
}

export function validateCompleteProfilePair(
  fullDocumentSet,
  compactDocumentSet,
  options = {}
) {
  const fullResult = validateCompleteDocumentSet(fullDocumentSet, options);
  const compactResult = validateCompleteDocumentSet(compactDocumentSet, options);
  const diagnostics = [...fullResult.diagnostics, ...compactResult.diagnostics];
  if (diagnostics.length > 0) {
    return { diagnostics, facts: { completeProfilePair: null } };
  }

  const full = profileFacts(fullDocumentSet, fullResult);
  const compact = profileFacts(compactDocumentSet, compactResult);
  const fullPaths = fullDocumentSet.files.map((file) => file.path);
  const compactPaths = compactDocumentSet.files.map((file) => file.path);
  const pathParity = sameStringArray(fullPaths, compactPaths);
  const fileMetadataParity = pathParity
    && correspondingMetadataMatches(fullDocumentSet, compactDocumentSet);
  const linkedCompactRoot = full.profileLink === null
    ? null
    : path.resolve(fullDocumentSet.rootDir, full.profileLink);
  const linkedFullRoot = compact.profileLink === null
    ? null
    : path.resolve(compactDocumentSet.rootDir, compact.profileLink);
  const pairIdentityMatches = full.root.metadata.profile === "full"
    && compact.root.metadata.profile === "compact"
    && full.root.metadata["docai-messaging"] === compact.root.metadata["docai-messaging"]
    && full.root.metadata.perspective === compact.root.metadata.perspective
    && fullResult.facts.projectionId === compactResult.facts.projectionId
    && fullResult.facts.projectionDigest === compactResult.facts.projectionDigest;
  const profileMismatch = !pairIdentityMatches
    || !pathParity
    || !fileMetadataParity
    || linkedCompactRoot !== path.resolve(compactDocumentSet.rootDir)
    || linkedFullRoot !== path.resolve(fullDocumentSet.rootDir);
  if (profileMismatch) {
    diagnostics.push(diagnostic(
      "DM-PROFILE-001",
      "full/INDEX.md",
      1,
      "Matching full and compact roots require exact paths, profiles, reciprocal profile links, DocAI version, perspective, projection identity, and corresponding coverage, knowledge, and source_refs."
    ));
  }
  if (!isDeepStrictEqual(full.catalogs, compact.catalogs)) {
    diagnostics.push(diagnostic(
      "DM-PROFILE-002",
      "compact/INDEX.md",
      1,
      "Matching full and compact roots require the same catalog forms, shard paths, and workflow routing names and Details paths."
    ));
  }
  if (diagnostics.length === 0) {
    diagnostics.push(...validatePairedFullSameAs(
      fullDocumentSet,
      compactResult.facts.complete.sameAs
    ));
  }
  const comparisonMismatch = diagnostics.length === 0
    ? fullDocumentSet.files.find((fullFile) => {
      const compactFile = compactDocumentSet.files.find((file) => file.path === fullFile.path);
      return compactFile === undefined || !compareExpandedProfileFiles(fullFile, compactFile);
    })
    : undefined;
  if (comparisonMismatch !== undefined) {
    diagnostics.push(diagnostic(
      "DM-PROFILE-003",
      `compact/${comparisonMismatch.path}`,
      1,
      "Expanded full and compact comparison views must preserve every ordered standard contract structure."
    ));
  }
  if (diagnostics.length > 0) {
    return { diagnostics, facts: { completeProfilePair: null } };
  }
  return {
    diagnostics,
    facts: {
      completeProfilePair: {
        paths: fullPaths,
        projection: {
          docaiMessaging: full.root.metadata["docai-messaging"],
          perspective: full.root.metadata.perspective,
          projectionId: fullResult.facts.projectionId,
          projectionDigest: fullResult.facts.projectionDigest
        },
        full: {
          profileLink: full.profileLink,
          setId: full.setId,
          setDigest: full.setDigest,
          catalogs: full.catalogs
        },
        compact: {
          profileLink: compact.profileLink,
          setId: compact.setId,
          setDigest: compact.setDigest,
          catalogs: compact.catalogs
        }
      }
    }
  };
}
