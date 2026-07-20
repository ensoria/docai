# DocAI HTTP TODO v1.0.0

This backlog starts after the pre-`1.0.0` stabilization work in
`TODO-v0.13.0.md` is complete.

The goal is to decide, prepare, verify, and publish the first stable DocAI HTTP
release without broadening the compatibility promise beyond the evidenced stable
conformance corpus.

## Release Thesis

- [x] Confirm that `TODO-v0.13.0.md` is historical and complete.
- [x] Confirm that `fixtures/conformance/v1.0.0/` is the intended stable conformance corpus.
- [x] Confirm that stable compatibility begins with `docai-http` version `1.0.0`.
- [x] Confirm that the `1.0.0` stable promise is limited to normative README text, `fixtures/conformance/v1.0.0/`, and `tools/check-conformance-fixtures.mjs`.
- [x] Confirm that candidate-only evidence paths do not create stable compatibility promises by themselves.

## P0: Release Path Decision

- [x] Decide whether to publish a `1.0.0` release candidate before stable `1.0.0`.
- [x] If using a release candidate, decide the tag and label format, such as `v1.0.0-rc.1`.
- [x] Since `v1.0.0-rc.1` is chosen, do not publish stable `v1.0.0` directly as the first publication step.
- [x] Confirm whether the first publication step updates the specification version in `README.md` to `1.0.0`.
- [x] Confirm whether the first publication step changes the publication label in `README.md` from `Complete-generator-ready candidate`.

Decision:

- Publish `v1.0.0-rc.1` first, then publish stable `v1.0.0` only after final RC review.
- The RC prepares the intended stable contract, so the active specification version should become `1.0.0` during the RC-preparation change set.
- The publication label should become `1.0.0 release candidate`, not `Stable`, until the final `v1.0.0` tag.
- If RC review finds only wording or metadata issues that preserve the stable contract, fix them before stable `v1.0.0`.
- If RC review finds compatibility-scope or conformance-content changes, update the evidence and consider publishing `v1.0.0-rc.2` before stable.

Decision options:

- Option A, recommended: publish `v1.0.0-rc.1` first, then tag `v1.0.0` after final review.
  - Advantages: gives reviewers a concrete stable-boundary artifact before final stable publication; lowers risk of discovering label/version mistakes after `v1.0.0`.
  - Disadvantages: adds one extra release step and one more label/version state to maintain.
- Option B: publish stable `v1.0.0` directly after deterministic checks and review.
  - Advantages: fastest path; avoids an intermediate release-candidate label.
  - Disadvantages: less room to catch publication wording mistakes before the first stable tag.
- Option C: publish another `0.x` candidate.
  - Advantages: safest if a new format change is discovered.
  - Disadvantages: delays stable release and should not be used unless the stable boundary changes.

## P0: Semantic Drift Audit

- [x] Compare `fixtures/conformance/v1.0.0/` against `fixtures/complete-candidates/v0.12.0/` and confirm that differences are limited to version metadata, source paths, fixture labels, and conformance documentation.
- [x] Confirm that no standard document content changed in a way that invalidates carried-forward LLM or OpenAPI evidence.
- [x] Since no semantic document content changed, record that no LLM or OpenAPI comparison refresh is required for `v1.0.0-rc.1`.
- [x] Do not send any live LLM API requests unless the user explicitly approves provider submission and possible API usage cost.

Audit result:

- `fixtures/conformance/v1.0.0/SEMANTIC-DRIFT-AUDIT.md` records the comparison.
- No live LLM API requests were sent for this audit.

## P1: Version And Label Alignment

- [x] Update `docai-http/README.md` specification version only when the release path decision says to do so.
- [x] Update the publication label in `docai-http/README.md` to the chosen `1.0.0` release-candidate or stable label.
- [x] Update the opening status prose in `docai-http/README.md` so it no longer describes the active publication as `0.12.0 Complete-generator-ready candidate` after the label changes.
- [x] Update README metadata-stamp examples if the chosen publication state requires examples to show `1.0.0`.
- [x] Keep historical `0.12.0` candidate references where they describe carried-forward evidence, not active publication status.
- [x] Update top-level `README.md` so its evidence summary and stable-boundary statement match the chosen release path.

## P1: Release Notes And Changelog

