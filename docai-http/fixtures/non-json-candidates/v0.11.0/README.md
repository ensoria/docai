# DocAI HTTP 0.11.0 Non-JSON Candidate Fixtures

This directory contains candidate fixtures for future non-JSON representation promotion. They are not part of the `0.11.0` Compatibility Core and do not make non-JSON output compatibility-preserving for the current release.

Promotion-scope decision: the first non-JSON candidate scope starts with `multipart/form-data` requests and now includes focused `application/x-www-form-urlencoded` request, raw binary upload/download, CSV response, XML response, and SSE response candidates. Future non-JSON forms remain outside this candidate scope until separate fixture and checker evidence exists.

Layout:

- `valid/full/` contains a full-profile candidate document set with multipart, form-urlencoded, raw binary, CSV, XML, and SSE endpoints.
- `valid/full/resources/binary.md` demonstrates raw binary upload/download size metadata, integrity metadata, download filename metadata, and the raw binary `body_nullable` exception.
- `valid/full/resources/csv.md` demonstrates CSV response charset, delimiter, record separator, quote/escape behavior, header presence, column order, and download filename metadata.
- `valid/full/resources/xml.md` demonstrates XML response charset, declaration encoding, namespaces, attributes, child element ordering, and node mapping.
- `valid/full/resources/sse.md` demonstrates SSE response event names, frame boundaries, data format, reconnect behavior, and termination rules.
- `valid/full/resources/uploads.md` demonstrates multipart file parts, filename requirements, part content types, size limits, and boundary delegation.
- `valid/full/resources/forms.md` demonstrates form-urlencoded character encoding, percent-encoding, and repeated-field rules.
- `focused/invalid/` contains focused negative snippets for multipart media markers, sample/prose, filename requirements, part content types, size limits, boundary delegation, file-part typing, form-urlencoded media markers, samples, character encoding, percent-encoding, repeated-field rules, raw binary size, integrity, filename, and marker boundaries, CSV delimiter, record separator, quote/escape, header presence, and column order, XML encoding, namespace, attribute, element-order, and node-table requirements, and SSE body-nullability, event-name, frame-format, data-format, reconnection, and termination requirements.
- `../../non-json-candidate-openapi.yaml` is the source OpenAPI fixture referenced by the candidate set.

These fixtures are intentionally not checked by `tools/check-core-fixtures.mjs`; that checker remains scoped to the published Compatibility Core corpus. Run `node tools/check-non-json-candidates.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-non-json-candidates.mjs` from the repository root, to check the non-JSON candidate expectations.
