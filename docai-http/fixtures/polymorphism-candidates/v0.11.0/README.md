# DocAI HTTP 0.11.0 Polymorphism Candidate Fixtures

This directory contains candidate fixtures for future polymorphic body variant promotion. They are not part of the `0.11.0` Compatibility Core and do not make polymorphic output compatibility-preserving for the current release.

The first polymorphism candidate scope is intentionally narrow: tagged request-body variants, untagged response-body variants, overlapping alternatives with a combined variant, focused invalid snippets, and checker coverage for variant block boundaries and per-variant table completeness. Broader polymorphic forms remain outside this candidate scope until separate fixture evidence exists.

Layout:

- `valid/full/` contains a full-profile candidate document set with tagged, untagged, and overlapping variant endpoints.
- `valid/full/resources/payments.md` demonstrates discriminator-based request variants ordered by discriminator value, stable-label untagged response variants with selection prose, and overlapping alternatives with an explicit combined variant.
- `focused/invalid/` contains focused negative snippets for unlabeled common tables, missing discriminator enum values, incomplete per-variant tables, and missing combined variants.
- `../../polymorphism-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the candidate set.

These fixtures are intentionally not checked by `tools/check-core-fixtures.mjs`; that checker remains scoped to the published Compatibility Core corpus. Run `node tools/check-polymorphism-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-polymorphism-candidates.mjs` from the repository root, to check the polymorphism candidate expectations.
