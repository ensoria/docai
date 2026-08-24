import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildFreezeManifest,
  collectFreezeArtifacts,
  validateFrozenArtifacts,
} from "../freeze-openapi-comparison-v2.mjs";
import {
  buildCostEstimate,
  validateModelResolutions,
} from "../estimate-openapi-comparison-v2-cost.mjs";
import {
  BENCHMARK_DIR,
  readV2Plan,
} from "../openapi-comparison-v2-utils.mjs";

const REQUIRED_CLASSES = [
  "authoritative-sources",
  "docai-contexts",
  "tasks-and-expected-outcomes",
  "prompt-templates-and-output-schemas",
  "graders",
  "context-builders",
  "model-resolutions",
  "cost-estimate",
];

test("freeze manifest validates all required artifact classes and hashes", () => {
  withFixture(({ root, plan, artifacts }) => {
    const manifest = buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    });

    assert.doesNotThrow(() => validateFrozenArtifacts({
      plan,
      manifest,
      rootDir: root,
    }));
    assert.deepEqual(
      [...new Set(manifest.artifacts.map((artifact) => artifact.class))].sort(),
      REQUIRED_CLASSES.sort(),
    );
  });
});

test("freeze validation rejects a missing required artifact class", () => {
  withFixture(({ root, plan, artifacts }) => {
    const incomplete = artifacts.filter((artifact) => artifact.class !== "cost-estimate");

    assert.throws(
      () => buildFreezeManifest({
        plan,
        artifacts: incomplete,
        rootDir: root,
        frozenAt: plan.freeze.frozen_at,
      }),
      /missing required artifact class cost-estimate/,
    );
  });
});

test("freeze validation rejects changed artifact content", () => {
  withFixture(({ root, plan, artifacts }) => {
    const manifest = buildFreezeManifest({
      plan,
      artifacts,
      rootDir: root,
      frozenAt: plan.freeze.frozen_at,
    });
    fs.appendFileSync(path.join(root, artifacts[0].path), "changed\n");

    assert.throws(
      () => validateFrozenArtifacts({ plan, manifest, rootDir: root }),
      /SHA-256 mismatch/,
    );
  });
});

test("freeze creation rejects likely credentials", () => {
  withFixture(({ root, plan, artifacts }) => {
    fs.writeFileSync(path.join(root, artifacts[0].path), "OPENAI_API_KEY=sk-example-secret-value\n");

    assert.throws(
      () => buildFreezeManifest({
        plan,
        artifacts,
        rootDir: root,
        frozenAt: plan.freeze.frozen_at,
      }),
      /possible secret/,
    );
  });
});

test("freeze creation rejects a non-frozen plan", () => {
  withFixture(({ root, plan, artifacts }) => {
    plan.status = "pre-registration-draft";
    plan.plan_version = "2.0.0-draft.2";

    assert.throws(
      () => buildFreezeManifest({
        plan,
        artifacts,
        rootDir: root,
        frozenAt: plan.freeze.frozen_at,
      }),
      /plan status must be frozen/,
    );
  });
});

test("cost estimate reports provider-specific whole-pilot and batch ceilings", () => {
  const plan = {
    benchmark_id: "benchmark",
    plan_version: "2.0.0-draft.1",
    execution: {
      planned_primary_requests: 2,
      batches: [
        { id: "b01", planned_requests: 1 },
        { id: "b02", planned_requests: 1 },
      ],
    },
    targets: [
      { id: "target-a", provider: "provider-a", planned_model: "model-a" },
    ],
  };
  const metrics = {
    benchmark_id: "benchmark",
    plan_version: "2.0.0-draft.1",
    rows: [
      { run_id: "run-1", batch_id: "b01", target_id: "target-a", prompt_approx_tokens_chars_div_4: 1000 },
      { run_id: "run-2", batch_id: "b02", target_id: "target-a", prompt_approx_tokens_chars_div_4: 2000 },
    ],
  };
  const modelResolutions = {
    benchmark_id: "benchmark",
    targets: [
      {
        target_id: "target-a",
        provider: "provider-a",
        requested_model: "model-a",
        resolved_model: "model-a",
        pricing_usd_per_million_tokens: { input: 2, output: 10 },
        request_settings: { json_output_mode: "prompt-only" },
      },
    ],
  };

  const estimate = buildCostEstimate({
    plan,
    metricsPacket: metrics,
    modelResolutions,
    outputTokensPerRequestCeiling: 500,
    estimatedAt: "2026-07-30T00:00:00Z",
  });

  assert.equal(estimate.whole_pilot.input_tokens_estimate, 3000);
  assert.equal(estimate.whole_pilot.output_tokens_ceiling, 1000);
  assert.equal(estimate.whole_pilot.cost_ceiling_usd, 0.016);
  assert.equal(estimate.batches[0].cost_ceiling_usd, 0.007);
  assert.equal(estimate.batches[1].cost_ceiling_usd, 0.009);
});

test("frozen model settings use the provider-neutral prompt-only JSON mode", () => {
  const plan = readV2Plan();
  const modelResolutions = JSON.parse(fs.readFileSync(
    path.join(BENCHMARK_DIR, "model-resolutions.json"),
    "utf8",
  ));

  assert.doesNotThrow(() => validateModelResolutions(plan, modelResolutions));
  modelResolutions.targets.forEach((target) => {
    assert.equal(target.request_settings.json_output_mode, "prompt-only");
    assert.equal(Object.hasOwn(target.request_settings, "structured_json"), false);
  });
});

test("freeze artifacts include the provider runner and all transport adapters", () => {
  const paths = new Set(collectFreezeArtifacts().map((artifact) => artifact.path));

  [
    "docai-http/tools/openapi-comparison-v2-runner.mjs",
    "docai-http/tools/openapi-comparison-v2-openai-adapter.mjs",
    "docai-http/tools/openapi-comparison-v2-anthropic-adapter.mjs",
    "docai-http/tools/openapi-comparison-v2-google-adapter.mjs",
    "docai-http/tools/check-openapi-comparison-v2-runs.mjs",
  ].forEach((file) => assert.equal(paths.has(file), true, file));
});

function withFixture(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docai-v2-freeze-"));
  try {
    const artifacts = REQUIRED_CLASSES.map((artifactClass, index) => {
      const relativePath = `artifacts/${String(index + 1).padStart(2, "0")}-${artifactClass}.txt`;
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `${artifactClass}\n`);
      return {
        class: artifactClass,
        path: relativePath,
        visibility: index < 2 ? "private" : "public",
      };
    });
    const plan = {
      benchmark_id: "benchmark",
      plan_version: "2.0.0-frozen.1",
      status: "frozen",
      freeze: {
        frozen_at: "2026-07-30T00:00:00Z",
        required_artifact_classes: REQUIRED_CLASSES,
      },
    };
    callback({ root, plan, artifacts });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
