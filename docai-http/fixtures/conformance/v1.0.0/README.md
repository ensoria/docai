# DocAI HTTP 1.0.0 Stable Conformance Fixtures

This directory is the intended first stable conformance corpus for DocAI HTTP `1.0.0`.
It is copied from the `0.12.0` complete-generator-ready candidate corpus and promoted
as a separate versioned conformance corpus so the stable compatibility boundary is not
silently tied to candidate evidence paths.

The standard DocAI HTTP document files in `valid/full/`, `valid/compact/`, and the
focused fixture snippets declare `docai-http: 1.0.0`. Their API content matches the
`0.12.0` complete-candidate corpus except for stable-conformance metadata, source
paths, and fixture expectation labels.

This corpus covers the stable complete surface intended for `1.0.0`: full profile,
matching compact profile, resources, workflows, webhooks, selective conventions,
common and inline errors, non-JSON representation rules, polymorphic variants,
`unknown`, `unsupported`, recursive-schema fallback, compact reductions, and the
focused syntax/behavior boundaries listed in `COVERAGE.md`.

Layout:

- `source/complete-openapi.yaml` is the source OpenAPI fixture referenced by the full
  and compact conformance sets.
- `source/recursive-direct-openapi.yaml` and `source/recursive-indirect-openapi.yaml`
  are recursive source inputs whose generated projections use `unsupported`.
- `valid/full/` contains the full-profile conformance set.
- `valid/compact/` contains the matching compact-profile conformance set.
- `focused/valid/` and `focused/invalid/` contain focused complete-surface snippets
  for the areas listed in `COVERAGE.md`.
- `COVERAGE.md` records the stable conformance evidence present in this corpus.
- `TOKEN-SAVINGS.md` records compact-profile reduction guidance for the conformance
  pair.

The full and compact sets use identical standard docs-root-relative paths:

- `INDEX.md`
- `CONVENTIONS.md`
- `resources/users.md`
- `resources/checkout.md`
- `resources/payments.md`
- `resources/documents.md`
- `workflows/checkout.md`
- `webhooks/payment-completed.md`

Both sets share `projection_id: conformance-20260710-001`. The full INDEX links
`Compact set: ../compact/`; the compact INDEX links `Full set: ../full/`.

Run `node tools/check-conformance-fixtures.mjs` from the `docai-http/` directory,
or `node docai-http/tools/check-conformance-fixtures.mjs` from the repository root,
to check this stable conformance corpus. The checker is corpus-specific expectation
coverage, not a public reusable validator.

The live LLM task evaluations, deterministic token-load evidence, and OpenAPI
comparison evidence were recorded against `fixtures/complete-candidates/v0.12.0/`.
They remain supporting evidence for this stable corpus only while the standard
document content stays semantically identical to that candidate corpus. If the
conformance document content changes beyond metadata, source paths, or expectation
labels, rerun the relevant deterministic checks and review whether the live LLM or
OpenAPI comparison evidence must be refreshed.
