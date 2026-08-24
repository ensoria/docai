# OpenAPI Comparison Benchmark v2 Plan

Plan ID: `docai-http-openapi-comparison-v2`

Status: frozen as `2.0.0-frozen.3` on 2026-08-24

Created: 2026-07-21

This plan was frozen before the first Live LLM request. Any
change to a task, prompt, output contract, grader, context, model panel,
repetition count, exclusion rule, or analysis method creates a new plan version
and invalidates unreported mixed-plan runs.

`2.0.0-frozen.3` supersedes `2.0.0-frozen.2`. The first four `b01` responses
from the earlier plan exposed a literal-placeholder grader defect and a runner
that applied the 5% review rule during a batch instead of at its boundary. The
attempts remain retained for audit but are excluded from primary analysis; see
`EXECUTION-LOG.md`.

## Purpose And Claim Boundaries

The benchmark measures whether DocAI HTTP provides useful context for LLM API
implementation tasks compared with three OpenAPI-based documentation
conditions. It does not test whether either format is universally better.

Two claims are intentionally separate:

1. Practical retrieval claim: compare DocAI HTTP with raw OpenAPI and a
   task-relevant OpenAPI slice. This reflects documentation that an application
   could commonly retrieve, but raw or sliced OpenAPI may lack behavior facts.
2. Representation claim: compare DocAI HTTP with OpenAPI enriched by the same
   authoritative behavior facts. This tests representation and retrieval after
   controlling for factual availability.

Raw OpenAPI byte or token size must not be used as a direct efficiency headline
when raw OpenAPI omits facts required to pass a task. Missing-fact failures and
representation failures are reported separately.

The primary outcomes are:

- automated task pass rate; and
- provider-reported input tokens.

Output tokens, deterministic context size, latency, provider-specific cost,
blocked calls, malformed output, and failure categories are secondary outcomes.
Cross-provider token totals or costs must not be combined unless a normalized
method is separately preregistered.

## Frozen Matrix

The primary matrix contains:

- 3 APIs;
- 6 Live LLM tasks per API;
- 3 provider/model targets;
- 3 repetitions; and
- 4 documentation conditions.

This is exactly `3 * 6 * 3 * 3 * 4 = 648` planned primary requests, excluding
transport retries. A separate DocAI full-versus-compact ablation is not part of
the 648-request primary matrix and requires its own estimate and approval.

### API Panel

1. `complete-commerce`: the existing complete API, projected into Stable DocAI
   HTTP `1.0.0`, for continuity with the historical `0.12.0` comparison.
2. `holdout-field-service`: a private holdout emphasizing JSON CRUD,
   pagination, authentication, endpoint errors, idempotent operations, a
   multi-step dispatch workflow, and webhooks.
3. `holdout-media-processing`: a private holdout emphasizing multipart upload,
   non-JSON transfer, polymorphic request bodies, error recovery, asynchronous
   processing, and webhooks.

The holdout inputs and expected outcomes remain unpublished until the nine
primary batches close. Before execution, their source inputs, tasks, expected
outcomes, and graders receive SHA-256 hashes and a UTC freeze timestamp.

Each API has six independently graded Live LLM tasks. Across the panel they
cover request construction, response handling, error recovery, workflow
completion, webhook handling, pagination/retrieval decisions, multipart and
non-JSON transfer, and polymorphic bodies. Deterministic token-load measurement
is performed for every task context and is not counted as a provider request.

### Documentation Conditions

Only documentation context may vary within a paired task block. The user task,
system instructions, required JSON output contract, grader, target, and execution
settings remain identical.

- `openapi-raw`: the authoritative OpenAPI document as authored.
- `openapi-sliced`: a deterministic task-relevant OpenAPI slice.
- `openapi-enriched`: the same slice plus all authoritative behavior facts
  available to the corresponding DocAI context.
- `docai-selected`: the Stable `1.0.0` full or compact retrieval set selected
  before execution for that task.

The slicer must be reusable across the three APIs. Fixture-specific mappings
may identify roots, but extraction and reference closure must use the same
implementation and must be disclosed.

### Model Panel

The panel uses one required target per provider: OpenAI `gpt-5.6-sol`,
Anthropic `claude-sonnet-5`, and Google `gemini-3.6-flash`.
`model-resolutions.json` records the official catalog check, request settings,
standard prices, and resolved model IDs. Each ID must be checked again
immediately before the first batch. A model substitution after freezing
requires a new plan version unless the provider only reports the already-frozen
alias resolution.

## Prompt And Grading Controls

Every condition uses the same system message and JSON output contract. The
contract is supplied in the prompt and enforced by the provider-neutral local
grader. Provider schema-constrained output is disabled for all targets because
the contract intentionally permits arbitrary wire keys in selected objects.
The prompt must say to use only supplied documentation and report uncertainty
instead of inventing missing facts. Expected outcomes and grader-only evidence
must never appear in provider prompts.

