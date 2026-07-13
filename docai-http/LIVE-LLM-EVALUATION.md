# Live LLM Evaluation Procedure

This document describes how to run live LLM evaluations for the DocAI HTTP complete-candidate corpus.

It is maintainer guidance, not a normative specification source. `README.md` remains authoritative for DocAI HTTP format rules, and `fixtures/complete-candidates/v0.11.0/evaluations/` remains the source of truth for the current task packet, target list, prompt export, result records, and local metrics.

## Purpose

Live LLM evaluation checks whether the complete-candidate corpus supports realistic task execution by model readers, not only whether the Markdown fixtures are syntactically valid.

The evaluation evidence should answer these questions:

- Can a model construct correct requests from the selected `INDEX.md`, `CONVENTIONS.md`, and resource files?
- Can a model interpret responses, response headers, body presence, related workflow/webhook references, and error behavior?
- Can a model follow workflow state, preserve values across steps, and reconcile webhook delivery?
- Does the compact profile reduce loaded context without removing behavior needed by the task?
- When a model fails, is the failure caused by model behavior, missing retrieval context, contradictory documentation, or a fixture/specification gap?

Live results do not need to prove that every target model succeeds. They must show that failures are not caused by missing or contradictory DocAI HTTP documentation before the publication label can move beyond the current Compatibility Core claim.

## Inputs And Evidence Files

Use these files for the current complete-candidate evaluation:

- `fixtures/complete-candidates/v0.11.0/evaluations/tasks.json`: task groups, task prompts, expected outcomes, context files, and evidence strings.
- `fixtures/complete-candidates/v0.11.0/evaluations/targets.json`: required and optional target models.
- `tools/build-complete-evaluation-prompts.mjs`: deterministic JSONL prompt export.
- `fixtures/complete-candidates/v0.11.0/evaluations/runs/*.jsonl`: live result records.
- `tools/check-complete-evaluations.mjs`: task packet, target list, result record, local metric, and automated grading checks for request construction, response handling, and error handling.
- `fixtures/complete-candidates/v0.11.0/evaluations/RESULTS.md`: human-readable status summary.

Before each live run, refresh the official provider model and pricing pages. Model availability, aliases, context limits, pricing, and usage accounting are provider-controlled and may change without a DocAI HTTP change.

## Required Targets

The current required target set is:

| Target ID | Provider | Model | Role |
|---|---|---|---|
| `openai-frontier` | OpenAI | `gpt-5.6-sol` | Frontier reasoning and coding baseline. |
| `anthropic-balanced` | Anthropic | `claude-sonnet-5` | Balanced cross-provider long-context baseline. |
| `google-stable-agentic` | Google | `gemini-3.5-flash` | Stable agentic and coding baseline. |

The current optional target set is:

| Target ID | Provider | Model | Role |
|---|---|---|---|
| `openai-cost` | OpenAI | `gpt-5.6-luna` | Cost-sensitive OpenAI comparison. |
| `anthropic-fast` | Anthropic | `claude-haiku-4-5` | Fast Anthropic comparison. |
| `google-cost` | Google | `gemini-3.1-flash-lite` | Cost-sensitive Google comparison. |

Only required targets are needed for the publication gate. Optional targets are useful for cost, speed, and robustness comparisons after the required target evidence is complete.

## Recommended Execution Order

Run in small gates rather than running every provider and every task group at once.

### Gate 1: Required Request Construction

Run `request_construction` tasks against required targets only.

Recommended provider order:

1. `google-stable-agentic`
2. `anthropic-balanced`
3. `openai-frontier`

Rationale:

- Request construction has the clearest current automated grading support.
- Starting with one required target limits cost and exposes prompt, fixture, and result-record problems early.
- Running the stable/cost-conscious required target first usually finds documentation gaps before spending on the frontier baseline.
- Anthropic second gives cross-provider signal before using the highest-capability frontier baseline.
- OpenAI frontier last confirms whether remaining failures are likely model-specific or fixture/specification issues.

Run:

```sh
node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction
```

To execute each required target directly after reviewing the prompt export, run the provider-specific command:

```sh
node docai-http/tools/run-google-complete-evaluation.mjs request_construction --target google-stable-agentic
node docai-http/tools/run-anthropic-complete-evaluation.mjs request_construction --target anthropic-balanced
node docai-http/tools/run-openai-complete-evaluation.mjs request_construction --target openai-frontier
```

These commands require `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` respectively and send the selected evaluation prompts and context to the corresponding external model provider API.

The Google runner sends the configured `temperature` value. The Anthropic and OpenAI runners omit `temperature` because the current required target models reject that parameter; use the fixed prompt packet, disabled tools, reviewed JSON result records, and the request-construction grader as the repeatability controls for those providers.

If the Codex managed environment blocks export of repository-derived prompts and fixture context to a provider, record the affected run as `blocked`. A maintainer can then run the same provider command locally outside the managed environment and replace the blocked record with the reviewed provider result.

Record one JSONL line per target/task result under:

```text
fixtures/complete-candidates/v0.11.0/evaluations/runs/request-construction.jsonl
```

Then run:

```sh
node docai-http/tools/check-complete-evaluations.mjs
```

Do not proceed to later gates if request-construction records reveal a fixture gap, contradictory documentation, missing context, or prompt/export problem.

