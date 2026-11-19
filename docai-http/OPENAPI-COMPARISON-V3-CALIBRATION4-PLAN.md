# Calibration 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and independently verify an isolated, prospectively frozen calibration with structured semantic answers, reliable deterministic grading and provider-specific usage accounting.

**Architecture:** Copy only the needed predecessor implementation into a new versioned draft, then replace answer schemas, predicates and billing normalization within that package. Keep source evidence, native usage and verifier-minted result evidence distinct. The runner remains serial and cannot send before a new freeze and explicit Live approval.

**Tech Stack:** Existing JavaScript ESM, Node.js built-ins and `node:test`; existing Ruby/Psych YAML parser; existing fetch adapters with injected transports. No new judge, SDK, package dependency or provider-specific constrained decoding.

**Spec:** [Approved calibration.4 design](OPENAPI-COMPARISON-V3-CALIBRATION4-DESIGN.md), approved by the maintainer on 2026-11-10.

## Global Constraints

- New identity: `3.0.0-calibration.4`; benchmark ID remains `docai-http-openapi-comparison-v3`.
- Two designated tasks, three targets, four conditions, one repetition, 24 scheduled requests; reliability gate requires at least 23 automatic decisions and at most one exceptional run.
- Intended targets remain `gpt-5.6-sol`, `claude-sonnet-5`, `gemini-3.8-flash`, pending fresh catalog verification. No silent substitution.
- Proposed/approved design setting: requested generated-token limit 16,384 per call; OpenAI medium reasoning, Anthropic adaptive thinking, Google medium thinking, subject to documented model support. Revalidate before freeze.
- Maximum generated allocation: 393,216 requested tokens before retries. This is not a fee authorization or a provider billing cap.
- At most one pre-response transport retry per logical request; no response-bearing retry; work-step ceiling 100 attempts; fatal stops remain terminal.
- Preserve v2, all historical calibrations and their tests, private retained records, Stable source/projection content and the existing failed .3 gate.
- No primary schedule, Live call, key-value output or Git mutation. Git is read-only; commit suggestions are maintainer handoffs, never agent commands.
- Manual source edits use `apply_patch`; bulk identity replacement is mechanical and must be reviewed. Do not copy old manifests, trust anchors or private result stores into the draft.
- Plan preparation is complete only after self-review. Implementation starts after the maintainer reviews this plan and selects/confirms execution method. Live approval is separate again.

## File Map And Interfaces

`C4` below expands exactly to `docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4`; `T4` expands to `docai-http/tools/tests/openapi-comparison-v3-calibration4-`. These aliases are paths, not new runtime configuration.

| Files | Responsibility |
|---|---|
| `C4/plan.json`, `calibration-schedule.jsonl`, package Markdown files | Draft identity, 24-run schedule, boundaries and operator documentation |
| `C4/contracts.json`, `runtime/contract.mjs` | Five successor contract families and schema-only validation |
| `C4/continuity/tasks.json`, `continuity/evidence-ledger.json` | Six tasks, typed expectations, source-to-predicate evidence; never injected into prompts as private data |
| `C4/runtime/answer-values.mjs` | Known/unknown values, collection membership, reference and identity semantics |
| `C4/runtime/semantic-predicates.mjs`, `grader.mjs` | Exact predicates, structural reference checks, contradictions, semantic/evidence diagnostics |
| `C4/runtime/check-evidence-ledger.mjs`, `context.mjs`, `prompt.mjs` | Reviewed source mapping, actual-context availability, neutral public instructions |
| `C4/runtime/provider-usage.mjs`, `billing.mjs` | Provider-native accounting and priced usage; no transport |
| `C4/runtime/*-adapter.mjs`, `provider-adapter-utils.mjs`, `provider-errors.mjs` | HTTP adapters, completion signals and retained response/error envelopes |
| `C4/runtime/record.mjs`, `runner.mjs`, `evidence-verifier.mjs`, `gate.mjs`, `adjudication.mjs`, check/execute CLIs | Verified attempt/run state, accounting stops, reporting, unchanged gate thresholds |
| `C4/model-resolutions.json`, `cost-estimate.json`, `MODEL-COST-PREFLIGHT.md`, `runtime/estimate-cost.mjs` | Fresh documented provider policy, exact settings, prices and recalculated envelope |
| `C4/runtime/freeze.mjs`, `check-plan.mjs`, `freeze-manifest.json` | Review-before-freeze, successor-only trust anchor, immutable closure |
| `T4*.test.mjs`, `docai-http/tools/tests/calibration4-*-helpers.mjs` | Successor-only offline tests and synthetic fixtures |
| Outer runbook, design, plan, TODO; `docai-http/tools/check-release-readiness.mjs` | Maintainer status and deterministic checks, not Live authorization |

