import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const source = path.resolve(import.meta.dirname, "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4");
export let revision;

export async function fixture() {
  const HostDate = globalThis.Date;
  let now = HostDate.parse("2026-11-13T12:00:00.000Z");
  // Test-local eligibility clock; production exposes no dated execution option.
  globalThis.Date = class extends HostDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  const restoreClock = () => { globalThis.Date = HostDate; };
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "calibration4-stops-")));
  const packageDir = path.join(root, "docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4");
  try {
    for (const entry of ["runtime", "plan.json", "contracts.json", "continuity", "calibration-schedule.jsonl"]) {
      fs.cpSync(path.join(source, entry), path.join(packageDir, entry), { recursive: true });
    }
    fs.cpSync(path.resolve(source, "../../../../../fixtures/conformance/v1.0.0"), path.join(root, "docai-http/fixtures/conformance/v1.0.0"), { recursive: true });
    const load = (name) => import(pathToFileURL(path.join(packageDir, "runtime", `${name}.mjs`)).href);
    const runner = await load("runner");
    const verifier = await load("evidence-verifier");
    const { readPlan } = await load("paths");
    const { readTaskPacket } = await load("contract");
    const { buildCalibrationPrompts, buildPromptMetrics } = await load("prompt");
    const { buildCostEstimate, buildModelResolutions } = await load("estimate-cost");
    const { FROZEN_ARTIFACT_CLASSES } = await load("check-plan");
    const errors = await load("provider-errors");
    const plan = readPlan();
    // Every fixture begins as a disposable draft, even after production freezes.
    plan.status = "calibration-draft";
    delete plan.freeze;
    plan.targets.forEach((target) => { target.model_id = null; });
    fs.writeFileSync(path.join(packageDir, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
    const packet = readTaskPacket(plan);
    const prompts = buildCalibrationPrompts({ plan, packet });
    const tasks = packet.tasks.filter((task) => plan.calibration.task_ids.includes(task.id));
    const models = buildModelResolutions(plan);
    // Synthetic fixture timestamp only, never an actual production freeze.
    const frozen = { ...plan, status: "calibration-frozen", targets: plan.targets.map((target, i) => ({ ...target, model_id: models.targets[i].resolved_model })), freeze: { manifest: "freeze-manifest.json", frozen_at: "2026-11-10T00:00:00Z", artifact_set_sha256: "0".repeat(64), required_artifact_classes: [...FROZEN_ARTIFACT_CLASSES] } };
    const metrics = buildPromptMetrics(prompts, { plan, packet });
    const cost = buildCostEstimate({ plan, metricsPacket: metrics, modelResolutions: models, outputTokensPerRequestCeiling: 16384, inputContingencyPercent: 10, estimatedAt: `${models.catalog_checked_on}T00:00:00Z` });
    fs.writeFileSync(path.join(packageDir, "plan.json"), JSON.stringify(frozen));
    Object.assign(plan, frozen);
    fs.mkdirSync(path.join(packageDir, "private/prompts"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "private/prompts/calibration.jsonl"), `${prompts.map(JSON.stringify).join("\n")}\n`);
    fs.mkdirSync(path.join(packageDir, "private/contexts"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "private/contexts/calibration-metrics.json"), JSON.stringify(metrics));
    fs.writeFileSync(path.join(packageDir, "model-resolutions.json"), `${JSON.stringify(models, null, 2)}\n`);
    fs.writeFileSync(path.join(packageDir, "cost-estimate.json"), `${JSON.stringify(cost, null, 2)}\n`);
    fs.writeFileSync(path.join(packageDir, "README.md"), "# Disposable synthetic fixture\n");
    const testsDir = path.join(root, "docai-http/tools/tests");
    fs.mkdirSync(testsDir, { recursive: true });
    for (const name of fs.readdirSync(import.meta.dirname).filter(name => /^openapi-comparison-v3-calibration4-.*\.test\.mjs$/.test(name) || /^calibration4-.*-helpers\.mjs$/.test(name))) {
      fs.copyFileSync(path.join(import.meta.dirname, name), path.join(testsDir, name));
    }
    revision = runner.buildRunnerRevision();
    const ruby = spawnSync("ruby", ["-rrbconfig", "-e", "print RbConfig.ruby"], { encoding: "utf8" });
    if (ruby.status !== 0) throw new Error("local Ruby identity unavailable");
    function execution(execute, store = new runner.MemoryRunStore(), validateFreezeArtifacts = () => true) {
      const adapters = Object.fromEntries(plan.targets.map(({ provider }) => [provider, { provider, api_key_status: "present", execute }]));
      const livePreflight = runner.validateLivePreflight({ plan: frozen, prompts, adapters, modelResolutions: models, costEstimate: cost, metricsPacket: metrics, freezeManifest: { benchmark_id: plan.benchmark_id, plan_version: plan.plan_version, status: "frozen", runtime_environment: { ruby: { executable: ruby.stdout } } }, validateFreezeArtifacts, runnerRevision: revision });
      return { plan: frozen, prompts, adapters, modelResolutions: models, tasks, store, livePreflight, runnerRevision: revision, clock: () => "2026-11-09T00:00:00.000Z", execute: true, approval: plan.plan_version };
    }
    const { normalizeProviderUsage } = await load("provider-usage");
    const { providerCompletion } = await load("provider-adapter-utils");
    function response(prompt, usage = { input_tokens: 1, output_tokens: 2, total_tokens: 3 }, extra = {}) {
      const provider = prompt.target.provider;
      const model = models.targets.find((target) => target.target_id === prompt.target.id).resolved_model;
      const nativeUsage = provider === "anthropic" ? { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
        : provider === "google" ? { total_input_tokens: usage.input_tokens, total_output_tokens: usage.output_tokens, total_thought_tokens: 0, total_cached_tokens: 0, total_tool_use_tokens: 0, total_tokens: usage.total_tokens } : { input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, ...usage };
      const raw = { model, ...(provider === "anthropic" ? { stop_reason: "end_turn" } : { status: "completed" }), usage: nativeUsage, ...extra };
      return { content_text: JSON.stringify(tasks.find((task) => task.id === prompt.task_id).private.expected_outcome), completion: providerCompletion(provider, raw), usage: normalizeProviderUsage({ provider, nativeUsage: raw.usage }), resolved_model: model, provider_request_id: "synthetic-request", raw_response: raw };
    }
    const ledger = (store) => ({ plan, prompts, tasks, attempts: store.listAttempts(), runs: store.listRuns(), checkpoint: store.readCheckpoint(), expectedRunnerRevision: revision });
    return { root, packageDir, load, runner, verifier, errors, plan, prompts, tasks, execution, response, ledger, cost, models, metrics,
      setNow: value => { now = HostDate.parse(value); }, cleanup: () => { restoreClock(); fs.rmSync(root, { recursive: true, force: true }); } };
  } catch (error) { restoreClock(); fs.rmSync(root, { recursive: true, force: true }); throw error; }
}

export function watchWrites(store) {
  let writes = 0;
  for (const name of ["appendAttempt", "appendRun", "writeCheckpoint", "initialize"]) {
    if (typeof store[name] !== "function") continue;
    const original = store[name].bind(store);
    store[name] = (...args) => { writes += 1; return original(...args); };
  }
  return () => writes;
}

export function predecessor(ledger) {
  const terminal = ledger.attempts.at(-1);
  const { record_version, ended_at, status, provider_call, response, error, accounting, ...identity } = terminal;
  return { ...ledger.checkpoint, status: "open", stop_reason: null, completed_run_ids: ledger.runs.slice(0, -1).map((run) => run.run_id), in_flight_attempt: { intent_version: "1", ...identity }, updated_at: terminal.started_at };
}

