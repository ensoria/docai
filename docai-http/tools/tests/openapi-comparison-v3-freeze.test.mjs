import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildCostEstimate,
  validateCostEstimate,
  validateModelResolutions,
} from "../estimate-openapi-comparison-v3-cost.mjs";
import {
  REQUIRED_ARTIFACT_CLASSES,
  V2_IMPORTED_DEPENDENCIES,
  buildCalibrationFreeze,
  buildFreezeManifest,
  collectFreezeArtifacts,
  sha256File,
  validateFrozenArtifacts,
  validateFrozenBenchmarkOutputs,
} from "../freeze-openapi-comparison-v3.mjs";
import * as freezeTools from "../freeze-openapi-comparison-v3.mjs";
import { CALIBRATION_RUNNER_REVISION_FILES } from "../openapi-comparison-v3-runner.mjs";
import { BENCHMARK_DIR, buildCalibrationSchedule, readV3Plan } from "../openapi-comparison-v3-utils.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const CATALOG_CHECKED_ON = "2026-09-03";
const FROZEN_AT = "2026-09-03T00:00:00Z";
const PLAN = readV3Plan();

test("model resolutions preserve the exact official catalog panel and provider request settings", () => {
  const packet = modelResolutions();

  assert.doesNotThrow(() => validateModelResolutions(PLAN, packet));
  assert.deepEqual(
    packet.targets.map((target) => [
      target.target_id,
      target.resolved_model,
      target.model_limits.max_output_tokens,
      target.pricing_usd_per_million_tokens,
    ]),
    [
      ["openai-frontier", "gpt-5.6-sol", 128_000, { input: 4, output: 20 }],
      ["anthropic-balanced", "claude-sonnet-5", 128_000, { input: 2, output: 10 }],
      ["google-stable-agentic", "gemini-3.7-flash", 65_536, { input: 0.75, output: 3.75 }],
    ],
  );
  assert.equal(packet.catalog_checked_on, CATALOG_CHECKED_ON);
  assert.deepEqual(packet.announced_future_pricing, [{
    target_id: "google-stable-agentic",
    effective_from: "2027-01-01",
    pricing_usd_per_million_tokens: { input: 1.5, output: 7.5 },
  }]);
  assert.equal(packet.pricing_notes.openai_promotion_available_at_least_through, "2026-11-21");
  assert.equal(packet.pricing_notes.google_promotion_effective_through, "2026-12-31");
});

test("model validation rejects catalog, price, output, reasoning, and prompt-mode drift", () => {
  const mutations = [
    ["model ID", (packet) => { packet.targets[0].resolved_model = "gpt-latest"; }],
    ["output capability", (packet) => { packet.targets[2].model_limits.max_output_tokens = 128_000; }],
    ["calibration output ceiling", (packet) => { packet.targets[1].request_settings.max_output_tokens = 4096; }],
    ["output parameter", (packet) => { packet.targets[1].request_settings.output_token_parameter = "max_output_tokens"; }],
    ["reasoning", (packet) => { packet.targets[0].request_settings.reasoning_effort = "high"; }],
    ["thinking", (packet) => { packet.targets[1].request_settings.thinking = "enabled"; }],
    ["thinking level", (packet) => { packet.targets[2].request_settings.thinking_level = "high"; }],
    ["JSON mode", (packet) => { packet.targets[2].request_settings.json_output_mode = "schema"; }],
    ["provider price", (packet) => { packet.targets[1].pricing_usd_per_million_tokens = { input: 4, output: 20 }; }],
    ["catalog date", (packet) => { packet.catalog_checked_on = "2026-09-02"; }],
    ["future Google rate", (packet) => { packet.announced_future_pricing[0].pricing_usd_per_million_tokens.output = 3.75; }],
  ];

  for (const [label, mutate] of mutations) {
    const packet = modelResolutions();
    mutate(packet);
    assert.throws(() => validateModelResolutions(PLAN, packet), /model resolution|catalog|pricing|request settings/, label);
  }
});

test("model validation rejects duplicate targets, aliases, extra fields, and non-plain input", () => {
  const duplicate = modelResolutions();
  duplicate.targets[2] = structuredClone(duplicate.targets[0]);
  assert.throws(
    () => validateModelResolutions(PLAN, duplicate),
    /exactly three approved targets|model resolution/,
  );

  const alias = modelResolutions();
  alias.targets[0].requested_model = "gpt-5.6-sol-latest";
  assert.throws(() => validateModelResolutions(PLAN, alias), /model resolution/);

  const extra = modelResolutions();
  extra.targets[0].normalized_pricing = { input: 1, output: 1 };
  assert.throws(() => validateModelResolutions(PLAN, extra), /unexpected or missing fields/);

  const accessor = modelResolutions();
  Object.defineProperty(accessor.targets[0], "requested_model", {
    enumerable: true,
    get() { return "gpt-5.6-sol"; },
  });
  assert.throws(() => validateModelResolutions(PLAN, accessor), /enumerable data properties only/);
});

