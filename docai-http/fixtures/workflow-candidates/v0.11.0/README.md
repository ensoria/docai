# DocAI HTTP 0.11.0 Workflow Candidate Fixtures

This directory contains candidate fixtures for a future workflow promotion. They are not part of the `0.11.0` Compatibility Core and do not make workflow output compatibility-preserving for the current release.

Promotion-scope decision: workflow support is split. The first candidate scope is minimal workflow discovery and structure: INDEX workflow routing, endpoint `Related` references, and the fixed workflow sections `Preconditions`, `Steps`, `State Transitions`, and `Failure and Recovery`. Advanced recovery semantics, workflow-specific deviations, replacement `unsupported` units, and checker support are deferred until separate fixture evidence exists.

Layout:

- `valid/full/` contains a full-profile candidate document set with one workflow file.
- `valid/full/workflows/checkout.md` demonstrates every fixed workflow section.
- `focused/valid/` contains focused positive snippets for workflow deviations and replacement `unsupported`.
- `focused/invalid/` contains focused negative snippets for workflow section order, references, passed values, failure branches, deviations, and replacement `unsupported`.
- `../../workflow-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the candidate set.

These fixtures are intentionally not checked by `tools/check-core-fixtures.mjs`; that checker remains scoped to the published Compatibility Core corpus. Run `node tools/check-workflow-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-workflow-candidates.mjs` from the repository root, to check the workflow candidate expectations.
