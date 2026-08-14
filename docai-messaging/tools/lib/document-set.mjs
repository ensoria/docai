import fs from "node:fs";
import path from "node:path";
import { diagnostic } from "./diagnostics.mjs";
import { parseOpeningMetadata } from "./metadata.mjs";
import { parseDocsPath } from "./paths.mjs";
import {
  computeSetDigest,
  decodeUtf8Bytes,
  deriveShortId,
  parseIdentityTrailer,
  scanUtf8Lines
} from "./identity.mjs";
import { validateCoreDocumentSet } from "./validators/core.mjs";

const DOCUMENT_DIRECTORIES = new Set(["indexes", "channels", "workflows", "references"]);

function asciiCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "ascii"), Buffer.from(right, "ascii"));
}

function closedRootDiagnostic(file, message, line = 1) {
  return diagnostic("DM-ID-004", file, line, message);
}

function isDocumentPath(relativePath) {
  const parsed = parseDocsPath(relativePath);
  if (parsed.value === null || parsed.value.kind !== "docs-root-relative") return false;
  if (relativePath === "INDEX.md" || relativePath === "CONVENTIONS.md") return true;
  const segments = relativePath.split("/");
  return segments.length >= 2
    && DOCUMENT_DIRECTORIES.has(segments[0])
    && segments.at(-1).endsWith(".md");
}

function parseDocument(relativePath, absolutePath, bytes) {
  const diagnostics = [];
  const lines = scanUtf8Lines(bytes).lines;
  const metadataResult = parseOpeningMetadata({
    text: lines[0]?.text ?? "",
    file: relativePath,
    line: 1
  });
  diagnostics.push(...metadataResult.diagnostics);

  const identityIndexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].text.startsWith("> docai-identity:")) identityIndexes.push(index);
  }
  let finalNonEmptyIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].end > lines[index].start) {
      finalNonEmptyIndex = index;
      break;
    }
  }

  let identity = null;
  let identityLine = null;
  if (identityIndexes.length !== 1 || identityIndexes[0] !== finalNonEmptyIndex) {
    diagnostics.push(diagnostic(
      "DM-ID-001",
      relativePath,
      identityIndexes.length === 0 ? Math.max(finalNonEmptyIndex + 1, 1) : identityIndexes[0] + 1,
      "Every document-set file must have exactly one identity trailer as its final non-empty line."
    ));
  } else {
    identityLine = identityIndexes[0] + 1;
    const identityResult = parseIdentityTrailer(
      { text: lines[identityIndexes[0]].text, file: relativePath, line: identityLine },
      { root: relativePath === "INDEX.md" }
    );
    diagnostics.push(...identityResult.diagnostics);
    identity = identityResult.value;
  }

  return {
    file: {
      path: relativePath,
      absolutePath,
      bytes,
      content: decodeUtf8Bytes(bytes),
      metadata: metadataResult.value,
      metadataLine: 1,
      identity,
      identityLine
    },
    diagnostics
  };
}

export function loadDocumentSet(rootDir) {
  const resolvedRoot = path.resolve(String(rootDir));
  const files = [];
  const diagnostics = [];
  let rootStat;
  try {
    rootStat = fs.lstatSync(resolvedRoot);
  } catch (error) {
    diagnostics.push(closedRootDiagnostic(
      "INDEX.md",
      `Document-set root cannot be read: ${error.code ?? error.message}.`
    ));
    return { rootDir: resolvedRoot, files, paths: [], diagnostics };
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    diagnostics.push(closedRootDiagnostic(
      "INDEX.md",
      "Document-set root must be a real directory, not a link or another file type."
    ));
    return { rootDir: resolvedRoot, files, paths: [], diagnostics };
  }

  function visit(directory, relativeDirectory = "") {
    const entries = fs.readdirSync(directory).sort(asciiCompare);
    if (entries.length === 0) {
      diagnostics.push(closedRootDiagnostic(
        relativeDirectory === "" ? "." : `${relativeDirectory}/`,
        "A closed document-set root must not contain an empty directory."
      ));
      return;
    }

    for (const name of entries) {
      const absolutePath = path.join(directory, name);
      const relativePath = relativeDirectory === "" ? name : `${relativeDirectory}/${name}`;
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        diagnostics.push(closedRootDiagnostic(
          relativePath,
          "Symbolic links are prohibited inside a closed document-set root."
        ));
        continue;
      }
      if (stat.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }
      if (!stat.isFile()) {
        diagnostics.push(closedRootDiagnostic(
          relativePath,
          "Only regular document-set files and directories are permitted."
        ));
        continue;
      }
      if (!isDocumentPath(relativePath)) {
        diagnostics.push(closedRootDiagnostic(
          relativePath,
          "The closed root contains an unrelated or invalid document-set path."
        ));
        continue;
      }

      const bytes = fs.readFileSync(absolutePath);
      try {
        scanUtf8Lines(bytes);
      } catch {
        diagnostics.push(closedRootDiagnostic(
          relativePath,
          "Document-set files must contain valid UTF-8 bytes."
        ));
        continue;
      }
      const parsed = parseDocument(relativePath, absolutePath, bytes);
      files.push(parsed.file);
      diagnostics.push(...parsed.diagnostics);
    }
  }

  visit(resolvedRoot);
  files.sort((left, right) => asciiCompare(left.path, right.path));
  if (!files.some((file) => file.path === "INDEX.md")) {
    diagnostics.push(closedRootDiagnostic(
      "INDEX.md",
      "A document-set root must contain the root INDEX.md file."
    ));
  }
  return { rootDir: resolvedRoot, files, paths: files.map((file) => file.path), diagnostics };
}