test("cost estimation uses characters divided by four, per-request contingency, and provider-specific rates", () => {
  const estimate = buildCostEstimate({
    plan: PLAN,
    metricsPacket: syntheticMetrics(),
    modelResolutions: modelResolutions(),
    outputTokensPerRequestCeiling: 8192,
    inputContingencyPercent: 10,
    estimatedAt: FROZEN_AT,
  });

  assert.equal(estimate.calibration.requests, 24);
  assert.equal(estimate.calibration.input_tokens_estimate, 25);
  assert.equal(estimate.calibration.input_tokens_ceiling, 49);
  assert.equal(estimate.calibration.output_tokens_ceiling, 196_608);
  assert.equal(estimate.calibration.total_tokens_ceiling, 196_657);
  assert.equal(estimate.calibration.cost_ceiling_usd, 2.211952);
  assert.deepEqual(
    estimate.calibration.targets.map((target) => ({
      target_id: target.target_id,
      requests: target.requests,
      input_tokens_estimate: target.input_tokens_estimate,
      input_tokens_ceiling: target.input_tokens_ceiling,
      output_tokens_ceiling: target.output_tokens_ceiling,
      price: target.pricing_usd_per_million_tokens,
      cost: target.cost_ceiling_usd,
    })),
    [
      {
        target_id: "openai-frontier",
        requests: 8,
        input_tokens_estimate: 9,
        input_tokens_ceiling: 17,
        output_tokens_ceiling: 65_536,
        price: { input: 4, output: 20 },
        cost: 1.310788,
      },
      {
        target_id: "anthropic-balanced",
        requests: 8,
        input_tokens_estimate: 8,
        input_tokens_ceiling: 16,
        output_tokens_ceiling: 65_536,
        price: { input: 2, output: 10 },
        cost: 0.655392,
      },
      {
        target_id: "google-stable-agentic",
        requests: 8,
        input_tokens_estimate: 8,
        input_tokens_ceiling: 16,
        output_tokens_ceiling: 65_536,
        price: { input: 0.75, output: 3.75 },
        cost: 0.245772,
      },
    ],
  );
  assert.doesNotThrow(() => validateCostEstimate(PLAN, estimate, modelResolutions()));
});

test("cost estimation rejects a noncanonical request count and a token estimate not derived from characters", () => {
  const short = syntheticMetrics();
  short.rows.pop();
  assert.throws(
    () => buildCostEstimate(costInputs(short)),
    /exactly 24|canonical calibration/,
  );

  const inconsistent = syntheticMetrics();
  inconsistent.rows[0].prompt_approx_tokens_chars_div_4 = 1;
  assert.throws(
    () => buildCostEstimate(costInputs(inconsistent)),
    /ceil\(characters \/ 4\)/,
  );
});

test("cost estimation rejects fixed-method drift, noncanonical rows, and aggregate tampering", () => {
  assert.throws(
    () => buildCostEstimate({ ...costInputs(syntheticMetrics()), outputTokensPerRequestCeiling: 4096 }),
    /output-token ceiling/,
  );
  assert.throws(
    () => buildCostEstimate({ ...costInputs(syntheticMetrics()), inputContingencyPercent: 0 }),
    /input contingency/,
  );

  const extraField = syntheticMetrics();
  extraField.rows[0].provider_tokens = 123;
  assert.throws(
    () => buildCostEstimate(costInputs(extraField)),
    /cost metrics row 1 has unexpected or missing fields/,
  );

  const estimate = buildCostEstimate(costInputs(syntheticMetrics()));
  estimate.calibration.targets[0].input_tokens_ceiling += 1;
  estimate.calibration.targets[0].total_tokens_ceiling += 1;
  estimate.calibration.input_tokens_ceiling += 1;
  estimate.calibration.total_tokens_ceiling += 1;
  assert.throws(
    () => validateCostEstimate(PLAN, estimate, modelResolutions()),
    /cost_ceiling_usd/,
  );
});

test("checked-in cost artifacts reproduce the frozen 24-request ceiling", () => {
  const plan = readV3Plan();
  const models = readJson(path.join(BENCHMARK_DIR, "model-resolutions.json"));
  const estimate = readJson(path.join(BENCHMARK_DIR, "cost-estimate.json"));

  assert.doesNotThrow(() => validateModelResolutions(plan, models));
  assert.doesNotThrow(() => validateCostEstimate(plan, estimate, models));
  assert.equal(estimate.calibration.requests, 24);
  assert.equal(estimate.calibration.input_tokens_estimate, 114_678);
  assert.equal(estimate.calibration.input_tokens_ceiling, 126_162);
  assert.equal(estimate.calibration.output_tokens_ceiling, 196_608);
  assert.equal(estimate.calibration.total_tokens_ceiling, 322_770);
  assert.equal(estimate.calibration.cost_ceiling_usd, 2.4957045);
  assert.deepEqual(
    estimate.calibration.targets.map((target) => target.cost_ceiling_usd),
    [1.478936, 0.739468, 0.2773005],
  );
});

test("freeze manifest validates every required class and rejects changed public content", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const manifest = buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    });

    assert.doesNotThrow(() => validateFrozenArtifacts({ plan, manifest, rootDir: root }));
    assert.deepEqual(
      [...new Set(manifest.artifacts.map((artifact) => artifact.class))].sort(),
      [...REQUIRED_ARTIFACT_CLASSES].sort(),
    );

    const publicArtifact = manifest.artifacts.find((artifact) => (
      artifact.visibility === "public" && artifact.path.endsWith(".txt")
    ));
    assert.ok(publicArtifact);
    fs.appendFileSync(path.join(root, publicArtifact.path), "changed\n");
    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest, rootDir: root }),
      /SHA-256 mismatch/,
    );
  });
});

test("default freeze validation tolerates absent ignored private inputs but verifies them when present", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const manifest = buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    });
    const privateArtifact = manifest.artifacts.find((artifact) => artifact.visibility === "private");
    const privateFile = path.join(root, privateArtifact.path);

    fs.unlinkSync(privateFile);
    assert.doesNotThrow(() => validateFrozenArtifacts({ plan, manifest, rootDir: root }));
    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest, rootDir: root, privateRequired: true }),
      /private freeze artifact is missing/,
    );

    fs.writeFileSync(privateFile, "changed private content\n");
    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest, rootDir: root }),
      /SHA-256 mismatch/,
    );
  });
});

test("freeze validation rejects missing public files and missing private manifest entries", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const manifest = buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    });
    const publicArtifact = manifest.artifacts.find((artifact) => artifact.visibility === "public");
    fs.unlinkSync(path.join(root, publicArtifact.path));
    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest, rootDir: root }),
      /freeze artifact is missing/,
    );

    const privateIndex = manifest.artifacts.findIndex((artifact) => artifact.visibility === "private");
    manifest.artifacts.splice(privateIndex, 1);
    manifest.artifact_count -= 1;
    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest, rootDir: root }),
      /missing required artifact class|incomplete freeze boundary/,
    );
  });
});

