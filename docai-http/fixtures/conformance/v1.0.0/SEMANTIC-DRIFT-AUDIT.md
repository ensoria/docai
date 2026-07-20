# Semantic Drift Audit

This file records the semantic-drift audit between the `0.12.0`
complete-generator-ready candidate corpus and the intended DocAI HTTP `1.0.0`
stable conformance corpus.

Audit date: 2026-07-20

## Compared Corpora

| Role | Path |
|---|---|
| Evaluated candidate corpus | `fixtures/complete-candidates/v0.12.0/` |
| Stable conformance corpus | `fixtures/conformance/v1.0.0/` |

## Result

No semantic drift was found in the standard DocAI HTTP document content.

After normalizing expected release-boundary differences, all comparable files in
`valid/`, `focused/`, and `source/` match the `0.12.0` candidate corpus. The live
LLM task evaluations, deterministic token-load evidence, and OpenAPI comparison
records can remain carried-forward supporting evidence for `v1.0.0-rc.1`.

## Normalized Differences

The audit treated the following differences as intentional release-boundary
changes rather than semantic document changes:

- Metadata stamp version: `docai-http: 0.12.0` to `docai-http: 1.0.0`.
- Fixture identity values: `generation_id`, `projection_id`, `source_revision`,
  and `x-fixture`.
- Source paths from `fixtures/complete-candidates/v0.12.0/source/...` to
  `fixtures/conformance/v1.0.0/source/...`.
- Focused fixture expectation prose from `complete candidate` to
  `complete conformance`.
- Source fixture `info.title` and `info.version` values that identify the stable
  conformance source fixtures.
- Conformance-only documentation files that define stable boundary evidence,
  release scope, traceability, coverage, and token-saving notes.

## File Coverage

Comparable files checked:

- `valid/full/` and `valid/compact/` standard DocAI HTTP document sets.
- `focused/valid/` and `focused/invalid/` snippets.
- `source/complete-openapi.yaml`.
- `source/recursive-direct-openapi.yaml`.
- `source/recursive-indirect-openapi.yaml`.

The `0.12.0` evaluation result files are intentionally not duplicated into the
conformance corpus. They remain in `fixtures/complete-candidates/v0.12.0/` as
supporting evidence while this audit remains valid.

## Refresh Rule

If any standard DocAI HTTP document content changes after this audit beyond
metadata, source paths, fixture labels, or documentation-only release-boundary
notes, rerun deterministic fixture checks and decide whether the affected live
LLM or OpenAPI comparison evidence must be refreshed before stable `v1.0.0`.
