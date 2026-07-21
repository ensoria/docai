# v1.0.0-rc.2 Review Regression

This checklist maps the nine findings from review of `v1.0.0-rc.1` to the
corrected files and deterministic evidence. The focused `rc.2` review should
verify these corrections and should not reopen unrelated feature design unless
it reveals another contradiction or compatibility risk.

Audit date: 2026-07-21

| ID | Correction | Primary files | Checker evidence | Current result |
|---|---|---|---|---|
| 1 | Replaced non-canonical `enum(...)` Type cells with `string` and explicit enum constraints | `README.md`; full/compact payments; polymorphism and generated-example focused fixtures | Semantic Type validation; `focused/invalid/type-enum-expression.md` | passed |
| 2 | Added separate canonical Request/Response `same_as` parsing and full target resolution | `tools/check-conformance-fixtures.mjs`; Request/Response focused fixtures | Valid Request and Response references plus malformed, forward, cross-kind, missing-body, media-mismatch, retrieval-unit, and chained-target rejection | passed |
| 3 | Removed runtime dependence on the candidate checker and `CHANGELOG.md` | `tools/check-conformance-fixtures.mjs`; `tools/check-conformance-boundary.mjs` | Isolated tree contains only normative README, conformance corpus, and stable checker | passed |
| 4 | Added an authoritative input-set manifest, behavior source, restamped projections, and fact-class traceability | `source/complete-input-set.yaml`; `source/complete-behavior.yaml`; `SOURCE-TRACEABILITY.md`; full/compact stamps | Manifest/source/revision and traceability checks | passed |
| 5 | Defined `Idempotency-Key`, conflict behavior, ambiguous-outcome replay, and corrected-input retry | Full/compact CONVENTIONS, resources, INDEX, and checkout workflow; retry focused fixtures | Complete-set safe-retry assertions and targeted invalid retry fixture | passed |
| 6 | Made deployment-specific token sizing advisory while preserving mandatory contract completeness | Normative README section 7 | Text review under normative-word rules | passed |
| 7 | Assigned edge-case demonstration across complete sets and focused fixtures | Normative README section 9.1 | Corpus layout and coverage map | passed |
| 8 | Required final review, final tag/publication, and label transition for `Stable` | `RELEASE.md` release labels | Release-document review | passed |
| 9 | Replaced XPath-like XML Field values with logical paths and retained wire mappings in Meaning | Normative README non-JSON rule; XML focused fixtures | Logical field-path validation and `focused/invalid/xml-xpath-field.md` | passed |

## Deterministic Commands

- `node docai-http/tools/check-conformance-fixtures.mjs`: passed.
- `node docai-http/tools/check-conformance-boundary.mjs`: passed.
- `node docai-http/tools/check-complete-candidates.mjs`: passed for historical
  `0.12.0` regression coverage.
- `node docai-http/tools/check-release-readiness.mjs`: passed.
- `git diff --check`: passed after the documentation/TODO update.

## Evidence Follow-Up

`SEMANTIC-DRIFT-AUDIT.md` finds task-relevant drift from the evaluated `0.12.0`
documents. Existing LLM/OpenAPI records remain historical `0.12.0` evidence.
Refreshing corrected-corpus live evidence is a separate release task and requires
explicit user approval before provider submission.

## External Review Result

Pending. Record each result as blocking, wording/metadata-only, future backlog,
or no change before tagging `v1.0.0-rc.2`.