test("freeze validation rejects duplicate, misclassified, and incomplete manifest entries", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const manifest = buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    });

    const duplicate = structuredClone(manifest);
    duplicate.artifacts.push(structuredClone(duplicate.artifacts[0]));
    duplicate.artifact_count += 1;
    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest: duplicate, rootDir: root }),
      /duplicate freeze artifact path/,
    );

    const misclassified = structuredClone(manifest);
    misclassified.artifacts[0].class = "cost-estimate";
    assert.throws(
      () => validateFrozenArtifacts({
        plan,
        manifest: misclassified,
        rootDir: root,
        expectedArtifacts: artifacts,
      }),
      /misclassified freeze artifact/,
    );

    const extraPath = "artifacts/additional-boundary-file.txt";
    fs.writeFileSync(path.join(root, extraPath), "additional boundary\n");
    const expectedArtifacts = [
      ...artifacts,
      { class: artifacts[0].class, path: extraPath, visibility: "public" },
    ];
    assert.throws(
      () => validateFrozenArtifacts({
        plan,
        manifest,
        rootDir: root,
        expectedArtifacts,
      }),
      /incomplete freeze boundary/,
    );
  });
});

test("freeze creation rejects unsafe, symlinked, and self-referential paths", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const unsafePaths = ["../outside.txt", "/absolute.txt", "artifacts\\windows.txt"];
    for (const unsafePath of unsafePaths) {
      const changed = structuredClone(artifacts);
      changed[0].path = unsafePath;
      assert.throws(
        () => buildFreezeManifest({
          plan,
          artifacts: changed,
          rootDir: root,
          frozenAt: plan.freeze.frozen_at,
        }),
        /artifact path|canonical relative path|escapes root/,
        unsafePath,
      );
    }

    const linkedPath = path.join(root, "artifacts", "linked.txt");
    fs.symlinkSync(path.join(root, artifacts[1].path), linkedPath);
    const linked = structuredClone(artifacts);
    linked[0].path = "artifacts/linked.txt";
    assert.throws(
      () => buildFreezeManifest({
        plan,
        artifacts: linked,
        rootDir: root,
        frozenAt: plan.freeze.frozen_at,
      }),
      /symbolic link/,
    );

    fs.writeFileSync(path.join(root, "freeze-manifest.json"), "{}\n");
    assert.throws(
      () => buildFreezeManifest({
        plan,
        artifacts: [
          ...artifacts,
          {
            class: "calibration-schedule-and-gate",
            path: "freeze-manifest.json",
            visibility: "public",
          },
        ],
        rootDir: root,
        frozenAt: plan.freeze.frozen_at,
      }),
      /must not include itself|self-referential/,
    );
  });
});

test("freeze creation and validation reject noncanonical JSON and manifest data", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    fs.writeFileSync(path.join(root, "plan.json"), JSON.stringify(plan));
    assert.throws(
      () => buildFreezeManifest({
        plan,
        artifacts,
        rootDir: root,
        frozenAt: plan.freeze.frozen_at,
      }),
      /canonical JSON/,
    );

    fs.writeFileSync(path.join(root, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
    const manifest = buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    });
    manifest.unapproved = true;
    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest, rootDir: root }),
      /freeze manifest has unexpected or missing fields/,
    );
  });
});

test("freeze creation rejects malformed v3-owned JSON", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    fs.writeFileSync(path.join(root, "plan.json"), "{invalid\n");
    assert.throws(
      () => buildFreezeManifest({
        plan,
        artifacts,
        rootDir: root,
        frozenAt: plan.freeze.frozen_at,
      }),
      /valid JSON/,
    );
  });
});

test("freeze validation rejects a malformed v3-owned JSONL row even when its hash matches", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const artifact = artifacts[2];
    artifact.path = "artifacts/malformed.jsonl";
    const file = path.join(root, artifact.path);
    fs.writeFileSync(file, '{"valid":true}\n');
    const manifest = buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    });
    fs.writeFileSync(file, '{"valid":true}\n{invalid\n');
    updateManifestHash(manifest, artifact.path, file);

    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest, rootDir: root }),
      /valid JSON.*line 2/,
    );
  });
});

test("likely-secret scanning fails closed without flagging hashes, model IDs, or benchmark prose", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const target = path.join(root, artifacts[1].path);
    fs.writeFileSync(target, [
      "gpt-5.6-sol claude-sonnet-5 gemini-3.7-flash",
      "13e7d8ef4a20ca8fe5aa60a9834a1ee167edfe4b2c0eb2ab392cade265ef627e",
      "Return exactly the required JSON object with no surrounding prose.",
      "",
    ].join("\n"));
    assert.doesNotThrow(() => buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    }));

    const secrets = [
      "OPENAI_API_KEY=definitely-secret-value-123456",
      `sk-proj-${"A".repeat(32)}`,
      `AIza${"B".repeat(35)}`,
      `Authorization: Bearer ${"c".repeat(32)}`,
    ];
    for (const secret of secrets) {
      fs.writeFileSync(target, `${secret}\n`);
      assert.throws(
        () => buildFreezeManifest({ plan, artifacts, rootDir: root, frozenAt: plan.freeze.frozen_at }),
        /possible secret/,
        secret.slice(0, 12),
      );
    }

    fs.writeFileSync(target, Buffer.from([0xc3, 0x28]));
    assert.throws(
      () => buildFreezeManifest({ plan, artifacts, rootDir: root, frozenAt: plan.freeze.frozen_at }),
      /cannot be safely scanned as UTF-8 text/,
    );
  });
});

