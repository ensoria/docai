import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { fixture } from "./calibration3-stop-helpers.mjs";

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function cliFixture() {
  const f = await fixture();
  try {
    // Re-anchor only this disposable synthetic package, never production.
    const committed = structuredClone(f.plan);
    committed.freeze.artifact_set_sha256 = "0".repeat(64);
    const anchor = crypto.createHash("sha256").update(json(committed)).digest("hex");
    const freezeFile = path.join(f.packageDir, "runtime/freeze.mjs");
    const source = fs.readFileSync(freezeFile, "utf8");
    const anchorDeclaration = /const FROZEN_PLAN_IDENTITY_SHA256 = (?:null|"[a-f0-9]{64}");/;
    if (!anchorDeclaration.test(source)) throw new Error("expected closed freeze anchor declaration");
    fs.writeFileSync(freezeFile, source.replace(anchorDeclaration, `const FROZEN_PLAN_IDENTITY_SHA256 = "${anchor}";`));
    const freeze = await import(`${pathToFileURL(freezeFile).href}?synthetic-anchor`);
    const draft = structuredClone(f.plan);
    draft.status = "calibration-draft"; delete draft.freeze;
    draft.targets.forEach((target) => { target.model_id = null; });
    for (const [name, value] of [["plan.json", draft], ["model-resolutions.json", f.models], ["cost-estimate.json", f.cost], ["private/contexts/calibration-metrics.json", f.metrics]]) fs.writeFileSync(path.join(f.packageDir, name), json(value));
    fs.writeFileSync(path.join(f.packageDir, "README.md"), "# Disposable synthetic CLI fixture\n");
    const testsDir = path.join(f.root, "docai-http/tools/tests");
    fs.mkdirSync(testsDir, { recursive: true });
    fs.copyFileSync(path.resolve(import.meta.dirname, "openapi-comparison-v3-calibration3-cli.test.mjs"), path.join(testsDir, "openapi-comparison-v3-calibration3-cli.test.mjs"));
    for (const helper of ["calibration3-cli-helpers.mjs", "calibration3-stop-helpers.mjs"]) {
      fs.copyFileSync(path.join(import.meta.dirname, helper), path.join(testsDir, helper));
    }
    const artifacts = freeze.collectFreezeArtifacts({ repositoryRoot: f.root, privateRequired: true });
    const frozen = freeze.buildCalibrationFreeze({ plan: draft, modelResolutions: f.models, artifacts, rootDir: f.root, frozenAt: committed.freeze.frozen_at, planArtifactPath: path.relative(f.root, path.join(f.packageDir, "plan.json")) });
    fs.writeFileSync(path.join(f.packageDir, "plan.json"), json(frozen.plan));
    fs.writeFileSync(path.join(f.packageDir, "freeze-manifest.json"), json(frozen.manifest));
    assertFrozen();
    function assertFrozen() { return freeze.validateFrozenPackage({ packageDir: f.packageDir, repositoryRoot: f.root, privateRequired: true }); }
    const { renderedProviderPrompt } = await f.load("provider-adapter-utils");
    const mappings = f.prompts.map((prompt) => ({ ...renderedProviderPrompt(prompt), output: JSON.stringify(f.tasks.find((task) => task.id === prompt.task_id).private.expected_outcome) }));
    const mappingsFile = path.join(f.root, "mock-responses.json");
    fs.writeFileSync(mappingsFile, json(mappings));
    const transportLog = path.join(f.root, "transport.jsonl");
    const preload = path.join(f.root, "mock-fetch.mjs");
    fs.writeFileSync(preload, `import fs from "node:fs";
const mappings = JSON.parse(fs.readFileSync(${JSON.stringify(mappingsFile)}, "utf8"));
globalThis.fetch = async (url, options) => {
  fs.appendFileSync(${JSON.stringify(transportLog)}, JSON.stringify({ url }) + "\\n");
  const body = JSON.parse(options.body);
  const user = body.messages?.[0]?.content ?? body.input;
  const system = body.instructions ?? body.system ?? body.system_instruction;
  const match = mappings.find((row) => row.user === user && row.system === system);
  if (!match) throw new Error("unexpected synthetic request");
  const payload = { model: body.model, status: "completed", stop_reason: "end_turn", output_text: match.output, content: [{ type: "text", text: match.output }], usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 } };
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
};
`);
    const env = { ...process.env, NODE_OPTIONS: "", OPENAI_API_KEY: "fake-openai", ANTHROPIC_API_KEY: "fake-claude", GOOGLE_API_KEY: "fake-google", GEMINI_API_KEY: "fake-google", DOCAI_LIVE_LLM_APPROVED_CALIBRATION: f.plan.plan_version };
    function spawn(name = "run-calibration", args = ["--execute"], overrides = {}) {
      // realpath prevents /var versus /private/var from skipping guarded entrypoints.
      const file = fs.realpathSync(path.join(f.packageDir, "runtime", `${name}.mjs`));
      return spawnSync(process.execPath, ["--import", preload, file, ...args], { cwd: fs.realpathSync(f.root), env: { ...env, ...overrides }, encoding: "utf8", timeout: 120000 });
    }
    const store = new f.runner.FileRunStore({ runsDir: path.join(f.packageDir, "private/runs", f.plan.plan_version), checkpointsDir: path.join(f.packageDir, "private/checkpoints", f.plan.plan_version) });
    return { ...f, spawn, store, assertFrozen, calls: () => fs.existsSync(transportLog) ? fs.readFileSync(transportLog, "utf8").trim().split("\n").filter(Boolean).length : 0 };
  } catch (error) { f.cleanup(); throw error; }
}