- [x] Add a `1.0.0` release section, or `1.0.0-rc.1` section if using an RC, to `CHANGELOG.md`.
- [x] Move applicable `Unreleased` entries into the concrete release section before tagging.
- [x] Add `1.0.0` or RC release notes to `RELEASE.md`.
- [x] Update old current-tagged-public-release wording after the new release is actually tagged.
- [x] Confirm release notes state the stable compatibility scope and explicitly non-promoted areas.
- [x] Confirm release notes describe carried-forward LLM/OpenAPI evidence without broadening claims.

## P1: Fixture And Checker Finalization

- [x] Run `node docai-http/tools/check-release-readiness.mjs`.
- [x] Run `git diff --check`.
- [x] Confirm `tools/check-conformance-fixtures.mjs` is the canonical stable conformance checker.
- [x] Confirm `tools/check-release-readiness.mjs` includes the stable conformance checker and does not run live LLM provider calls.
- [x] Confirm `fixtures/conformance/v1.0.0/README.md`, `COVERAGE.md`, `SOURCE-TRACEABILITY.md`, and `TOKEN-SAVINGS.md` use stable conformance wording.
- [x] Confirm `fixtures/README.md` points to the stable conformance corpus and checker.

Confirmation notes:

- `tools/check-conformance-fixtures.mjs` is the stable conformance wrapper for
  `fixtures/conformance/v1.0.0/`.
- `tools/check-release-readiness.mjs` includes `check-conformance-fixtures` and
  does not call live LLM provider runners.
- `fixtures/README.md` points to the stable conformance corpus, checker, coverage,
  source traceability, semantic drift audit, and token-saving notes.

## P1: Evidence Scope Review

- [x] Confirm required-target LLM evaluation evidence remains complete and passing.
- [x] Confirm OpenAPI comparison evidence remains scoped to the evaluated fixture, target models, task contracts, run dates, and grader policy.
- [x] Confirm optional LLM targets are not required for `1.0.0`.
- [x] Confirm additional APIs and task classes are not required for `1.0.0`.
- [x] Confirm normalized provider cost or cross-provider token aggregates are not published before a normalized cost model exists.

Confirmation notes:

- `node docai-http/tools/check-complete-evaluations.mjs` passes for the required
  target evidence.
- `node docai-http/tools/check-openapi-comparison.mjs` passes for the scoped
  OpenAPI baseline records.
- `targets.json` status records required target completion while keeping optional
  targets pending.
- `OPENAPI-COMPARISON-EVIDENCE.md` keeps claims scoped to the evaluated fixture,
  target models, task contracts, run dates, and grader policy.
- Optional targets, additional APIs/task classes, provider latency metrics, and
  normalized provider-cost comparisons remain future adoption evidence, not
  `v1.0.0-rc.1` or final stable blockers.

## P2: Publication Readiness Review

- [x] Review `docai-http/README.md` for active-version, active-label, and compatibility wording consistency.
- [x] Review `README.md` for scoped comparison claims and stable-boundary wording.
- [x] Review `RELEASE.md` for release path, release notes, tag checklist, and validation commands.
- [x] Review `CHANGELOG.md` for version section consistency.
- [x] Review fixture docs for path/version consistency.
- [x] Confirm no stale active-publication wording is present after `v1.0.0-rc.1` publication.
- [x] Search for claims that imply broader benchmark results than `OPENAPI-COMPARISON-EVIDENCE.md` supports.

Confirmation notes:

- `docai-http/README.md` now presents specification version `1.0.0` with the
  `1.0.0 release candidate` label and limits the intended stable promise to
  normative README text, `fixtures/conformance/v1.0.0/`, and
  `tools/check-conformance-fixtures.mjs`.
- The top-level `README.md` keeps OpenAPI comparison claims scoped to the
  evaluated `0.12.0` complete-candidate fixture, target models, task contracts,
  and evidence document.
- `RELEASE.md` now uses the `v1.0.0-rc.1` path, conformance-corpus evidence,
  `node docai-http/tools/check-release-readiness.mjs`, and `git diff --check`
  as the tag-time checks; it does not require live LLM provider calls.
- The `v1.0.0-rc.1` tag exists locally, and documentation that names the current
  tagged public release has been updated to `v1.0.0-rc.1`.
- Search found no unsupported broad benchmark claims; comparison claims remain
  bounded by `OPENAPI-COMPARISON-EVIDENCE.md`.

## P2: Tag And Release Preparation

- [x] Confirm working tree state before tagging.
- [x] Run `node docai-http/tools/check-release-readiness.mjs` immediately before tagging.
- [x] Run `git diff --check` immediately before tagging.
- [x] Prepare release notes from `RELEASE.md`.
- [x] User tags the release.
- [x] User publishes the release.
- [x] After tagging, update any documentation that must refer to the newly tagged release as current.

