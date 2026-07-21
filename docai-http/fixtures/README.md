# DocAI HTTP Fixtures

This directory holds DocAI HTTP's versioned fixture corpora.

The current contents are an initial Compatibility Core corpus for draft `0.11.0`, a compact-profile candidate corpus, a workflow candidate corpus, a webhook candidate corpus, a non-JSON candidate corpus, a polymorphism candidate corpus, a complete-surface candidate corpus for draft `0.12.0`, and the stable conformance corpus for `1.0.0`. The core corpus is the historical pre-1.0 subset, the complete-surface candidate corpus supports the broader pre-1.0 complete-generator-ready candidate label, and the conformance corpus defines the `1.0.0` stable fixture boundary. The evidence gate for the `0.12.0` complete-generator-ready candidate label is tracked in [`../COMPLETE-GENERATOR-READINESS.md`](../COMPLETE-GENERATOR-READINESS.md).

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
- `complete-candidates/v0.12.0/source/complete-openapi.yaml` is the source OpenAPI fixture referenced by the complete-surface candidate example pair.
- `complete-candidates/v0.12.0/source/recursive-direct-openapi.yaml` and `complete-candidates/v0.12.0/source/recursive-indirect-openapi.yaml` are recursive source fixtures whose complete-candidate projections use the required `unsupported` fallback.
- `complete-candidates/v0.12.0/valid/full/` and `complete-candidates/v0.12.0/valid/compact/` contain a matching full/compact candidate pair that includes resources, workflows, and webhooks.
- `complete-candidates/v0.12.0/focused/valid/` and `complete-candidates/v0.12.0/focused/invalid/` contain focused complete-candidate snippets for the areas listed in `complete-candidates/v0.12.0/COVERAGE.md`.
- `complete-candidates/v0.12.0/evaluations/` contains the complete-candidate LLM evaluation task packet, local context metrics, live run records, and separate OpenAPI baseline comparison artifacts.
- `conformance/v1.0.0/source/complete-openapi.yaml` is the source OpenAPI fixture referenced by the stable conformance full/compact pair.
- `conformance/v1.0.0/source/recursive-direct-openapi.yaml` and `conformance/v1.0.0/source/recursive-indirect-openapi.yaml` are recursive source fixtures whose stable conformance projections use the required `unsupported` fallback.
- `conformance/v1.0.0/valid/full/` and `conformance/v1.0.0/valid/compact/` contain the stable conformance full/compact pair.
- `conformance/v1.0.0/focused/valid/` and `conformance/v1.0.0/focused/invalid/` contain focused stable conformance snippets for the areas listed in `conformance/v1.0.0/COVERAGE.md`.
- `conformance/v1.0.0/COVERAGE.md` records the stable conformance evidence map.
- `conformance/v1.0.0/SOURCE-TRACEABILITY.md` records the source fixture audit and confirms that source fixtures remain traceability evidence rather than a public source-to-projection validator contract for `1.0.0`.
- `conformance/v1.0.0/SEMANTIC-DRIFT-AUDIT.md` records the semantic comparison against the evaluated `0.12.0` complete-candidate corpus.
- `conformance/v1.0.0/TOKEN-SAVINGS.md` records compact-profile reduction guidance for the stable conformance pair.

Only the `core/` corpus is part of the `0.11.0` Compatibility Core evidence. The compact, workflow, webhook, non-JSON, and polymorphism candidate corpora remain separate candidate-only inputs unless incorporated into a broader evidenced corpus. The non-JSON candidate corpus includes CSV, XML, and SSE response fixture evidence, but CSV, XML, and SSE remain candidate-only there. The polymorphism candidate corpus includes tagged, untagged, and overlapping variant fixture evidence, but polymorphic variants remain candidate-only there. The `complete-candidates/v0.12.0/` corpus incorporates the broader complete-surface evidence: resources, workflows, webhooks, focused snippets for README section 9.1 complete-surface coverage, corpus-specific checkers, required-target LLM task evidence, token-load evidence, OpenAPI comparison prompt/context-metric artifacts, live baseline records, and a scoped comparison summary. These fixtures support the `0.12.0` complete-generator-ready candidate label; they do not declare a stable compatibility promise. The `conformance/v1.0.0/` corpus copies that standard document content into a separate stable-boundary path with `1.0.0` metadata and stable conformance expectation labels; its coverage, source traceability, semantic drift, and token-saving notes describe the intended stable boundary. Live LLM and OpenAPI comparison records remain supporting evidence in `complete-candidates/v0.12.0/` unless the conformance document content changes.

Run `node tools/check-core-fixtures.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-core-fixtures.mjs` from the repository root, to check the core fixture expectations.

Run `node tools/check-compact-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-compact-candidates.mjs` from the repository root, to check the compact candidate expectations.

Run `node tools/check-workflow-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-workflow-candidates.mjs` from the repository root, to check the workflow candidate expectations.

Run `node tools/check-webhook-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-webhook-candidates.mjs` from the repository root, to check the webhook candidate expectations.

Run `node tools/check-non-json-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-non-json-candidates.mjs` from the repository root, to check the non-JSON candidate expectations.

Run `node tools/check-polymorphism-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-polymorphism-candidates.mjs` from the repository root, to check the polymorphism candidate expectations.

Run `node tools/check-complete-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-complete-candidates.mjs` from the repository root, to check the complete candidate expectations.

Run `node tools/check-conformance-fixtures.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-conformance-fixtures.mjs` from the repository root, to check the `1.0.0` stable conformance expectations.

Run `node tools/check-complete-evaluations.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-complete-evaluations.mjs` from the repository root, to check the complete candidate evaluation packet and local context metrics.

Run `node tools/build-openapi-comparison-prompts.mjs all --condition all --summary` from the `docai-http/` directory, or `node docai-http/tools/build-openapi-comparison-prompts.mjs all --condition all --summary` from the repository root, to inspect the OpenAPI comparison prompt matrix. Run `node tools/record-openapi-comparison-metrics.mjs`, or `node docai-http/tools/record-openapi-comparison-metrics.mjs` from the repository root, to refresh OpenAPI baseline context metrics. Run `node tools/check-openapi-comparison.mjs`, or `node docai-http/tools/check-openapi-comparison.mjs` from the repository root, to validate OpenAPI baseline context metrics and any separate OpenAPI baseline run records.
