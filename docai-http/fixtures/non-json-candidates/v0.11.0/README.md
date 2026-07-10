# DocAI HTTP 0.11.0 Non-JSON Candidate Fixtures

This directory contains candidate fixtures for future non-JSON representation promotion. They are not part of the `0.11.0` Compatibility Core and do not make non-JSON output compatibility-preserving for the current release.

Promotion-scope decision: the first non-JSON candidate scope is `multipart/form-data` requests. Other non-JSON forms such as `application/x-www-form-urlencoded`, raw binary, CSV, XML, and SSE remain outside this candidate scope until separate fixture and checker evidence exists.

Layout:

- `valid/full/` contains a full-profile candidate document set with one multipart upload endpoint.
- `valid/full/resources/uploads.md` demonstrates multipart file parts, filename requirements, part content types, size limits, and boundary delegation.
- `focused/invalid/` contains focused negative snippets for multipart media markers, sample/prose, filename requirements, part content types, size limits, boundary delegation, and file-part typing.
- `../../non-json-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the candidate set.

These fixtures are intentionally not checked by `tools/check-core-fixtures.mjs`; that checker remains scoped to the published Compatibility Core corpus. Run `node tools/check-non-json-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-non-json-candidates.mjs` from the repository root, to check the non-JSON candidate expectations.