Keep the predecessor's public module/function names for unchanged interfaces.
New interfaces below are part of this plan; changes require updating consumers
and tests together before task completion.

### Shared Data Decisions

- Contract IDs: `request-construction.calibration4`, `response-handling.calibration4`, `error-recovery.calibration4`, `workflow-completion.calibration4`, `webhook-handling.calibration4`. The unused `retrieval-selection.v3` is not migrated or claimed as measured.
- `Known<T> = {status:"known", value:T}`; `Unknown = {status:"unknown", value:null}`. Known-null is permitted only for fields whose source value type is nullable.
- `Collection<T> = {status:"complete"|"partial"|"unknown", items:T[]}`; unknown collections have no items. Membership and member-value knowledge are separate.
- References: `{kind:"task-input",name}`, `{kind:"external-input",name}`, `{kind:"generated",rule,scope}`, `{kind:"step-output",step,field}`. Names/scopes are answer-local identities, not private expected placeholder labels. Resolve task inputs from public structured task inputs; generated scopes may use any name if their identity relationships are correct.
- Requests use `method`, `path`, `path_parameters`, `query`, `headers`, `body`, `parts`, `content_type`, `boundary`, `validation`. Use known/unknown value records for scored scalar/object facts and collection records for uncertain membership. Header members have `name` and typed `value`; duplicates differing only by case are semantic errors.
- Boundary facts are `mode` (generic `library-managed`, `caller-specified`, or explicit unknown) and optional caller boundary value. No mode is publicly declared correct for an operation.
- Workflow steps use `order`, `request`, `keep`, `states_after_success`; state members use `subject` and `state`. Recovery members use `trigger`, `operation`, `action`, `preserve`, `repeat_side_effect`; triggers use public generic categories, not private prose labels.
- Preserve existing top-level family keys (`request`/`retry`, `response`, `errors`, workflow keys, `webhook`, and `uncertainties`); their nested shapes become explicit. No unscored rationale field in this calibration, avoiding an unbounded prose channel.
- Each evidence row has `predicate_id`, `task_id`, `fact_id`, `output_path`, `public_rule`, `source_evidence`, `availability` (four condition keys), `negative_control`, `measured`. `source_evidence` identifies file, section or parsed pointer, source value and a reviewed prose-to-predicate mapping when needed.

Exact leaf schemas, constraint names and generic enum inventories are written
as reviewed data in Task 2. They must cover the six tasks without supplying
per-task correct values or private missing-fact lists. Inventory approval is
an offline review deliverable, not a runtime guessing step.

## Review Focus

1. Partial collection membership must preserve known entries without forcing names of hidden headers/cases; test in Tasks 2 and 3.
2. A typed key reference or state vocabulary must not teach an API's undocumented replay/no-recapture policy; test public/private separation in Tasks 2 and 6.
3. Contradictory extra steps, nested negation and duplicate references must fail semantically even when positive facts are present; test in Task 3.
4. Cached input and separately reported thinking must reconcile without omitted billing or double-counting; test in Tasks 4 and 5.
5. A crash, accounting defect or copied report snapshot must never permit more sends or fabricate verified results; test in Tasks 5 and 7.

## Task 1: Establish The Isolated Draft

Status: complete and independently reviewed (2026-11-10). Focused acceptance
8/8; inherited successor baseline193/277 with84 explicitly recorded later-task
migration failures, no skipped tests. This is not whole-package readiness.

