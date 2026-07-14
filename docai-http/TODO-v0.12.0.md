# DocAI HTTP TODO v0.12.0

This backlog tracks the work needed to prepare the next DocAI HTTP release after the
`0.11.0` Compatibility Core implementation target.

The working release thesis is:

- Version: `0.12.0`
- Publication label: `Complete-generator-ready candidate`
- Stability level: pre-1.0 candidate, not stable
- Compatibility posture: broader than the `0.11.0` Compatibility Core, but still not a
  `1.0.0` stable compatibility promise

The goal is to turn the complete-surface evidence already collected during the
`0.11.0` backlog into a coherent `0.12.0` candidate release without over-claiming
stable compatibility.

## Current Starting Point

- [x] `0.11.0` Compatibility Core has been published and archived in `TODO-v0.11.0.md`.
- [x] Complete-candidate full/compact fixtures exist under `fixtures/complete-candidates/v0.11.0/`.
- [x] Complete-candidate focused fixtures cover the README section 9.1 complete surface.
- [x] `tools/check-complete-candidates.mjs` validates the complete-candidate fixture corpus.
- [x] Required-target LLM task evaluations have been recorded and pass for DocAI HTTP contexts.
- [x] OpenAPI comparison live baselines have been recorded for raw, sliced, and enriched conditions.
- [x] Top-level README now contains measured, fixture-scoped DocAI HTTP versus OpenAPI comparison data.
- [ ] Release label, version references, fixture versioning, changelog sections, and release checklist have not yet been aligned for `0.12.0`.

## P0: Confirm Release Scope

- [ ] Decide whether `0.12.0 Complete-generator-ready candidate` is the target release.
- [ ] Confirm that `0.12.0` is not intended to be `Stable` and not intended to be `1.0.0`.
- [ ] Confirm that the release may advertise complete-generator readiness only for the evidenced complete-surface candidate corpus.
- [ ] Confirm that stable compatibility guarantees still begin at `1.0.0`.
- [ ] Record the decision in `RELEASE.md`, `COMPLETE-GENERATOR-READINESS.md`, and `CHANGELOG.md`.

Recommended decision:

- Use `0.12.0 Complete-generator-ready candidate`.
- Do not use `1.0.0` yet.
- Do not call the release stable.

Why:

- The complete-surface fixture, checker, LLM evaluation, and OpenAPI comparison evidence now exist.
- The release can make a stronger implementation-readiness claim than `0.11.0`.
- A candidate label preserves room for review and fixture-driven corrections before the stable `1.0.0` contract.

## P0: Commit Or Stabilize Current Evidence

- [ ] Confirm the current OpenAPI comparison results are committed or intentionally included in the `0.12.0` release branch.
- [ ] Confirm `TODO-v0.11.0.md` is treated as historical and is no longer the active backlog.
- [ ] Confirm `TODO-v0.12.0.md` is the active backlog for release-preparation work.
- [ ] Check that no repository documentation still points to a now-missing `TODO.md`.

## P0: Fix Known Documentation Drift

- [ ] Update `COMPLETE-GENERATOR-READINESS.md` current status.
- [ ] Remove or replace the outdated statement that the OpenAPI live task baseline has not been run.
- [ ] State that complete-surface fixture coverage, complete-candidate checker coverage, required-target LLM evaluations, and OpenAPI comparison evidence exist.
- [ ] Keep the document clear that this supports a `Complete-generator-ready candidate`, not `Stable`.
- [ ] Update `fixtures/README.md` so the complete-surface candidate evidence and OpenAPI comparison records are described as current.
- [ ] Update `RELEASE.md` so the current repository state and the intended `0.12.0` release label agree.
- [ ] Review top-level `README.md` and `docai-http/README.md` for publication-label consistency.

## P0: Decide Version And Fixture Alignment

- [ ] Decide whether `0.12.0` changes the DocAI HTTP specification version or only the repository publication label.
- [ ] Decide whether complete-candidate fixtures should remain under `fixtures/complete-candidates/v0.11.0/` or be copied/promoted to `fixtures/complete-candidates/v0.12.0/`.
- [ ] If creating `v0.12.0` fixture directories, update metadata stamps, checker `SPEC_VERSION` values, docs, and run-record paths consistently.
- [ ] If keeping `v0.11.0` fixture directories, explicitly document why `0.12.0` uses `0.11.0` fixture evidence and why that does not create version confusion.

Decision options:

