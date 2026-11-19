import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { PACKAGE_DIR, readPlan } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/paths.mjs";
import { readTaskPacket, validateOutputContract } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/contract.mjs";
import { buildTaskContext, parseYamlFile, parseYamlText } from "../../benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/context.mjs";

test("checkout keeps known operation slots and methods separate from undocumented expanded paths", async () => {
  const { validateEvidenceLedger } = await import(path.join(PACKAGE_DIR, "runtime/check-evidence-ledger.mjs"));
  const plan = readPlan();
  const task = readTaskPacket(plan).tasks.find((t) => t.id === "complete-checkout-workflow");
  const ledger = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "continuity/evidence-ledger.json")));
  const scopedLedger = { ...ledger, rows: ledger.rows.filter((r) => r.task_id === task.id) };
  const contexts = { [task.id]: Object.fromEntries(plan.conditions.map((condition) => [condition, buildTaskContext({ api: { id: "complete-commerce" }, task, condition })])) };
  const packet = { api_id: "complete-commerce", tasks: [task] };
  const report = validateEvidenceLedger({ plan, packet, ledger: scopedLedger, contexts });
  assert.deepEqual(report.failures, []);
  const endpoints = ["POST /carts/{id}/validate", "POST /payments", "POST /orders"];
  for (const condition of ["openapi-raw", "openapi-sliced"]) {
    const context = contexts[task.id][condition];
    const document = condition === "openapi-raw" ? parseYamlText(context.content) : JSON.parse(context.content);
    assert.equal(Object.hasOwn(document, "servers"), false);
    assert.equal(context.content.includes("/v1"), false);
    assert.deepEqual(document["x-docai-workflows"].checkout.endpoints, endpoints);
    for (let i = 0; i < 3; i += 1) {
      const pathRow = report.coverage.measured.find((r) => r.output_path === `/steps/items/${i}/request/path`);
      assert.equal(pathRow.availability[condition], "missing", "an operation endpoint without a server base cannot establish the expanded path");
      for (const leaf of [`/steps/items/${i}/order`, `/steps/items/${i}/request/method`]) {
        const known = report.coverage.measured.find((r) => r.output_path === leaf);
        assert.equal(known?.availability[condition], "available", leaf);
      }
    }
  }
  assert.equal(task.private.fact_inventory.raw_missing.includes("checkout:expanded-paths"), true);
  assert.equal(task.private.fact_inventory.raw_missing.includes("checkout:ordered-steps"), false);
  const withoutBase = structuredClone(contexts);
  withoutBase[task.id]["openapi-enriched"].content = withoutBase[task.id]["openapi-enriched"].content.replace("base_path: /v1", "base_path: /v9");
  withoutBase[task.id]["docai-selected"].content = withoutBase[task.id]["docai-selected"].content.replace("Use the `/v1` base path", "Use the `/v9` base path");
  const missingBaseReport = validateEvidenceLedger({ plan, packet, ledger: scopedLedger, contexts: withoutBase });
  for (let i = 0; i < 3; i += 1) {
    const row = missingBaseReport.coverage.measured.find((r) => r.output_path === `/steps/items/${i}/request/path`);
    assert.equal(row.availability["openapi-enriched"], "missing");
    assert.equal(row.availability["docai-selected"], "missing");
    assert.equal(missingBaseReport.coverage.measured.find((r) => r.output_path === `/steps/items/${i}/request/method`).availability["openapi-enriched"], "available");
  }
});

