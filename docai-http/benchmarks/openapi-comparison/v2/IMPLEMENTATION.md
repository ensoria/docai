# OpenAPI Comparison Benchmark v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, freeze, execute, and analyze the preregistered 648-request
DocAI HTTP versus OpenAPI benchmark without publishing holdout contents early.

**Architecture:** Public, provider-neutral tools validate task contracts,
construct contexts, export prompts, grade responses, schedule batches, and
summarize results. Two holdout APIs and all pre-publication prompts, expected
outcomes, checkpoints, and runs stay in the ignored `private/` workspace.
Every executable artifact is hashed into one freeze identity before Live LLM
requests begin.

**Tech Stack:** Node.js ESM and built-in modules only; JSON, JSONL, Markdown,
OpenAPI YAML inputs, and Stable DocAI HTTP `1.0.0` document sets.

## Global Constraints

- Keep the Stable `v1.0.0` tag and `fixtures/conformance/v1.0.0/` immutable.
- Do not add third-party runtime dependencies.
- Do not expose holdout source facts or expected outcomes before all nine
  primary batches close.
- Do not send provider requests until the frozen-plan checker passes and the
  user approves the concrete `b01` cost ceiling.
- Execute at most one 72-request batch and at most 100 provider attempts per
  user-approved work step.
- Use the same task, prompt envelope, output contract, and grader for all four
  documentation conditions.

---

### Task 1: Evaluation Contract And Validation

**Files:**
- Create: `docai-http/benchmarks/openapi-comparison/v2/contracts.json`
- Create: `docai-http/tools/openapi-comparison-v2-contract.mjs`
- Create: `docai-http/tools/tests/openapi-comparison-v2-contract.test.mjs`
- Modify: `docai-http/benchmarks/openapi-comparison/v2/README.md`

**Interfaces:**
- Consumes: `plan.json` API and task identities.
- Produces: `readContractPacket()`,
  `validateBenchmarkTaskPacket(packet, plan)`, and
  `buildRequiredOutputText(contractId)`.

- [x] Write failing tests for the valid packet, unknown task identity, duplicate
  task, invalid assertion operator, and expected-outcome leakage into public
  prompt fields.
- [x] Run
  `node --test docai-http/tools/tests/openapi-comparison-v2-contract.test.mjs`
  and verify failure because the contract module does not exist.
- [x] Add the six output contracts and minimal validation implementation.
- [x] Run the contract tests and draft plan checker.
- [x] Update the benchmark README with contract validation commands.

### Task 2: Continuity API Task Packet

**Files:**
- Create:
  `docai-http/benchmarks/openapi-comparison/v2/continuity/tasks.json`
- Create:
  `docai-http/benchmarks/openapi-comparison/v2/continuity/positive-results.json`
- Create:
  `docai-http/benchmarks/openapi-comparison/v2/continuity/negative-results.json`
- Create:
  `docai-http/tools/tests/openapi-comparison-v2-continuity.test.mjs`

**Interfaces:**
- Consumes: Stable conformance documents and the Task 1 packet contract.
- Produces: six validated `complete-commerce` tasks covering request,
  response, errors, workflow, and webhook behavior.

- [x] Write tests that require the six task IDs from `plan.json`.
- [x] Verify tests fail while the continuity packet is absent.
- [x] Port five historical tasks to Stable `1.0.0` source paths and add the
  payment webhook task.
- [x] Add one positive and one targeted negative output per task.
- [x] Validate all task contracts without changing Stable fixtures.

### Task 3: Field-Service Holdout

**Files:**
- Create locally under:
  `docai-http/benchmarks/openapi-comparison/v2/private/holdouts/field-service/`
- Test:
  `docai-http/tools/tests/openapi-comparison-v2-private-packets.test.mjs`

**Interfaces:**
- Consumes: Stable DocAI HTTP grammar and Task 1 contracts.
- Produces: authoritative OpenAPI and behavior inputs, full and compact DocAI
  document sets, six task contracts, and positive/negative grader cases.

- [ ] Write a failing private-packet test for the six planned task IDs.
- [ ] Author JSON CRUD, cursor pagination, authentication, endpoint errors,
  idempotency, dispatch workflow, webhook, and bulk-parts facts.
- [ ] Project the same facts into full and compact Stable `1.0.0` contexts.
- [ ] Add six task contracts with source-fact inventories.
- [ ] Validate positive and targeted negative results.
- [ ] Back up the ignored holdout directory in access-controlled storage.

### Task 4: Media-Processing Holdout

**Files:**
- Create locally under:
  `docai-http/benchmarks/openapi-comparison/v2/private/holdouts/media-processing/`
- Test:
  `docai-http/tools/tests/openapi-comparison-v2-private-packets.test.mjs`

**Interfaces:**
- Consumes: Stable DocAI HTTP grammar and Task 1 contracts.
- Produces: authoritative OpenAPI and behavior inputs, full and compact DocAI
  document sets, six task contracts, and positive/negative grader cases.

- [ ] Extend the private-packet test for the six planned media task IDs.
- [ ] Author multipart, CSV download, polymorphic body, asynchronous workflow,
  error recovery, and webhook facts.
- [ ] Project the same facts into full and compact Stable `1.0.0` contexts.
- [ ] Add six task contracts with source-fact inventories.
- [ ] Validate positive and targeted negative results.
- [ ] Back up the ignored holdout directory in access-controlled storage.

### Task 5: Context Construction And Source Parity

