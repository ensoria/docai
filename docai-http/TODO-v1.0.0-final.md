# DocAI HTTP TODO v1.0.0 Final Publication

This is the active checklist for promoting published `v1.0.0-rc.4` to final
stable `v1.0.0`. Earlier release-path decisions remain in `TODO-v1.0.0.md` and
the RC-specific TODO files.

## Current Decision

- [x] Confirm `v1.0.0-rc.4` is tagged and published.
- [x] Confirm focused RC.4 review completed with zero stable blockers, wording
  issues, future-backlog items, or open questions.
- [x] Select direct promotion from `v1.0.0-rc.4` to final `v1.0.0`.
- [x] Confirm no additional release candidate is required.
- [x] Keep every published RC tag immutable.

## P0: Close RC.4 Review

- [x] Check all four Reviewer Result items in `RC4-METADATA-REVIEW.md`.
- [x] Mark RC.4 review and resolution complete in `TODO-v1.0.0-rc.4.md`.
- [x] Record this file as the active final-publication checklist without
  deleting the historical `TODO-v1.0.0.md` record.

## P0: Freeze The Reviewed Contract

- [ ] Freeze normative DocAI HTTP syntax and behavior through the stable tag.
- [ ] Freeze `fixtures/conformance/v1.0.0/` content and
  `tools/check-conformance-fixtures.mjs` behavior through the stable tag.
- [ ] Keep projection ID `conformance-20260721-rc4-001` and source revision
  `fixture-input-set-rc3-001`; do not restamp the reviewed corpus for the final
  tag.
- [ ] Confirm the post-RC.4 current-release update is wording/metadata only.
- [ ] If any normative text, projected conformance content, checker expectation,
  or compatibility boundary must change, stop stable preparation and create a
  new RC checklist instead.

## P1: Prepare Stable Publication Wording

- [ ] Change `docai-http/README.md` status and publication label from release
  candidate to final `Stable`.
- [ ] Update the DocAI HTTP README opening status prose for final `v1.0.0` while
  keeping `v1.0.0-rc.4` as the current tagged public release until the final tag
  is actually published.
- [ ] Update the root `README.md` to present final `v1.0.0` as the stable
  publication being prepared from the reviewed RC.4 contract.
- [ ] Add final `1.0.0` stable release notes to `RELEASE.md`, including the exact
  compatibility boundary and explicitly non-promoted areas.
- [ ] Add `1.0.0 (Stable)` to `CHANGELOG.md` and move applicable `Unreleased`
  entries into it before tagging.
- [ ] Audit active wording across README, release, fixture, and readiness
  documents; retain RC wording only where it is historical.
- [ ] Keep `README.ja.md` deferred until the final English `1.0.0` publication is
  complete.

## P1: Confirm Evidence Scope

- [ ] Confirm RC.4 review made no task-contract or context-content change that
  requires Live LLM provider submission.
- [ ] Regrade existing required-target responses and recompute deterministic
  context metrics without provider calls.
- [ ] Keep OpenAPI comparison claims scoped to the evaluated `0.12.0` fixture,
  target models, task contracts, run dates, and grader policy.
- [ ] Confirm optional models, additional APIs/tasks, normalized provider costs,
  hosted CI, and a public validator remain non-blocking post-1.0 work.

## P2: Final Pre-Tag Gate

- [ ] Run `node docai-http/tools/check-release-readiness.mjs`.
- [ ] Run `git diff --check`.
- [ ] Confirm no source, conformance fixture, or checker behavior changed after
  the reviewed RC.4 state.
- [ ] Confirm the stable-preparation diff contains only intended publication
  wording, release metadata, review records, and TODO updates.
- [ ] Confirm the worktree is clean after committing the stable-preparation
  change.
- [ ] Confirm `v1.0.0` does not already exist locally or on the release remote.
- [ ] Prepare final release notes from the `1.0.0` section in `RELEASE.md`.

## P2: Tag And Publish

User-side work after the pre-tag gate passes:

- [ ] User creates annotated tag `v1.0.0` at the reviewed stable-preparation
  commit.
- [ ] User pushes the `v1.0.0` tag.
- [ ] User publishes the final `v1.0.0` release using the prepared release notes.
- [ ] Verify the public tag resolves to the intended stable commit.

Do not move or recreate the final tag after publication. A later correction
must use a new version according to the compatibility rules.

## P2: Post-Publication Alignment

- [ ] Update current-release wording from `v1.0.0-rc.4` to published
  `v1.0.0` without changing the tagged stable artifact.
- [ ] Confirm root README, DocAI HTTP README, and `RELEASE.md` all identify
  `v1.0.0` as current and `Stable`.
- [ ] Record tag/publication completion in this checklist and the changelog.
- [ ] Rerun `node docai-http/tools/check-release-readiness.mjs`.
- [ ] Rerun `git diff --check`.
- [ ] Commit and push the post-publication alignment separately.

## P3: Post-1.0 Handoff

- [ ] Create a versioned post-`1.0.0` TODO for deferred adoption and tooling
  work.
- [ ] Create or refresh `README.ja.md` from the final English `1.0.0` text.
- [ ] Keep recursive finite representation, public validator APIs, hosted CI,
  optional live targets, and expanded benchmarks outside the `1.0.0` contract
  unless separately designed and versioned.

## Stop Conditions

- [ ] Stop and prepare another RC if stable preparation changes normative
  behavior, conformance content, checker expectations, or compatibility scope.
- [ ] Stop and investigate if any deterministic readiness check fails.
- [ ] Do not send Live LLM API requests without explicit user approval; none are
  currently required for final publication.
