import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const RC2_CONTEXT_DIR = path.resolve(SCRIPT_DIR, "..", "fixtures", "conformance", "v1.0.0");
export const RC2_EVALUATION_DIR = path.resolve(
  SCRIPT_DIR,
  "..",
  "fixtures",
  "release-candidates",
  "v1.0.0-rc.2",
  "evaluations",
);

export function configureRc2Evaluation() {
  process.env.DOCAI_COMPLETE_CONTEXT_DIR = RC2_CONTEXT_DIR;
  process.env.DOCAI_COMPLETE_EVALUATION_DIR = RC2_EVALUATION_DIR;
  process.env.DOCAI_COMPLETE_EXPECTED_VERSION = "1.0.0";
  process.env.DOCAI_COMPLETE_EXPECTED_CANDIDATE = "release-candidates/v1.0.0-rc.2";
  process.env.DOCAI_COMPLETE_REQUIRE_REQUIRED_PASS = "1";
}
