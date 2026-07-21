# v1.0.0-rc.2 Evaluation Snapshot

This directory records refreshed evaluation evidence for the corrected
`v1.0.0-rc.2` release candidate. It is outside the stable compatibility
boundary and reads context from `fixtures/conformance/v1.0.0/valid/` without
copying or modifying the conformance documents.

The released `fixtures/complete-candidates/v0.12.0/evaluations/` records remain
immutable historical evidence. OpenAPI comparison records are not refreshed for
`rc.2`; comparative claims remain explicitly scoped to the evaluated `0.12.0`
fixture.

## Scope

- `tasks.json` contains five live tasks and two deterministic token-load tasks.
- `targets.json` retains the three required provider targets used by the
  historical evaluation so changed conformance behavior can be compared without
  changing the model panel.
- `runs/*.jsonl` contains six deterministic token-load records and fifteen live
  records after all required provider runs complete.
- Request grading requires an operation-unique `Idempotency-Key` for the create
  and upload tasks.
- Error and workflow grading checks corrected-input/new-key behavior and same-key
  replay behavior where those rules apply.

## Commands

From the repository root:

```sh
node docai-http/tools/build-rc2-evaluation-prompts.mjs all --summary
node docai-http/tools/record-rc2-token-load.mjs

node docai-http/tools/run-rc2-complete-evaluation.mjs google request_construction --target google-stable-agentic
node docai-http/tools/run-rc2-complete-evaluation.mjs anthropic request_construction --target anthropic-balanced
node docai-http/tools/run-rc2-complete-evaluation.mjs openai request_construction --target openai-frontier
```

Repeat the provider commands for `response_handling`, `error_handling`, and
`workflow_completion`, then run:

```sh
node docai-http/tools/check-rc2-evaluations.mjs
```

Provider commands require the matching `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, or
`OPENAI_API_KEY`. They send the selected task prompt and conformance context to
that provider and may incur API usage cost.
