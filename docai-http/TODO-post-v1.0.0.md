# DocAI HTTP TODO After v1.0.0

This backlog starts after publication of Stable `v1.0.0`. Items here are not
part of the `1.0.0` compatibility promise and must be assigned an appropriate
future version before publication.

## P0: Documentation Follow-Up

- [ ] Create or refresh `README.ja.md` from the final English `1.0.0` text.
- [ ] Define how translations record the English source version and how stale
  translations are identified.
- [ ] Add a short maintenance note that distinguishes normative English text
  from translations.

## P1: Release Maintenance

- [ ] Define the first post-1.0 release objective before choosing `1.0.1`,
  `1.1.0`, or `2.0.0`.
- [ ] Apply README section 3.1 compatibility analysis to every proposed
  normative, fixture, or checker change.
- [ ] Keep the `v1.0.0` tag and conformance corpus immutable; version later
  conformance evidence when meaning or required structure changes.
- [ ] Decide whether hosted CI should run
  `node docai-http/tools/check-release-readiness.mjs`.

## P1: Validator And Generator Tooling

- [ ] Evaluate a public validator API or CLI only after defining its input,
  diagnostics, versioning, and compatibility boundary.
- [ ] Evaluate a source-to-projection validator separately from document
  conformance validation.
- [ ] Decide whether a reference generator is useful without making one part of
  the stable format contract by implication.

## P2: OpenAPI Comparison Benchmark v2

### Claims And Fairness

- [x] Create a versioned benchmark plan before sending provider requests and
  freeze its tasks, prompts, output contracts, graders, conditions, model panel,
  repetition count, exclusion rules, and analysis methods.
- [x] Create the human-readable and machine-readable pre-registration draft in
  `benchmarks/openapi-comparison/v2/`; keep Live execution locked until its
  freeze manifest passes `tools/check-openapi-comparison-v2-plan.mjs --frozen`.
- [x] Separate the practical claim, DocAI HTTP versus raw/task-sliced OpenAPI,
  from the representation claim, DocAI HTTP versus OpenAPI enriched with the
  same authoritative behavior facts.
- [x] Require identical user tasks, system instructions, output contracts, and
  grading rules across context conditions; vary only the documentation context.
- [x] Keep raw OpenAPI size out of direct efficiency headlines when it omits
  facts required by the task.
- [x] Predefine primary outcomes as automated task pass rate and provider input
  tokens; treat latency, output tokens, cost, and failure categories as
  secondary outcomes.

### Fixtures And Tasks

- [x] Include the existing complete API for continuity plus at least two newly
  authored, unpublished holdout APIs to reduce training-contamination risk.
- [x] Define and validate the six `complete-commerce` continuity tasks against
  Stable `1.0.0`, including one positive and one targeted negative grader case
  per task.
- [x] Define six condition-neutral output contracts and a generic assertion
  grader that keeps expected outcomes outside public prompt fields.
- [x] Author and privately validate the `holdout-field-service` source bundle,
  full/compact DocAI projections, six-task packet, and grader cases.
- [x] Author and privately validate the `holdout-media-processing` source
  bundle, full/compact DocAI projections, six-task packet, and grader cases.
- [x] Hash and timestamp holdout source inputs, tasks, expected outcomes, and
  graders before live execution; publish them only after the run set is closed.
- [x] Cover materially different API surfaces: ordinary JSON CRUD and
  pagination, authentication and errors, idempotent multi-step workflows,
  webhooks, multipart/non-JSON transfer, and polymorphic bodies.
- [x] Define at least six independently gradable tasks per API across request
  construction, response handling, error recovery, workflow completion,
  retrieval selection, and token load.
- [x] Give every condition the same authoritative facts for the enriched
  comparison, and record separately which facts raw OpenAPI cannot express.

### Context Conditions

- [ ] Compare OpenAPI raw, OpenAPI task slice, OpenAPI enriched, and DocAI HTTP
  selected profile as the four primary conditions.
- [ ] Add a DocAI full-versus-compact ablation for compact-eligible tasks without
  mixing that ablation into the primary OpenAPI comparison.
- [x] Build a reusable OpenAPI slicer or document clearly where fixture-mapped
  slicing remains part of the benchmark setup.
- [ ] Measure deterministic UTF-8 bytes and characters, provider-reported input
  tokens, and tokenizer-specific counts where a stable tokenizer is available.

### Pilot Execution

- [ ] Use the recommended pilot matrix: three APIs, six tasks per API, three
  provider/model targets, three repetitions, and four primary conditions, for
  exactly 648 primary live requests plus a separately approved limited
  full/compact ablation.
- [x] Retain the four diagnostic `2.0.0-frozen.2` attempts as superseded
  evidence, repair semantic header grading and the batch-boundary review gate,
  and freeze the corrected pipeline as `2.0.0-frozen.3`.