test("retained ID members stay available independently of key policy and order relationship", async () => {
  const { validateEvidenceLedger } = await import(path.join(PACKAGE_DIR, "runtime/check-evidence-ledger.mjs"));
  const plan = readPlan();
  const packet = readTaskPacket(plan);
  const task = packet.tasks.find((t) => t.id === "complete-checkout-workflow");
  const response = packet.tasks.find((t) => t.id === "payment-created-response");
  const ledger = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "continuity/evidence-ledger.json")));
  for (const condition of ["openapi-raw", "openapi-sliced"]) {
    const context = buildTaskContext({ api: { id: packet.api_id }, task, condition });
    const document = condition === "openapi-raw" ? parseYamlText(context.content) : JSON.parse(context.content);
    assert.deepEqual(document.components.schemas.PaymentResponse.required, ["payment_id", "status"]);
    assert.deepEqual(document.components.schemas.OrderResponse.required, ["order_id", "status"]);
    assert.deepEqual(document.paths["/orders"].post.requestBody.content["application/json"].schema.required, ["cart_id", "payment_id"]);
    const responseContext = buildTaskContext({ api: { id: packet.api_id }, task: response, condition });
    const responseDocument = condition === "openapi-raw" ? parseYamlText(responseContext.content) : JSON.parse(responseContext.content);
    assert.deepEqual(responseDocument.components.schemas.PaymentResponse.required, ["payment_id", "status"]);
    assert.deepEqual(responseDocument.paths["/payments"].post["x-docai-triggers"], ["payment.completed"]);
    assert.equal(responseDocument.webhooks["payment.completed"].post.requestBody.content["application/json"].schema.required.includes("payment_id"), true);
    for (const [step, member] of [[1, { kind: "step-output", step: 2, field: "payment_id" }], [2, { kind: "step-output", step: 3, field: "order_id" }], [2, { kind: "step-output", step: 1, field: "cart_id" }], [2, { kind: "step-output", step: 2, field: "payment_id" }]]) {
      const index = task.private.assertions.findIndex((a) => a.path === `/steps/items/${step}/keep` && a.operator === "contains" && JSON.stringify(a.value) === JSON.stringify({ items: [member] }));
      assert.notEqual(index, -1, `no independent keep predicate for ${step}/${member.field}`);
      const row = ledger.rows.find((r) => r.task_id === task.id && r.negative_control.assertion_index === index);
      assert.equal(row.availability[condition], "available");
      assert.equal(row.negative_control.replacement.items.some((item) => JSON.stringify(item) === JSON.stringify(member)), false, "negative control must remove this member, not an unrelated one");
    }
    for (const step of [1, 2]) {
      const row = ledger.rows.find((r) => r.task_id === task.id && r.output_path === `/steps/items/${step}/keep` && task.private.assertions[r.negative_control.assertion_index]?.value.items?.[0]?.kind === "generated");
      assert.equal(row?.availability[condition], "missing", "known returned ID must not invent key retention policy");
    }
    const index = response.private.assertions.findIndex((a) => a.path === "/response/retained_fields" && a.operator === "contains" && JSON.stringify(a.value) === JSON.stringify({ items: ["payment_id"] }));
    assert.notEqual(index, -1, "response retention must not require a complete list or the unavailable order relationship");
    assert.equal(ledger.rows.find((r) => r.task_id === response.id && r.negative_control.assertion_index === index).availability[condition], "available");
    assert.equal(ledger.rows.find((r) => r.task_id === response.id && r.output_path === "/response/relations" && r.fact_id === "payments:order-link").availability[condition], "missing");
  }
  const contexts = Object.fromEntries(packet.tasks.map((t) => [t.id, Object.fromEntries(plan.conditions.map((condition) => [condition, buildTaskContext({ api: { id: packet.api_id }, task: t, condition })]))]));
  contexts[response.id]["openapi-enriched"].content = contexts[response.id]["openapi-enriched"].content.split("<!-- behavior:")[0];
  const report = validateEvidenceLedger({ plan, packet, ledger, contexts });
  assert.equal(report.coverage.measured.find((r) => r.task_id === response.id && r.output_path === "/response/retained_fields").availability["openapi-enriched"], "available", "the available event link still supports retention without the order link");
  const eventRow = ledger.rows.find((r) => r.task_id === response.id && r.fact_id === "payments:webhook-link");
  assert.equal(eventRow.negative_control.replacement.items.some((item) => item.target.value === "payment.completed"), false, "event negative control must remove the event relation, not the order relation");
  const sliced = JSON.parse(contexts[response.id]["openapi-sliced"].content);
  delete sliced.paths["/payments"].post["x-docai-triggers"];
  contexts[response.id]["openapi-sliced"].content = JSON.stringify(sliced);
  const withoutEventLink = validateEvidenceLedger({ plan, packet, ledger, contexts });
  assert.equal(withoutEventLink.coverage.measured.find((r) => r.predicate_id === eventRow.predicate_id).availability["openapi-sliced"], "missing");
  assert.equal(withoutEventLink.coverage.measured.find((r) => r.task_id === response.id && r.output_path === "/response/retained_fields").availability["openapi-sliced"], "available", "retaining the supplied ID is independent of either downstream relationship");
});

