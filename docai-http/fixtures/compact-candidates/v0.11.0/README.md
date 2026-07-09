# DocAI HTTP 0.11.0 Compact Candidate Fixtures

This directory contains candidate fixtures for a future compact-profile promotion. They are not part of the `0.11.0` Compatibility Core and do not make compact output compatibility-preserving for the current release.

The first compact promotion scope is intentionally narrow: profile pairing, compact examples, and `field_defaults`. This keeps the first compact contract small while fixture and checker evidence is collected. `same_as`, retrieval-unit discovery, `Client-visible fields`, `Opaque fields`, workflow compacting, webhook compacting, and non-JSON compact rules remain outside this candidate scope.

Layout:

- `valid/full/` contains the canonical full-profile set.
- `valid/compact/` contains the matching compact-profile set.
- `focused/invalid/` contains focused negative snippets for candidate compact-profile links, profile identity rules, and `field_defaults` boundaries.
- `TOKEN-SAVINGS.md` records candidate measurement guidance and fixture-level reduction annotations.
- Both sets use identical standard docs-root-relative paths.
- Both sets share `projection_id: compact-candidate-20260709-001`.
- The full INDEX links `Compact set: ../compact/`.
- The compact INDEX links `Full set: ../full/`.

These fixtures are intentionally not checked by `tools/check-core-fixtures.mjs`; that checker remains scoped to the published Compatibility Core corpus. Run `node tools/check-compact-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-compact-candidates.mjs` from the repository root, to check the compact candidate expectations.
