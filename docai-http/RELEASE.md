# DocAI HTTP Release Process

This document defines the repository release process for DocAI HTTP. It is operational guidance for maintainers; the format rules remain in `README.md`.

## 1.0.0-rc.1 Release Notes (Release candidate)

Scope:

- Publication label: `1.0.0 release candidate`, not final `Stable`.
- Release path: publish `v1.0.0-rc.1` before stable `v1.0.0`; tag stable
  `v1.0.0` only after final RC review.
- Compatibility scope under review for final stable: normative README text,
  `fixtures/conformance/v1.0.0/`, and `tools/check-conformance-fixtures.mjs`.
- Explicitly non-promoted areas: final `Stable` publication, standalone public
  validator APIs, automated live-provider CI, translated `README.ja.md`, source-to-projection
  validator guarantees, normalized provider cost comparisons, optional live LLM
  target requirements, additional API/task benchmark claims, and recursive-schema
  finite representation support.

Evidence:

- Stable conformance corpus: `fixtures/conformance/v1.0.0/`.
- Stable conformance checker: `node docai-http/tools/check-conformance-fixtures.mjs`.
- Stable conformance coverage: `fixtures/conformance/v1.0.0/COVERAGE.md`.
- Source traceability audit: `fixtures/conformance/v1.0.0/SOURCE-TRACEABILITY.md`.
- Semantic drift audit: `fixtures/conformance/v1.0.0/SEMANTIC-DRIFT-AUDIT.md`.
- Token-saving conformance notes: `fixtures/conformance/v1.0.0/TOKEN-SAVINGS.md`.
- Carried-forward LLM evaluation results: `fixtures/complete-candidates/v0.12.0/evaluations/RESULTS.md`.
- Carried-forward OpenAPI comparison evidence: `OPENAPI-COMPARISON-EVIDENCE.md`.

Compatibility:

- Version bump reason: `v1.0.0-rc.1` switches the active specification version to
  `1.0.0` and tests the intended first stable compatibility contract before the
  final stable tag.
- Known compatibility limits: this publication is a release candidate, not final
  `Stable`; candidate-only evidence paths do not create stable compatibility
  promises by themselves.
- Migration notes: implementers targeting the RC should use
  `fixtures/conformance/v1.0.0/` and `node docai-http/tools/check-conformance-fixtures.mjs`.
  Implementers targeting historical pre-1.0 scopes may continue using the
  `0.11.0` core corpus or the `0.12.0` complete-candidate corpus as appropriate.

Carried-forward evidence policy:

- The `0.12.0` live LLM task evaluations, deterministic token-load records, and
  OpenAPI comparison records remain supporting evidence for `v1.0.0-rc.1` because
  `SEMANTIC-DRIFT-AUDIT.md` found no standard document content drift after
  release-boundary metadata is normalized.
- If final RC review changes standard document content beyond wording or metadata
  that preserves the stable contract, rerun deterministic checks and decide
  whether the affected live LLM or OpenAPI comparison evidence must be refreshed.

Required pre-tag validation:

- `node docai-http/tools/check-release-readiness.mjs`.
- `git diff --check`.
- Rerun both immediately before tagging `v1.0.0-rc.1`.

Publication notes:

- Do not call this release `Stable`.
- Now that `v1.0.0-rc.1` is tagged and published, documentation that names the
  current tagged public release should point to `v1.0.0-rc.1`.
- If final review finds only wording or metadata issues that preserve the stable
  contract, fix them before tagging stable `v1.0.0`.
- If final review finds compatibility-scope or conformance-content changes,
  update the evidence and consider publishing `v1.0.0-rc.2` before stable `v1.0.0`.

## 0.12.0 Draft Release Notes (Complete-generator-ready candidate)

Scope:

- Compatibility scope: the complete draft surface evidenced by `fixtures/complete-candidates/v0.12.0/`.
- Newly promoted features: complete-surface generator readiness for the evidenced corpus, including the required full profile, matching compact profile, workflows, webhooks, non-JSON representation classes, polymorphic variants, selective convention loading, compact reductions, and complete-surface `unknown` / `unsupported` forms covered by the fixture corpus.
- Explicitly non-promoted draft areas: stable compatibility, `1.0.0` conformance status, recursive-schema representation support, a standalone public validator package, automated live-provider CI, and `README.ja.md`.