Option A: Create `v0.12.0` fixture/evaluation directories for the complete-candidate release evidence.

- Pros:
  - The release version, fixture version, metadata stamps, checker expectations, and README examples can agree.
  - Easier for users to understand what corpus belongs to the `0.12.0` candidate release.
  - Cleaner path toward a later `1.0.0` conformance corpus.
- Cons:
  - Larger mechanical change.
  - Existing JSONL evaluation records may need to be copied or regenerated with updated paths/version fields.
  - More files to review before release.

Option B: Keep `fixtures/complete-candidates/v0.11.0/` as the evidence corpus for the `0.12.0` repository release.

- Pros:
  - Smaller change.
  - Preserves the exact evidence generated so far.
  - Avoids accidental metadata churn in fixtures and run records.
- Cons:
  - Easy for users to confuse release version `0.12.0` with fixture version `0.11.0`.
  - Harder to satisfy the release checklist requirement that README version, fixture metadata, and changelog agree.
  - Less clean as a public release artifact.

Recommended decision:

- Prefer Option A if `0.12.0` is meant to be a real public candidate release.
- Use Option B only if `0.12.0` is treated as a repository milestone rather than a format-versioned release.

## P1: Align Publication Labels

- [ ] Update `docai-http/README.md` header publication label if the release is promoted to `Complete-generator-ready candidate`.
- [ ] Ensure the README says the release is not stable and not compatibility-stable for all future versions.
- [ ] Ensure the Compatibility Core language remains true for core-only implementers.
- [ ] Ensure complete-surface language points to the exact fixture corpus, checker, and evaluation evidence.
- [ ] Ensure OpenAPI comparison claims stay scoped to the evaluated fixture, target models, tasks, and run dates.

## P1: Changelog And Release Notes

- [ ] Move release-relevant `Unreleased` entries into a concrete `0.12.0` changelog section.
- [ ] Keep any unrelated future work under `Unreleased`.
- [ ] Add release notes using the `RELEASE.md` template.
- [ ] Include scope, promoted/non-promoted areas, evidence, compatibility posture, and known limits.
- [ ] Confirm README-visible changes are not left only under `Unreleased`.

## P1: Evidence Documentation

- [ ] Update `COMPLETE-GENERATOR-READINESS.md` work breakdown to mark the complete-candidate gate as satisfied for `0.12.0`.
- [ ] Link to complete-candidate fixture corpus, checker, LLM evaluation results, and OpenAPI comparison evidence.
- [ ] Update `OPENAPI-COMPARISON-EVIDENCE.md` only if additional review changes are needed.
- [ ] Confirm `fixtures/complete-candidates/v0.11.0/evaluations/RESULTS.md` still reflects the recorded live runs accurately.
- [ ] Confirm OpenAPI baseline JSONL records are intentionally included as comparison evidence and not conformance evidence.

## P1: Deterministic Validation Checklist

- [ ] Run `node docai-http/tools/check-core-fixtures.mjs`.
- [ ] Run `node docai-http/tools/check-compact-candidates.mjs`.
- [ ] Run `node docai-http/tools/check-workflow-candidates.mjs`.
- [ ] Run `node docai-http/tools/check-webhook-candidates.mjs`.
- [ ] Run `node docai-http/tools/check-non-json-candidates.mjs`.
- [ ] Run `node docai-http/tools/check-polymorphism-candidates.mjs`.
- [ ] Run `node docai-http/tools/check-complete-candidates.mjs`.
- [ ] Run `node docai-http/tools/check-complete-evaluations.mjs`.
- [ ] Run `node docai-http/tools/check-openapi-comparison.mjs`.
- [ ] Run `git diff --check`.
- [ ] Record the final command results in the release notes or release PR summary.

## P2: Optional Release Automation

- [ ] Decide whether to add lightweight CI for deterministic checks before tagging `0.12.0`.
- [ ] If CI is added, include only local deterministic checks.
- [ ] Do not run live LLM provider calls in CI.
- [ ] Document that live provider evaluations are manually recorded evidence, not automatic CI gates.

## P2: Pre-Tag Review

- [ ] Review `docai-http/README.md` for over-claiming complete readiness or stability.
- [ ] Review top-level `README.md` comparative claims for scope limits.
- [ ] Review all release-label references across `README.md`, `RELEASE.md`, `fixtures/README.md`, `COMPLETE-GENERATOR-READINESS.md`, and `CHANGELOG.md`.
- [ ] Confirm fixture paths and version labels agree with the versioning decision.
- [ ] Confirm no required release evidence exists only in an untracked file.
- [ ] Confirm `README.ja.md` is excluded from `0.12.0` readiness work by explicit decision.