### Gate 2: Required Response Handling

Run `response_handling` tasks against required targets.

Use the same provider order as Gate 1 unless a provider is blocked or unavailable. Response handling should run after request construction because response interpretation depends on the same retrieval path and convention loading behavior.

Stop if a failure indicates that the selected files do not contain enough information to interpret status, body fields, response headers, related workflows, or webhooks.

### Gate 3: Required Error Handling

Run `error_handling` tasks against required targets.

Error handling should run after response handling because it depends on common errors, inline errors, retryability, caller actions, and field-level behavior. Failures here are especially useful for finding missing common-error links or ambiguous endpoint-specific error rows.

Stop if a failure points to missing error-shape context, contradictory retry guidance, or incomplete caller-action documentation.

### Gate 4: Required Workflow Completion

Run `workflow_completion` tasks against required targets.

Workflow completion should run after request, response, and error tasks because it combines endpoint calls, state transitions, recovery branches, and webhook reconciliation. It is more integration-like than the earlier task groups.

Stop if a failure indicates missing workflow links, missing value-passing guidance, unclear recovery behavior, or ambiguous webhook reconciliation.

### Gate 5: Token-Load And Usage Recording

Record token-load measurements for each task/model/profile combination.

Use provider-reported usage when it is safe to publish and comparable enough to help evaluate the full/compact tradeoff. Keep local context metrics from `check-complete-evaluations.mjs` as deterministic baseline evidence.

Do not treat token counts as fully comparable across providers unless the tokenizer and accounting method are documented. Use them as practical evidence for each target model, not as a universal measurement.

### Gate 6: Optional Target Comparison

Run optional targets only after all required target gates are complete or explicitly blocked with documented reasons.

Use optional targets to answer narrower questions:

- Does a cost-sensitive model still handle the same retrieval path?
- Does a faster model fail in predictable ways?
- Does compact output remain usable for lower-cost or lower-latency models?
- Are failures concentrated in one provider family or one task group?

Optional targets should not compensate for missing required evidence.

## Decision Criteria

### Proceed

Proceed to the next gate when:

- All required target records for the current gate are present.
- `node docai-http/tools/check-complete-evaluations.mjs` passes.
- All failures, if any, are model-specific and do not indicate missing or contradictory DocAI HTTP documentation.
- `RESULTS.md` summarizes the gate status clearly enough for a reviewer to understand publication impact.

### Stop And Fix Fixtures

Stop live evaluation and fix the corpus when:

- Any result sets `review.fixture_gap` to `true`.
- The model needed facts that were absent from the selected context.
- The result exposes contradictory guidance between a resource file and `CONVENTIONS.md`.
- The result exposes a missing `Related` link, missing convention, missing error shape, or insufficient workflow/webhook retrieval path.
- The prompt exporter omitted necessary context or leaked expected outcomes.

After the fix, rerun the affected gate from the beginning for all required targets.

### Record As Blocked

Record a `blocked` run instead of silently skipping it when:

- A provider API key is unavailable.
- The provider rejects the model ID.
- The run exceeds quota or budget.
- The provider is down or rate-limited beyond the planned evaluation window.
- Safety, policy, or account controls prevent the call.

If a required target is blocked, do not replace it with another model without updating `targets.json`, the rationale, and `RESULTS.md`.

## Authentication And Secret Handling

Keep provider API keys out of the repository.

Recommended handling:

- Use environment variables or a local secret manager.
- Never write keys, bearer tokens, account IDs, or raw HTTP authorization headers into `runs/*.jsonl`.
- Commit only reviewed, publishable result records.
- When raw provider logs are useful for debugging, keep them outside the repository and summarize only safe fields in the result record.

Before running, decide which provider keys are available and who owns the spend. If only one provider key is available, start with that provider as a smoke test but do not treat it as complete publication evidence.

## Cost Controls

Use small gates to limit spend:

1. Generate prompt records with `--summary` first.
2. Run one target and one task group before expanding.
3. Review and check JSONL before running the next provider.
4. Stop immediately on fixture gaps.
5. Run optional targets only after required evidence is useful.

For a dry run, generate prompts without provider calls:

```sh
node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction --summary
```

For required-only full prompt export:

```sh
node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction
```

For required plus optional prompt export:

```sh
node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction --include-optional
```

## Result Record Review

Each live result record must include:

- `run_id`
- `target_id`
- `task_id`
- `provider`
- `model`
- `executed_at`
- `status`
- `review.fixture_gap`
- `review.notes`
- `review.matches_expected_outcome` for non-blocked runs
- `response` for non-blocked runs, or `blocked_reason` for blocked runs

For request-construction, response-handling, and error-handling records, `check-complete-evaluations.mjs` also verifies that `review.matches_expected_outcome` agrees with the corresponding automated grader.

## Publication Impact

Do not change the README publication label until:

- Every required target has been run, or a required block has been explicitly recorded and judged acceptable by maintainers.
- Every required task group has result evidence.
- Fixture gaps found by live runs have been fixed and rerun.
- `RESULTS.md` summarizes pass/fail/blocked counts, fixture gaps, model-specific failures, and publication impact.
- The complete-candidate checker and evaluation checker pass.

Optional target success is helpful comparison evidence, but it does not replace required target coverage.
