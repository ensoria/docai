# DocAI HTTP Fixtures

This directory holds DocAI HTTP's versioned fixture corpora.

The current contents are an initial Compatibility Core corpus for draft `0.11.0`, a compact-profile candidate corpus, a workflow candidate corpus, a webhook candidate corpus, a non-JSON candidate corpus, and a polymorphism candidate corpus. The complete conformance corpus that a stable release requires (README §9.1) does not exist yet; the core corpus is the pre-1.0 subset, intended to make the core scope concrete before the complete generator implementation surface is stabilized. The evidence gate for a future complete-generator-ready label is tracked in [`../COMPLETE-GENERATOR-READINESS.md`](../COMPLETE-GENERATOR-READINESS.md).

Layout:

- `core-openapi.yaml` is the source OpenAPI fixture referenced by the current core corpus.
- `core/v0.11.0/valid/full/` contains a valid full-profile document set for the Compatibility Core.
- `core/v0.11.0/focused/valid/` contains focused valid snippets for individual core syntax rules.
- `core/v0.11.0/focused/invalid/` contains focused invalid snippets for validator negative tests.
- `core/v0.11.0/source/` contains direct and indirect recursive OpenAPI inputs whose generated projections use the required `unsupported` fallback.
- `compact-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the compact candidate corpus.
- `compact-candidates/v0.11.0/valid/full/` and `compact-candidates/v0.11.0/valid/compact/` contain a matching full/compact candidate pair for future compact-profile promotion work.
- `compact-candidates/v0.11.0/focused/invalid/` contains focused compact-candidate negative snippets.
- `workflow-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the workflow candidate corpus.
- `workflow-candidates/v0.11.0/valid/full/` contains a full-profile candidate set for minimal workflow structure.
- `workflow-candidates/v0.11.0/focused/valid/` and `workflow-candidates/v0.11.0/focused/invalid/` contain focused workflow-candidate snippets.
- `webhook-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the webhook candidate corpus.
- `webhook-candidates/v0.11.0/valid/full/` contains a full-profile candidate set for single-event and grouped webhook structure.
- `webhook-candidates/v0.11.0/focused/invalid/` contains focused webhook-candidate negative snippets.
- `non-json-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the non-JSON candidate corpus.
- `non-json-candidates/v0.11.0/valid/full/` contains a full-profile candidate set for multipart, form-urlencoded, raw binary, CSV, XML, and SSE request/response structure.
- `non-json-candidates/v0.11.0/focused/invalid/` contains focused non-JSON candidate negative snippets.
- `polymorphism-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the polymorphism candidate corpus.
- `polymorphism-candidates/v0.11.0/valid/full/` contains a full-profile candidate set for tagged request body variants, untagged response body variants, and overlapping alternatives with a combined variant.
- `polymorphism-candidates/v0.11.0/focused/invalid/` contains focused polymorphism-candidate negative snippets.

Only the `core/` corpus is part of the current Compatibility Core evidence. The compact, workflow, webhook, non-JSON, and polymorphism candidate corpora do not declare those features ready for compatibility-preserving implementation. The non-JSON candidate corpus now includes CSV, XML, and SSE response fixture evidence, but CSV, XML, and SSE remain candidate-only. The polymorphism candidate corpus now includes tagged, untagged, and overlapping variant fixture evidence, but polymorphic variants remain candidate-only. These fixtures do not declare selective convention loading, token-routing metadata, or other non-core structures ready for compatibility-preserving implementation.

Run `node tools/check-core-fixtures.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-core-fixtures.mjs` from the repository root, to check the core fixture expectations.

Run `node tools/check-compact-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-compact-candidates.mjs` from the repository root, to check the compact candidate expectations.

Run `node tools/check-workflow-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-workflow-candidates.mjs` from the repository root, to check the workflow candidate expectations.

Run `node tools/check-webhook-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-webhook-candidates.mjs` from the repository root, to check the webhook candidate expectations.

Run `node tools/check-non-json-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-non-json-candidates.mjs` from the repository root, to check the non-JSON candidate expectations.

Run `node tools/check-polymorphism-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-polymorphism-candidates.mjs` from the repository root, to check the polymorphism candidate expectations.