## P3: Tag And Publish

- [ ] Confirm final release version and tag name.
- [ ] Confirm changelog section is final.
- [ ] Confirm all deterministic checks pass from a clean worktree.
- [ ] Create the release tag.
- [ ] Publish release notes.
- [ ] After publication, move remaining future work to the next active TODO file.

## Parking Lot Decisions From v0.11.0

The following items came from `TODO-v0.11.0.md`. They are recorded here so they can
be consciously included in, or excluded from, the `0.12.0` release scope.

### README.ja.md Translation

Decision already made:

- [x] Defer `README.ja.md` until after `1.0.0` is confirmed.
- [ ] Optionally add a short note somewhere release-facing that Japanese translation is intentionally deferred.

Details:

- Including a full Japanese README before `1.0.0` would create a second normative-looking document that can drift while the English specification is still changing.
- Translation work is valuable, but it is high maintenance before the stable text is known.
- For `0.12.0`, do not block the release on `README.ja.md`.

Recommended `0.12.0` treatment:

- Exclude from `0.12.0`.
- Keep or add a short placeholder that the Japanese translation will be prepared after `1.0.0`.

### Full OpenAPI Source Files For Every Generated Fixture Set

Decision needed:

- [ ] Decide whether this is required for `0.12.0`.

What this means:

- Every generated fixture corpus should have the authoritative source input used to produce it, usually an OpenAPI YAML file plus any pass-through content required by the projection.
- This improves traceability from source to generated DocAI HTTP output.

Reasons to include in `0.12.0`:

- Better release evidence.
- Easier to audit `unsupported`, `unknown`, recursive fallback, and generated examples.
- Helps future generator work because source fixtures are available for source-to-projection tests.

Reasons to defer:

- `0.12.0` is a complete-generator-ready candidate, not a stable conformance release.
- Adding or rewriting source fixtures can expand the review surface.
- Some candidate corpora already have source OpenAPI fixtures; the immediate need may be only an audit rather than new source files.

Recommended `0.12.0` treatment:

- Include a source-fixture audit in `0.12.0`.
- Add missing source files only if an evidenced corpus used for the release lacks a clear source input.
- Do not broaden the task into a full source-to-projection validator for this release.

### Publish Checker As A Standalone Package

Decision needed:

- [ ] Decide whether to publish a checker package before `0.12.0`.

What this means:

- Convert one or more repository-local fixture checkers into a package or reusable CLI/API.

Reasons to include in `0.12.0`:

- Easier for external implementers to run checks.
- Gives the release a clearer adoption path.

Reasons to defer:

- Current checkers are intentionally corpus-specific expectation checkers, not public reusable validators.
- Publishing a package implies API stability, support expectations, installation docs, versioning, and probably CI/release automation.
- Premature packaging could freeze internal checker structure before the actual stable conformance validator is designed.

Recommended `0.12.0` treatment:

- Defer.
- Keep direct Node commands as canonical.
- Revisit after `1.0.0` scope and validator boundaries are clearer.

### Add CI

Decision needed:

- [ ] Decide whether lightweight deterministic CI should be added before tagging `0.12.0`.

What this means:

- Add a CI workflow that runs local deterministic checks, such as fixture checkers and syntax checks.
- Live LLM evaluations should not run in CI because they require provider credentials, cost controls, and manual review.

Reasons to include in `0.12.0`:

- Reduces release risk.
- Makes future PRs safer.
- Documents the expected validation commands in executable form.

Reasons to defer:

- Adds repository/platform maintenance.
- Requires choosing a CI provider and workflow policy.
- Could slow the release if the repository has not standardized task automation yet.

Recommended `0.12.0` treatment:

- Include only if the project already uses, or wants to adopt, a simple CI provider now.
- If included, keep it narrow: deterministic local Node checks only.
- If not included, record the exact manual validation command list in release notes.

## Explicit Non-Goals For v0.12.0

- [ ] Do not publish `README.ja.md` as a complete translation before `1.0.0`.
- [ ] Do not advertise `0.12.0` as stable.
- [ ] Do not claim general "DocAI always beats OpenAPI" results beyond the measured fixture, models, tasks, and run dates.
- [ ] Do not publish live LLM provider calls as an automated CI requirement.
- [ ] Do not publish a checker package unless a separate packaging decision is made.
