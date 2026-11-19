import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { fixture } from "./calibration4-stop-helpers.mjs";
import { documentedNativeResponse } from "./calibration4-evidence-helpers.mjs";
import { pinFixtureAuthority } from "./calibration4-freeze-helpers.mjs";

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function cliFixture() {
  const f = await fixture();
  try {
    // Prepare exact bytes first; pin only the disposable data root afterward.
    const committed = structuredClone(f.plan);
    const freezeFile = path.join(f.packageDir, "runtime/freeze.mjs");
    const freeze = await import(pathToFileURL(freezeFile).href);
    const draft = structuredClone(f.plan);
    draft.status = "calibration-draft"; delete draft.freeze;
    draft.targets.forEach((target) => { target.model_id = null; });
    for (const [name, value] of [["plan.json", draft], ["model-resolutions.json", f.models], ["cost-estimate.json", f.cost], ["private/contexts/calibration-metrics.json", f.metrics]]) fs.writeFileSync(path.join(f.packageDir, name), json(value));
    fs.writeFileSync(path.join(f.packageDir, "README.md"), "# Disposable synthetic CLI fixture\n");
    const testsDir = path.join(f.root, "docai-http/tools/tests");
    fs.mkdirSync(testsDir, { recursive: true });
    fs.copyFileSync(path.resolve(import.meta.dirname, "openapi-comparison-v3-calibration4-cli.test.mjs"), path.join(testsDir, "openapi-comparison-v3-calibration4-cli.test.mjs"));
    for (const helper of ["calibration4-cli-helpers.mjs", "calibration4-stop-helpers.mjs", "calibration4-evidence-helpers.mjs"]) {
      fs.copyFileSync(path.join(import.meta.dirname, helper), path.join(testsDir, helper));
    }
    const artifacts = freeze.collectFreezeArtifacts({ repositoryRoot: f.root, privateRequired: true });
    const frozen = freeze.buildCalibrationFreeze({ plan: draft, modelResolutions: f.models, artifacts, rootDir: f.root, frozenAt: committed.freeze.frozen_at, planArtifactPath: path.relative(f.root, path.join(f.packageDir, "plan.json")) });
    await pinFixtureAuthority(f.packageDir, frozen.manifest);
    const candidateFile = path.join(f.root, "reviewed-freeze-candidate.json");
    fs.writeFileSync(candidateFile, json(frozen));
    fs.writeFileSync(path.join(f.packageDir, "plan.json"), json(frozen.plan));
    fs.writeFileSync(path.join(f.packageDir, "freeze-manifest.json"), json(frozen.manifest));
    assertFrozen();
    function assertFrozen() { return freeze.validateFrozenPackage({ packageDir: f.packageDir, repositoryRoot: f.root, privateRequired: true }); }
    const { renderedProviderPrompt } = await f.load("provider-adapter-utils");
    const mappings = f.prompts.map(prompt => {
      const output = JSON.stringify(f.tasks.find(task => task.id === prompt.task_id).private.expected_outcome);
      const response = f.response(prompt);
      const raw = prompt.target.provider === "anthropic" ? { ...response.raw_response, content: [{ type: "text", text: output }] }
        : documentedNativeResponse(prompt.target.provider, response.resolved_model, output);
      return { ...renderedProviderPrompt(prompt), run_id: prompt.run_id, raw };
    });
    const mappingsFile = path.join(f.root, "mock-responses.json");
    fs.writeFileSync(mappingsFile, json(mappings));
    const transportLog = path.join(f.root, "transport.jsonl");
    const preload = path.join(f.root, "mock-fetch.mjs");
    fs.writeFileSync(preload, `import fs from "node:fs";
const HostDate = globalThis.Date;
const now = HostDate.parse(process.env.TASK5_TEST_NOW ?? "2026-11-13T12:00:00.000Z");
globalThis.Date = class extends HostDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
const mappings = JSON.parse(fs.readFileSync(${JSON.stringify(mappingsFile)}, "utf8"));
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  const user = body.messages?.[0]?.content ?? body.input;
  const system = body.instructions ?? body.system ?? body.system_instruction;
  const match = mappings.find((row) => row.user === user && row.system === system && row.raw.model === body.model);
  if (!match) throw new Error("unexpected synthetic request");
  fs.appendFileSync(${JSON.stringify(transportLog)}, JSON.stringify({ url, body, run_id: match.run_id, at: new Date().toISOString() }) + "\\n");
  const payload = { ...match.raw, model: body.model };
  if (process.env.TASK5_FAKE_NATIVE === "openai-billing" && url.includes("openai")) payload.output[0].content[0].billing_addon = null;
  if (process.env.TASK5_FAKE_NATIVE === "google-tool" && url.includes("googleapis")) payload.steps.push({ type: "function_call", name: "unexpected", arguments: {}, id: "synthetic-tool" });
  if (process.env.TASK5_FAKE_TRANSPORT === "reject") throw new Error("ambiguous fake fetch failure");
  if (process.env.TASK5_FAKE_TRANSPORT === "read") return { ok: true, status: 200, text: async () => { throw new Error("fake response read failure"); } };
  if (process.env.TASK5_FAKE_TRANSPORT === "partial") {
    if (url.includes("anthropic")) { payload.stop_reason = "max_tokens"; payload.content[0].text = '{"partial":'; }
    else {
      payload.status = "incomplete"; payload.incomplete_details = { reason: "max_output_tokens" };
      if (url.includes("openai")) payload.output[0].content[0].text = '{"partial":';
      else payload.steps.find(step => step.type === "model_output").content[0].text = '{"partial":';
    }
  }
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
};
`);
    const env = { ...process.env, NODE_OPTIONS: "", TASK5_TEST_NOW: "2026-11-13T12:00:00.000Z", OPENAI_API_KEY: "fake-openai", ANTHROPIC_API_KEY: "fake-claude", GOOGLE_API_KEY: "fake-google", GEMINI_API_KEY: "fake-google", DOCAI_LIVE_LLM_APPROVED_CALIBRATION: f.plan.plan_version };
    function spawn(name = "run-calibration", args = ["--execute"], overrides = {}) {
      // realpath prevents /var versus /private/var from skipping guarded entrypoints.
      const file = fs.realpathSync(path.join(f.packageDir, "runtime", `${name}.mjs`));
      return spawnSync(process.execPath, ["--import", preload, file, ...args], { cwd: fs.realpathSync(f.root), env: { ...env, ...overrides }, encoding: "utf8", timeout: 120000 });
    }
    const store = new f.runner.FileRunStore({ runsDir: path.join(f.packageDir, "private/runs", f.plan.plan_version), checkpointsDir: path.join(f.packageDir, "private/checkpoints", f.plan.plan_version) });
    const requests = () => fs.existsSync(transportLog) ? fs.readFileSync(transportLog, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
    return { ...f, freeze, candidateFile, spawn, store, assertFrozen, requests, calls: () => requests().length };
  } catch (error) { f.cleanup(); throw error; }
}
