# DocAI HTTP TODO pre-1.0 RC

This backlog starts after the `v0.12.0` Complete-generator-ready candidate release.
The filename is kept as `TODO-v0.13.0.md` for continuity, but the active release
thesis is now a pre-`1.0.0` release-candidate stabilization effort rather than a
new feature-widening `0.13.0` candidate.

## Release Thesis

- [x] `v0.12.0` has been tagged and published as `Complete-generator-ready candidate`.
- [x] `0.12.0` is not stable and not `1.0.0`.
- [x] Stable compatibility guarantees still begin with `1.0.0`.
- [x] `TODO-v0.12.0.md` is historical after publication.
- [x] Decide the next release thesis: proceed with a pre-`1.0.0` release-candidate stabilization effort.

Decision rationale:

- `0.12.0` already has complete-generator-ready candidate evidence.
- The next useful work is to decide which evidenced structures become stable compatibility promises.
- Broadening the draft again before setting the stable boundary would increase migration risk.
- Direct `1.0.0` is still premature until the stable conformance corpus boundary is explicit.

## P0: Stable Conformance Boundary

- [x] Decide the minimum evidence required before calling a release `1.0.0`.
- [x] Define the stable conformance corpus boundary separately from candidate fixture evidence.
- [x] Decide whether `fixtures/complete-candidates/v0.12.0/` should be promoted, copied, or replaced for the stable corpus.
- [x] Confirm which complete-surface structures become stable compatibility promises.
- [x] Confirm which structures remain candidate-only or explicitly outside `1.0.0`.
- [x] Record the stable-boundary decision in `README.md`, `RELEASE.md`, and `CHANGELOG.md`.

Decision:

- The intended first stable conformance corpus is `fixtures/conformance/v1.0.0/`.
- It is copied from the standard document content in `fixtures/complete-candidates/v0.12.0/` with `1.0.0` metadata and stable conformance expectation labels.
- Structures covered by normative README text, `fixtures/conformance/v1.0.0/`, and `tools/check-conformance-fixtures.mjs` are the structures intended to become stable compatibility promises at `1.0.0`.
- The live LLM, token-load, and OpenAPI comparison evidence remains supporting evidence in `fixtures/complete-candidates/v0.12.0/` only while conformance document content remains semantically identical.
- Standalone public validator APIs, automated live-provider CI, translated `README.ja.md`, and finite recursive-schema representation remain outside the stable boundary unless deliberately promoted later with their own evidence.

Decision criteria:

- A stable structure should have normative README text, positive fixtures, negative fixtures, checker coverage, and no known unresolved compatibility risk.
- A candidate-only structure may remain in the draft when it is useful but not ready for stable compatibility.
- A structure should stay outside `1.0.0` when supporting it would require a representation that existing readers must understand but the repository does not yet have versioned fixtures for it.

## P0: Recursive Schema Policy

- [x] Review the current recursive-schema unsupported policy before any `1.0.0` release candidate.
- [x] Decide whether recursive schemas remain explicitly unsupported for `1.0.0`.
- [x] If recursive schemas remain unsupported, ensure stable fixtures cover direct and indirect recursive fallback.
- [x] If recursive schemas remain unsupported, do not define or promote a finite recursive representation before `1.0.0`.

Recommended starting assumption:

- Keep recursive schemas unsupported for `1.0.0`.

Why:

- `0.12.0` evidence already validates the `unsupported` fallback.
- Adding recursive representation now would be a high-risk late-stage format change.
- A future version can add recursive support under the compatibility rules when representation evidence exists.

## P1: Stable Corpus Plan

- [x] Decide the target stable corpus directory name and version.
- [x] Decide whether to copy from `fixtures/complete-candidates/v0.12.0/` or create a new corpus from source inputs.
- [x] Decide how immutable released candidate evidence should relate to the stable corpus.
- [x] Define the stable corpus coverage document.
- [x] Define the stable corpus checker command.
- [x] Define the stable corpus release-note evidence summary.

Decision:

- Target corpus: `fixtures/conformance/v1.0.0/`.
- Checker command: `node docai-http/tools/check-conformance-fixtures.mjs`.
- Coverage document: `fixtures/conformance/v1.0.0/COVERAGE.md`.
- Release-note summary: `RELEASE.md` records the minimum evidence and carried-forward evaluation policy.

## P1: Validator And Checker Strategy

- [x] Decide whether `1.0.0` ships only corpus-specific expectation checkers.
- [x] Decide whether a public reusable validator API/CLI is required before `1.0.0`.
- [x] Since a public validator is not planned before `1.0.0`, do not define or publish a validator API in this stabilization pass.
- [x] Keep direct Node checker commands canonical until a public validator/package boundary is explicit.

Recommended starting assumption:

- Do not publish a standalone validator package before `1.0.0` unless the API boundary is deliberately designed.

## P1: Source-To-Projection Audit

- [x] Decide whether source fixtures remain traceability evidence only.
- [x] Decide whether a source-to-projection validator is required before `1.0.0`.
- [x] Audit source fixture coverage for any corpus considered for the stable release.
- [x] Add missing source inputs only when an evidenced corpus lacks a clear authoritative source.

Decision:

- Source fixtures remain traceability evidence for `1.0.0`; they are not a public source-to-projection validator contract.
- A source-to-projection validator is not required before `1.0.0`.
- `fixtures/conformance/v1.0.0/SOURCE-TRACEABILITY.md` records the audit.
- No missing source inputs were found for the current stable conformance corpus.

Recommended starting assumption:

- Keep source fixtures as traceability evidence unless a narrow validator boundary is defined.

## P2: CI And Automation

- [x] Decide whether to adopt a CI provider for deterministic local checks before `1.0.0`.
- [x] If CI is added later, run only local deterministic checks.
- [x] Do not run live LLM provider calls in CI.
- [x] Keep live provider evaluations as manually reviewed evidence with explicit cost and credential control.

Decision:

- Do not add a hosted CI provider as a `1.0.0` prerequisite.
- Add local deterministic automation first: `node docai-http/tools/check-release-readiness.mjs`.
- A future CI workflow may call that aggregate checker, but live LLM provider calls remain manual evidence only.

## P2: LLM Evaluation And OpenAPI Comparison

- [ ] Decide whether optional LLM targets should be run for broader signal.
- [ ] Decide whether additional APIs or task classes are required before `1.0.0`.
- [ ] Keep current OpenAPI comparison claims scoped to the evaluated fixture, target models, tasks, and run dates.
- [ ] Decide whether provider-reported token/cost metrics can be normalized and published.

## P2: Documentation

- [ ] Keep `README.ja.md` deferred until after `1.0.0` text is stable.
- [ ] Review whether post-`0.12.0` documentation should include a release-history summary separate from `CHANGELOG.md`.
- [ ] Keep top-level README comparison claims synchronized with `OPENAPI-COMPARISON-EVIDENCE.md`.
- [ ] Decide when to replace `Complete-generator-ready candidate` publication wording with release-candidate wording.

## Explicit Non-Goals Before Stable Boundary Decision

- [x] Do not call any post-`0.12.0` release stable without a stable conformance corpus.
- [x] Do not publish a standalone checker package without defining its API and compatibility promise.
- [x] Do not broaden OpenAPI comparison claims beyond the data recorded in the evidence file.
- [x] Do not treat live LLM provider calls as automated CI gates.
- [x] Do not introduce new format features merely to make the release look larger.
