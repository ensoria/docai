# DocAI HTTP TODO v1.0.0-rc.4

This backlog starts after publication and review of `v1.0.0-rc.3`. That review
confirmed the authoritative source content, found omitted source revisions in
focused metadata stamps, and found stale current-release wording. Final stable
`v1.0.0` remains deferred until the correction is published and reviewed.

## Release Decision

- [x] Keep tagged `v1.0.0-rc.3` immutable.
- [x] Use `v1.0.0-rc.4` because the versioned conformance corpus and stable
  checker expectations change after publication.
- [x] Preserve DocAI HTTP format version `1.0.0`, authoritative input revision
  `fixture-input-set-rc3-001`, and the projected client contract.
- [x] Restamp the corrected projection as `rc4-001`.

## P0: Focused Metadata Identity

- [x] Add the stable input-set revision to every metadata-bearing focused
  snippet that omitted it.
- [x] Keep the dedicated invalid fixture without a source revision.
- [x] Make the stable checker validate focused projection, generation, source,
  and source-revision identity.
- [x] Add focused and isolated negative tests for omitted source revisions.
- [x] Update conformance README, coverage, and semantic-drift evidence.

## P1: Release Documentation

- [x] Update root README, DocAI HTTP README, and release guidance to identify
  published `v1.0.0-rc.3` and preparation of `v1.0.0-rc.4`.
- [x] Record the RC.3 review result without rewriting the published tag.
- [x] Add RC.4 changelog and release notes.
- [x] Add `RC4-METADATA-REVIEW.md` for the next focused review.

## P1: Evaluation Impact

- [x] Record that authoritative inputs, normative syntax, and projected client
  behavior are unchanged.
- [x] Regrade existing required-target responses against the corrected corpus.
- [x] Recompute deterministic task/context metrics.
- [x] Do not send Live LLM provider requests because no task contract changed.

## P2: Regression Gate

- [x] Run `node docai-http/tools/check-conformance-fixtures.mjs`.
- [x] Run `node docai-http/tools/check-conformance-boundary.mjs`.
- [x] Run `node docai-http/tools/check-release-readiness.mjs`.
- [x] Run `git diff --check`.
- [x] Audit focused metadata identity, excluding only the dedicated invalid
  fixture, and confirm no stale active-release wording remains.
- [x] Confirm the worktree contains only intended RC.4 changes.

## P2: Tag, Publish, And Review

- [x] User creates the `v1.0.0-rc.4` tag.
- [x] User publishes the `v1.0.0-rc.4` release.
- [x] Update current-release wording to `v1.0.0-rc.4` after publication.
- [x] Request focused external review using `RC4-METADATA-REVIEW.md`.
- [x] Resolve every review result before final stable publication.

## P3: Final Stable Handoff

- [x] Confirm the focused RC.4 review found no stable blocker and hand final
  publication work to `TODO-v1.0.0-final.md`.
- [x] Confirm another RC is unnecessary because review requires no normative,
  conformance-content, checker, or compatibility-boundary change.

## Explicit Non-Goals

- [ ] Do not rewrite or retag published release candidates.
- [ ] Do not change authoritative source content or projected API behavior.
- [ ] Do not broaden OpenAPI comparison claims beyond evaluated `0.12.0` data.
- [ ] Do not rerun paid Live LLM calls when task semantics are unchanged.
- [ ] Do not create `README.ja.md` before final English `1.0.0` is stable.