Evidence:

- Fixture corpus: `fixtures/complete-candidates/v0.12.0/`.
- Complete-candidate checker: `node docai-http/tools/check-complete-candidates.mjs`.
- Evaluation checker: `node docai-http/tools/check-complete-evaluations.mjs`.
- OpenAPI comparison checker: `node docai-http/tools/check-openapi-comparison.mjs`.
- Coverage notes: `fixtures/complete-candidates/v0.12.0/COVERAGE.md`.
- LLM evaluation results: `fixtures/complete-candidates/v0.12.0/evaluations/RESULTS.md`.
- OpenAPI comparison evidence: `OPENAPI-COMPARISON-EVIDENCE.md`.

Compatibility:

- Version bump reason: `0.12.0` expands the advertised pre-1.0 implementation target from the `0.11.0` Compatibility Core to an evidenced complete-generator-ready candidate surface.
- Known compatibility limits: this release is not stable, not `1.0.0`, and not compatibility-stable for future versions. Stable compatibility guarantees still begin at `1.0.0`.
- Migration notes: implementers targeting only the `0.11.0` Compatibility Core may continue using the core fixture corpus; implementers targeting `0.12.0` should use the `complete-candidates/v0.12.0` corpus and the complete-candidate checkers.

Pre-tag deterministic validation results:

- `node docai-http/tools/check-core-fixtures.mjs`: passed.
- `node docai-http/tools/check-compact-candidates.mjs`: passed.
- `node docai-http/tools/check-workflow-candidates.mjs`: passed.
- `node docai-http/tools/check-webhook-candidates.mjs`: passed.
- `node docai-http/tools/check-non-json-candidates.mjs`: passed.
- `node docai-http/tools/check-polymorphism-candidates.mjs`: passed.
- `node docai-http/tools/check-complete-candidates.mjs`: passed.
- `node docai-http/tools/check-complete-evaluations.mjs`: passed.
- `node docai-http/tools/check-openapi-comparison.mjs`: passed.
- `git diff --check`: passed.

Release automation:

- No CI workflow is added for `0.12.0`; this repository does not yet have a standard CI provider or task-runner surface.
- The deterministic commands above remain the canonical pre-tag validation path for this release.
- Live LLM provider evaluations are manually recorded evidence. They require provider credentials, cost controls, and human result review, and must not be treated as automatic CI gates.

Pre-tag review status:

- `docai-http/README.md` describes `0.12.0` as a pre-1.0 complete-generator-ready candidate, not stable and not compatibility-stable.
- The top-level `README.md` comparison summary is scoped to the evaluated fixture, target models, task contracts, and evidence file.
- Release-label references across `README.md`, `RELEASE.md`, `fixtures/README.md`, `COMPLETE-GENERATOR-READINESS.md`, and `CHANGELOG.md` agree on the `0.12.0 Complete-generator-ready candidate` label.
- The active complete-candidate fixture paths and checker version expectations use `fixtures/complete-candidates/v0.12.0/`.
- The evidenced complete-candidate corpus has source fixtures under `fixtures/complete-candidates/v0.12.0/source/`.
- `README.ja.md` is explicitly excluded from `0.12.0` readiness work and deferred until after `1.0.0`.

## Release Labels

Use the narrowest publication label supported by evidence:

- `Design-review draft`: specification text is available, but fixture evidence is incomplete for an implementation promise.
- `Compatibility Core implementation target`: the release satisfies the Compatibility Core scope in `README.md` and has matching core fixtures and checker coverage.
- `Complete-generator-ready candidate`: the release has complete-surface fixture evidence for the full generator implementation surface described in `README.md` section 9.1.
- `1.0.0 release candidate`: the release has the intended `1.0.0` stable conformance corpus and checker evidence, but is still under final review before the final `Stable` tag.
- `Stable`: the release has the versioned conformance corpus required for the stable compatibility promise.

Do not imply compatibility for structures outside the published label. Non-core structures remain opt-in until they have specification text, positive and negative fixtures, checker behavior, coverage notes, and changelog evidence.

## Complete Generator Readiness Gate

