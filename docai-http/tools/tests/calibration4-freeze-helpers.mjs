import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Synthetic identity/time only. This helper never modifies production files.
export const SYNTHETIC_FROZEN_AT = "2026-11-10T00:00:00Z";

export async function pinFixtureAuthority(packageDir, manifest) {
  const file = path.join(packageDir, "runtime/freeze-authority.mjs");
  const { FREEZE_AUTHORITY } = await import(pathToFileURL(file).href);
  writeFixtureAuthority(file, FREEZE_AUTHORITY, manifest);
}

function writeFixtureAuthority(file, FREEZE_AUTHORITY, manifest) {
  FREEZE_AUTHORITY.manifest_sha256 = manifest === null ? null : crypto.createHash("sha256").update(`${JSON.stringify(manifest, null, 2)}\n`).digest("hex");
  fs.writeFileSync(file, `export const FREEZE_AUTHORITY = ${JSON.stringify(FREEZE_AUTHORITY, null, 2)};\n`);
}

export async function syntheticFreezeRuntime() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "calibration4-freeze-runtime-")));
  const source = path.resolve(import.meta.dirname, "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime");
  try {
    fs.cpSync(source, path.join(root, "runtime"), { recursive: true });
    const file = path.join(root, "runtime/freeze.mjs");
    const authorityFile = path.join(root, "runtime/freeze-authority.mjs");
    const { FREEZE_AUTHORITY } = await import(pathToFileURL(authorityFile).href);
    return { freeze: await import(pathToFileURL(file).href),
      pin: manifest => writeFixtureAuthority(authorityFile, FREEZE_AUTHORITY, manifest),
      authorityFile,
      cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
  } catch (error) { fs.rmSync(root, { recursive: true, force: true }); throw error; }
}
