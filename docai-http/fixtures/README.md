# DocAI HTTP Fixtures

This directory holds DocAI HTTP's versioned fixture corpora.

The current contents are an initial Compatibility Core corpus for draft `0.11.0`. The complete conformance corpus that a stable release requires (README §9.1) does not exist yet; this core corpus is the pre-1.0 subset, intended to make the core scope concrete before the complete generator implementation surface is stabilized.

Layout:

- `core-openapi.yaml` is the source OpenAPI fixture referenced by the current core corpus.
- `core/v0.11.0/valid/full/` contains a valid full-profile document set for the Compatibility Core.
- `core/v0.11.0/focused/valid/` contains focused valid snippets for individual core syntax rules.
- `core/v0.11.0/focused/invalid/` contains focused invalid snippets for validator negative tests.

These fixtures do not declare the compact profile, workflows, webhooks, non-JSON representations, selective convention loading, token-routing metadata, or other non-core structures ready for compatibility-preserving implementation.

Run `node tools/check-core-fixtures.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-core-fixtures.mjs` from the repository root, to check the core fixture expectations.