test("likely-secret scanning catches quoted JSON and JSONL provider-key properties", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const cases = [
      ["artifacts/provider-key.json", '{\n  "OPENAI_API_KEY": "definitely-secret-value-123456"\n}\n'],
      ["artifacts/provider-key.jsonl", '{"ANTHROPIC_API_KEY":"definitely-secret-value-123456"}\n'],
    ];
    for (const [logicalPath, content] of cases) {
      const changed = structuredClone(artifacts);
      changed[2].path = logicalPath;
      fs.writeFileSync(path.join(root, logicalPath), content);
      assert.throws(
        () => buildFreezeManifest({
          plan,
          artifacts: changed,
          rootDir: root,
          frozenAt: plan.freeze.frozen_at,
        }),
        /possible secret \(provider API key assignment\)/,
        logicalPath,
      );
    }
  });
});

test("quoted provider-key scanning allows placeholders and SHA-256 values", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    const changed = structuredClone(artifacts);
    changed[2].path = "artifacts/provider-placeholders.jsonl";
    fs.writeFileSync(path.join(root, changed[2].path), [
      '{"OPENAI_API_KEY":"${OPENAI_API_KEY}"}',
      '{"GOOGLE_API_KEY":"<YOUR_GOOGLE_API_KEY>"}',
      `{"ANTHROPIC_API_KEY":"${"a".repeat(64)}"}`,
      "",
    ].join("\n"));

    assert.doesNotThrow(() => buildFreezeManifest({
      plan,
      artifacts: changed,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    }));
  });
});

test("freeze collection covers every runner dependency, Task 9 strict JSON, and exact imported v2 boundary", () => {
  const artifacts = collectFreezeArtifacts({
    repositoryRoot: REPOSITORY_ROOT,
    privateRequired: true,
  });
  const byPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]));

  assert.deepEqual(
    [...new Set(artifacts.map((artifact) => artifact.class))].sort(),
    [...REQUIRED_ARTIFACT_CLASSES].sort(),
  );
  CALIBRATION_RUNNER_REVISION_FILES
    .filter((file) => file !== "docai-http/benchmarks/openapi-comparison/v3/freeze-manifest.json")
    .forEach((file) => assert.ok(byPath.has(file), file));
  assert.equal(
    byPath.get("docai-http/tools/openapi-comparison-v3-strict-json.mjs")?.class,
    "calibration-schedule-and-gate",
  );
  assert.deepEqual(
    artifacts
      .filter((artifact) => artifact.class === "imported-v2-dependencies")
      .map((artifact) => artifact.path)
      .sort(),
    [...V2_IMPORTED_DEPENDENCIES].sort(),
  );
});

test("manifest records unchanged imported v2 SHA-256 values", () => {
  const plan = frozenPlan();
  const artifacts = collectFreezeArtifacts({
    repositoryRoot: REPOSITORY_ROOT,
    privateRequired: true,
  });
  const manifest = buildFreezeManifest({
    plan,
    artifacts,
    rootDir: REPOSITORY_ROOT,
    frozenAt: plan.freeze.frozen_at,
  });

  for (const logicalPath of V2_IMPORTED_DEPENDENCIES) {
    const entry = manifest.artifacts.find((artifact) => artifact.path === logicalPath);
    assert.equal(entry?.class, "imported-v2-dependencies", logicalPath);
    assert.equal(entry?.sha256, sha256File(path.join(REPOSITORY_ROOT, logicalPath)), logicalPath);
  }
  assert.doesNotThrow(() => validateFrozenArtifacts({
    plan,
    manifest,
    rootDir: REPOSITORY_ROOT,
    privateRequired: true,
  }));
});

test("calibration freeze derives the frozen plan and its matching manifest as one boundary", () => {
  withFreezeFixture(({ root, artifacts }) => {
    const draft = draftPlan();
    const planArtifact = artifacts.find((artifact) => artifact.path === "plan.json");
    fs.writeFileSync(path.join(root, planArtifact.path), `${JSON.stringify(draft, null, 2)}\n`);

    const frozen = buildCalibrationFreeze({
      plan: draft,
      modelResolutions: modelResolutions(),
      artifacts,
      rootDir: root,
      frozenAt: FROZEN_AT,
      planArtifactPath: planArtifact.path,
    });

    assert.equal(draft.status, "calibration-draft");
    assert.equal(frozen.plan.status, "calibration-frozen");
    assert.deepEqual(
      frozen.plan.targets.map((target) => target.model_id),
      ["gpt-5.6-sol", "claude-sonnet-5", "gemini-3.7-flash"],
    );
    const sealedArtifacts = frozen.manifest.artifacts
      .filter((artifact) => artifact.path !== planArtifact.path);
    const expectedSeal = crypto.createHash("sha256")
      .update(`${JSON.stringify(sealedArtifacts, null, 2)}\n`)
      .digest("hex");
    assert.equal(frozen.plan.freeze.artifact_set_sha256, expectedSeal);
    fs.writeFileSync(path.join(root, planArtifact.path), `${JSON.stringify(frozen.plan, null, 2)}\n`);
    assert.doesNotThrow(() => validateFrozenArtifacts({
      plan: frozen.plan,
      manifest: frozen.manifest,
      rootDir: root,
      privateRequired: true,
    }));
  });
});

test("calibration freeze leaves the draft unchanged when the manifest cannot pass", () => {
  withFreezeFixture(({ root, artifacts }) => {
    const draft = draftPlan();
    const missing = artifacts.find((artifact) => artifact.path !== "plan.json");
    fs.unlinkSync(path.join(root, missing.path));

    assert.throws(
      () => buildCalibrationFreeze({
        plan: draft,
        modelResolutions: modelResolutions(),
        artifacts,
        rootDir: root,
        frozenAt: FROZEN_AT,
        planArtifactPath: "plan.json",
      }),
      /freeze artifact is missing/,
    );
    assert.equal(draft.status, "calibration-draft");
    assert.equal(Object.hasOwn(draft, "freeze"), false);
  });
});

