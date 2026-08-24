# OpenAPI Comparison Benchmark v2

This directory contains the preregistered plan and, after execution, the
evidence for the second DocAI HTTP versus OpenAPI comparison benchmark.

The benchmark is adoption evidence. It is not part of the DocAI HTTP `1.0.0`
format or conformance compatibility boundary.

## Current State

The plan is frozen as `2.0.0-frozen.3`. The two private holdout APIs, task
contracts, output contracts, graders, prompt templates, context builders, model
resolutions, schedule, and cost estimate are recorded in the SHA-256 freeze
manifest. Live execution under this plan has not started and still requires
separate approval. Four retained attempts from superseded `2.0.0-frozen.2` are
excluded from primary analysis as recorded in `EXECUTION-LOG.md`.

Run the frozen-plan checker from the repository root:

```sh
node docai-http/tools/check-openapi-comparison-v2-plan.mjs --frozen
```

Run the public evaluation-contract tests:

```sh
node --test \
  docai-http/tools/tests/openapi-comparison-v2-contract.test.mjs \
  docai-http/tools/tests/openapi-comparison-v2-continuity.test.mjs \
  docai-http/tools/tests/openapi-comparison-v2-grader.test.mjs
```

Context construction requires the `ruby` executable and its standard `yaml`
and `json` libraries; no third-party Ruby packages are required. When the
private holdouts are available locally, validate all four contexts and source
fact parity with:

```sh
DOCAI_BENCHMARK_PRIVATE_REQUIRED=1 \
  node docai-http/tools/check-openapi-comparison-v2-parity.mjs --private-required
```

Export the 648 provider-neutral prompt records and deterministic local metrics
to the ignored private workspace:

```sh
DOCAI_BENCHMARK_PRIVATE_REQUIRED=1 \
  node docai-http/tools/build-openapi-comparison-v2-prompts.mjs \
  --private-required --write --summary
node docai-http/tools/record-openapi-comparison-v2-metrics.mjs --write
```

The metrics include exact context and rendered-prompt UTF-8 bytes, Unicode
characters, and characters/4 estimates. Provider tokenizer counts remain empty
unless a stable tokenizer is explicitly supplied without adding a runtime
dependency. Provider-reported input tokens remain the primary Live efficiency
measurement.

## Grading Statuses

The generic grader first validates the strict output contract and then applies
the private task assertions:

- `malformed`: the provider output is not a JSON object or violates its output
  contract;
- `pass`: every assertion passes, regardless of any extra uncertainty text;
- `fail`: at least one assertion fails and `uncertainties` is empty; and
- `inconclusive`: at least one assertion fails and the structurally valid
  output contains one or more explicit uncertainty strings.

Only `inconclusive` records require blinded manual review. Content, format, and
grader outcomes never authorize an automatic rerun; only the separately frozen
transport policy can do so before a usable provider response exists.

The `header_contains` assertion compares HTTP header names case-insensitively,
validates bearer and idempotency values by their wire contracts, and treats
angle-bracket values as semantic placeholders rather than required literal
output. This prevents valid generated credentials or operation keys from being
graded as incorrect.

Inspect the deterministic 648-request schedule without writing it:

```sh
node docai-http/tools/build-openapi-comparison-v2-schedule.mjs --summary
```

The generated `schedule.jsonl` is part of the freeze manifest. Before any
provider request, the frozen-plan check must pass:

```sh
node docai-http/tools/check-openapi-comparison-v2-plan.mjs --frozen
```

Changing any hashed artifact now causes the frozen-plan check to fail.

## Execution Tooling

The provider-neutral runner, provider adapters, append-only run store, resume
checkpoints, batch reports, and run checker are implemented. Inspect the current
private run state without making provider requests:

```sh
node docai-http/tools/check-openapi-comparison-v2-runs.mjs
```

Before a provider call, the runner independently validates the frozen manifest,
all frozen generated outputs, and private source parity. It also requires one
matching command-line batch approval and the
`DOCAI_LIVE_LLM_APPROVED_BATCH` environment variable. Every attempt records the
runner SHA-256 revision and retains the raw provider response.

All targets use prompt-only JSON output. Provider schema constraints and
provider-specific JSON modes are disabled because the contracts intentionally
contain objects with arbitrary wire keys. The shared prompt carries the same
output contract for every target and condition; the provider-neutral local
grader classifies invalid JSON or contract violations as `malformed`. This
preserves the natural HTTP result shape and makes malformed-output frequency
part of the reported benchmark evidence.

## Private Holdouts

The two holdout API inputs must remain outside the public repository until all
nine primary batches are closed. Their hashes, not their contents, will be
recorded in the freeze manifest before execution. Publishing holdout contents
early would weaken the benchmark's training-contamination control.

Do not send provider requests from this directory until the user has approved
the concrete per-batch token and cost ceiling. Approval for one batch does not
authorize a later batch.

## Files

- `PLAN.md` explains claims, fairness rules, execution, analysis, and stopping
  criteria for human review.
- `plan.json` is the machine-readable matrix and policy source.
- `contracts.json` defines the six condition-neutral output contracts and the
  assertion vocabulary used by private expected outcomes.
- `continuity/` contains the six Stable `1.0.0` continuity task contracts and
  their hand-authored positive and targeted negative grader cases.
- `ARTIFACT-CONTRACT.md` defines the public/private split and the evidence
  required to freeze the plan.
- `IMPLEMENTATION.md` tracks the test-first implementation sequence.
- `model-resolutions.json` records the approved model IDs, request settings,
  and conservative standard token prices.
- `cost-estimate.json` records whole-pilot and per-batch token and cost ceilings.
- `schedule.jsonl` contains the 648 frozen primary run identities.
- `freeze-manifest.json` records 88 public/private artifact hashes, including
  the provider runner, adapters, and run checker.
- Ignored `private/runs/<plan-version>/<batch-id>/` directories hold append-only
  attempts and runs plus atomic checkpoints and batch reports during execution.
