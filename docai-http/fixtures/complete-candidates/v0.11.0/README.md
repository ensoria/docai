# DocAI HTTP 0.11.0 Complete Candidate Fixtures

This directory contains the first candidate full/compact example pair for the future complete generator implementation surface. It is not part of the `0.11.0` Compatibility Core and does not make the repository complete-generator-ready.

This corpus is intentionally a candidate example set, not the final complete conformance corpus required by README section 9.1. Remaining focused complete-surface fixtures and live LLM task evaluation evidence still need to land before the README publication label can change.

Layout:

- `source/complete-openapi.yaml` is the source OpenAPI fixture referenced by the full and compact candidate sets.
- `source/recursive-direct-openapi.yaml` and `source/recursive-indirect-openapi.yaml` are recursive source inputs whose generated projections use `unsupported`.
- `valid/full/` contains the full-profile candidate set.
- `valid/compact/` contains the matching compact-profile candidate set.
- `focused/valid/` and `focused/invalid/` contain focused complete-surface snippets for the areas listed in `COVERAGE.md`, including profile pairing, compact reductions, non-JSON, polymorphism, workflow/webhook boundaries, metadata, canonical boundaries, unknown state, structured parameters, response headers, errors, generated examples, media-type boundaries, localized/replacement `unsupported`, and recursive fallback.
- `COVERAGE.md` records which readiness evidence is present and which evidence is still missing.
- `TOKEN-SAVINGS.md` records compact-profile candidate reduction guidance.
- `evaluations/` contains the complete-candidate LLM evaluation task packet, local context metrics, and live-evaluation status.

The full and compact sets use identical standard docs-root-relative paths:

- `INDEX.md`
- `CONVENTIONS.md`
- `resources/users.md`
- `resources/checkout.md`
- `resources/payments.md`
- `resources/documents.md`
- `workflows/checkout.md`
- `webhooks/payment-completed.md`

Both sets share `projection_id: complete-candidate-20260710-001`. The full INDEX links `Compact set: ../compact/`; the compact INDEX links `Full set: ../full/`.

The compact set demonstrates candidate use of compact examples, `field_defaults`, `same_as` with discoverable retrieval-unit metadata, and webhook payload `Client-visible fields` / `Opaque fields`.

Run `node tools/check-complete-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-complete-candidates.mjs` from the repository root, to check this complete candidate corpus. The checker is corpus-specific expectation coverage, not a public reusable validator.

Run `node tools/check-complete-evaluations.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-complete-evaluations.mjs` from the repository root, to check the evaluation task packet and print local context metrics. This does not run a live LLM evaluation.