test("freeze publication installs the manifest before the frozen plan", () => {
  assert.equal(typeof freezeTools.publishFreezePair, "function");
  withPublicationFixture(({ root, planFile, manifestFile, frozen }) => {
    const observations = [];
    const fsOps = Object.create(fs);
    fsOps.renameSync = (source, destination) => {
      fs.renameSync(source, destination);
      if (destination === manifestFile) {
        observations.push("manifest");
        const visiblePlan = readJson(planFile);
        assert.equal(visiblePlan.status, "calibration-draft");
        assert.throws(
          () => validateFrozenArtifacts({
            plan: visiblePlan,
            manifest: readJson(manifestFile),
            rootDir: root,
            privateRequired: true,
          }),
          /status must be calibration-frozen/,
        );
      }
      if (destination === planFile) {
        observations.push("plan");
        assert.doesNotThrow(() => validateFrozenArtifacts({
          plan: readJson(planFile),
          manifest: readJson(manifestFile),
          rootDir: root,
          privateRequired: true,
        }));
      }
    };

    freezeTools.publishFreezePair({
      ...frozen,
      planFile,
      manifestFile,
      fsOps,
      validatePrepared: () => true,
      validatePublished: () => true,
    });

    assert.deepEqual(observations, ["manifest", "plan"]);
  });
});

test("freeze publication durably syncs each file and directory in acceptance order", () => {
  withPublicationFixture(({ planFile, manifestFile, frozen }) => {
    const operations = [];
    const opened = new Map();
    const fsOps = Object.create(fs);
    fsOps.writeFileSync = (file, ...args) => {
      if (String(file).endsWith(".tmp")) {
        operations.push(`write:${String(file).startsWith(manifestFile) ? "manifest" : "plan"}`);
      }
      return fs.writeFileSync(file, ...args);
    };
    fsOps.openSync = (file, ...args) => {
      const descriptor = fs.openSync(file, ...args);
      opened.set(descriptor, String(file));
      return descriptor;
    };
    fsOps.fsyncSync = (descriptor) => {
      const file = opened.get(descriptor);
      if (file) {
        const kind = file === path.dirname(planFile)
          ? "directory"
          : file.startsWith(manifestFile) ? "manifest" : "plan";
        operations.push(`fsync:${kind}`);
      }
      return fs.fsyncSync(descriptor);
    };
    fsOps.closeSync = (descriptor) => {
      opened.delete(descriptor);
      return fs.closeSync(descriptor);
    };
    fsOps.renameSync = (source, destination) => {
      operations.push(`rename:${destination === manifestFile ? "manifest" : "plan"}`);
      return fs.renameSync(source, destination);
    };

    freezeTools.publishFreezePair({
      ...frozen,
      planFile,
      manifestFile,
      fsOps,
      validatePrepared: () => true,
      validatePublished: () => true,
    });

    assert.deepEqual(operations, [
      "write:manifest",
      "fsync:manifest",
      "write:plan",
      "fsync:plan",
      "rename:manifest",
      "fsync:directory",
      "rename:plan",
      "fsync:directory",
    ]);
  });
});

test("freeze publication rolls back failures at every write, sync, and rename stage", () => {
  for (const failAt of [1, 2, 3, 4, 5, 6, 7, 8]) {
    withPublicationFixture(({ planFile, manifestFile, frozen }) => {
      const originalPlan = fs.readFileSync(planFile);
      const originalManifest = fs.readFileSync(manifestFile);
      let stage = 0;
      let failed = false;
      const fsOps = Object.create(fs);
      fsOps.writeFileSync = (file, ...args) => {
        if (!failed && String(file).endsWith(".tmp")) {
          stage += 1;
          if (stage === failAt) {
            failed = true;
            throw new Error(`injected filesystem failure ${failAt}`);
          }
        }
        return fs.writeFileSync(file, ...args);
      };
      fsOps.renameSync = (source, destination) => {
        if (!failed) {
          stage += 1;
          if (stage === failAt) {
            failed = true;
            throw new Error(`injected filesystem failure ${failAt}`);
          }
        }
        return fs.renameSync(source, destination);
      };
      fsOps.fsyncSync = (descriptor) => {
        if (!failed) {
          stage += 1;
          if (stage === failAt) {
            failed = true;
            throw new Error(`injected filesystem failure ${failAt}`);
          }
        }
        return fs.fsyncSync(descriptor);
      };

      assert.throws(
        () => freezeTools.publishFreezePair({
          ...frozen,
          planFile,
          manifestFile,
          fsOps,
          validatePrepared: () => true,
          validatePublished: () => true,
        }),
        new RegExp(`injected filesystem failure ${failAt}`),
      );
      assert.deepEqual(fs.readFileSync(planFile), originalPlan, `plan at stage ${failAt}`);
      assert.deepEqual(fs.readFileSync(manifestFile), originalManifest, `manifest at stage ${failAt}`);
      assert.deepEqual(
        fs.readdirSync(path.dirname(planFile)).filter((file) => file.endsWith(".tmp")),
        [],
        `temporary files at stage ${failAt}`,
      );
    });
  }
});

test("freeze publication rolls back both files when final validation fails", () => {
  withPublicationFixture(({ planFile, manifestFile, frozen }) => {
    const originalPlan = fs.readFileSync(planFile);
    const originalManifest = fs.readFileSync(manifestFile);

    assert.throws(
      () => freezeTools.publishFreezePair({
        ...frozen,
        planFile,
        manifestFile,
        validatePrepared: () => true,
        validatePublished: () => { throw new Error("injected final validation failure"); },
      }),
      /injected final validation failure/,
    );
    assert.deepEqual(fs.readFileSync(planFile), originalPlan);
    assert.deepEqual(fs.readFileSync(manifestFile), originalManifest);
  });
});

