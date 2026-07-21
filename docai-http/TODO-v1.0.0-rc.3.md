# DocAI HTTP TODO v1.0.0-rc.3

This backlog starts after publication and focused review of `v1.0.0-rc.2`.
That review confirmed seven original corrections, found one remaining
source-traceability blocker, and found stale current-release wording. Final
stable `v1.0.0` remains deferred until this correction is published and reviewed.

## Release Decision

- [x] Treat tagged `v1.0.0-rc.2` as immutable historical evidence.
- [x] Choose `v1.0.0-rc.3` because the versioned conformance corpus requires a
  meaningful authoritative-input and source-revision update.
- [x] Keep the DocAI HTTP format version at `1.0.0` and the publication label at
  `1.0.0 release candidate`.
- [x] Preserve the projected client contract; change provenance inputs, stamps,
  checker evidence, and release metadata only.

## P0: Complete Authoritative Inputs

- [x] Inventory every success response, response header, error shape, request
  constraint/default, document metadata field, and webhook field in the full
  and compact complete sets.
- [x] Add body presence, `application/json`, and schemas for cart validation,
  payment creation, order confirmation, and document upload success responses.
- [x] Add the POST `/users` `Location` response header.
- [x] Add structural schemas for common, validation, and `email_taken` errors.
- [x] Add missing user constraints/defaults and document metadata structure.
- [x] Add webhook metadata structure and the remaining header wire behavior.
- [x] Add error-field usage behavior not represented structurally by OpenAPI.

## P1: Restamp And Trace

- [x] Bump the input-set revision to `fixture-input-set-rc3-001`.
- [x] Bump the behavior-source revision to `fixture-behavior-rc3-001`.
- [x] Restamp full, compact, and focused fixtures as one `rc3-001` projection.
- [x] Update the conformance README and coverage map to the new projection ID.
- [x] Expand `SOURCE-TRACEABILITY.md` with success-response and error-shape
  inventories and remove the unsupported `rc.2` completeness conclusion.

## P1: Strengthen Deterministic Evidence

- [x] Add targeted checker assertions for every required success response,
  `Location`, error schema, request constraint/default, document metadata, and
  webhook schema block.
- [x] Keep the checker corpus-specific and self-contained; do not create a
  public source-to-projection validator API.
- [x] Verify that deleting any required source block causes the targeted source
  gate to fail.
- [x] Run the isolated stable-boundary checker.

## P2: Evaluation Impact

- [x] Classify the source expansion as provenance-only for LLM tasks: loaded
  standard-document semantics are unchanged except for equal-length stamps.
- [x] Recompute deterministic task/context metrics against the `rc3-001` corpus.
- [x] Regrade the existing required-target live responses against the unchanged
  task contract without making new provider calls.
- [x] Record explicitly that no Live LLM resend is required unless a projected
  task contract changes during correction.
- [x] Keep OpenAPI comparison evidence scoped to the historical `0.12.0` corpus.

## P2: Release Documentation

- [x] Update root and DocAI HTTP README current-release wording to published
  `v1.0.0-rc.2` and preparation of `v1.0.0-rc.3`.
- [x] Add `v1.0.0-rc.3` preparation notes to `CHANGELOG.md` and `RELEASE.md`.
- [x] Keep final `Stable` wording reserved for published final `v1.0.0`.
- [x] Prepare the final `1.0.0-rc.3` changelog section before tagging.

## P2: Regression And Review Gate

- [x] Run `node docai-http/tools/check-conformance-fixtures.mjs`.
- [x] Run `node docai-http/tools/check-conformance-boundary.mjs`.
- [x] Run `node docai-http/tools/check-release-readiness.mjs`.
- [x] Run `git diff --check`.
- [x] Confirm the worktree contains only intended `rc.3` changes.
- [ ] Request a focused external review of authoritative source completeness,
  traceability claims, and checker coverage using `RC3-SOURCE-REVIEW.md`.
- [ ] Resolve every focused-review result before final stable publication.

## P2: Tag And Publish

- [ ] User creates the `v1.0.0-rc.3` tag.
- [ ] User publishes the `v1.0.0-rc.3` release.
- [ ] Update current-release wording to `v1.0.0-rc.3` after publication.

## P3: Final Stable Handoff

- [ ] Return to `TODO-v1.0.0.md` only after the focused `rc.3` review finds no
  stable blocker.
- [ ] Publish another RC rather than stable if review changes normative text,
  projected conformance content, checker expectations, or the compatibility
  boundary again.

## Explicit Non-Goals

- [ ] Do not rewrite or retag `v1.0.0-rc.2`.
- [ ] Do not change projected API behavior to solve a source-only defect.
- [ ] Do not publish a reusable source-to-projection validator in this RC.
- [ ] Do not rerun paid Live LLM calls when task semantics are unchanged.
- [ ] Do not create `README.ja.md` before final English `1.0.0` is stable.
