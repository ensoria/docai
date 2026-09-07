# OpenAPI Comparison v3 Calibration Runbook

This runbook records the frozen `3.0.0-calibration.1` calibration envelope and
its current execution status. It does not authorize provider calls, create
private run state, or authorize a primary benchmark schedule.

> **Execution blocked:** do not execute `3.0.0-calibration.1`. Final review
> found that its retained-run validator checks record structure and transport
> state but does not recompute parsing, contract validation, and grading from
> each retained provider response. Because the affected checker, runner,
> parser, grader, and gate are frozen artifacts, the correction requires a new
> calibration identity rather than a change to this one.

## Frozen Calibration Envelope

- Requests: exactly 24.
- Models: `gpt-5.6-sol`, `claude-sonnet-5`, and `gemini-3.7-flash`.
- Combined token ceiling: 322,770 tokens.
- Cost ceiling: USD 2.4957045.

The 24-request calibration is a planned exception to the normal 50-to-100
request work-step target. It is a fixed reliability calibration that must
complete and pass its gate before any primary design or batch can be proposed.
It remains separately subject to explicit Live approval for this exact plan,
models, and ceiling.

## Preflight And Dry Run

Run the deterministic frozen-boundary checks first. These ordinary repository
checks intentionally omit `--private-required` and require no private response
files.

```sh
node docai-http/tools/check-openapi-comparison-v3-plan.mjs --frozen
node docai-http/tools/freeze-openapi-comparison-v3.mjs --check
node docai-http/tools/check-openapi-comparison-v3-parity.mjs
node docai-http/tools/check-release-readiness.mjs
```

Then validate the runner without provider calls:

```sh
node docai-http/tools/run-openapi-comparison-v3-calibration.mjs --dry-run
```

Confirm the dry run reports the frozen plan identity, 24-request ceiling, the
three exact models, the 322,770-token ceiling, USD 2.4957045 cost ceiling, and
zero provider calls. This confirms the retained artifact, but it does not
remove the execution block above.

## Required Replacement

Before any Live provider request, create and freeze a new calibration identity
that:

- recomputes parsing, output-contract validation, grading, uncertainty, and
  relevant audit fields from every retained response and canonical task;
- rejects any mismatch between the recomputed result and the retained run;
- makes the calibration gate consume only verified results;
- includes regression tests for fabricated all-pass records and mismatched
  response/run payloads; and
- receives a separate explicit Live approval for its exact request, model,
  token, and cost envelope after the replacement freeze passes review.

## Historical Post-Run Commands

The following `3.0.0-calibration.1` commands validate structure and evaluate
stored result fields, but they do not establish that those fields were derived
from the retained provider responses. They are retained for auditability and
must not be used to approve this calibration:

```sh
node docai-http/tools/check-openapi-comparison-v3-runs.mjs
node docai-http/tools/check-openapi-comparison-v3-calibration.mjs
```

Likewise, its conditional blinded one-reviewer packet remains historical only:

```sh
node docai-http/tools/openapi-comparison-v3-adjudication.mjs --write
node docai-http/tools/check-openapi-comparison-v3-adjudication.mjs --require-complete
```

The packet and source records stay in the ignored private directory. Its manual
decisions remain secondary evidence and do not replace automatic results.