**Files:** Create `C4/` from the required .3 public baseline and isolated successor tests; do not create a new frozen manifest or copy .3 private directories. Create `T4identity.test.mjs`, `T4plan.test.mjs`.

**Interfaces:** Retain `readPlan()`, `buildCalibrationSchedule(plan)`, `PACKAGE_DIR`, `PRIVATE_DIR`; all resolve only the new package. Draft preflight must fail before fetch even if an approval variable is present.

- [x] Write identity tests: exact .4 IDs, 24 unique schedule rows, two tasks, three targets, four conditions, one repetition and no imports/executable paths into mutable predecessor runtime.
- [x] Run `node --test docai-http/tools/tests/openapi-comparison-v3-calibration4-identity.test.mjs`; confirm it fails because the draft does not exist.
- [x] Mechanically copy required public runtime/helpers and adapt identity references; review every replacement. Use draft plan state, disabled freeze trust anchor, no copied model/cost authorization and no private prompt/run files.
- [x] Carry forward inherited .3 adversarial tests into successor test names and helper paths, preserving historical files. Mark baseline expectations requiring Task 2-5 migration explicitly; do not claim the full suite is green yet.
- [x] Run identity/plan tests and a fake-credential CLI preflight test asserting zero injected fetch calls. Run historical .3 `freeze.mjs --check --private-required`; it must still pass.
- [x] Review draft isolation. Record the checkpoint and suggest `Create isolated calibration 4 draft`; do not run Git write commands.

## Task 2: Define Public Schemas, Source Evidence And Prompts

Status: complete after independent review and fix-round rereview (2026-11-11).
Initial scoped42/42; final fix covering23/23; ledger89 measured predicates and
two contextual-only rows. No whole-runtime or Live-readiness claim.

**Files:** `C4/contracts.json`, `continuity/tasks.json`, `continuity/evidence-ledger.json`, `runtime/contract.mjs`, `answer-values.mjs`, `context.mjs`, `prompt.mjs`, `check-evidence-ledger.mjs`; `T4contract.test.mjs`, `T4prompt.test.mjs`, `T4parity.test.mjs`, `T4ledger.test.mjs`.

**Interfaces:** Keep `readTaskPacket(plan)`, `buildRequiredOutputText(contractId)`, `validateOutputContract(value,contractId) -> {valid,errors}`. Add `validateEvidenceLedger({plan,packet,ledger,contexts}) -> {failures,coverage}`; the CLI exits nonzero on failures. `coverage` lists all measured facts and condition availability, separate from contextual-only facts.

- [x] Write schema tests for all six positive task outcomes, known-null versus unknown, partial/unknown collections and malformed type/extra-field rejection. Verify duplicate ordinals/dangling references are schema-valid shapes reserved for semantic failure.
- [x] Write prompt tests asserting only the answer schema is displayed, no answer-level `schema_version`, identical public task/contract across targets/conditions, no private answer/assertion/inventory data, and no contract/system-instruction mandate to replay with a key or avoid recapture. Inspect instruction segments separately from documentation, where source-supported policies must remain visible.
- [x] Run the four new Task 2 test files; observe the missing interfaces/old-shape failures before implementation.
- [x] Define the five closed schemas and all public leaf conventions. Extend the existing schema interpreter only with a tested `one_of` combinator for discriminated shapes; exactly one branch must validate. Keep schema validation free of task-specific semantic relations.
- [x] Rewrite six task expectations using the shared data decisions. Expose actual task input IDs/values publicly, not private placeholder spellings. Include document validation facts: 10,485,760-byte file limit, 4,096-byte serialized metadata limit, documented MIME types and filename rules, each confirmed against unchanged authoritative sources.
- [x] Build the source-to-predicate ledger against actual parsed YAML/Markdown sections and actual rendered contexts. Review each prose mapping independently; label explicit missing facts for raw/sliced contexts. A declared fact ID alone cannot satisfy coverage. Do not edit Stable source documents to make this pass.
- [x] Run Task 2 tests and `node C4/runtime/check-evidence-ledger.mjs` after expanding `C4`. Review schemas, task input mapping and evidence availability together. Record any source ambiguity as a decision, not an invented rule.
- [x] Check all six positive schema outcomes and public/private separation. Suggest `Define structured calibration 4 answer contracts`.