test("freeze publication refuses to replace an already-frozen destination", () => {
  withPublicationFixture(({ planFile, manifestFile, frozen }) => {
    fs.writeFileSync(planFile, `${JSON.stringify(frozen.plan, null, 2)}\n`);
    fs.writeFileSync(manifestFile, `${JSON.stringify(frozen.manifest, null, 2)}\n`);
    const originalPlan = fs.readFileSync(planFile);
    const originalManifest = fs.readFileSync(manifestFile);

    assert.throws(
      () => freezeTools.publishFreezePair({
        ...frozen,
        planFile,
        manifestFile,
        validatePrepared: () => true,
        validatePublished: () => true,
      }),
      /frozen calibration identity 3\.0\.0-calibration\.1 is immutable/,
    );
    assert.deepEqual(fs.readFileSync(planFile), originalPlan);
    assert.deepEqual(fs.readFileSync(manifestFile), originalManifest);
  });
});

test("freeze publication refuses a retained identity after plan status downgrade", () => {
  withPublicationFixture(({ planFile, manifestFile, frozen }) => {
    fs.writeFileSync(manifestFile, `${JSON.stringify(frozen.manifest, null, 2)}\n`);
    const originalPlan = fs.readFileSync(planFile);
    const originalManifest = fs.readFileSync(manifestFile);

    assert.throws(
      () => freezeTools.publishFreezePair({
        ...frozen,
        planFile,
        manifestFile,
        validatePrepared: () => true,
        validatePublished: () => true,
      }),
      /frozen calibration identity 3\.0\.0-calibration\.1 is immutable/,
    );
    assert.deepEqual(fs.readFileSync(planFile), originalPlan);
    assert.deepEqual(fs.readFileSync(manifestFile), originalManifest);
  });
});

test("calibration freeze builder rejects an already-frozen plan identity", () => {
  withFreezeFixture(({ root, plan, artifacts }) => {
    assert.throws(
      () => buildCalibrationFreeze({
        plan,
        modelResolutions: modelResolutions(),
        artifacts,
        rootDir: root,
        frozenAt: FROZEN_AT,
        planArtifactPath: "plan.json",
      }),
      /calibration freeze requires a calibration-draft plan/,
    );
  });
});

test("calibration freeze builder refuses a retained identity after plan status downgrade", () => {
  withFreezeFixture(({ root, artifacts }) => {
    const draft = draftPlan();
    fs.writeFileSync(path.join(root, "freeze-manifest.json"), `${JSON.stringify({
      benchmark_id: draft.benchmark_id,
      plan_version: draft.plan_version,
    }, null, 2)}\n`);

    assert.throws(
      () => buildCalibrationFreeze({
        plan: draft,
        modelResolutions: modelResolutions(),
        artifacts,
        rootDir: root,
        frozenAt: FROZEN_AT,
        planArtifactPath: "plan.json",
      }),
      /frozen calibration identity 3\.0\.0-calibration\.1 is immutable/,
    );
  });
});

test("freeze CLI never rebaselines changed bytes under an already-frozen plan identity", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-freeze-cli-")));
  try {
    fs.cpSync(path.join(REPOSITORY_ROOT, "docai-http"), path.join(root, "docai-http"), {
      recursive: true,
    });
    const benchmarkDir = path.join(root, "docai-http", "benchmarks", "openapi-comparison", "v3");
    const planFile = path.join(benchmarkDir, "plan.json");
    const manifestFile = path.join(benchmarkDir, "freeze-manifest.json");
    const coveredFile = path.join(root, "docai-http", "tools", "openapi-comparison-v3-parser.mjs");
    const originalPlan = fs.readFileSync(planFile);
    const originalManifest = fs.readFileSync(manifestFile);
    const downgradedPlan = readJson(planFile);
    downgradedPlan.status = "calibration-draft";
    downgradedPlan.targets.forEach((target) => { target.model_id = null; });
    delete downgradedPlan.freeze;
    fs.writeFileSync(planFile, `${JSON.stringify(downgradedPlan, null, 2)}\n`);
    const downgradedPlanBytes = fs.readFileSync(planFile);
    fs.appendFileSync(coveredFile, "\n// changed covered bytes\n");

    const result = spawnSync(
      process.execPath,
      [path.join(root, "docai-http", "tools", "freeze-openapi-comparison-v3.mjs"), "--write"],
      { cwd: root, encoding: "utf8" },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /frozen calibration identity 3\.0\.0-calibration\.1 is immutable/);
    assert.notDeepEqual(downgradedPlanBytes, originalPlan);
    assert.deepEqual(fs.readFileSync(planFile), downgradedPlanBytes);
    assert.deepEqual(fs.readFileSync(manifestFile), originalManifest);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("frozen manifest validation is independent of the process locale", () => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(REPOSITORY_ROOT, "docai-http", "tools", "freeze-openapi-comparison-v3.mjs"),
      "--check",
      "--private-required",
    ],
    {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      env: { ...process.env, LC_ALL: "tr_TR.UTF-8", LANG: "tr_TR.UTF-8" },
    },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("Live CLI rejects every canonical freeze-boundary violation before store or provider use", () => {
  const cases = [
    ["changed bytes", ({ root }) => {
      fs.appendFileSync(path.join(root, "docai-http", "tools", "openapi-comparison-v3-parser.mjs"), "\n// drift\n");
    }],
    ["reclassified entry", ({ manifest }) => {
      manifest.artifacts[0].class = "cost-estimate";
    }],
    ["omitted entry", ({ manifest }) => {
      manifest.artifacts.splice(0, 1);
      manifest.artifact_count -= 1;
    }],
    ["noncanonical v3 JSON", ({ root, manifest }) => {
      const logicalPath = "docai-http/benchmarks/openapi-comparison/v3/contracts.json";
      const file = path.join(root, logicalPath);
      fs.writeFileSync(file, JSON.stringify(readJson(file)));
      updateManifestHash(manifest, logicalPath, file);
    }],
    ["symlinked artifact", ({ root }) => {
      const file = path.join(root, "docai-http", "tools", "openapi-comparison-v3-parser.mjs");
      const target = `${file}.target`;
      fs.renameSync(file, target);
      fs.symlinkSync(target, file);
    }],
    ["secret-bearing artifact", ({ root, manifest }) => {
      const logicalPath = "docai-http/benchmarks/openapi-comparison/v3/ARTIFACT-CONTRACT.md";
      const file = path.join(root, logicalPath);
      fs.appendFileSync(file, '\n{"OPENAI_API_KEY":"definitely-secret-value-123456"}\n');
      updateManifestHash(manifest, logicalPath, file);
    }],
    ["rehashed changed artifact", ({ root, manifest }) => {
      const logicalPath = "docai-http/benchmarks/openapi-comparison/v3/README.md";
      const file = path.join(root, logicalPath);
      fs.appendFileSync(file, "\nrehashed drift\n");
      updateManifestHash(manifest, logicalPath, file);
    }],
  ];

  for (const [label, mutate] of cases) {
    withCopiedV3Repository(({ root, benchmarkDir, manifest, manifestFile }) => {
      mutate({ root, benchmarkDir, manifest, manifestFile });
      fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      const fetchBlocker = path.join(root, "fetch-blocker.mjs");
      fs.writeFileSync(fetchBlocker, [
        "globalThis.fetch = async () => {",
        '  throw new Error("TEST_PROVIDER_CALL_REACHED");',
        "};",
        "",
      ].join("\n"));

      const result = spawnSync(
        process.execPath,
        [path.join(root, "docai-http", "tools", "run-openapi-comparison-v3-calibration.mjs"), "--execute"],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            NODE_OPTIONS: `--import=${fetchBlocker}`,
            DOCAI_LIVE_LLM_APPROVED_CALIBRATION: "3.0.0-calibration.1",
            OPENAI_API_KEY: "test-openai-key",
            ANTHROPIC_API_KEY: "test-anthropic-key",
            GOOGLE_API_KEY: "test-google-key",
          },
        },
      );

      assert.notEqual(result.status, 0, label);
      assert.doesNotMatch(result.stderr, /TEST_PROVIDER_CALL_REACHED/, label);
      assert.equal(fs.existsSync(path.join(benchmarkDir, "private", "runs")), false, label);
      assert.equal(fs.existsSync(path.join(benchmarkDir, "private", "checkpoints")), false, label);
    });
  }
});

