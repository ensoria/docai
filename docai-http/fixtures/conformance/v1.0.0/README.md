# DocAI HTTP 1.0.0 Stable Conformance Fixtures

This directory is the intended first stable conformance corpus for DocAI HTTP `1.0.0`.
It originated from the `0.12.0` complete-generator-ready candidate corpus and is
maintained as a separate versioned conformance corpus so the stable compatibility
boundary is not silently tied to candidate evidence paths. The `rc.2` preparation
corrects Type and XML field syntax, source provenance, safe retry behavior, and
Request `same_as` checker coverage found during review of `v1.0.0-rc.1`. The
`rc.3` completed the authoritative success-response, response-header,
error-shape, constraint, default, document-metadata, and webhook source evidence
found incomplete during focused review of `v1.0.0-rc.2`. The `rc.4` preparation
completes focused-fixture source-revision identity and checker coverage found
incomplete during review of published `v1.0.0-rc.3`.

The standard DocAI HTTP document files in `valid/full/`, `valid/compact/`, and the
focused fixture snippets declare `docai-http: 1.0.0`. The semantic differences from
the evaluated `0.12.0` candidate are recorded in `SEMANTIC-DRIFT-AUDIT.md`; the old
evaluation records are not direct evidence for the corrected standard documents.

This corpus covers the stable complete surface intended for `1.0.0`: full profile,
matching compact profile, resources, workflows, webhooks, selective conventions,
common and inline errors, non-JSON representation rules, polymorphic variants,
`unknown`, `unsupported`, recursive-schema fallback, compact reductions, and the
focused syntax/behavior boundaries listed in `COVERAGE.md`.

Layout:

- `source/complete-input-set.yaml` is the authoritative input-set manifest referenced
  by the full and compact conformance sets.
- `source/complete-openapi.yaml` provides operations and structured schemas.
- `source/complete-behavior.yaml` provides pass-through conventions, errors, retry
  behavior, workflows, webhooks, and multipart constraints.
- `source/recursive-direct-openapi.yaml` and `source/recursive-indirect-openapi.yaml`
  are recursive source inputs whose generated projections use `unsupported`.
- `valid/full/` contains the full-profile conformance set.
- `valid/compact/` contains the matching compact-profile conformance set.
- `focused/valid/` and `focused/invalid/` contain focused complete-surface snippets
  for the areas listed in `COVERAGE.md`.
- `COVERAGE.md` records the stable conformance evidence present in this corpus.
- `SOURCE-TRACEABILITY.md` records the source fixture audit and the decision not
  to require a public source-to-projection validator before `1.0.0`.
- `RC2-REVIEW-REGRESSION.md` maps the nine `rc.1` review findings to corrected
  files and deterministic regression evidence.
- `RC3-SOURCE-REVIEW.md` limits the next focused review to authoritative source
  completeness and current-release wording left by review of `rc.2`.
- `RC4-METADATA-REVIEW.md` limits the next review to focused metadata identity,
  checker rejection evidence, and current-release wording.
- `SEMANTIC-DRIFT-AUDIT.md` records the corrected corpus differences from the
  evaluated `0.12.0` candidate and their evaluation impact.
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

Both sets share `projection_id: conformance-20260721-rc4-001`. The full INDEX links
`Compact set: ../compact/`; the compact INDEX links `Full set: ../full/`.

Run `node tools/check-conformance-fixtures.mjs` from the `docai-http/` directory,
or `node docai-http/tools/check-conformance-fixtures.mjs` from the repository root,
to check this stable conformance corpus. The checker is corpus-specific expectation
coverage, not a public reusable validator or a full source-to-projection validator.

The original live LLM task evaluations, deterministic token-load evidence, and
OpenAPI comparison evidence were recorded against the `0.12.0` candidate. The
separate `rc.2` task snapshot refreshed behavior-affecting evidence. For `rc.3`,
those stored responses were regraded without provider submission. The `rc.4`
correction changes provenance stamps and checker coverage, not loaded task
semantics, so it also requires no provider submission. OpenAPI comparison claims remain scoped to `0.12.0`; see
`SEMANTIC-DRIFT-AUDIT.md` and the active release TODO.
