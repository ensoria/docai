# DocAI HTTP 0.11.0 Polymorphism Candidate Fixtures

This directory contains candidate fixtures for future polymorphic body variant promotion. They are not part of the `0.11.0` Compatibility Core and do not make polymorphic output compatibility-preserving for the current release.

The first polymorphism candidate scope is intentionally narrow: tagged request-body variants with complete examples and complete field tables per variant. Untagged alternatives, invalid negative snippets, overlapping alternatives, combined variant semantics, and broader checker support remain outside this candidate scope until separate fixture evidence exists.

Layout:

- `valid/full/` contains a full-profile candidate document set with one tagged-variant endpoint.
- `valid/full/resources/payments.md` demonstrates discriminator-based request variants ordered by discriminator value, with no unlabeled common example or common field table.
- `../../polymorphism-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the candidate set.

These fixtures are intentionally not checked by `tools/check-core-fixtures.mjs`; that checker remains scoped to the published Compatibility Core corpus. Run `node tools/check-polymorphism-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-polymorphism-candidates.mjs` from the repository root, to check the polymorphism candidate expectations.