test("ledger validates parsed source values and all actual rendered condition contexts", async () => {
  const file = path.join(PACKAGE_DIR, "runtime/check-evidence-ledger.mjs");
  assert.equal(fs.existsSync(file), true, "missing evidence ledger implementation");
  const { validateEvidenceLedger } = await import(file);
  const plan = readPlan();
  const packet = readTaskPacket(plan);
  const ledger = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "continuity/evidence-ledger.json")));
  const contexts = Object.fromEntries(packet.tasks.map((task) => [task.id, Object.fromEntries(plan.conditions.map((condition) => [condition, buildTaskContext({ api: { id: packet.api_id }, task, condition })]))]));
  const check = (overrides = {}) => validateEvidenceLedger({ plan, packet, ledger, contexts, ...overrides });
  const result = check();
  assert.deepEqual(result.failures, []);
  assert.equal(result.coverage.measured.length > 40, true);
  assert.equal(Array.isArray(result.coverage.contextual_only), true);
  const receiver = packet.tasks[5].private.expected_outcome.webhook.path;
  assert.equal(receiver.status, "known");
  assert.equal(receiver.value.kind, "external-input");
  assert.equal(ledger.rows.some((r) => r.measured && r.task_id === packet.tasks[5].id && r.output_path === "/webhook/path"), false, "a runtime receiver reference is not a source-backed registration policy");
  const registration = result.coverage.contextual_only.find((r) => r.fact_id === "context:receiver-registration-wording");
  assert.deepEqual(registration?.availability, { "openapi-raw": "missing", "openapi-sliced": "missing", "openapi-enriched": "missing", "docai-selected": "available" });
  const method = ledger.rows.filter((r) => r.task_id === packet.tasks[5].id && r.fact_id === "webhook:payment-method");
  assert.equal(method.length, 1);
  assert.equal(method[0].output_path, "/webhook/method");
  assert.equal(method[0].availability["openapi-raw"], "available");
  for (const fact of ["documents:file-content-types", "documents:metadata-content-type", "documents:metadata-additional-properties"]) {
    const row = result.coverage.measured.find((r) => r.task_id === "upload-document-request" && r.fact_id === fact);
    assert.equal(row.availability["openapi-raw"], "available", `${fact}: explicit OpenAPI encoding/schema facts must not be declared missing`);
    assert.equal(row.availability["openapi-sliced"], "available");
  }
  for (const path of ["/errors/items/0/status", "/errors/items/0/code", "/errors/items/1/status", "/errors/items/1/code", "/errors/items/2/status", "/errors/items/3/code"]) {
    assert.equal(result.coverage.measured.find((r) => r.task_id === "create-user-errors" && r.output_path === path).availability["openapi-raw"], "available", path);
  }
  const paymentState = ledger.rows.find((r) => r.task_id === "complete-checkout-workflow" && r.output_path === "/steps/items/1/states_after_success" && packet.tasks[4].private.assertions[r.negative_control.assertion_index]?.value.items[0]?.subject === "payment");
  assert.equal(paymentState?.availability["openapi-raw"], "available", "known payment state must survive unknown independent order state");
  for (const row of ledger.rows.filter((r) => r.measured)) {
    const task = packet.tasks.find((t) => t.id === row.task_id);
    const answer = structuredClone(task.private.expected_outcome);
    const segments = row.output_path.slice(1).split("/").map((s) => s.replaceAll("~1", "/").replaceAll("~0", "~"));
    const parent = segments.slice(0, -1).reduce((v, key) => v[key], answer);
    assert.notDeepEqual(parent[segments.at(-1)], row.negative_control.replacement, row.predicate_id);
    parent[segments.at(-1)] = row.negative_control.replacement;
    assert.equal(validateOutputContract(answer, task.public.output_contract).valid, true, `${row.predicate_id}: negative control must be a semantic, not contract, failure`);
  }
  const sizes = result.coverage.measured.filter((r) => r.fact_id === "documents:size-limits");
  assert.equal(sizes.length >= 2, true);
  assert.equal(sizes.every((r) => r.availability["openapi-raw"] === "missing" && r.availability["docai-selected"] === "available"), true);
  const wrongSource = structuredClone(ledger);
  wrongSource.rows[0].source_evidence[0].source_value = "invented source value";
  assert.notDeepEqual(check({ ledger: wrongSource }).failures, []);
  const inventedId = structuredClone(ledger);
  inventedId.rows[0].source_evidence = [];
  assert.notDeepEqual(check({ ledger: inventedId }).failures, []);
  const missingRow = structuredClone(ledger);
  missingRow.rows.shift();
  assert.notDeepEqual(check({ ledger: missingRow }).failures, []);
  const contentStripped = structuredClone(contexts);
  for (const task of packet.tasks) contentStripped[task.id]["docai-selected"].content = "";
  assert.notDeepEqual(check({ contexts: contentStripped }).failures, []);
  const wrongMapping = structuredClone(ledger);
  wrongMapping.rows[0].output_path = "/not-an-answer-field";
  assert.notDeepEqual(check({ ledger: wrongMapping }).failures, []);
  const incompleteComposite = structuredClone(contexts);
  incompleteComposite["complete-checkout-workflow"]["openapi-enriched"].content = incompleteComposite["complete-checkout-workflow"]["openapi-enriched"].content.split("<!-- behavior:")[0];
  const compositeReport = check({ contexts: incompleteComposite });
  const independentOrderState = ledger.rows.find((r) => r.task_id === "complete-checkout-workflow" && r.output_path === "/steps/items/1/states_after_success" && packet.tasks[4].private.assertions[r.negative_control.assertion_index]?.value.items[0]?.subject === "order");
  const pendingState = compositeReport.coverage.measured.find((r) => r.predicate_id === independentOrderState?.predicate_id);
  assert.equal(pendingState.availability["openapi-enriched"], "missing", "response status alone must not establish independent order state");
  const incompleteKeyPolicy = structuredClone(contexts);
  incompleteKeyPolicy["create-user-errors"]["docai-selected"].content = incompleteKeyPolicy["create-user-errors"]["docai-selected"].content.replace("opaque, operation-unique string", "opaque string");
  const keyPolicyReport = check({ contexts: incompleteKeyPolicy });
  assert.equal(keyPolicyReport.coverage.measured.find((r) => r.predicate_id === "create-user-errors#1").availability["docai-selected"], "missing", "correcting an email alone must not invent a new-key policy");
  const cli = spawnSync(process.execPath, [file], { encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout).failures, []);
});