## Task 3: Implement Exact Semantic Predicates

Status: complete and independently reviewed (2026-11-11). Covering tests
207/207; all initial review findings closed after scoped fix round 3.
This does not imply provider, whole-runtime or Live readiness.

**Files:** `C4/runtime/answer-values.mjs`, `semantic-predicates.mjs`, `grader.mjs`, `continuity/tasks.json`, evidence ledger; `T4values.test.mjs`, `T4grader.test.mjs`, `T4uncertainty.test.mjs`.

**Interfaces:** Keep `gradeParsedResponse({parsed,task,condition})` and its existing contract/accuracy/uncertainty/reason/category/manual-review result fields. Add `evaluateTaskSemantics({answer,task,condition,ledger}) -> {passed,failures,evidence_discipline}` and `validateAnswerRelations({answer,task}) -> Failure[]`. A `Failure` contains `predicate_id`, `path`, `category`, `message`; evidence diagnostics retain fact IDs outside prompts.

- [x] Write failing synthetic tests for all 18 audit grading cases plus partial collection knowledge, false unknown claims, external required input versus missing API documentation, generated-key alpha-renaming and backward output references.
- [x] Pin the grading table: wrong wire path, duplicate ordinal, forward/dangling reference, conflicting header/state, missing uncertainty correspondence and unsafe replay are contract-valid automatic semantic failures. Unknown enum tokens/wrong JSON shapes remain exceptional contract failures. No task-specific automatic pass/fail-rate target.
- [x] Run Task 3 tests and confirm false positives/negatives reproduce before replacing old predicates.
- [x] Implement exact scalar/operation/state checks, declared unordered-set checks, ordered consecutive steps, reference resolution and contradiction detection. Never use generic string substring matching or recursively sort arbitrary arrays/JSON bodies.
- [x] Add public typed-reference identity checks without requiring exact generated scope names. Check operation-specific key/replay policy only through source-mapped private predicates.
- [x] Grade valid unknown required capability as semantic fail; separately classify correctly reported gaps, missed available facts and unsupported claims. Collection-level gaps map to unknown membership without requiring a hidden member name. Preserve known members and independently grade facts available in that condition.
- [x] Run all six canonical semantic outcomes and adversarial cases. All positives must pass; unsafe/path-suffix/negated-state/duplicate-step negatives must fail in the specified layer. Compare enriched and DocAI predicate expectations through the source mapping, not dotted label spellings.
- [x] Review false-positive and false-negative controls together. Suggest `Add exact calibration 4 semantic grading`.

## Task 4: Implement Provider Usage And Completion Policies

Status: complete and independently reviewed (2026-11-13) for the approved
domain below.74/74 covering tests; all Important findings closed. Execution
stops and retained-evidence verification are still Task5 obligations.

Scope disposition approved by the maintainer on 2026-11-13: retain the fixed
Anthropic standard-version single request without beta/tools/compaction/
advisor/fallback features. Unexpected `usage.iterations` remains unpriced
accounting-unknown with retained evidence and a terminal stop before further
sends. This explicit domain boundary replaces the unresolved general iteration
policy requirement, not the rule against guessing unknown charges. Task5 must
verify the stop and retained-evidence behavior before Task7 freeze.

**Files:** `C4/runtime/provider-usage.mjs`, `billing.mjs`, three adapters, `provider-adapter-utils.mjs`, `provider-errors.mjs`; `T4usage.test.mjs`, `T4billing.test.mjs`, `T4adapters.test.mjs`; `C4/USAGE-ACCOUNTING.md`.

