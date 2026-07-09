# DocAI HTTP Fixtures

This directory contains versioned conformance fixtures for DocAI HTTP.

The current corpus is an initial Compatibility Core corpus for draft `0.11.0`. It is intended to make the pre-1.0 core scope concrete before the complete generator implementation surface is stabilized.

Layout:

- `core/v0.11.0/valid/full/` contains a valid full-profile document set for the Compatibility Core.
- `core/v0.11.0/focused/valid/` contains focused valid snippets for individual core syntax rules.
- `core/v0.11.0/focused/invalid/` contains focused invalid snippets for validator negative tests.

These fixtures do not declare the compact profile, workflows, webhooks, non-JSON representations, selective convention loading, token-routing metadata, or other non-core structures ready for compatibility-preserving implementation.

Run `node tools/check-core-fixtures.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-core-fixtures.mjs` from the repository root, to check the core fixture expectations.