test("independently reviews source facts against typed answer locations, not fact inventories", () => {
  const root = path.resolve(PACKAGE_DIR, "../../../../..");
  const behavior = parseYamlFile(path.join(root, "fixtures/conformance/v1.0.0/source/complete-behavior.yaml"));
  const openapi = parseYamlFile(path.join(root, "fixtures/conformance/v1.0.0/source/complete-openapi.yaml"));
  const packet = readTaskPacket();
  const upload = packet.tasks[1].private.expected_outcome;
  const constraints = upload.request.validation.items;
  const constraint = (target, name) => constraints.find((c) => c.target === target && c.constraint === name).value.value;
  assert.equal(behavior.file_transfer.document_part.maximum_bytes, 10485760);
  assert.equal(constraint("document", "maximum-bytes"), 10485760);
  assert.equal(behavior.file_transfer.metadata_part.maximum_bytes, 4096);
  assert.equal(constraint("metadata", "maximum-bytes"), 4096);
  assert.deepEqual(behavior.file_transfer.document_part.content_types, ["application/pdf", "image/png"]);
  assert.deepEqual(constraint("document", "accepted-content-types"), ["application/pdf", "image/png"]);
  assert.equal(behavior.file_transfer.document_part.filename_required, true);
  assert.equal(behavior.file_transfer.document_part.preserve_extension, true);
  assert.equal(constraint("document", "filename-required"), true);
  assert.equal(constraint("document", "preserve-extension"), true);
  const document = fs.readFileSync(path.join(root, "fixtures/conformance/v1.0.0/valid/full/resources/documents.md"), "utf8");
  assert.match(document, /maximum serialized size is 4096 bytes/);
  assert.match(document, /maximum size is 10485760 bytes/);
  assert.match(behavior.operations["POST /documents"].idempotency, /byte-identical multipart parts/);
  assert.equal(upload.retry.items[0].action.value.request_equivalence, "byte-identical");
  assert.match(behavior.operations["POST /orders"].preconditions, /POST \/payments returned a payment_id/);
  assert.equal(packet.tasks[2].private.expected_outcome.response.relations.items[0].target.value, "POST /orders");
  assert.equal(openapi.components.schemas.PaymentResponse.properties.status.const, "pending");
  assert.equal(openapi.components.schemas.OrderResponse.properties.status.const, "confirmed");
  assert.match(behavior.workflow.checkout.recovery.early_webhook, /mark the payment settled, retain order.not_confirmed, and continue POST \/orders/);
  const checkout = packet.tasks[4].private.expected_outcome;
  assert.deepEqual(checkout.webhook_reconciliation.items[0].record_states.items, [{ subject: "payment", state: { status: "known", value: "settled" } }, { subject: "order", state: { status: "known", value: "not_confirmed" } }]);
  assert.equal(checkout.webhook_reconciliation.items[0].repeat_side_effect.value, false);
  assert.match(behavior.operations["POST /orders"].payment_state_handling.settled, /without another capture/);
  assert.equal(openapi.webhooks["payment.completed"].post.requestBody.content["application/json"].schema.properties.metadata["x-docai-opaque"], true);
  assert.equal(packet.tasks[5].private.expected_outcome.webhook.payload.metadata.interpret.value, false);
  assert.equal(behavior.webhook_delivery.default.response, "any 2xx within 5 seconds");
  assert.equal(packet.tasks[5].private.expected_outcome.webhook.acknowledgement.deadline_seconds.value, 5);
});