Before using the `Complete-generator-ready candidate` label, complete the evidence gate in `COMPLETE-GENERATOR-READINESS.md`.

The current tagged public release is `v1.0.0-rc.1`, published as `1.0.0 release candidate`, not final `Stable`. The previous `v0.12.0` complete-generator-ready candidate remains historical supporting evidence. Its complete-candidate corpus has complete focused fixture coverage, matching checker coverage, required-target LLM evaluations, token-load evidence, and scoped OpenAPI comparison evidence.

Do not update the README publication label merely because one candidate corpus exists. The label may change only after the complete full-profile set, matching compact projection, focused complete-surface fixtures, checker behavior, evaluation notes, and changelog/release notes support the broader claim.

## Pre-1.0 Stable Boundary Decision

The intended first stable conformance corpus is `fixtures/conformance/v1.0.0/`.
It copies the standard document content from `fixtures/complete-candidates/v0.12.0/`
into a separate versioned stable-boundary path with `docai-http: 1.0.0` metadata
and stable conformance expectation labels.

Minimum evidence before calling a release `1.0.0`:

- Normative README text defines the structure.
- `fixtures/conformance/v1.0.0/` contains positive and negative fixture evidence for the structure.
- `node docai-http/tools/check-conformance-fixtures.mjs` passes.
- Recursive schemas remain explicitly unsupported and are covered by direct and indirect recursive source fixtures plus generated `unsupported` fallback fixtures.
- The `0.12.0` live LLM, token-load, and OpenAPI comparison records remain supporting evidence only while the stable conformance document content stays semantically identical to the evaluated candidate content.
- If conformance document content changes beyond metadata, paths, or expectation labels, the release must rerun deterministic checks and decide whether affected live LLM or OpenAPI comparison evidence must be refreshed before tagging `1.0.0`.

Stable compatibility promises for `1.0.0` are limited to structures covered by README normative text, the `fixtures/conformance/v1.0.0/` corpus, and the conformance checker. Candidate-only evidence paths do not create a stable compatibility promise by themselves. Standalone public validator APIs, automated live-provider CI, translated `README.ja.md`, and recursive-schema finite representation support remain outside the stable boundary unless they are deliberately promoted with their own compatibility evidence.

## 1.0.0 Release Candidate Path

The chosen path is to publish `v1.0.0-rc.1` before stable `v1.0.0`.

The release candidate prepares the intended stable contract, so the RC
preparation change set should update active specification wording to
`docai-http` version `1.0.0` while keeping the publication label as
`1.0.0 release candidate`, not `Stable`.

After `v1.0.0-rc.1` is published:

- If final review finds only wording or metadata issues that preserve the
  stable contract, fix them before tagging stable `v1.0.0`.
- If final review finds compatibility-scope changes or conformance-content
  changes, update the evidence and consider publishing `v1.0.0-rc.2` before
  stable `v1.0.0`.
- Do not call the release `Stable` until the final `v1.0.0` publication step.

## Source-To-Projection Audit

For the intended `1.0.0` stable release, source fixtures remain traceability evidence only. `fixtures/conformance/v1.0.0/SOURCE-TRACEABILITY.md` records the source inputs, their conformance roles, and the decision not to require a public source-to-projection validator before `1.0.0`.

No missing source inputs are known for the current stable conformance corpus:

- `source/complete-openapi.yaml` covers the full/compact complete API example pair.
- `source/recursive-direct-openapi.yaml` covers direct recursive-schema fallback.
- `source/recursive-indirect-openapi.yaml` covers indirect recursive-schema fallback.

Do not promote a source-to-projection validator as part of `1.0.0` unless its input model, diagnostics model, versioning rules, and compatibility boundary are explicitly designed and documented. Until then, the canonical stable check remains `node docai-http/tools/check-conformance-fixtures.mjs`.

## Semantic Drift Audit

`fixtures/conformance/v1.0.0/SEMANTIC-DRIFT-AUDIT.md` records the audit comparing
the stable conformance corpus with `fixtures/complete-candidates/v0.12.0/`.

The audit found no semantic drift in standard DocAI HTTP document content after
normalizing version metadata, source paths, fixture identity values, fixture
expectation labels, and source fixture title/version metadata. Therefore the
`0.12.0` live LLM task evaluations, deterministic token-load evidence, and
OpenAPI comparison records remain carried-forward supporting evidence for
`v1.0.0-rc.1`.