- [ ] Execute `b01` under `2.0.0-frozen.3` after renewed approval; do not count
  the four superseded attempts in the 648 primary requests.
- [x] Split the 648 primary requests into nine batches of 72 requests. One batch
  is one API, one repetition, six tasks, three models, and four conditions.
- [x] Treat 100 attempted provider requests as a hard maximum for one work step;
  target 72 and never begin another batch in the same step.
- [x] Count successful calls, blocked calls, malformed responses, rate-limited
  calls, and transport retries toward the per-step request maximum.
- [x] Stop after every batch and wait for explicit user approval before starting
  the next batch; do not automatically continue across batches.
- [x] At every batch boundary, report requests attempted, completed, blocked,
  failed, and retried; provider-reported token usage; available account or cost
  signals; grader pass/fail/inconclusive counts; and the remaining batch plan.
- [x] Run the benchmark checker after every batch and persist an idempotent
  checkpoint so a resumed batch skips already completed run identities.
- [x] Define batch IDs before execution using API, repetition, and frozen-plan
  identity, and record start/end timestamps and resolved model IDs per batch.
- [x] Stop the current batch early on a billing/credit error, repeated rate
  limit, unavailable model, grader/fixture defect, unexpected prompt expansion,
  or spend materially above the approved batch estimate.
- [ ] Keep the full/compact ablation outside the nine primary batches and split
  it into separately estimated steps of at most 100 attempted requests.
- [x] Verify current model IDs in official provider catalogs immediately before
  execution and record exact resolved model or snapshot identifiers.
- [x] Define deterministic rotation of condition order within API/task/model
  blocks; keep
  the execution window short enough to limit provider drift.
- [x] Require blocked and malformed-output attempts to be recorded instead of
  silently rerunning; predefine when a transport-only retry is allowed.
- [x] Export all prompts and compute estimated token/cost ceilings for the whole
  pilot and for each 72-request batch before the first live request; obtain
  explicit approval for the first concrete batch ceiling.
- [ ] Stop after the pilot if fixture gaps, grader ambiguity, provider parsing
  failures, or unexpectedly high cost make the comparison unreliable.

### Statistical Analysis

- [ ] Report pass-rate differences in percentage points with 95% confidence
  intervals, not pass counts alone.
- [ ] Use paired analysis by API/task/model/repetition, such as paired bootstrap
  intervals or McNemar tests, and use a mixed-effects logistic model when the
  sample supports API, task, and model variation.
- [ ] Report median and mean input-token differences with bootstrap confidence
  intervals and include successful tasks per million input tokens as an
  efficiency measure.
- [ ] Report consistency across repetitions, including all-runs-pass rate and
  per-condition failure-category distributions.
- [ ] Keep provider-specific token and cost results separate unless a normalized
  pricing and token-accounting model is defined in advance.
- [ ] Require blinded manual adjudication only for grader-inconclusive records
  and report the adjudication rule and inter-rater agreement when multiple
  reviewers are used.

### Expansion And Publication

- [x] Set a pilot stop/go rule before execution; expand only if the pipeline is
  reliable and the effect estimate justifies additional provider cost.
- [ ] For a broader follow-up, target at least five APIs, eight tasks per API,
  three models, and five repetitions; calculate the exact request and cost
  budget before approval rather than treating this as an automatic requirement.
- [ ] Store Stable `1.0.0` benchmark artifacts separately from historical
  `0.12.0` evidence and add a checker for run completeness and frozen-plan
  identity.
- [ ] Update `OPENAPI-COMPARISON-EVIDENCE.md` with methods, run dates, model IDs,
  confidence intervals, limitations, raw aggregate tables, and failure analysis.
- [ ] Update the top-level README only with claims supported by the completed
  benchmark scope; do not generalize to all APIs, models, or implementation
  tasks.

## P2: Additional Adoption Evidence

- [ ] Consider optional target models and additional task classes only when
  their review and provider costs are justified.
- [ ] Define a normalized cost model before publishing provider-cost or
  cross-provider token comparisons.
- [ ] Consider provider latency measurements only with a reproducible sampling
  and reporting policy.

## P2: Future Format Work

- [ ] Treat finite recursive-schema representation as major-version work by
  default because `1.0.0` requires an explicit `unsupported` fallback.
- [ ] Require normative text, positive and negative fixtures, checker behavior,
  coverage notes, and compatibility analysis for every promoted feature.
- [ ] Keep experimental additions in candidate-only paths until their release
  scope and compatibility impact are explicit.

## Guardrails

- [ ] Do not broaden Stable `1.0.0` claims using candidate-only evidence.
- [ ] Do not send Live LLM provider requests without explicit approval and a
  stated task, target, and cost rationale.
- [ ] Do not choose a future version number until the intended change set is
  classified under the compatibility rules.
