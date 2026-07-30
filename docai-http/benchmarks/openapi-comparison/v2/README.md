# OpenAPI Comparison Benchmark v2

This directory contains the preregistered plan and, after execution, the
evidence for the second DocAI HTTP versus OpenAPI comparison benchmark.

The benchmark is adoption evidence. It is not part of the DocAI HTTP `1.0.0`
format or conformance compatibility boundary.

## Current State

The plan is a pre-registration draft. Live execution is locked until the two
private holdout APIs, all task contracts, output schemas, graders, prompt
templates, context builders, and a cost estimate have been reviewed and
recorded in the freeze manifest.

Run the draft-plan checker from the repository root:

```sh
node docai-http/tools/check-openapi-comparison-v2-plan.mjs
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

Inspect the deterministic 648-request schedule without writing it:

```sh
node docai-http/tools/build-openapi-comparison-v2-schedule.mjs --summary
```

The final preflight will use `--write` to export `schedule.jsonl`; that generated
file then becomes part of the freeze manifest.

Before any provider request, the stricter frozen-plan check must also pass:

```sh
node docai-http/tools/check-openapi-comparison-v2-plan.mjs --frozen
```

The frozen check intentionally fails while `plan.json` has
`status: pre-registration-draft`.

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
- `freeze-manifest.json` will be created only after every benchmark artifact is
  complete and hashed.
- `batches/` and `runs/` will be created when the frozen execution tooling is
  implemented.
