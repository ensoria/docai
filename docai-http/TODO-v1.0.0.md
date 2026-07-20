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
- [ ] Update any `current tagged public release is v0.12.0` wording after the new release is actually tagged.
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

- [ ] Confirm required-target LLM evaluation evidence remains complete and passing.
- [ ] Confirm OpenAPI comparison evidence remains scoped to the evaluated fixture, target models, task contracts, run dates, and grader policy.
- [ ] Confirm optional LLM targets are not required for `1.0.0`.
- [ ] Confirm additional APIs and task classes are not required for `1.0.0`.
- [ ] Confirm normalized provider cost or cross-provider token aggregates are not published before a normalized cost model exists.

## P2: Publication Readiness Review

- [ ] Review `docai-http/README.md` for active-version, active-label, and compatibility wording consistency.
- [ ] Review `README.md` for scoped comparison claims and stable-boundary wording.
- [ ] Review `RELEASE.md` for release path, release notes, tag checklist, and validation commands.
- [ ] Review `CHANGELOG.md` for version section consistency.
- [ ] Review fixture docs for path/version consistency.
- [ ] Search for stale active-publication wording such as `current tagged public release is v0.12.0` after the new tag exists.
- [ ] Search for claims that imply broader benchmark results than `OPENAPI-COMPARISON-EVIDENCE.md` supports.

## P2: Tag And Release Preparation

- [ ] Confirm working tree state before tagging.
- [ ] Run `node docai-http/tools/check-release-readiness.mjs` immediately before tagging.
- [ ] Run `git diff --check` immediately before tagging.
- [ ] Prepare release notes from `RELEASE.md`.
- [ ] User tags the release.
- [ ] User publishes the release.
- [ ] After tagging, update any documentation that must refer to the newly tagged release as current.

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
