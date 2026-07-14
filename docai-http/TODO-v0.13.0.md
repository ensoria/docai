# DocAI HTTP TODO v0.13.0

This backlog starts after the `v0.12.0` Complete-generator-ready candidate release.

The next release version is not final. Use this file as the active post-`0.12.0`
planning backlog until the project decides whether the next public release is a
`0.13.0` candidate, a pre-`1.0.0` release candidate, or a direct `1.0.0`
stabilization effort.

## Starting Point

- [x] `v0.12.0` has been tagged and published as `Complete-generator-ready candidate`.
- [x] `0.12.0` is not stable and not `1.0.0`.
- [x] Stable compatibility guarantees still begin with `1.0.0`.
- [x] `TODO-v0.12.0.md` is historical after publication.
- [ ] Decide the next release thesis: `0.13.0` candidate, pre-`1.0.0` release candidate, or `1.0.0` stabilization.

## Candidate Work Items

### Stable Readiness And Conformance

- [ ] Decide the minimum evidence required before calling a release `1.0.0`.
- [ ] Define the stable conformance corpus boundary separately from candidate fixture evidence.
- [ ] Decide whether `fixtures/complete-candidates/v0.12.0/` should be promoted, copied, or replaced for the stable corpus.
- [ ] Review recursive-schema unsupported policy before any `1.0.0` release candidate.
- [ ] Confirm which complete-surface structures become stable compatibility promises.

### Validator And Checker Strategy

- [ ] Decide whether to keep corpus-specific expectation checkers only.
- [ ] Decide whether to design a public reusable validator API/CLI.
- [ ] If a public validator is planned, define its compatibility boundary before publishing a package.
- [ ] Keep direct Node checker commands canonical until a public validator/package boundary is explicit.

### Source-To-Projection Audit

- [ ] Decide whether to add a source-to-projection validator or keep source fixtures as traceability evidence only.
- [ ] Audit source fixture coverage for any corpus considered for the next public release.
- [ ] Add missing source inputs only when an evidenced corpus lacks a clear authoritative source.

### CI And Automation

- [ ] Decide whether to adopt a CI provider for deterministic local checks.
- [ ] If CI is added, run only local deterministic checks.
- [ ] Do not run live LLM provider calls in CI.
- [ ] Keep live provider evaluations as manually reviewed evidence with explicit cost and credential control.

### LLM Evaluation And OpenAPI Comparison

- [ ] Decide whether optional LLM targets should be run for broader signal.
- [ ] Add more APIs or task classes before making broader OpenAPI comparison claims.
- [ ] Keep current OpenAPI comparison claims scoped to the evaluated fixture, target models, tasks, and run dates.
- [ ] Decide whether provider-reported token/cost metrics can be normalized and published.

### Documentation

- [ ] Keep `README.ja.md` deferred until after `1.0.0` text is stable.
- [ ] Review whether post-`0.12.0` documentation should include a release-history summary separate from `CHANGELOG.md`.
- [ ] Keep top-level README comparison claims synchronized with `OPENAPI-COMPARISON-EVIDENCE.md`.

## Explicit Non-Goals Until Decided

- [ ] Do not call any post-`0.12.0` release stable without a stable conformance corpus.
- [ ] Do not publish a standalone checker package without defining its API and compatibility promise.
- [ ] Do not broaden OpenAPI comparison claims beyond the data recorded in the evidence file.
- [ ] Do not treat live LLM provider calls as automated CI gates.
