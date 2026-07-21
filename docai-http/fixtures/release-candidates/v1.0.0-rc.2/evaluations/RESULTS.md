# v1.0.0-rc.2 Evaluation Results

Status: required live provider refresh in progress. Six deterministic token-load
records and all five Google live task records pass; ten Anthropic/OpenAI live
records require maintainer execution.

This snapshot evaluates the corrected `fixtures/conformance/v1.0.0/valid/`
documents. It does not alter the historical `0.12.0` records and does not refresh
the historical OpenAPI comparison.

## Target LLM List

| Target | Provider | Model | Required | Role | Status |
|---|---|---|---|---|---|
| openai-frontier | openai | gpt-5.6-sol | yes | frontier reasoning and coding baseline | maintainer live refresh pending; token load passed |
| anthropic-balanced | anthropic | claude-sonnet-5 | yes | balanced cross-provider long-context baseline | maintainer live refresh pending; token load passed |
| google-stable-agentic | google | gemini-3.5-flash | yes | stable agentic and coding baseline | all live tasks and token load passed |
| openai-cost | openai | gpt-5.6-luna | no | cost-sensitive OpenAI comparison | not planned for rc.2 |
| anthropic-fast | anthropic | claude-haiku-4-5 | no | fast Anthropic comparison | not planned for rc.2 |
| google-cost | google | gemini-3.1-flash-lite | no | cost-sensitive Google comparison | not planned for rc.2 |

## Local Context Metrics

Recorded on 2026-07-21 from the corrected conformance context.

| Task | Context | UTF-8 bytes | Characters | Approx tokens(chars/4) |
|---|---|---:|---:|---:|
| request-create-user-compact | compact | 11184 | 11184 | 2796 |
| request-upload-document-full | full | 10321 | 10321 | 2581 |
| response-payment-created-compact | compact | 14570 | 14570 | 3643 |
| error-create-user-compact | compact | 11184 | 11184 | 2796 |
| workflow-complete-checkout-compact | compact | 17862 | 17862 | 4466 |
| token-load-create-user | full | 11932 | 11932 | 2983 |
| token-load-create-user | compact | 11184 | 11184 | 2796 |
| token-load-checkout | full | 18700 | 18700 | 4675 |
| token-load-checkout | compact | 17862 | 17862 | 4466 |

## Token Load

All six required-target records passed. The create-user compact context saves
748 characters and approximately 187 chars/4 tokens. The checkout compact
context saves 838 characters and approximately 209 chars/4 tokens.

## Live LLM Results

Official provider catalogs were checked on 2026-07-21 for the selected model
IDs. The successful Google calls also confirmed live resolution of
`gemini-3.5-flash`.

| Target | Task group | Records | Status | Notes |
|---|---|---:|---|---|
| google-stable-agentic | request construction | 2 | pass | Includes operation-unique idempotency keys, JSON/multipart request details, and delegated multipart boundary generation. |
| google-stable-agentic | response handling | 1 | pass | Includes the fixed `pending` value and both downstream references. |
| google-stable-agentic | error handling | 1 | pass | Includes corrected-input/new-key handling and unchanged-input non-retry behavior. |
| google-stable-agentic | workflow completion | 1 | pass | Preserves IDs and the same idempotency key for safe order replay. |
| anthropic-balanced | all live groups | 5 | pending | Managed execution blocked private-workspace context export; run from the maintainer environment. |
| openai-frontier | all live groups | 5 | pending | Not sent after the managed-environment export block; run from the maintainer environment. |

The multipart grader accepts direct part fields or standard nested
`Content-Disposition` and `Content-Type` headers. The workflow grader accepts
`POST /orders`, `order request`, or `order operation` when the same endpoint,
state, values, and idempotency key are otherwise explicit. These are
representation normalizations, not relaxed behavior requirements.

## Maintainer Commands Still Required

From the repository root, run:

```sh
for group in request_construction response_handling error_handling workflow_completion
do
  node docai-http/tools/run-rc2-complete-evaluation.mjs anthropic "$group" --target anthropic-balanced
  node docai-http/tools/run-rc2-complete-evaluation.mjs openai "$group" --target openai-frontier
done

node docai-http/tools/check-rc2-evaluations.mjs
```

These commands send the selected conformance context to Anthropic and OpenAI and
may incur API usage cost. Review every resulting pass/fail record before changing
this snapshot status to complete.