**Interfaces:** `normalizeProviderUsage({provider,nativeUsage}) -> UsageLedger`; `validateUsageLedger(ledger) -> {valid,issues}`; `priceUsage({usage,pricing}) -> {status:"complete"|"unknown"|"invalid",estimated_usd:number|null,issues:string[]}`. Raw response usage remains untouched. `UsageLedger` version `2` contains provider, normalized input/generated/provider totals, native/derived total provenance, disjoint input billing components, reasoning/final-output inclusion metadata, accounting status and issues. Missing amounts are null, never fabricated zero.

Use these ledger keys consistently in adapters, records, verifier and reports:
`usage_version:"2"`, `policy_id`, `provider`, `input_tokens`, `output_tokens`,
`total_tokens`, `native_total_tokens`, `total_provenance:"native"|"derived"|"unknown"`,
`input_components`, `reasoning_tokens`, `final_output_tokens`,
`reasoning_in_output:boolean|null`, `accounting_status` and `issues`.
`output_tokens` is normalized generated/billable output including reasoning
once, not merely visible text. `input_components` members are
`{kind:"uncached"|"cache-read"|"cache-write",tokens:number|null,ttl_seconds:number|null,pricing_key:string}`.
The components are disjoint; explanatory native breakdowns are not extra
components. `policy_id` binds the reviewed successor policy/runtime mapping;
pricing is separately bound to its exact model-resolution packet. Counts are
nonnegative integers or null; `issues` is a string array. No legacy three-key
usage object can silently satisfy this successor record type.

- [x] Check official provider documentation before coding mappings; record field inclusion, cache policy, completion semantics, checked date and URLs in `USAGE-ACCOUNTING.md`. Unresolved/native new billing fields block policy acceptance within the approved domain; never infer a cache rate from ordinary input pricing.
- [x] Write failing tests for the three synthetic usage probes: Google 100 input + 20 final + 80 thoughts => 100 generated/200 total; Anthropic 100 uncached + 30 write + 70 read + 20 output => 200 input/220 total with distinct pricing components; OpenAI 100 input + 100 output containing 80 reasoning => 200 total, not 280.
- [x] Add tests for Anthropic aggregate versus duration breakdown overlap; cached OpenAI input subsets; negative/noninteger/nonfinite/missing counters; inconsistent totals; explicit zero versus unknown; incomplete responses and HTTP failures with supplied usage. Preserve original provider completion status and unknown stop reason.
- [x] Run usage/billing/adapter tests and confirm old normalization fails those cases.
- [x] Implement provider-specific mappings and pricing with explicit overlap rules. Use unrounded accumulated charge for stop decisions; round only display values. Unsupported ambiguous fields produce unknown/invalid accounting, not zero charge or silently complete accounting.
- [x] Wire adapters to retain `UsageLedger` and native response. Set 16,384 in each actual request body with preserved reasoning modes; mocked transports assert exact payload and headers with fake keys only.
- [x] Run Task 4 tests; independently inspect inclusion relationships and billing categories. No network inference or actual-credential tests. Suggest `Correct calibration 4 provider usage accounting`.

## Task 5: Integrate Verified State, Budget Stops And The Actual CLI

Status: complete and independently reviewed (2026-11-13). Earlier covering
566/566, final-guard subset206/206, then native-shape fix covering246/246 on
stable bytes. All Important findings closed; whole-package acceptance is6B.

**Dependency:** Complete Task 4 and Task 6A's independently reviewed candidate
model/cost validators before this integration. Actual CLI tests must exercise
the real candidate preflight, not a bypass or copied historical authorization.

**Files:** `C4/runtime/record.mjs`, `runner.mjs`, `evidence-verifier.mjs`, `gate.mjs`, `adjudication.mjs`, check/execute CLIs; `T4integration.test.mjs`, `T4evidence.test.mjs`, `T4runner.test.mjs`, `T4stop.test.mjs`, `T4report.test.mjs`, `T4gate.test.mjs`, `T4cli.test.mjs`, `T4adjudication.test.mjs` and helpers. Independent tests use the `T4` prefix so canonical suite discovery and freeze registration include them; `calibration4-*` names are reserved for helpers.