Automated graders are the primary accuracy authority. A run may be `pass`,
`fail`, `blocked`, `malformed`, or `inconclusive`. Manual adjudication is allowed
only for records automatically classified as `inconclusive`; reviewers see
condition-neutral run identifiers and must not see the documentation condition.
If multiple reviewers adjudicate a record, agreement is reported.

Fixture or grader defects discovered after execution starts do not justify
silent exclusion. Stop the batch, retain affected attempts, repair under a new
plan version, and clearly label the superseded data.

## Execution And Batching

The 648 primary requests are split into nine batches of 72. One batch contains
one API, one repetition, six tasks, three models, and four conditions. Batches
are interleaved by repetition so all APIs receive an early observation:

| Batch | API | Repetition | Planned requests |
|---|---|---:|---:|
| `b01` | `complete-commerce` | 1 | 72 |
| `b02` | `holdout-field-service` | 1 | 72 |
| `b03` | `holdout-media-processing` | 1 | 72 |
| `b04` | `complete-commerce` | 2 | 72 |
| `b05` | `holdout-field-service` | 2 | 72 |
| `b06` | `holdout-media-processing` | 2 | 72 |
| `b07` | `complete-commerce` | 3 | 72 |
| `b08` | `holdout-field-service` | 3 | 72 |
| `b09` | `holdout-media-processing` | 3 | 72 |

One work step executes no more than one batch and no more than 100 provider
attempts. Successful, failed, blocked, malformed, rate-limited, and retried
calls all count. After each batch the runner stops and requires explicit user
approval for the next batch.

Condition order is deterministically rotated within API/task/model blocks from
the frozen plan ID, batch, task, and target. This avoids always placing one
condition first while keeping execution reproducible. Exact scheduled order is
exported before approval.

Only a transport failure that occurs before a usable provider response may be
retried, at most once. Content failures, malformed model output, safety blocks,
rate-limit responses with a recorded provider result, and grader failures are
not silently rerun. Both transport attempts remain in the audit record and
count toward the 100-attempt cap.

Each batch has an idempotent checkpoint keyed by frozen plan ID, batch, target,
task, condition, and attempt. Resume skips completed identities. The boundary
report includes attempted, completed, blocked, failed, malformed, retried, and
inconclusive counts; provider usage; available cost/account signals; grader
results; exact model IDs; and remaining batches.

## Cost And Early Stop Rules

All prompts must be exported before `b01`. Deterministic UTF-8 bytes,
characters, and characters/4 estimates are required. Provider input-token
estimates and current official prices are used to prepare whole-pilot and
per-batch ceilings. The user must approve the concrete ceiling for `b01`.
Approval never carries to the next batch.

Stop a batch immediately for any of these conditions:

- billing or credit failure;
- an unavailable or unexpectedly resolved model;
- repeated rate limiting that would require a second retry for one run;
- a fixture, prompt, parser, or grader defect;
- actual prompt size more than 10% above the approved estimate;
- projected batch spend more than 20% above the approved estimate; or
- 100 attempted provider calls.

Stop the pilot for review before another batch if cumulative malformed plus
inconclusive records exceed 5%, any condition is missing paired records, a
source-fact parity audit fails, or a model/condition combination has a systemic
parser failure. A low pass rate by itself is a result, not a reason to rerun.
The 5% threshold is evaluated in the completed batch report and does not stop
the current batch midway. Immediate fixture, parser, or grader defects remain
separate stop conditions.

## Analysis

The unit of pairing is API, task, target, and repetition. Primary pass-rate
contrasts are `docai-selected` versus each OpenAPI condition. Report percentage
point differences and 95% paired cluster-bootstrap confidence intervals, using
10,000 resamples with seed `20260721`; exact paired McNemar tests are secondary.
Apply Holm correction to the three primary pass-rate contrasts.

Report provider input-token mean and median paired differences with 95%
cluster-bootstrap intervals. Also report successful tasks per million input
tokens. Deterministic bytes and character counts are descriptive secondary
metrics.

Report results by provider, API, task class, condition, and repetition, plus:

- all-three-repetitions-pass rate;
- blocked, malformed, inconclusive, and failure-category distributions;
- raw/sliced missing-source-fact failures separately from representation
  failures; and
- fixture gaps without reclassifying the original run.

A mixed-effects logistic model with condition as a fixed effect and API, task,
and model as random intercepts is exploratory and is reported only if it
converges. It does not replace paired primary estimates.

## Pilot Stop/Go And Publication

After `b09`, proceed to publication analysis only if all planned pair identities
are present or transparently blocked, automated grading coverage is at least
95%, malformed plus inconclusive records are at most 5%, source parity passes,
and no unresolved fixture or grader defect remains. Otherwise publish a methods
and failure report without an accuracy headline.

Broader follow-up execution is not automatic. It requires a new estimate and
approval and should add APIs or task classes only when this pilot is reliable.

Published claims must name the benchmark version, run dates, APIs, tasks,
models, repetitions, context conditions, confidence intervals, and limitations.
They must not generalize the result to every API, model, or implementation task.