If standard document content changes after this audit, repeat deterministic
checks and decide whether affected live LLM or OpenAPI comparison evidence must
be refreshed before stable `v1.0.0`.

## Pre-1.0 Deterministic Automation

Do not add a hosted CI provider as a `1.0.0` prerequisite unless the repository
chooses a CI platform separately. Before `1.0.0`, keep deterministic validation
local and provider-neutral:

- Canonical aggregate command: `node docai-http/tools/check-release-readiness.mjs`.
- The aggregate command runs only local deterministic checks.
- It must not call Google, Anthropic, OpenAI, or any other live LLM provider.
- Live provider evaluations remain manually reviewed evidence with explicit
  credential and cost control.

A future CI workflow may call `node docai-http/tools/check-release-readiness.mjs`,
but adding CI does not change the stable compatibility boundary.

## Pre-1.0 LLM Evaluation And OpenAPI Comparison Scope

Do not require optional live LLM targets before `1.0.0`. The required target
coverage in `fixtures/complete-candidates/v0.12.0/evaluations/RESULTS.md` is
sufficient supporting evidence for the intended stable conformance corpus while
the conformance document content stays semantically identical to the evaluated
candidate content.

Do not add additional APIs or task classes as `1.0.0` prerequisites. Additional
fixtures, APIs, task groups, optional target models, latency measurements, or
provider-cost comparisons are useful future adoption evidence, but they are not
part of the stable compatibility boundary unless explicitly promoted with their
own fixture and checker evidence.

Keep OpenAPI comparison claims scoped to the evaluated fixture, target models,
task contracts, run dates, and grader policy recorded in
`OPENAPI-COMPARISON-EVIDENCE.md`. Do not generalize the comparison into a broad
benchmark claim.

Do not publish normalized provider cost or cross-provider token aggregates before
`1.0.0`. Provider-reported usage may remain in reviewed JSONL records, but public
summary claims should use deterministic local context metrics, pass rates, and
the existing scoped comparison until a normalized cost model is deliberately
defined.

## Pre-Stable Documentation Scope

Keep documentation changes before final stable `v1.0.0` narrowly focused on the
stable boundary:

- Defer `README.ja.md` until after the English `1.0.0` text is stable.
- Do not add a separate release-history document before final stable `v1.0.0`; use
  `CHANGELOG.md` for chronological history and this `RELEASE.md` for release
  criteria, gates, and operational decisions.
- Keep top-level README comparison claims synchronized with
  `OPENAPI-COMPARISON-EVIDENCE.md` and scoped to the evaluated fixture, target
  models, tasks, and dates.
- After switching to `v1.0.0-rc.1`, keep active publication wording on
  `1.0.0 release candidate` until the repository deliberately switches to final
  `Stable`.

When the publication label changes, update `docai-http/README.md`, `README.md`,
`CHANGELOG.md`, fixture documentation, and release notes in the same change set.

## Version Bump Rules

Before `1.0.0`:

- Use a patch version for compatible wording clarifications, checker diagnostics, fixture additions that only reinforce an already published compatibility scope, and other changes that do not change document meaning or required structure.
- Use a minor version and reset patch to zero when a change can alter the meaning of an existing compliant document, changes required structure, expands the compatibility scope, or promotes a non-core feature into a compatibility promise.
- Keep non-core draft changes outside the compatibility promise unless the release explicitly promotes them. A non-core draft clarification can ride in a patch release only when it does not affect the current Compatibility Core promise or advertised release label.
- Reject numeric shortcuts such as using `pre-v1.0.0` in metadata stamps. Repository tags and labels may use release-candidate wording, but generated fixture files declare the numeric DocAI HTTP version they test.

From `1.0.0` onward:

- Follow the semantic-versioning rules in `README.md`: major for meaning-changing or newly required structures, minor for backward-compatible optional capabilities, and patch for clarifications that preserve meaning and required structure.

## Fixture Versioning

Treat released fixture corpora as compatibility evidence:

