# DocAI HTTP TODO After v1.0.0

This backlog starts after publication of Stable `v1.0.0`. Items here are not
part of the `1.0.0` compatibility promise and must be assigned an appropriate
future version before publication.

## P0: Documentation Follow-Up

- [ ] Create or refresh `README.ja.md` from the final English `1.0.0` text.
- [ ] Define how translations record the English source version and how stale
  translations are identified.
- [ ] Add a short maintenance note that distinguishes normative English text
  from translations.

## P1: Release Maintenance

- [ ] Define the first post-1.0 release objective before choosing `1.0.1`,
  `1.1.0`, or `2.0.0`.
- [ ] Apply README section 3.1 compatibility analysis to every proposed
  normative, fixture, or checker change.
- [ ] Keep the `v1.0.0` tag and conformance corpus immutable; version later
  conformance evidence when meaning or required structure changes.
- [ ] Decide whether hosted CI should run
  `node docai-http/tools/check-release-readiness.mjs`.

## P1: Validator And Generator Tooling

- [ ] Evaluate a public validator API or CLI only after defining its input,
  diagnostics, versioning, and compatibility boundary.
- [ ] Evaluate a source-to-projection validator separately from document
  conformance validation.
- [ ] Decide whether a reference generator is useful without making one part of
  the stable format contract by implication.

## P2: Adoption Evidence

- [ ] Decide whether to rerun DocAI HTTP versus OpenAPI comparison tasks against
  the Stable `1.0.0` corpus instead of historical `0.12.0` context.
- [ ] Consider optional target models, additional API fixtures, and additional
  task classes only when their review and provider costs are justified.
- [ ] Define a normalized cost model before publishing provider-cost or
  cross-provider token comparisons.
- [ ] Consider provider latency measurements only with a reproducible sampling
  and reporting policy.

## P2: Future Format Work

- [ ] Treat finite recursive-schema representation as major-version work by
  default because `1.0.0` requires an explicit `unsupported` fallback.
- [ ] Require normative text, positive and negative fixtures, checker behavior,
  coverage notes, and compatibility analysis for every promoted feature.
- [ ] Keep experimental additions in candidate-only paths until their release
  scope and compatibility impact are explicit.

## Guardrails

- [ ] Do not broaden Stable `1.0.0` claims using candidate-only evidence.
- [ ] Do not send Live LLM provider requests without explicit approval and a
  stated task, target, and cost rationale.
- [ ] Do not choose a future version number until the intended change set is
  classified under the compatibility rules.
