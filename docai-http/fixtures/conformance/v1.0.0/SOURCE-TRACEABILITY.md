# Source Traceability

This file records the source-fixture audit for the intended DocAI HTTP `1.0.0`
stable conformance corpus.

## Decision

Source fixtures remain traceability evidence for `1.0.0`; they are not a
source-to-projection validator contract. The stable release does not require a
public source-to-projection validator before `1.0.0`.

Why:

- The stable compatibility promise is the DocAI HTTP document format and the
  conformance corpus, not a generator implementation API.
- A public source-to-projection validator would need its own input model,
  diagnostics model, versioning rules, and compatibility boundary.
- The current corpus already records authoritative source inputs for the stable
  examples and the recursive-schema unsupported fallback.
- Adding a validator boundary immediately before `1.0.0` would broaden the stable
  promise more than the fixture evidence requires.

## Source Fixtures

| Source fixture | Traceability role | Conformance evidence |
|---|---|---|
| `source/complete-openapi.yaml` | Authoritative source for the full and compact complete API example pair. | `valid/full/`, `valid/compact/`, and focused fixtures that reference complete API behavior. |
| `source/recursive-direct-openapi.yaml` | Authoritative source for direct recursive-schema fallback. | `focused/valid/recursive-direct-unsupported.md` and `focused/invalid/recursive-truncated-representation.md`. |
| `source/recursive-indirect-openapi.yaml` | Authoritative source for indirect recursive-schema fallback. | `focused/valid/recursive-indirect-unsupported.md` and `focused/invalid/recursive-truncated-representation.md`. |

## Checker Boundary

`tools/check-conformance-fixtures.mjs` checks the corpus-specific DocAI HTTP
expectations: metadata version, stable conformance expectation labels, full/compact
profile pairing, required standard paths, focused valid/invalid snippets, coverage
references, and required source fixture presence.

It does not prove that every field in the DocAI HTTP projection was mechanically
generated from the OpenAPI source. That deeper source-to-projection check remains
future work unless the project deliberately defines a reusable validator boundary.

## Missing Source Inputs

No missing source inputs were found for the current stable conformance corpus.

Before `1.0.0`, add a new source fixture only if a conformance document or focused
fixture depends on authoritative source behavior that is not already represented by
the three source files above.

## Refresh Rule

If the conformance document content changes beyond metadata, paths, expectation
labels, or documentation-only traceability notes, repeat this audit and decide
whether the live LLM, token-load, or OpenAPI comparison evidence must also be
refreshed.
