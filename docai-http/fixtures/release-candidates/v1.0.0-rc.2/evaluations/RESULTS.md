# v1.0.0-rc.2 Evaluation Results

Status: twelve unaffected required live task records and all six required-target
deterministic token-load records pass. The early-settlement workflow ambiguity
found by human review is resolved in the `rc2-002` conformance projection, and
the three affected workflow records must now be refreshed before this evidence
is release-complete.

This snapshot evaluates the corrected `fixtures/conformance/v1.0.0/valid/`
documents. It does not alter the historical `0.12.0` records and does not refresh
the historical OpenAPI comparison.

## Target LLM List

| Target | Provider | Model | Required | Role | Status |
|---|---|---|---|---|---|
| openai-frontier | openai | gpt-5.6-sol | yes | frontier reasoning and coding baseline | workflow refresh pending; other live tasks and token load passed |
| anthropic-balanced | anthropic | claude-sonnet-5 | yes | balanced cross-provider long-context baseline | workflow refresh pending; other live tasks and token load passed |
| google-stable-agentic | google | gemini-3.5-flash | yes | stable agentic and coding baseline | workflow refresh pending; other live tasks and token load passed |
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
| workflow-complete-checkout-compact | compact | 18946 | 18946 | 4737 |
| token-load-create-user | full | 11932 | 11932 | 2983 |
| token-load-create-user | compact | 11184 | 11184 | 2796 |
| token-load-checkout | full | 19716 | 19716 | 4929 |
| token-load-checkout | compact | 18946 | 18946 | 4737 |

## Token Load

All six required-target records passed. The create-user compact context saves
748 characters and approximately 187 chars/4 tokens. The checkout compact
context saves 770 characters and approximately 192 chars/4 tokens.

## Live LLM Results

Official provider catalogs were checked on 2026-07-21 for the selected model
IDs. Successful calls confirmed live resolution of `gpt-5.6-sol`,
`claude-sonnet-5`, and `gemini-3.5-flash`.

| Target | Task group | Records | Status | Notes |
|---|---|---:|---|---|
| google-stable-agentic | request construction | 2 | pass | Includes operation-unique idempotency keys, JSON/multipart request details, and delegated multipart boundary generation. |
| google-stable-agentic | response handling | 1 | pass | Includes the fixed `pending` value and both downstream references. |
| google-stable-agentic | error handling | 1 | pass | Includes corrected-input/new-key handling and unchanged-input non-retry behavior. |
| google-stable-agentic | workflow completion | 1 | refresh pending | The recorded response predates the settled-payment/no-recapture contract. |
| anthropic-balanced | request construction | 2 | pass | Includes operation-unique idempotency keys, JSON/multipart request details, and delegated multipart boundary generation. |
| anthropic-balanced | response handling | 1 | pass | Includes the fixed `pending` value and both downstream references. |
| anthropic-balanced | error handling | 1 | pass | Includes corrected-input/new-key handling and unchanged-input non-retry behavior. |
| anthropic-balanced | workflow completion | 1 | refresh pending | The recorded response predates the settled-payment/no-recapture contract. |
| openai-frontier | request construction | 2 | pass | Includes operation-unique idempotency keys, JSON/multipart request details, and delegated multipart boundary generation. |
| openai-frontier | response handling | 1 | pass | Includes the fixed `pending` value and both downstream references. |
| openai-frontier | error handling | 1 | pass | Includes corrected-input/new-key handling and unchanged-input non-retry behavior. |
| openai-frontier | workflow completion | 1 | refresh pending | The recorded response predates the settled-payment/no-recapture contract. |

The multipart grader accepts direct part fields or standard nested
`Content-Disposition` and `Content-Type` headers. The workflow grader accepts
`POST /orders`, `order request`, or `order operation` when the same endpoint,
state, values, and idempotency key are otherwise explicit. These are
representation normalizations, not relaxed behavior requirements.

## Required Gate Summary

| Gate | Required records | Result | Fixture gap |
|---|---:|---|---|
| Request construction | 6 | pass | no |
| Response handling | 3 | pass | no |
| Error handling | 3 | pass | no |
| Workflow completion | 3 | refresh pending | resolved fixture gap; new runs required |
| Deterministic token load | 6 | pass | no |

The live task result is evidence for this corrected conformance context and the
recorded task/model panel. It is not a claim that every LLM or every API will
produce the same result. The historical OpenAPI comparison remains scoped to the
evaluated `0.12.0` fixture and is not combined with this `rc.2` result.

Human review found that the old workflow context did not say whether
`POST /orders` remained valid after an early `payment.completed` webhook changed
the payment from pending to settled. The chosen correction tracks payment and
order state independently: `POST /orders` accepts either payment state, captures
a pending payment once, and associates an already settled payment without
capturing it again. The three workflow records above remain provisional until
they are rerun against that corrected contract.
