# DocAI HTTP Fixtures

This directory holds DocAI HTTP's versioned fixture corpora.

The current contents are an initial Compatibility Core corpus for draft `0.11.0` and a compact-profile candidate corpus. The complete conformance corpus that a stable release requires (README §9.1) does not exist yet; the core corpus is the pre-1.0 subset, intended to make the core scope concrete before the complete generator implementation surface is stabilized.

Layout:

- `core-openapi.yaml` is the source OpenAPI fixture referenced by the current core corpus.
- `core/v0.11.0/valid/full/` contains a valid full-profile document set for the Compatibility Core.
- `core/v0.11.0/focused/valid/` contains focused valid snippets for individual core syntax rules.
- `core/v0.11.0/focused/invalid/` contains focused invalid snippets for validator negative tests.
- `compact-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the compact candidate corpus.
- `compact-candidates/v0.11.0/valid/full/` and `compact-candidates/v0.11.0/valid/compact/` contain a matching full/compact candidate pair for future compact-profile promotion work.
- `compact-candidates/v0.11.0/focused/invalid/` contains focused compact-candidate negative snippets.

Only the `core/` corpus is part of the current Compatibility Core evidence. The compact candidate corpus does not declare the compact profile ready for compatibility-preserving implementation. These fixtures do not declare workflows, webhooks, non-JSON representations, selective convention loading, token-routing metadata, or other non-core structures ready for compatibility-preserving implementation.

Run `node tools/check-core-fixtures.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-core-fixtures.mjs` from the repository root, to check the core fixture expectations.