for (const preexistingPrivate of [false, true]) test(`CLI rejects tampered source claims without changing private outputs: ${preexistingPrivate ? "preexisting fake inputs" : "no private inputs"}`, () => {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "c4-ledger-cli-"));
  const httpRoot = path.resolve(PACKAGE_DIR, "../../../../..");
  const copy = path.join(root, "docai-http", path.relative(httpRoot, PACKAGE_DIR));
  try {
    fs.cpSync(PACKAGE_DIR, copy, {
      recursive: true,
      filter: source => path.resolve(source) !== path.join(PACKAGE_DIR, "private"),
    });
    fs.cpSync(path.join(httpRoot, "fixtures/conformance/v1.0.0"), path.join(root, "docai-http/fixtures/conformance/v1.0.0"), { recursive: true });
    const privateDir = path.join(copy, "private");
    assert.equal(fs.existsSync(privateDir), false, "production private inputs must not enter the disposable fixture");
    if (preexistingPrivate) {
      fs.mkdirSync(path.join(privateDir, "prompts"), { recursive: true });
      fs.mkdirSync(path.join(privateDir, "contexts", "empty"), { recursive: true });
      fs.writeFileSync(path.join(privateDir, "prompts", "calibration.jsonl"), '{"fixture":"fake-prompt-only"}\n');
      fs.writeFileSync(path.join(privateDir, "contexts", "calibration-metrics.json"), '{"fixture":"fake-metrics-only"}\n');
      fs.writeFileSync(path.join(privateDir, "contexts", "sentinel.bin"), Buffer.from([0, 255, 10, 13]));
    }
    const before = snapshotPrivateOutputs(privateDir);
    assert.equal(before !== null, preexistingPrivate);
    const ledgerFile = path.join(copy, "continuity/evidence-ledger.json");
    const ledger = JSON.parse(fs.readFileSync(ledgerFile));
    ledger.rows[0].source_evidence[0].source_value = "fabricated";
    fs.writeFileSync(ledgerFile, JSON.stringify(ledger));
    const result = spawnSync(process.execPath, [path.join(copy, "runtime/check-evidence-ledger.mjs")], { encoding: "utf8" });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /parsed source value mismatch/);
    assert.ok(JSON.parse(result.stdout).failures.includes(`${ledger.rows[0].predicate_id}: parsed source value mismatch`));
    assert.deepEqual(snapshotPrivateOutputs(privateDir), before, "invalid source CLI must not create, remove or alter private paths/bytes/modes");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

function snapshotPrivateOutputs(directory) {
  if (!fs.existsSync(directory)) return null;
  const entries = [];
  function visit(file) {
    const stat = fs.lstatSync(file);
    assert.equal(stat.isSymbolicLink(), false, "private fixture inventory must not follow symlinks");
    const entry = { path: path.relative(directory, file), mode: stat.mode & 0o777, type: stat.isDirectory() ? "directory" : "file" };
    if (stat.isFile()) entry.bytes = fs.readFileSync(file).toString("hex");
    else assert.equal(stat.isDirectory(), true, "private fixture entries must be files or directories");
    entries.push(entry);
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name));
  }
  visit(directory);
  return entries;
}
