# OpenAPI Comparison v3 Calibration 3 Plan

## Identity

- Benchmark ID: `docai-http-openapi-comparison-v3`
- Plan version: `3.0.0-calibration.3`
- Published status: `calibration-frozen` (verify the plan and manifest)

Stop/resume corrections passed Task 2 review. Execute CLI and verified-report
corrections passed Task 3 review. Task 4 binds the November 10, 2026 catalogs,
canonical private inputs, provider-specific costs and normalized plan anchor.
The freeze is not execution approval; Task 5 review and explicit Live
confirmation are still required.

## Calibration Matrix

The calibration evaluates `complete-commerce` tasks
`upload-document-request` and `complete-checkout-workflow` once for each of
these targets and conditions:

- `openai-frontier` via OpenAI
- `anthropic-balanced` via Anthropic
- `google-stable-agentic` via Google
- `openapi-raw`, `openapi-sliced`, `openapi-enriched`, and `docai-selected`

This is `2 x 3 x 1 x 4 = 24` planned requests. A work step may attempt at most
100 requests. The calibration gate requires at least 23 automated decisions
and at most 1 exceptional run.

Approved models are `gpt-5.6-sol`, `claude-sonnet-5`, and `gemini-3.8-flash`.
Exact IDs, settings and prices are bound by `model-resolutions.json`; the
canonical 24-row schedule and generated prompt/metrics hashes are frozen.
No provider run, checkpoint or approval state is supplied. Provider execution
requires separate explicit approval for this exact identity.

## Future Primary Design

The future primary design is metadata only: 3 APIs x 6 tasks x 3 targets x 3
repetitions x 4 conditions = 648 requests, arranged in 9 batches of 72. It is
not a primary schedule and requires separate design, evidence, and approval.
