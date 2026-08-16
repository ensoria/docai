# Compatibility Core Coverage Matrix

This matrix maps the DocAI Messaging `0.17.1` Compatibility Core corpus requirements in README §8 to versioned evidence. It is a release-review artifact, not a substitute for the fixture checker or source-aware human review.

## Matrix Contract

Each `R8-CORE-*` row represents one independently reviewable Core corpus requirement. Requirement IDs remain stable if README prose moves. Fixture entries are `cases.json` case IDs; that manifest is the authoritative mapping from an ID to its file and expected result. `Source / derivation` names authoritative input or, for context-free grammar cases, the normative README derivation instead of inventing a source artifact.

Status values are:

- `covered`: every cited fixture, rule, and checker exists and currently passes.
- `partial`: evidence exists, but another matrix row or fixture group is still required before the requirement is complete.
- `pending`: the requirement has not yet been mapped completely.

Cascade diagnostics do not satisfy a Rule column. Invalid fixtures must identify one primary rule concern and pass the corpus one-invalidity audit.

## Core Requirements

| ID | README §8 requirement | Source / derivation | Valid fixture cases | Invalid fixture cases | Primary rule IDs | Checker tests | Status |
|---|---|---|---|---|---|---|---|
| `R8-CORE-001` | Publish a versioned valid full-profile set and focused valid and invalid fixtures for every Compatibility Core structure before advertising Core as an implementation target. | `source/projection-input-manifest.json`; `source/storefront.asyncapi.json`; `source/storefront-behavior.json`; `SOURCE-TRACEABILITY.md` | `core-valid-full-set` and all mapped focused valid cases | All mapped focused invalid cases | All mapped Core `DM-*` rules | `document-set.test.mjs`: `validates the Task 8 contract-complete full document set`; `core-corpus.test.mjs`: all `executes the Task 9 ... corpus` tests and `audits every Task 9 invalid fixture as one primary concern` | `partial` |
| `R8-CORE-002` | Cover valid and invalid opening metadata and identity trailers. | README §3.1 opening-metadata grammar; README §3.2 identity grammar; main-set derivations in `SOURCE-TRACEABILITY.md` → `Document Metadata and Identity` | `metadata-canonical-extensions-and-escapes`; `identity-whole-set-valid`; `core-valid-full-set` | `metadata-missing-standard-key`; `metadata-format-version-invalid`; `metadata-profile-invalid`; `metadata-perspective-empty`; `metadata-coverage-invalid`; `metadata-knowledge-invalid`; `identity-trailer-missing`; `identity-trailer-malformed-projection-digest` | `DM-META-001`; `DM-ID-001` | `core-corpus.test.mjs`: `executes the Task 9 metadata and sentence focused corpus`, `executes the Task 9 identity focused corpus`; `identity.test.mjs`: `parses only the fixed root and non-root identity trailer shapes` | `covered` |
| `R8-CORE-003` | Cover valid lowercase metadata extension names; invalid uppercase, empty-suffix, and disallowed-punctuation names; duplicate standard and extension keys; value-only escaping; and rejection of an unknown non-`x-` key for the same or an older supported declaration. | README §3.1 metadata name, ordering, uniqueness, and value-only escape grammar | `metadata-canonical-extensions-and-escapes` | `metadata-extension-uppercase`; `metadata-extension-empty-suffix`; `metadata-extension-disallowed-punctuation`; `metadata-duplicate-standard-key`; `metadata-duplicate-extension-key`; `metadata-unknown-escape`; `metadata-trailing-backslash`; `metadata-unknown-non-extension-key` | `DM-META-001`; `DM-META-004` | `core-corpus.test.mjs`: `executes the Task 9 metadata and sentence focused corpus`; `metadata.test.mjs`: extension, duplicate-key, escape, and unknown-standard-key tests | `covered` |
| `R8-CORE-004` | Cover deterministic `set_digest` recomputation, closed-root membership, path and content binding, short-ID derivation, mixed-set rejection, and task-scoped identity checking without whole-set retrieval. | `source/projection-input-manifest.json`; README §3.2 identity derivation; main-set derivations in `SOURCE-TRACEABILITY.md` → `Document Metadata and Identity` | `identity-whole-set-valid`; `identity-task-scoped-stale-digest`; `core-valid-full-set` | `identity-task-scoped-stale-digest-whole-set-invalid`; `identity-closed-root-extra-file`; `identity-set-short-id-invalid`; `identity-projection-short-id-invalid`; `identity-format-version-mixed`; `identity-profile-mixed`; `identity-perspective-mixed`; `identity-set-id-mixed`; `identity-projection-id-mixed` | `DM-ID-002`; `DM-ID-003`; `DM-ID-004`; `DM-ID-005`; `DM-ID-006`; `DM-ID-007`; `DM-ID-008`; `DM-ID-009` | `core-corpus.test.mjs`: `executes the Task 9 identity focused corpus`; `identity.test.mjs`: digest vector, `SELF`, short-ID, and path/membership/content binding tests; `document-set.test.mjs`: closed-root, mixed-set, and `task-scoped validation checks handles without recomputing the whole set` tests | `covered` |

## Remaining Core Inventory

The remaining clauses in the README §8 Core corpus paragraphs are intentionally not marked covered by this checkpoint. Subsequent matrix checkpoints append rows for Sources and routing, contexts and Unprojected Operations, readiness and perspective, messages and payloads, replies and failures, adapters and publication safety, and the additional media-type, source-shard, language, deviation, and conventions requirements. `R8-CORE-001` remains `partial` until every Core clause has a `covered` row and the release review gate confirms that no clause is missing.