**Interfaces:** Preserve `verifyCalibrationEvidence(...) -> {failures,evidence}`, opaque `requireVerifiedEvidence(value)`, `runApprovedCalibration(input)`, `buildCalibrationReport({evidence})`, `evaluateCalibrationGate(evidence)` and store interfaces. Version new retained run records as `4`; new attempt/usage envelopes are successor-only, with validators shared by runner and verifier. Record and verify the accounting policy identity used to derive every charge.

Review-driven file allowance: `C4/runtime/google-adapter.mjs` and
`T4adapters.test.mjs` may receive the documented Interactions final-text
extraction correction and native-envelope regressions. Preserve request
payload/model/settings and separate thought/signature steps from final text;
this supports the already approved API rather than adding a provider feature.

- [x] Write failing tests that verify Task 4 native accounting is recomputed from retained evidence, not trusted from stored totals; altered usage/pricing/policy identity must fail verification.
- [x] Test all charge-bearing response/error attempts, near/exact token and USD thresholds, unknown usage stops and no further sends after accounting defects. Include the approved Anthropic boundary: an unexpected `iterations` member (including null/empty) retains native response and unknown/null charge, stops durably, and allows no further send on execution/resume/re-entry. Preserve response bodies/usage in accounting-defect terminal evidence rather than discarding them as untyped exceptions.
- [x] Test the actual CLI using injected/fake transports: 24 unique calls, 16,384 limit per body, real clock wiring, zero calls without separate approval/freeze, no response-bearing retry, at most one proven-unsent retry and complete condition pairs. Unqualified fetch/read failures do not prove an unsent/free request: retain unknown charges and stop, including resume/re-entry, rather than retry merely to satisfy a fixture.
- [x] Reproduce inherited fatal stop/re-entry, both crash-recovery windows, unresolved intents, forged/copied/mutated evidence and reporting exploits. Reports, gate and any blinded adjudication must consume verified snapshots only.
- [x] Run Task 5 tests to observe the migration failures, then integrate the new record/accounting path and grader. Keep stale stopped checkpoints terminal, preserve unknown usage/stop causes and never turn partial provider text into a completed answer.
- [x] Assert gate fixtures: 24 valid automatic semantic failures can pass the reliability gate; 22 decisions or two exceptional results cannot. Incomplete provider responses always block it. Thresholds stay 23 and one; no relaxation based on .3 observed output.
- [x] Run all successor tests implemented through Task 5. Verify synthetic data remains in temporary fixtures, never `C4/private/runs/`. Suggest `Integrate verified calibration 4 execution and stops`.

## Task 6: Verify Models, Contexts, Prices And The Full Draft

Status: preparation phase6A complete and independently reviewed (2026-11-13).
Covering143/143 before the dated-validation fix; fix covering34/34 and
future-clock cost12/12. Phase6B integrated/whole-package acceptance is pending.
Documented exact IDs are verified, not account access or actual returned model
identity; Task5 must enforce the latter. No freeze or spending authorization.

**Execution order:** Perform preparation phase 6A after Task 4 and before
Task 5: verify candidate models/settings/prices, implement their validators,
and prepare prompt/context/cost inputs and focused tests. Review that phase
independently without freezing or sending Live requests. After Task 5, perform
phase 6B: integrated zero-call checks, historical/successor regression checks
and whole-package review, including Task7A's offline freeze implementation and
disposable-fixture tests. Recheck catalog/pricing validity before Task 7's
freeze. These are dependency phases of this task, not additional measured
scope or spending authorization.

**Files:** `C4/model-resolutions.json`, `cost-estimate.json`, `MODEL-COST-PREFLIGHT.md`, `runtime/estimate-cost.mjs`, `context.mjs`, `prompt.mjs`, `build-prompts.mjs`, `check-plan.mjs`; private regenerated prompts/metrics; `T4cost.test.mjs`, `T4prompt.test.mjs`, `T4parity.test.mjs`.

**Interfaces:** Preserve `buildCalibrationPrompts({plan,packet})`, `buildCostEstimate(...)` and validation functions; consume the Task 4 accounting/pricing policy. Model records bind requested/resolved ID, checked sources/date, exact settings, token limits, disjoint billing-category rates and policy identity. No stale .3 cost/model packet can authorize .4.

