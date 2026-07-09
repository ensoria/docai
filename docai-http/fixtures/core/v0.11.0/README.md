# DocAI HTTP 0.11.0 Compatibility Core Fixtures

This directory contains the initial Compatibility Core fixture corpus for DocAI HTTP draft `0.11.0`.

- `valid/full/` is a full-profile document set that exercises the core read path: `INDEX.md` -> `CONVENTIONS.md` -> `resources/users.md`.
- `focused/valid/` contains small valid snippets for individual core syntax rules.
- `focused/invalid/` contains small invalid snippets for validator negative tests.
- `../../core-openapi.yaml` is the source OpenAPI fixture referenced by the valid full-profile set.

The `valid/full/` set deliberately exercises the incomplete-signaling markers that the core corpus must demonstrate (README §9.1): `**unknown**:`, localized and replacement `**unsupported**:`, and the recursive-schema fallback. Because of those markers its `INDEX.md` reports `coverage: requires-source | knowledge: requires-input`, so the set is intentionally **not** implementation-ready under README §3. It shows that the core structures are expressible, not that a projection is complete. A fully clean, implementation-ready core endpoint shape (no `unknown` or `unsupported`) is shown by `focused/valid/endpoint-basic.md`.

This corpus intentionally excludes non-core draft features such as the compact profile, workflows, webhooks, non-JSON bodies, selective convention loading, and token-routing metadata.

Run `node ../../../tools/check-core-fixtures.mjs` from this directory, `node tools/check-core-fixtures.mjs` from `docai-http/`, or `node docai-http/tools/check-core-fixtures.mjs` from the repository root.
