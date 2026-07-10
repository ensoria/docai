# DocAI HTTP Release Process

This document defines the repository release process for DocAI HTTP. It is operational guidance for maintainers; the format rules remain in `README.md`.

## Release Labels

Use the narrowest publication label supported by evidence:

- `Design-review draft`: specification text is available, but fixture evidence is incomplete for an implementation promise.
- `Compatibility Core implementation target`: the release satisfies the Compatibility Core scope in `README.md` and has matching core fixtures and checker coverage.
- `Complete-generator-ready candidate`: the release has complete-surface fixture evidence for the full generator implementation surface described in `README.md` section 9.1.
- `Stable`: the release has the versioned conformance corpus required for the stable compatibility promise.

Do not imply compatibility for structures outside the published label. Non-core structures remain opt-in until they have specification text, positive and negative fixtures, checker behavior, coverage notes, and changelog evidence.

## Complete Generator Readiness Gate

Before using the `Complete-generator-ready candidate` label, complete the evidence gate in `COMPLETE-GENERATOR-READINESS.md`.

The current repository state is not complete-generator-ready. Candidate corpora for compact output, workflows, webhooks, non-JSON representations, polymorphic variants, and the complete-surface example pair are preparation work only until complete focused fixtures, matching checker coverage, LLM task evaluations, and release evidence all land together.

Do not update the README publication label merely because one candidate corpus exists. The label may change only after the complete full-profile set, matching compact projection, focused complete-surface fixtures, checker behavior, evaluation notes, and changelog/release notes support the broader claim.

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

Keep recursive schemas explicitly unsupported for the intended `1.0.0` stable contract unless a finite, self-contained representation and versioned fixture evidence land before the pre-v1.0.0 release-candidate stage.

Current evidence:

- Direct recursive source: `fixtures/core/v0.11.0/source/recursive-direct-openapi.yaml`
- Indirect recursive source: `fixtures/core/v0.11.0/source/recursive-indirect-openapi.yaml`
- Direct recursive projection fallback: `fixtures/core/v0.11.0/focused/valid/recursive-direct-unsupported.md`
- Indirect recursive projection fallback: `fixtures/core/v0.11.0/focused/valid/recursive-indirect-unsupported.md`
- Full-profile fallback example: `fixtures/core/v0.11.0/valid/full/resources/users.md`

Compatibility impact:

- A future recursive representation changes the contract for APIs that currently require an `unsupported` source fallback.
- After `1.0.0`, treat recursive-schema support as requiring a new major version by default when existing readers must understand the new representation to call the API correctly.
- A minor version is acceptable only for optional, self-bounding recursive metadata or capabilities that older readers can ignore while still relying on the existing `unsupported` fallback.

## Tag Checklist

Before tagging:

- Confirm the intended release label and compatibility scope.
- Confirm `README.md` specification version, metadata-stamp examples, fixture metadata stamps, checker `SPEC_VERSION`, and the `CHANGELOG.md` version section agree.
- Move every README-visible change out of `Unreleased` into the concrete version section.
- Confirm promoted features have README text, fixtures, checker behavior, coverage notes, and changelog evidence in the same release.
- Confirm non-core features are not advertised as compatibility-preserving unless they are explicitly promoted with fixture evidence.
- Confirm meaning-changing fixture updates either use a new fixture version directory or are called out as compatibility-impacting under the version bump rules.
- Run `node --check docai-http/tools/check-core-fixtures.mjs` from the repository root.
- Run `node docai-http/tools/check-core-fixtures.mjs` from the repository root.

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