- [x] Revalidate documented exact intended model IDs without substitution, reasoning configuration, 16,384 support and current prices through official sources without inference. Actual native identity/redirect rejection remains Task5's execution check. Stop and ask the maintainer if any target or setting cannot be retained as approved.
- [x] Write failing tests for stale model/pricing inputs, missing cache categories, mismatched accounting policy, changed public prompts, hidden expected values and missing source-to-predicate evidence.
- [x] Regenerate private prompts and context metrics only for .4. Count complete task/contract/documentation payloads, annotate approximate counts versus measured provider usage, and assert 24 prompt identities with identical task/contract text across conditions and providers.
- [x] Recalculate provider-specific input contingency, 393,216 combined requested generated allocation, token stop and USD stop thresholds using reviewed pricing categories. Document cache assumptions, retries, unknown usage, rounding and non-invoice limitations; do not quote the old USD 2.4957045 envelope as the new one.
- [ ] Run Task 6 tests and zero-call dry-run. Review all six source ledgers and rendered contexts independently; source mappings and public instructions must neither favor DocAI labels nor leak absent raw/sliced facts.
- [ ] Run the current v3 test inventory and record any historical lifecycle assumptions separately, without editing historical tests. Require the complete current successor suite, immutable historical suites against their actual pre-Live commit/input snapshots, and actual-checkout historical public/private freeze and retained-evidence checks to pass. Historical checks that require pending Live TODOs or pre-Live directory inventories must not be "fixed" by falsifying current status or deleting real records. Run `git diff --check`.
- [ ] Complete independent whole-package review, including inherited evidence exploits, schema/semantic boundaries and accounting. Close important findings while still draft. Suggest `Verify calibration 4 context and cost preflight`.

## Task 7: Freeze Once And Prepare The Approval Handoff

Status: phase7A fix1 scoped review passed (2026-11-19). R1 dependency-scanner
line terminators and R2 commit/cleanup outcomes are corrected; affected
covering237/237 and parent fresh focused12/12. On 2026-11-19 the maintainer
approved A1 Option A: bind the complete reviewed artifact set, not only the
plan identity and internal manifest consistency. Fix2 implements that guarantee;
its affected covering run passed285/285 and the coordinator freshly reran all10
authority tests successfully. The scoped independent review was interrupted by
the review tool's automated restriction before a verdict; it remains pending.
Full7A is not accepted and actual7B is blocked until phase7A acceptance and
phase6B review. This is not a newly established code finding or a waived gate.

**Execution order:** After Task5, implement and independently review phase7A's
offline freeze construction/closure/transaction tests in disposable fixtures,
while the production plan stays draft with no published manifest. Include
that implementation in phase6B's full-suite and whole-package review. Only
then perform phase7B's one-time production anchoring/publication and final
frozen checks. This avoids requiring freeze-dependent tests to pass before
their implementation exists; it does not allow an unreviewed production freeze.

**Files:** `C4/runtime/freeze.mjs`, `check-plan.mjs`, `runner.mjs` (revision-closure registration only), `freeze-manifest.json`, `T4freeze.test.mjs`, successor package documentation; outer runbook/TODO; `docai-http/tools/check-release-readiness.mjs` and its unfrozen shared `tests/openapi-comparison-v3-release-readiness.test.mjs` integration test.

Phase7A also migrates successor-only identity/plan/inherited-identity/
inherited-plan fixtures to distinguish a prepared draft from an initial empty
draft and a published freeze. Retain zero-send/authorization guards; do not
change historical tests or publish the production anchor to make fixtures pass.

The shared release-readiness integration test is outside all historical freeze
manifests. Maintain its assertions for current release status and registry
contents; it is not a frozen historical calibration test. Preserve its
command/no-Live guards rather than requiring completed Live tasks to stay
unchecked. Frozen versioned calibration tests remain immutable.

**Interfaces:** Existing freeze CLI accepts `--check` and `--private-required`. Bind .4 plan identity, runtime module closure, successor tests, schemas, task/ledger data, accounting policy, exact model/cost packets, private prompt/metrics hashes, authoritative sources/projections and runtime identities. Derive anchor values from reviewed draft artifacts; never copy predecessor digests or fabricate an old freeze date.