function mixedSetDiagnostic(ruleId, file, line, field, expected, actual) {
  return diagnostic(
    ruleId,
    file,
    line,
    `Mixed document set: '${field}' must be '${expected}' from root INDEX.md, not '${actual}'.`
  );
}

export function validateDocumentSet(documentSet, options = {}) {
  const diagnostics = [...documentSet.diagnostics];
  const root = documentSet.files.find((file) => file.path === "INDEX.md");
  const wholeSet = options.wholeSet ?? options.mode !== "task-scoped";
  const facts = {
    rootDir: documentSet.rootDir,
    paths: [...documentSet.paths],
    fileCount: documentSet.files.length,
    wholeSet,
    setId: root?.identity?.set_id ?? null,
    projectionId: root?.identity?.projection_id ?? null,
    setDigest: root?.identity?.set_digest ?? null,
    projectionDigest: root?.identity?.projection_digest ?? null,
    computedSetDigest: null,
    core: null
  };
  const coreResult = validateCoreDocumentSet(documentSet);
  diagnostics.push(...coreResult.diagnostics);
  facts.core = coreResult.facts;
  if (root === undefined || root.metadata === null || root.identity === null) {
    return { diagnostics, facts };
  }

  const expectedSetId = deriveShortId(root.identity.set_digest);
  const expectedProjectionId = deriveShortId(root.identity.projection_digest);
  if (root.identity.set_id !== expectedSetId) {
    diagnostics.push(diagnostic(
      "DM-ID-002",
      root.path,
      root.identityLine,
      `Root set_id must be '${expectedSetId}', derived from set_digest.`
    ));
  }
  if (root.identity.projection_id !== expectedProjectionId) {
    diagnostics.push(diagnostic(
      "DM-ID-002",
      root.path,
      root.identityLine,
      `Root projection_id must be '${expectedProjectionId}', derived from projection_digest.`
    ));
  }

  const sharedMetadata = [
    ["docai-messaging", "DM-ID-005"],
    ["profile", "DM-ID-006"],
    ["perspective", "DM-ID-007"]
  ];
  for (const file of documentSet.files) {
    if (file === root || file.metadata === null || file.identity === null) continue;
    for (const [field, ruleId] of sharedMetadata) {
      if (file.metadata[field] !== root.metadata[field]) {
        diagnostics.push(mixedSetDiagnostic(
          ruleId,
          file.path,
          file.metadataLine,
          field,
          root.metadata[field],
          file.metadata[field]
        ));
      }
    }
    if (file.identity.set_id !== root.identity.set_id) {
      diagnostics.push(mixedSetDiagnostic(
        "DM-ID-008",
        file.path,
        file.identityLine,
        "set_id",
        root.identity.set_id,
        file.identity.set_id
      ));
    }
    if (file.identity.projection_id !== root.identity.projection_id) {
      diagnostics.push(mixedSetDiagnostic(
        "DM-ID-009",
        file.path,
        file.identityLine,
        "projection_id",
        root.identity.projection_id,
        file.identity.projection_id
      ));
    }
  }

  if (wholeSet && documentSet.diagnostics.length === 0) {
    const computedSetDigest = computeSetDigest(documentSet.files);
    facts.computedSetDigest = computedSetDigest;
    if (root.identity.set_digest !== computedSetDigest) {
      diagnostics.push(diagnostic(
        "DM-ID-003",
        root.path,
        root.identityLine,
        `Root set_digest does not match recomputed whole-set digest '${computedSetDigest}'.`
      ));
    }
  }
  return { diagnostics, facts };
}

function operationProfileFacts(result) {
  const operations = result.facts.core?.operations;
  if (operations === null || operations === undefined) return null;
  return {
    form: operations.form,
    shardPaths: operations.shards.map((route) => route.path).sort(asciiCompare)
  };
}

export function validateOperationProfilePair(fullDocumentSet, compactDocumentSet) {
  const fullResult = validateDocumentSet(fullDocumentSet, { wholeSet: false });
  const compactResult = validateDocumentSet(compactDocumentSet, { wholeSet: false });
  const full = operationProfileFacts(fullResult);
  const compact = operationProfileFacts(compactResult);
  const diagnostics = [...fullResult.diagnostics, ...compactResult.diagnostics];

  if (
    full !== null
    && compact !== null
    && (
      full.form !== compact.form
      || JSON.stringify(full.shardPaths) !== JSON.stringify(compact.shardPaths)
    )
  ) {
    diagnostics.push(diagnostic(
      "DM-IDX-006",
      "compact/INDEX.md",
      1,
      "Matching full and compact profiles must use the same Operations form and operation-shard paths."
    ));
  }

  return {
    diagnostics,
    facts: { operationProfilePair: { full, compact } }
  };
}