Preparation notes:

- `docai-http/RELEASE.md` contains the `1.0.0-rc.1` release notes, evidence
  list, compatibility notes, carried-forward evidence policy, validation
  commands, and publication notes.
- The user confirmed the tag-time `check-release-readiness` and `git diff --check`
  runs before publication.
- `git tag --list v1.0.0-rc.1` confirms the release-candidate tag exists locally.
- Post-tag documentation now names `v1.0.0-rc.1` as the current tagged public
  release while keeping final `Stable` reserved for `v1.0.0`.

## P2: Final RC Review Before Stable

- [ ] Decide the RC review window and feedback cutoff before final stable tagging.
- [ ] Collect post-`v1.0.0-rc.1` feedback from release notes, issues, discussions, downstream users, or local review notes.
- [ ] Classify each feedback item as no-change, wording/metadata-only, compatibility-scope change, conformance-content change, or future backlog.
- [ ] Apply wording/metadata-only fixes that preserve the intended stable contract before final `v1.0.0`.
- [ ] If compatibility-scope or conformance-content changes are needed, update fixtures/evidence and consider publishing `v1.0.0-rc.2` before stable.
- [ ] Rerun `node docai-http/tools/check-release-readiness.mjs` after any RC-review fix.
- [ ] Rerun `git diff --check` after any RC-review fix.
- [ ] Decide whether the final stable path is `v1.0.0` or another RC such as `v1.0.0-rc.2`.

Decision guidance:

- Choose final stable `v1.0.0` when review finds no issues or only
  wording/metadata fixes that do not change the compatibility boundary.
- Choose another RC when review finds changes to normative behavior,
  compatibility scope, conformance fixture content, checker expectations, or
  evidence requirements.
- Waiting longer for RC feedback reduces first-stable correction risk, but
  delays the stable release. Moving quickly is reasonable only if no external
  review channel is expected to provide meaningful new feedback.

User-side work:

- Decide the RC review window and whether any public or downstream feedback must
  be collected before final stable publication.
- After review, decide whether to proceed to final `v1.0.0` or publish another
  RC. The project should prefer another RC if the contract changes.

## P2: Stable Tag And Release Preparation

- [ ] Update `docai-http/README.md` publication label from `1.0.0 release candidate` to `Stable` only after the final stable decision.
- [ ] Update top-level `README.md` so it says final stable `v1.0.0` is published instead of pending.
- [ ] Add final `1.0.0` release notes to `docai-http/RELEASE.md`.
- [ ] Add a final `1.0.0` section to `docai-http/CHANGELOG.md` and move applicable `Unreleased` entries.
- [ ] Update current-tagged-public-release wording from `v1.0.0-rc.1` to final `v1.0.0` only after final stable publication.
- [ ] Run `node docai-http/tools/check-release-readiness.mjs` immediately before tagging stable `v1.0.0`.
- [ ] Run `git diff --check` immediately before tagging stable `v1.0.0`.
- [ ] User tags final stable `v1.0.0`.
- [ ] User publishes final stable `v1.0.0`.
- [ ] After stable publication, update any documentation that must refer to `v1.0.0` as current.

## P3: Post-1.0 Follow-Up Backlog

- [ ] Create a post-`1.0.0` TODO file after stable release.
- [ ] Create or refresh `README.ja.md` after the English `1.0.0` text is stable.
- [ ] Consider optional LLM target runs for adoption evidence.
- [ ] Consider provider latency and normalized cost metrics only after defining a cost model.
- [ ] Consider hosted CI that runs `node docai-http/tools/check-release-readiness.mjs`.
- [ ] Consider a public validator API/CLI only after defining its compatibility boundary.
- [ ] Consider a source-to-projection validator only after defining its input and diagnostics model.
- [ ] Consider finite recursive-schema representation in a future version only with explicit compatibility analysis and versioned fixtures.

## Non-Goals For The First Stable Release

- [ ] Do not broaden the stable compatibility boundary without new normative text, fixtures, checker behavior, and release notes.
- [ ] Do not run live LLM provider calls without explicit user approval.
- [ ] Do not publish `README.ja.md` before the English `1.0.0` text is stable.
- [ ] Do not publish a standalone validator package as part of `1.0.0`.
- [ ] Do not add hosted CI as a blocker for `1.0.0`.
- [ ] Do not add recursive-schema finite representation to `1.0.0`.