test("checked-in frozen outputs and manifest pass public and private-required validation", () => {
  const plan = readV3Plan();
  const manifest = readJson(path.join(BENCHMARK_DIR, "freeze-manifest.json"));

  assert.equal(plan.status, "calibration-frozen");
  assert.doesNotThrow(() => validateFrozenBenchmarkOutputs({
    plan,
    benchmarkDir: BENCHMARK_DIR,
    privateRequired: true,
  }));
  assert.doesNotThrow(() => validateFrozenArtifacts({
    plan,
    manifest,
    rootDir: REPOSITORY_ROOT,
    privateRequired: true,
  }));
});

function costInputs(metricsPacket) {
  return {
    plan: PLAN,
    metricsPacket,
    modelResolutions: modelResolutions(),
    outputTokensPerRequestCeiling: 8192,
    inputContingencyPercent: 10,
    estimatedAt: FROZEN_AT,
  };
}

function syntheticMetrics() {
  const rows = buildCalibrationSchedule(PLAN).map((row, index) => {
    const promptCharacters = index === 0 ? 5 : 4;
    return {
      ...row,
      prompt_sha256: "a".repeat(64),
      context_utf8_bytes: promptCharacters,
      context_characters: promptCharacters,
      context_approx_tokens_chars_div_4: Math.ceil(promptCharacters / 4),
      prompt_utf8_bytes: promptCharacters,
      prompt_characters: promptCharacters,
      prompt_approx_tokens_chars_div_4: Math.ceil(promptCharacters / 4),
    };
  });
  return {
    metric_version: "1",
    benchmark_id: PLAN.benchmark_id,
    plan_version: PLAN.plan_version,
    methodology: {
      context: "Exact documentation section supplied to the model.",
      prompt: "SYSTEM and USER message content joined with deterministic role labels.",
      characters: "Unicode code points.",
      approximate_tokens: "ceil(characters / 4); descriptive only, not a provider tokenizer count.",
      prompt_hash: "SHA-256 of the deterministic rendered prompt text.",
    },
    rows,
  };
}