- When the numeric DocAI HTTP version changes, create a matching fixture version directory, update fixture metadata stamps, update checker version expectations, and update fixture documentation.
- Create a new fixture version directory when a meaning-changing fixture update changes an expected valid/invalid result, changes the represented contract, expands the compatibility scope, or tests newly promoted structures.
- Patch an existing draft fixture directory only for non-meaning-changing corrections such as typos, comments, paths in documentation prose, or checker-report improvements that do not change expected fixture outcomes.
- Adding focused fixtures for the same already-promoted scope is allowed during `Unreleased`, but before tagging, confirm whether the addition is compatible reinforcement or requires a new fixture version directory under the rules above.
- Do not silently mutate the fixture evidence for an already published tag. The tag remains the immutable release artifact; any main-branch fixture change after that tag must be represented in `CHANGELOG.md` before the next release.

## Promoted Feature Change Set

For every promoted feature, update all applicable release evidence in the same change set:

- `README.md` specification text
- versioned fixtures
- checker behavior
- fixture `COVERAGE.md`
- `CHANGELOG.md`

If one of these does not apply, state why in the change or release notes. A feature is not promoted merely because draft text exists; promotion requires the release label or release notes to say that readers/producers may rely on the feature inside the advertised compatibility scope.

## Recursive Schema Policy

Keep recursive schemas explicitly unsupported for the intended `1.0.0` stable
contract unless a finite, self-contained representation and versioned fixture
evidence land before final stable `v1.0.0` publication.

Current evidence:

- Direct recursive source: `fixtures/conformance/v1.0.0/source/recursive-direct-openapi.yaml`
- Indirect recursive source: `fixtures/conformance/v1.0.0/source/recursive-indirect-openapi.yaml`
- Direct recursive projection fallback: `fixtures/conformance/v1.0.0/focused/valid/recursive-direct-unsupported.md`
- Indirect recursive projection fallback: `fixtures/conformance/v1.0.0/focused/valid/recursive-indirect-unsupported.md`
- Invalid finite truncation fixture: `fixtures/conformance/v1.0.0/focused/invalid/recursive-truncated-representation.md`

Compatibility impact:

- A future recursive representation changes the contract for APIs that currently require an `unsupported` source fallback.
- After `1.0.0`, treat recursive-schema support as requiring a new major version by default when existing readers must understand the new representation to call the API correctly.
- A minor version is acceptable only for optional, self-bounding recursive metadata or capabilities that older readers can ignore while still relying on the existing `unsupported` fallback.

## Tag Checklist

Before tagging:

- Confirm the intended release label and compatibility scope.
- Confirm `docai-http/README.md` specification version, publication label,
  metadata-stamp examples, conformance fixture metadata stamps, checker expected
  version, and the `CHANGELOG.md` version section agree.
- Move every README-visible change out of `Unreleased` into the concrete version section.
- Confirm promoted features have README text, fixtures, checker behavior, coverage notes, and changelog evidence in the same release.
- Confirm non-core features are not advertised as compatibility-preserving unless they are explicitly promoted with fixture evidence.
- Confirm meaning-changing fixture updates either use a new fixture version directory or are called out as compatibility-impacting under the version bump rules.
- Confirm candidate-only evidence paths are described as supporting evidence, not
  stable compatibility promises.
- Confirm OpenAPI comparison claims remain scoped to the evaluated fixture,
  required target models, task contracts, run dates, and grader policy.
- Confirm no live LLM provider call is required by the tag checklist.
- Run `node docai-http/tools/check-release-readiness.mjs` from the repository root.
- Run `git diff --check` from the repository root.
- For release-candidate publications, update "current tagged public release"
  wording only after the tag is actually published.

## Release Note Template

```markdown
## <version> (<label>)

Scope:
- Compatibility scope:
- Newly promoted features:
- Explicitly non-promoted draft areas:

Evidence:
- Fixture corpus:
- Checker command:
- Coverage notes:

Compatibility:
- Version bump reason:
- Known compatibility limits:
- Migration notes:
```

## Checker Command Policy

Use the direct Node command as the canonical checker entry point:

```sh
node docai-http/tools/check-core-fixtures.mjs
```

Do not add a package script only for this checker while the repository has no standard package/task-runner surface. Revisit a package or script entry if the repository adopts a task runner, publishes the checker as a package, or adds multiple repeatable validation commands.
