#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

process.env.DOCAI_COMPLETE_FIXTURE_VERSION ??= "1.0.0";
process.env.DOCAI_COMPLETE_FIXTURE_DEFAULT_RELATIVE_DIR ??= path.join("fixtures", "conformance", "v1.0.0");
process.env.DOCAI_COMPLETE_FOCUSED_EXPECTATION_LABEL ??= "complete conformance";
process.env.DOCAI_COMPLETE_FIXTURE_EXTENSION_LABEL ??= "stable-conformance";
process.env.DOCAI_COMPLETE_CORPUS_DISPLAY_LABEL ??= "Stable conformance";
process.env.DOCAI_COMPLETE_SOURCE_TRACEABILITY_FILE ??= "SOURCE-TRACEABILITY.md";

if (!process.argv[2]) {
  process.argv[2] = path.resolve(SCRIPT_DIR, "..", "fixtures", "conformance", "v1.0.0");
}

await import("./check-complete-candidates.mjs");