function modelResolutions() {
  return {
    resolution_version: "1",
    benchmark_id: PLAN.benchmark_id,
    plan_version: PLAN.plan_version,
    status: "frozen",
    catalog_checked_on: CATALOG_CHECKED_ON,
    pricing_currency: "USD",
    pricing_unit: "per 1000000 tokens",
    pricing_basis: "current-standard-first-party-api-rates-effective-on-catalog-check-date",
    pricing_notes: {
      openai_promotion_available_at_least_through: "2026-11-21",
      google_promotion_effective_through: "2026-12-31",
    },
    announced_future_pricing: [{
      target_id: "google-stable-agentic",
      effective_from: "2027-01-01",
      pricing_usd_per_million_tokens: { input: 1.5, output: 7.5 },
    }],
    targets: [
      {
        target_id: "openai-frontier",
        provider: "openai",
        requested_model: "gpt-5.6-sol",
        resolved_model: "gpt-5.6-sol",
        resolution_kind: "exact-catalog-model-id",
        official_sources: [
          "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
          "https://developers.openai.com/api/docs/guides/latest-model",
        ],
        model_limits: { input_tokens: 1_050_000, max_output_tokens: 128_000 },
        pricing_usd_per_million_tokens: { input: 4, output: 20 },
        token_accounting: "openai-provider-specific",
        request_settings: {
          json_output_mode: "prompt-only",
          schema_constrained_output: false,
          sampling_parameters: "omitted",
          prompt_caching: false,
          tools: false,
          output_token_parameter: "max_output_tokens",
          max_output_tokens: 8192,
          reasoning_parameter: "reasoning.effort",
          reasoning_effort: "medium",
        },
      },
      {
        target_id: "anthropic-balanced",
        provider: "anthropic",
        requested_model: "claude-sonnet-5",
        resolved_model: "claude-sonnet-5",
        resolution_kind: "exact-pinned-model-id",
        official_sources: [
          "https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5",
          "https://platform.claude.com/docs/en/about-claude/pricing",
          "https://platform.claude.com/docs/en/build-with-claude/effort",
        ],
        model_limits: { input_tokens: 1_000_000, max_output_tokens: 128_000 },
        pricing_usd_per_million_tokens: { input: 2, output: 10 },
        token_accounting: "anthropic-provider-specific",
        request_settings: {
          json_output_mode: "prompt-only",
          schema_constrained_output: false,
          sampling_parameters: "omitted",
          prompt_caching: false,
          tools: false,
          output_token_parameter: "max_tokens",
          max_output_tokens: 8192,
          thinking_parameter: "thinking.type",
          thinking: "adaptive",
        },
      },
      {
        target_id: "google-stable-agentic",
        provider: "google",
        requested_model: "gemini-3.7-flash",
        resolved_model: "gemini-3.7-flash",
        resolution_kind: "exact-stable-model-id",
        official_sources: [
          "https://ai.google.dev/gemini-api/docs/latest-model",
          "https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash",
          "https://ai.google.dev/gemini-api/docs/pricing",
          "https://ai.google.dev/api/interactions-api",
        ],
        model_limits: { input_tokens: 1_048_576, max_output_tokens: 65_536 },
        pricing_usd_per_million_tokens: { input: 0.75, output: 3.75 },
        token_accounting: "google-provider-specific",
        request_settings: {
          json_output_mode: "prompt-only",
          schema_constrained_output: false,
          sampling_parameters: "omitted",
          prompt_caching: false,
          tools: false,
          grounding: false,
          output_token_parameter: "generation_config.max_output_tokens",
          max_output_tokens: 8192,
          thinking_parameter: "generation_config.thinking_level",
          thinking_level: "medium",
        },
      },
    ],
  };
}

function draftPlan() {
  const plan = structuredClone(PLAN);
  plan.status = "calibration-draft";
  plan.targets.forEach((target) => { target.model_id = null; });
  delete plan.freeze;
  return plan;
}

function frozenPlan() {
  const plan = draftPlan();
  plan.status = "calibration-frozen";
  const models = new Map(modelResolutions().targets.map((target) => [target.target_id, target.resolved_model]));
  plan.targets.forEach((target) => { target.model_id = models.get(target.id); });
  plan.freeze = {
    manifest: "freeze-manifest.json",
    frozen_at: FROZEN_AT,
    artifact_set_sha256: "a".repeat(64),
    required_artifact_classes: [...REQUIRED_ARTIFACT_CLASSES],
  };
  return plan;
}

function withFreezeFixture(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-freeze-"));
  try {
    const artifacts = REQUIRED_ARTIFACT_CLASSES.map((artifactClass, index) => {
      const relativePath = index === 0
        ? "plan.json"
        : `artifacts/${String(index + 1).padStart(2, "0")}-${artifactClass}.txt`;
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `${artifactClass}\n`);
      return {
        class: artifactClass,
        path: relativePath,
        visibility: index === 1 ? "private" : "public",
      };
    });
    const plan = frozenPlan();
    fs.writeFileSync(path.join(root, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
    callback({ root, plan, artifacts });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function withCopiedV3Repository(callback) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "docai-v3-live-cli-")));
  try {
    fs.cpSync(path.join(REPOSITORY_ROOT, "docai-http"), path.join(root, "docai-http"), {
      recursive: true,
    });
    const benchmarkDir = path.join(root, "docai-http", "benchmarks", "openapi-comparison", "v3");
    const manifestFile = path.join(benchmarkDir, "freeze-manifest.json");
    const manifest = readJson(manifestFile);
    for (const artifact of manifest.artifacts) {
      updateManifestHash(manifest, artifact.path, path.join(root, artifact.path));
    }
    const planLogicalPath = "docai-http/benchmarks/openapi-comparison/v3/plan.json";
    const planFile = path.join(root, planLogicalPath);
    const plan = readJson(planFile);
    const sealedArtifacts = manifest.artifacts
      .filter((artifact) => artifact.path !== planLogicalPath);
    plan.freeze.artifact_set_sha256 = crypto.createHash("sha256")
      .update(`${JSON.stringify(sealedArtifacts, null, 2)}\n`)
      .digest("hex");
    fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
    updateManifestHash(manifest, planLogicalPath, planFile);
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    callback({ root, benchmarkDir, manifest, manifestFile });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function withPublicationFixture(callback) {
  withFreezeFixture(({ root, artifacts }) => {
    const draft = draftPlan();
    const planFile = path.join(root, "plan.json");
    const manifestFile = path.join(root, "freeze-manifest.json");
    fs.writeFileSync(planFile, `${JSON.stringify(draft, null, 2)}\n`);
    const frozen = buildCalibrationFreeze({
      plan: draft,
      modelResolutions: modelResolutions(),
      artifacts,
      rootDir: root,
      frozenAt: FROZEN_AT,
      planArtifactPath: "plan.json",
    });
    fs.writeFileSync(manifestFile, '{"status":"old-draft-manifest"}\n');
    callback({ root, planFile, manifestFile, frozen });
  });
}

function updateManifestHash(manifest, logicalPath, file) {
  const artifact = manifest.artifacts.find((candidate) => candidate.path === logicalPath);
  assert.ok(artifact, logicalPath);
  artifact.sha256 = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