Publication outcomes must distinguish pre-commit rollback from post-commit
cleanup issues. Restore the exact draft on failure while publication ownership
is retained. After releasing the publication lock, do not blindly roll back
committed files: expose an explicit committed-with-cleanup-issue outcome and
require read-only verification rather than a publication retry. No ordinary
failure result may misleadingly imply that a committed freeze was restored.

Approved A1 implementation refinement: add the fixed data-only
`C4/runtime/freeze-authority.mjs` trust root described in the design. Exclude
only that exact root from authenticated payload discovery; include its full
raw bytes explicitly in default runner revision. Authenticate exact manifest
bytes before accepting frozen content, including prepared publication inputs.
Root establishment is a separate reviewed7B step; publication cannot rewrite
it. Retain raw file hashes, existing plan-seal semantics and two-file rollback.
First prove unchanged-root same-ID/time README/ledger reseals fail, then cover
all artifact classes, final plan/manifest metadata and membership, null/malformed
root, path/override substitution, root revision binding and retained R1/R2 cases.
Run affected tests and independent scoped review before accepting phase7A.

- [ ] Write failing freeze tests covering public/private closure, altered ledger/policy/contract, external mutable runtime import, symlink path escapes, secret patterns and transactional plan/manifest publication failures. Retain the post-rename directory-sync rollback regression.
- [ ] Implement successor artifact registration and transactional one-time publication; exclude only designated dynamic run/checkpoint/adjudication stores, not prompt/metrics inputs. Ensure tests and accounting helpers enter both runner revision and freeze closure where applicable.
- [ ] Run the full suite before freezing, resolve review findings, establish the trust anchor once, then publish the .4 manifest. Once Live-used, no regeneration or rebaseline is permitted. Earlier draft corrections must remain auditable; never imply approval that was not given.
- [ ] Run .4 `check-plan.mjs --frozen`, `freeze.mjs --check --private-required`, `check-parity.mjs`, `check-evidence-ledger.mjs` and `run-calibration.mjs --dry-run`; all must succeed with zero inference calls. Verify all retained historical manifests.
- [ ] Add only deterministic .4 plan/freeze/parity/ledger checks to the outer readiness script after the freeze exists. A failed historical .3 gate remains historical evidence, not a newly added readiness requirement to force green.
- [ ] Run the complete current successor suite and the phase6B historical/current verification matrix, `node docai-http/tools/check-release-readiness.mjs`, and `git diff --check`. Independently review the frozen closure and operator command; record actual results and historical lifecycle failures rather than promising a green combined inventory.
- [ ] Update runbook/TODO with completion, limitations and the exact new provider/model/request/token/cost envelope. Present the 24-call exception, retry ceiling and increased token/cost allocation to the maintainer for separate Live approval. Do not execute the command in this task.
- [ ] Suggest `Freeze verified calibration 4 and prepare live approval`.

## Self-Review And Execution Handoff

- [x] Map approved design scope to tasks: isolation 1; contracts/coverage 2;
  semantics/layer boundary 3; usage/completion 4; verified execution/gate 5;
  model/cost/context checks 6; freeze/handoff 7.
- [x] Keep shared data/function names consistent across producer/consumer tasks.
- [x] Assign all five Review Focus risks to concrete failing tests.
- [x] Separate document-only planning from implementation, freeze and Live approval.
- [x] Preserve read-only Git policy: commit lines are suggestions for the user.
- [x] Obtain maintainer plan review and execution-method selection/confirmation
  (subagent-driven implementation, 2026-11-10).

Recommended execution method: subagent-driven task implementation with fresh
task review and a final whole-package review. The contract/grader and
usage/verifier interfaces can independently invalidate the evidence; fresh
review at those boundaries helps catch errors before integration and freeze.
Native execution by the main agent is also possible, with less coordination
overhead but without independent review until the whole-package checkpoint.
Neither method authorizes Live inference or Git mutation.
