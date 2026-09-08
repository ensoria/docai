# OpenAPI Comparison v3 Calibration 2 Plan

## Identity

- Benchmark ID: `docai-http-openapi-comparison-v3`
- Plan version: `3.0.0-calibration.2`
- Status: `calibration-draft`

## Calibration Matrix

The calibration draft evaluates `complete-commerce` tasks
`upload-document-request` and `complete-checkout-workflow` once for each of
these targets and conditions:

- `openai-frontier` via OpenAI
- `anthropic-balanced` via Anthropic
- `google-stable-agentic` via Google
- `openapi-raw`, `openapi-sliced`, `openapi-enriched`, and `docai-selected`

This is `2 x 3 x 1 x 4 = 24` planned requests. A work step may attempt at most
100 requests. The calibration gate requires at least 23 automated decisions
and at most 1 exceptional run.

Exact model IDs are unset in this draft. The package has no frozen schedule,
run data, or approval state. Provider execution requires separately approved
future work for this exact plan identity.

## Future Primary Design

The future primary design is metadata only: 3 APIs x 6 tasks x 3 targets x 3
repetitions x 4 conditions = 648 requests, arranged in 9 batches of 72. It is
not a primary schedule and requires separate design, evidence, and approval.
