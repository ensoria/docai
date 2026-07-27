import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildParityReport,
  buildTaskContext,
  readApiTaskPacket,
  resolveApiArtifacts,
  sliceOpenApiDocument,
} from "../openapi-comparison-v2-context.mjs";
import {
  BENCHMARK_DIR,
  readV2Plan,
} from "../openapi-comparison-v2-utils.mjs";

const plan = readV2Plan();
const continuityApi = plan.apis.find((api) => api.id === "complete-commerce");
const continuityPacket = readApiTaskPacket(continuityApi);
const createUserTask = continuityPacket.tasks.find((task) => task.id === "create-user-request");
const privateRequired = process.env.DOCAI_BENCHMARK_PRIVATE_REQUIRED === "1";

test("reference-closed slice follows nested and recursive local refs", () => {
  const document = {
    openapi: "3.1.1",
    paths: {
      "/nodes": {
        get: {
          responses: {
            200: {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Node" },
                },
              },
            },
          },
        },
      },
      "/unrelated": { get: { responses: { 204: { description: "none" } } } },
    },
    components: {
      schemas: {
        Node: {
          type: "object",
          properties: {
            child: { $ref: "#/components/schemas/Node" },
            label: { $ref: "#/components/schemas/Label" },
          },
        },
        Label: { type: "string" },
        Unrelated: { type: "integer" },
      },
    },
  };

  const sliced = sliceOpenApiDocument(document, ["paths./nodes.get"]);

  assert.deepEqual(Object.keys(sliced.paths), ["/nodes"]);
  assert.deepEqual(Object.keys(sliced.components.schemas).sort(), ["Label", "Node"]);
  assert.equal(sliced.components.schemas.Node.properties.child.$ref, "#/components/schemas/Node");
  assert.equal(Object.hasOwn(sliced.components.schemas, "Unrelated"), false);
});

test("raw context preserves the complete OpenAPI and records known source gaps", () => {
  const context = buildTaskContext(continuityApi, createUserTask, "openapi-raw");

  assert.equal(context.condition, "openapi-raw");
  assert.match(context.content, /^openapi:/);
  assert.match(context.content, /\/payments:/);
  assert.deepEqual(context.missing_fact_ids, createUserTask.private.fact_inventory.raw_missing);
  assert.deepEqual(
    context.fact_ids.sort(),
    createUserTask.private.fact_inventory.required
      .filter((fact) => !createUserTask.private.fact_inventory.raw_missing.includes(fact))
      .sort(),
  );
});

test("sliced context contains selected roots and local ref closure only", () => {
  const context = buildTaskContext(continuityApi, createUserTask, "openapi-sliced");
  const document = JSON.parse(context.content);

  assert.equal(context.condition, "openapi-sliced");
  assert.ok(document.paths["/users"].post);
  assert.ok(document.components.schemas.User);
  assert.equal(Object.hasOwn(document.paths, "/payments"), false);
  assert.deepEqual(context.missing_fact_ids, createUserTask.private.fact_inventory.sliced_missing);
});

test("enriched and DocAI contexts expose the same complete task fact inventory", () => {
  const enriched = buildTaskContext(continuityApi, createUserTask, "openapi-enriched");
  const docai = buildTaskContext(continuityApi, createUserTask, "docai-selected");

  assert.match(enriched.content, /<!-- openapi:/);
  assert.match(enriched.content, /<!-- behavior:/);
  assert.match(enriched.content, /behavior_source: docai-http-stable-conformance/);
  assert.match(docai.content, /<!-- docai:INDEX\.md -->/);
  assert.match(docai.content, /<!-- docai:resources\/users\.md -->/);
  assert.doesNotMatch(docai.content, /<!-- docai:resources\/payments\.md -->/);
  assert.deepEqual(enriched.fact_ids.sort(), createUserTask.private.fact_inventory.required.sort());
  assert.deepEqual(docai.fact_ids.sort(), createUserTask.private.fact_inventory.required.sort());
  assert.deepEqual(enriched.missing_fact_ids, []);
  assert.deepEqual(docai.missing_fact_ids, []);
});

test("API artifact resolution keeps private holdout facts below the ignored root", {
  skip: skipUnlessPrivateApi("holdout-media-processing"),
}, () => {
  const mediaApi = plan.apis.find((api) => api.id === "holdout-media-processing");
  const artifacts = resolveApiArtifacts(mediaApi);

  assert.equal(
    artifacts.root,
    path.join(BENCHMARK_DIR, "private", "holdouts", "media-processing"),
  );
  assert.equal(fs.existsSync(artifacts.task_packet), true);
  assert.equal(fs.existsSync(artifacts.openapi), true);
  assert.equal(fs.existsSync(artifacts.behavior), true);
});

test("parity report proves enriched and DocAI fact equality for every available task", () => {
  const report = buildParityReport({ privateRequired });
  const availableApis = plan.apis.filter((api) => (
    fs.existsSync(resolveApiArtifacts(api).task_packet)
  ));

  assert.equal(report.status, "pass");
  assert.equal(report.summary.apis, availableApis.length);
  assert.equal(report.summary.tasks, availableApis.length * 6);
  assert.equal(report.summary.parity_failures, 0);
  report.tasks.forEach((entry) => {
    assert.deepEqual(entry.enriched_missing, []);
    assert.deepEqual(entry.docai_missing, []);
    assert.deepEqual(entry.enriched_fact_ids, entry.required_fact_ids);
    assert.deepEqual(entry.docai_fact_ids, entry.required_fact_ids);
    assert.ok(Array.isArray(entry.raw_missing));
    assert.ok(Array.isArray(entry.sliced_missing));
  });
});

function skipUnlessPrivateApi(apiId) {
  if (privateRequired) return false;
  const api = plan.apis.find((candidate) => candidate.id === apiId);
  return !fs.existsSync(resolveApiArtifacts(api).task_packet);
}
