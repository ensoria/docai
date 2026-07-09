# Compatibility Core Fixture Coverage

This matrix tracks the initial fixture evidence for the DocAI HTTP `0.11.0` Compatibility Core. It is scoped to the full profile and does not claim coverage for non-core draft features.

| Core area | Valid fixture evidence | Invalid fixture evidence | Checker coverage |
|---|---|---|---|
| Metadata stamp standard key order, values, escaping, and extension placement | `valid/full/*.md`, `focused/valid/metadata-stamp-escaped.md` | `focused/invalid/metadata-wrong-key-order.md`, `focused/invalid/metadata-extension-before-standard.md` | `parseStamp`, focused fixture checks |
| Full-profile set identity and metadata consistency | `valid/full/INDEX.md`, `valid/full/CONVENTIONS.md`, `valid/full/resources/users.md` | `focused/invalid/coverage-knowledge-mismatch.md` | valid set checks |
| INDEX structure and endpoint routing | `valid/full/INDEX.md`, `focused/valid/index-basic.md` | `focused/invalid/index-missing-webhooks.md`, `focused/invalid/unknown-structural-path.md` | INDEX parser and focused checks |
| CONVENTIONS fixed headings and common error shapes | `valid/full/CONVENTIONS.md`, `focused/valid/conventions-common-error.md` | `focused/invalid/conventions-heading-order.md` | conventions heading and shape checks |
| Endpoint section order and fixed headings | `valid/full/resources/users.md`, `focused/valid/endpoint-basic.md` | `focused/invalid/endpoint-section-order.md` | resource endpoint parser |
| Request path/query/header/cookie/body parameter structure | `valid/full/resources/users.md`, `focused/valid/path-parameter-match.md` | `focused/invalid/path-parameter-mismatch.md` | path parameter checks |
| JSON request and response body representation | `valid/full/resources/users.md`, `focused/valid/type-grammar.md` | `focused/invalid/type-grammar.md` | body marker and type checks |
| Response status ordering and response headers | `valid/full/resources/users.md`, `focused/valid/status-ordering.md`, `focused/valid/unknown-table-cells.md` | `focused/invalid/status-ordering.md`, `focused/invalid/table-cell-count-mismatch.md` | response status and table checks |
| Common and inline error mapping | `valid/full/CONVENTIONS.md`, `valid/full/resources/users.md`, `focused/valid/conventions-common-error.md` | `focused/invalid/inline-error-label-mismatch.md` | error-shape reference checks |
| `none`, `unknown`, and table-level unknown markers | `valid/full/resources/users.md`, `focused/valid/unknown-table-cells.md` | `focused/invalid/unknown-structural-path.md` | unknown marker checks |
| Localized and core-unit replacement `unsupported` | `valid/full/resources/users.md`, `focused/valid/core-replacement-unsupported.md` | `focused/invalid/unsupported-missing-prefix.md` | unsupported marker checks |
| Recursive schema fallback | `valid/full/resources/users.md`, `focused/valid/core-replacement-unsupported.md` | none yet; recursive finite expansion is covered by review until a source fixture exists | unsupported marker checks |
| Canonical table parsing and cell normalization | `valid/full/*.md`, `focused/valid/table-and-field-paths.md` | `focused/invalid/table-cell-count-mismatch.md` | table parser checks |
| Field-path escaping | `valid/full/resources/users.md`, `focused/valid/table-and-field-paths.md` | `focused/invalid/field-path-invalid-escape.md` | field-path checks |
| Extension placement | `valid/full/*.md`, `focused/valid/metadata-stamp-escaped.md` | `focused/invalid/metadata-extension-before-standard.md` | metadata parser checks |

Known limitation: this initial core corpus has no source OpenAPI fixture and no complete validator. The checker in `tools/check-core-fixtures.mjs` validates the core fixture shape and focused positive/negative expectations, but it is not a full DocAI HTTP validator.
