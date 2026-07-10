# DocAI HTTP 0.11.0 Webhook Candidate Fixtures

This directory contains candidate fixtures for a future webhook promotion. They are not part of the `0.11.0` Compatibility Core and do not make webhook output compatibility-preserving for the current release.

Promotion-order decision: webhook support is prepared after workflow support and remains a separate opt-in compatibility scope candidate. The first webhook candidate scope covers discovery from INDEX, triggering endpoint references, fixed webhook sections, event-specific headers, single-event payloads, grouped payload variants, event-specific delivery deviations, and deduplication guidance.

Layout:

- `valid/full/` contains a full-profile candidate document set with one single-event webhook and one grouped webhook.
- `valid/full/webhooks/payment-completed.md` demonstrates a single event with event-specific delivery deviation and a unique deduplication key.
- `valid/full/webhooks/subscription-events.md` demonstrates grouped events with tagged payload variants and a composite deduplication strategy.
- `focused/invalid/` contains focused negative snippets for webhook section order, INDEX references, endpoint `Related` references, grouping boundaries, event-specific headers, payload `Presence`, and deduplication.
- `../../webhook-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the candidate set.

These fixtures are intentionally not checked by `tools/check-core-fixtures.mjs`; that checker remains scoped to the published Compatibility Core corpus. Run `node tools/check-webhook-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-webhook-candidates.mjs` from the repository root, to check the webhook candidate expectations.