**Files:**
- Create: `docai-http/tools/openapi-comparison-v2-context.mjs`
- Create: `docai-http/tools/check-openapi-comparison-v2-parity.mjs`
- Create: `docai-http/tools/tests/openapi-comparison-v2-context.test.mjs`

**Interfaces:**
- Consumes: one API source bundle and task retrieval roots.
- Produces: `buildTaskContext(api, task, condition)` and a parity report.

- [ ] Write failing tests for raw, reference-closed slice, enriched, and DocAI
  selected-profile contexts.
- [ ] Implement reusable path/component reference closure without
  fixture-specific extraction code.
- [ ] Add deterministic enrichment and DocAI retrieval loading.
- [ ] Verify enriched and DocAI contexts expose every task fact ID.
- [ ] Record raw/sliced missing facts separately instead of treating them as
  representation failures.

### Task 6: Prompt Export And Context Metrics

**Files:**
- Create: `docai-http/tools/openapi-comparison-v2-prompt.mjs`
- Create: `docai-http/tools/build-openapi-comparison-v2-prompts.mjs`
- Create: `docai-http/tools/record-openapi-comparison-v2-metrics.mjs`
- Create: `docai-http/tools/tests/openapi-comparison-v2-prompt.test.mjs`

**Interfaces:**
- Consumes: frozen tasks, contracts, contexts, targets, and schedule.
- Produces: strict provider-neutral prompt records and deterministic local
  context metrics.

- [ ] Write a failing test proving all four condition prompts differ only in
  context and contain no expected values or grader evidence.
- [ ] Build the common system/user envelope and required-output text.
- [ ] Export all 648 prompts into the ignored workspace.
- [ ] Record UTF-8 bytes, characters, and characters/4 for every prompt.
- [ ] Add optional provider tokenizer counts only where a stable tokenizer is
  available without adding a runtime dependency.

### Task 7: Generic Grader

**Files:**
- Create: `docai-http/tools/openapi-comparison-v2-grader.mjs`
- Create: `docai-http/tools/tests/openapi-comparison-v2-grader.test.mjs`

**Interfaces:**
- Consumes: strict response JSON and private assertion lists.
- Produces:
  `gradeBenchmarkResponse(contentJson, task)` returning status, reasons, and
  failure categories.

- [ ] Write failing tests for every assertion operator and each task class.
- [x] Implement exact, inclusion, absence, and unordered collection
  assertions with JSON-pointer-like paths.
- [ ] Classify malformed and inconclusive output without automatic reruns.
- [ ] Run every positive/negative fixture through the grader.

### Task 8: Freeze And Cost Preflight

**Files:**
- Create: `docai-http/tools/freeze-openapi-comparison-v2.mjs`
- Create: `docai-http/tools/estimate-openapi-comparison-v2-cost.mjs`
- Create: `docai-http/tools/tests/openapi-comparison-v2-freeze.test.mjs`
- Generate:
  `docai-http/benchmarks/openapi-comparison/v2/freeze-manifest.json`
- Generate:
  `docai-http/benchmarks/openapi-comparison/v2/schedule.jsonl`

**Interfaces:**
- Consumes: all completed public/private artifact classes.
- Produces: SHA-256 manifest, frozen plan identity, exact model resolutions,
  and provider-specific whole-pilot/per-batch ceilings.

- [ ] Write tests that reject missing classes, changed hashes, secrets, or a
  non-frozen plan.
- [ ] Verify current models and prices using official provider documentation.
- [ ] Generate and review prompt/token estimates.
- [ ] Freeze every required artifact and change plan status to frozen.
- [ ] Run `check-openapi-comparison-v2-plan.mjs --frozen`.
- [ ] Present the `b01` ceiling and request explicit user approval.

### Task 9: Provider Runners And Checkpoints

**Files:**
- Create: `docai-http/tools/openapi-comparison-v2-runner.mjs`
- Create: one thin provider adapter per OpenAI, Anthropic, and Google.
- Create: `docai-http/tools/check-openapi-comparison-v2-runs.mjs`
- Create: `docai-http/tools/tests/openapi-comparison-v2-runner.test.mjs`

**Interfaces:**
- Consumes: one approved batch, frozen prompts, and provider credentials.
- Produces: append-only attempts, idempotent checkpoints, graded run records,
  and the batch-boundary report.

- [ ] Write failing tests for resume, 100-attempt cap, retry eligibility,
  mandatory stop rules, and one-batch selection.
- [ ] Implement dependency-injected provider adapters and append-only storage.
- [ ] Enforce one transport retry and retain both attempts.
- [ ] Generate counts, usage, cost signals, model IDs, and remaining batches.
- [ ] Run adapters only after the corresponding user approval.

### Task 10: Analysis And Publication

**Files:**
- Create: `docai-http/tools/analyze-openapi-comparison-v2.mjs`
- Create: `docai-http/tools/tests/openapi-comparison-v2-analysis.test.mjs`
- Modify after closure: `docai-http/OPENAPI-COMPARISON-EVIDENCE.md`
- Modify after closure: `README.md`

**Interfaces:**
- Consumes: closed, checked run records.
- Produces: paired estimates, confidence intervals, failure analysis, scoped
  publication tables, and redacted public benchmark artifacts.

- [ ] Write deterministic statistical tests with the frozen seed.
- [ ] Implement paired bootstrap, Holm correction, exact McNemar summaries,
  token efficiency, and repetition consistency.
- [ ] Execute one approved batch at a time and stop after each boundary report.
- [ ] Apply the preregistered pilot stop/go gate after `b09`.
- [ ] Redact and publish holdout artifacts and scoped evidence only after run
  closure.
