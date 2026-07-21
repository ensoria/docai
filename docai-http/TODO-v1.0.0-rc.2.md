# DocAI HTTP TODO v1.0.0-rc.2

This backlog starts after publication and external review of `v1.0.0-rc.1`.
The review found conformance-content and checker-boundary defects, so final
stable `v1.0.0` must remain unpublished until the affected contract is corrected
and reviewed through `v1.0.0-rc.2`.

The goal is to make the intended `1.0.0` compatibility boundary internally
consistent, reproducible from the files inside that boundary, and evidenced by
fixtures that agree with the normative specification.

## Release Decision

- [ ] Confirm that final stable `v1.0.0` is deferred.
- [ ] Confirm that the next public release is `v1.0.0-rc.2`.
- [ ] Keep the numeric DocAI HTTP version in conformance fixture stamps at
  `1.0.0`; the `rc.2` suffix identifies the repository release, not a different
  format version.
- [ ] Treat `v1.0.0-rc.1` as immutable historical evidence; apply corrections
  only in the working tree and the later `v1.0.0-rc.2` release.
- [ ] Keep the publication label as `1.0.0 release candidate` until final
  `v1.0.0` is tagged and published.

Why another RC is required:

- The review found valid fixtures that contradict normative grammar.
- The stable checker rejects a normative valid `same_as` form and has unlisted
  transitive implementation and data dependencies.
- Correcting conformance document content changes the artifact reviewed in
  `rc.1`, even when the intended specification semantics are preserved.
- A second RC gives external reviewers a concrete corrected boundary before the
  first stable compatibility promise is made.

## Review Finding Disposition

| ID | Review finding | Classification | Planned disposition | Exit evidence |
|---|---|---|---|---|
| 1 | Valid fixtures use non-normative `enum(...)` types | Blocking | Keep the existing Type grammar; use `string` and put allowed values in constraints or meaning | Corrected full, compact, and focused fixtures plus semantic Type checks |
| 2 | Request `same_as` cannot be parsed | Blocking | Parse Request and Response targets separately and add request-form positive and negative coverage | Request and response fixtures pass or fail for the intended reason |
| 3 | Stable checker boundary is not closed | Blocking | Remove runtime dependence on candidate checker and `CHANGELOG.md`; make the stable checker implementation self-contained | Isolated boundary execution succeeds |
| 4 | Source traceability and `knowledge: complete` disagree | Blocking | Add an authoritative input-set manifest and pass-through behavior source, then restamp and document provenance | Source matrix covers every complete fixture fact class |
| 5 | Retry contract is unsafe or incomplete | Blocking | Define an explicit idempotency-key wire contract and precise retry actions | Full and compact examples expose equivalent safe retry semantics |
| 6 | Mandatory token budget has no criterion | Blocking | Make token-budget sizing advisory for `1.0.0`, while retaining required contract completeness | Normative text no longer creates an untestable compliance condition |
| 7 | Complete sets versus focused-fixture responsibility is unclear | Wording | Clarify that the requirements are demonstrated across the complete sets and focused fixtures | Section 9.1 matches the published corpus layout |
| 8 | `Stable` label lacks final-tag conditions | Metadata | Require final review, final `v1.0.0` tag/publication, and label transition | `RELEASE.md` cannot classify an RC as Stable |
| 9 | XML fields look like an undefined XPath grammar | Compatibility clarification | Use logical DocAI field paths and keep XML wire locations in Meaning/prose | XML fixture follows the existing dot-path grammar |

## P0: Confirm Specification Choices

- [ ] Confirm the Type decision: do not add `enum(...)` to the `1.0.0` Type
  grammar; represent enum values as constraints on `Type=string`.
- [ ] Confirm the XML decision: field-table identifiers are logical decoded
  field paths using the existing dot/array/map grammar; XPath-like locations,
  namespace URIs, and attribute/element mappings belong in Meaning or the
  representation prose.
- [ ] Confirm the checker decision: make
  `tools/check-conformance-fixtures.mjs` self-contained and dependent only on
  Node built-ins and files explicitly inside the stable boundary.
- [ ] Confirm the retry decision: define an `Idempotency-Key` request-header
  convention for the fixture endpoints that require safe retries, including
  applicability, key syntax, replay behavior, conflicting reuse, and retention
  window.
- [ ] Confirm the source decision: add a structured authoritative input-set
  manifest that references the OpenAPI and a pass-through behavior source for
  conventions, errors, workflows, webhooks, multipart constraints, and retry
  semantics.
- [ ] Confirm the token-budget decision: use advisory `should` language for file
  sizing in `1.0.0`; keep preservation of the complete applicable client
  contract mandatory.

Decision guidance:

- Keeping enum values in constraints preserves the published Type grammar and
  avoids adding a late parser feature. Adding `enum(...)` would be more compact,
  but would create a new canonical syntax and require broader parser fixtures.
- Logical XML field paths reuse the existing parser and keep format-specific
  wire mappings in prose. Canonical XPath would identify XML nodes directly,
  but requires a new grammar for namespaces, attributes, text nodes, and
  repetition immediately before stable release.
- A self-contained stable checker preserves the already advertised three-part
  boundary. A versioned shared module would reduce code duplication, but would
  widen the boundary and require every transitive dependency to be versioned and
  documented.
- A formal idempotency-key contract supports the existing retry-oriented
  workflow. Declaring the create operations non-idempotent is smaller, but would
  require the workflow and caller guidance to prohibit retries after an
  ambiguous outcome.
- A manifest plus pass-through behavior source accurately models the
  specification's authoritative input-set concept without inflating OpenAPI
  with project-specific extensions. Putting all behavior in OpenAPI `x-`
  extensions would use one file, but would make the source fixture larger and
  less representative of generators that combine OpenAPI with maintained
  conventions and workflows.
- Advisory token sizing avoids an unverifiable conformance requirement. A
  mandatory producer-configured tokenizer and budget would be more enforceable
  in controlled systems, but would add a new configuration/publication contract
  that is not otherwise part of `1.0.0`.

## P1: Align Normative Text

- [ ] Keep the existing simple Type grammar and enum-in-constraint rule in
  `README.md`; clarify only if needed to make `enum(...)` unmistakably invalid.
- [ ] Clarify that structured non-JSON field tables use logical decoded field
  paths governed by the standard field-path grammar.
- [ ] Clarify that XML XPath-like locations are wire-mapping prose, not canonical
  `Field` values.
- [ ] Rewrite the token-budget requirement with advisory `should` language and
  retain mandatory completeness and explicit `unknown` / `unsupported`
  handling.
- [ ] Change section 9.1 from requiring the complete full/compact pair alone to
  demonstrate every edge case to requiring demonstration across the complete
  example sets and focused fixtures.
- [ ] Confirm that the normative Request and Response `same_as` grammars remain
  unchanged.
- [ ] Update the stable compatibility-boundary wording only if implementation
  reveals another required runtime dependency; do not silently widen it.
- [ ] Update `RELEASE.md` so `Stable` requires completed final review, final
  `v1.0.0` tagging and publication, and the publication-label transition.

## P1: Correct Type And XML Fixtures

- [ ] Audit every `Type` cell in `fixtures/conformance/v1.0.0/`, including
  snippets embedded in invalid fixtures whose intended failure is unrelated to
  Type grammar.
- [ ] Replace `enum(JPY, USD)`, `enum(pending)`, `enum(final, draft)`, and any
  other `enum(...)` Type values with `string`.
- [ ] Put every closed allowed-value set in `Constraints / Meaning` or `Meaning`
  using the canonical escaped table-cell form.
- [ ] Keep full and compact payment representations semantically equivalent
  after the Type correction.
- [ ] Replace XML XPath-like `Field` values with logical decoded field paths.
- [ ] Record each XML element, attribute, namespace, order, and repetition wire
  mapping in Meaning or adjacent representation prose.
- [ ] Add or update focused invalid evidence proving that `enum(...)` is rejected
  as a Type expression.
- [ ] Add or update focused invalid evidence proving that an XPath-like XML
  `Field` value is not a canonical DocAI field path.
- [ ] Update `COVERAGE.md` and checker expectation maps for the changed or added
  focused fixtures.

## P1: Complete The `same_as` Contract

- [ ] Split Request and Response `same_as` parsing so Request consumes
  `<METHOD> <path> Request <media type>` and Response consumes
  `<METHOD> <path> Response <status> <media type>`.
- [ ] Resolve targets by parsed endpoint, body kind, response status when
  applicable, and concrete media type rather than by loose text search.
- [ ] Verify that every target is a full earlier representation in the same
  file, not another `same_as` reference.
- [ ] Verify that the referring and referenced units are both Request or both
  Response and that the marker is inside the correct containing section.
- [ ] Keep the retrieval-unit discoverability check for every `same_as` use.
- [ ] Add a focused valid backward Request reference fixture.
- [ ] Keep the existing focused valid backward Response reference fixture.
- [ ] Add or update focused invalid Request fixtures for malformed grammar,
  forward references, cross-kind references, wrong target endpoint/body, wrong
  media type, and a target that is itself `same_as`.
- [ ] Add or update equivalent Response coverage where existing fixtures do not
  already prove the rule.
- [ ] Update `COVERAGE.md` and checker expectation maps for all added fixtures.

## P1: Close The Stable Checker Boundary

- [ ] Move or reimplement stable conformance logic inside
  `tools/check-conformance-fixtures.mjs` without importing
  `check-complete-candidates.mjs`.
- [ ] Remove stable-checker reads of `CHANGELOG.md` and other files outside the
  stated stable boundary.
- [ ] Replace candidate-history assertions with conformance-local evidence in
  `COVERAGE.md` or with versioned assertions embedded in the stable checker.
- [ ] Add semantic validation of Type expressions across every valid complete
  document and focused valid snippet.
- [ ] Add semantic field-path validation across structured non-JSON focused
  fixtures, not only JSON examples.
- [ ] Add the corrected Request and Response `same_as` parser and target checks.
- [ ] Preserve the statement that this is a corpus-specific expectation checker,
  not a public reusable validator or source-to-projection validator.
- [ ] Add a deterministic boundary-closure test that copies only normative
  `README.md`, `fixtures/conformance/v1.0.0/`, and the checker into an isolated
  temporary tree and successfully runs the checker there.
- [ ] Confirm with an import/file-read audit that the isolated run has no hidden
  repository dependency.
- [ ] Run the historical complete-candidate checker separately and confirm that
  the stable-checker extraction did not change released `0.12.0` evidence.

## P1: Repair Source Traceability

- [ ] Inventory every fact in the full and compact conformance sets that does
  not come from `source/complete-openapi.yaml`.
- [ ] Add `source/complete-behavior.yaml` or an equivalently structured
  pass-through source covering shared conventions, common and endpoint errors,
  idempotency, workflows, webhook delivery, non-JSON wire behavior, and
  multipart constraints.
- [ ] Add an authoritative input-set manifest that names the OpenAPI and
  pass-through source files and their revisions.
- [ ] Point complete-set metadata stamps at the authoritative input-set manifest
  rather than presenting the OpenAPI file as the only source.
- [ ] Compute and record a stable `source_revision` that covers every input in
  the manifest.
- [ ] Regenerate the full and compact sets as whole logical projections: update
  `generated`, `generation_id`, and shared `projection_id` consistently rather
  than editing only individual stamps.
- [ ] Audit focused fixtures with metadata stamps and update their source claims
  where their knowledge depends on pass-through behavior.
- [ ] Replace the `No missing source inputs` claim with an evidenced traceability
  matrix mapping each source fact class to its source and projected files.
- [ ] Extend the corpus checker to verify source/manifest existence, stamp
  references, input-set revision consistency, and required traceability rows
  without claiming full source-to-projection validation.
- [ ] Keep the source files and manifest as traceability evidence, not a public
  generator input schema or reusable validator API.

## P1: Define Safe Retry Semantics

- [ ] Define the authoritative idempotency contract in the pass-through behavior
  source before changing projected documents.
- [ ] Document the `Idempotency-Key` wire contract in full and compact
  `CONVENTIONS.md`, including endpoint applicability, allowed value form,
  identical-request replay result, conflicting key reuse result, and minimum
  retention window.
- [ ] Update affected endpoint `Behavior` entries so they refer to the defined
  convention instead of an idempotency key "outside this fixture".
- [ ] Confirm affected endpoint headers and INDEX convention routing expose the
  contract according to the shared-header rules in `README.md`.
- [ ] Make workflow retry steps distinguish pre-response failure, ambiguous
  outcome, safe same-key replay, and corrected-input/new-key retry where
  applicable.
- [ ] Update the document-upload 422 Caller action to say that unchanged input
  must not be retried and that retry is allowed only after correcting the file
  or metadata.
- [ ] Apply equivalent semantics to the full and compact profiles.
- [ ] Add focused valid and invalid evidence for safe retry guidance and missing
  or contradictory idempotency contracts.
- [ ] Add targeted checker assertions for the retry fixtures.

## P2: Reaudit Semantics And Evidence

- [ ] Compare corrected `fixtures/conformance/v1.0.0/` standard documents against
  the evaluated `fixtures/complete-candidates/v0.12.0/` documents.
- [ ] Record every semantic difference in an updated semantic-drift audit,
  including Type spelling, XML field identifiers, source stamps, idempotency,
  retry actions, and wording-only changes.
- [ ] Classify each difference as syntax-only, metadata/provenance-only, or
  task-behavior-affecting.
- [ ] Identify which existing request construction, response handling, error
  handling, workflow completion, token-load, and OpenAPI comparison records no
  longer apply to the corrected corpus.
- [ ] Create a versioned `rc.2` evaluation snapshot outside the stable
  compatibility boundary if refreshed evidence is required; do not modify the
  released `0.12.0` evaluation records.
- [ ] Refresh deterministic context and token-load metrics for every affected
  task.
- [ ] Refresh required-provider live LLM task runs for every affected task only
  after the user explicitly approves provider submission and possible API
  usage cost.
- [ ] Refresh OpenAPI comparison runs if `rc.2` or final `v1.0.0` will use those
  results as evidence for the corrected documents; otherwise keep the existing
  comparison explicitly historical and scoped to `0.12.0`.
- [ ] Update `OPENAPI-COMPARISON-EVIDENCE.md` and top-level `README.md` only with
  claims supported by the chosen evidence path.
- [ ] Record failed, blocked, and passing live results without converting a
  provider-access failure into a conformance failure.

Evidence refresh rule:

- Metadata/provenance-only changes do not require live LLM reruns.
- Syntax or prose changes require rerunning a task when that changed content is
  included in its prompt or alters its expected output.
- Retry and idempotency changes are task-behavior-affecting and therefore require
  refreshed request/error/workflow evidence if those evaluations remain part of
  the `rc.2` readiness claim.
- No live provider request may be sent without explicit approval in the turn in
  which it will be sent.

## P2: Regression And Review Gate

- [ ] Add a regression checklist mapping review findings 1 through 9 to changed
  files, checker coverage, and verification output.
- [ ] Run `node docai-http/tools/check-conformance-fixtures.mjs`.
- [ ] Run the isolated stable-boundary checker test.
- [ ] Run `node docai-http/tools/check-complete-candidates.mjs` for historical
  candidate regression coverage.
- [ ] Run `node docai-http/tools/check-complete-evaluations.mjs` when evaluation
  artifacts were refreshed or remain claimed as supporting evidence.
- [ ] Run `node docai-http/tools/check-openapi-comparison.mjs` when comparison
  artifacts were refreshed or remain cited.
- [ ] Run `node docai-http/tools/check-release-readiness.mjs`.
- [ ] Run `git diff --check`.
- [ ] Confirm no valid fixture contains a Type outside the normative grammar.
- [ ] Confirm both canonical `same_as` forms have positive and negative semantic
  checker coverage.
- [ ] Confirm the stable checker runs from only the advertised boundary files.
- [ ] Confirm every `knowledge: complete` standard file has complete source
  provenance for its client-visible facts.
- [ ] Confirm every retry instruction is safe for ambiguous outcomes and
  corrected-input retries.
- [ ] Confirm the token-budget text is objectively classifiable as normative or
  advisory under section 3.1.
- [ ] Confirm the complete-set/focused-fixture wording and Stable label definition
  no longer admit the reviewed contradictory readings.
- [ ] Request a focused external regression review of the nine original findings
  rather than reopening unrelated feature design.
- [ ] Resolve every regression-review result as blocking, wording/metadata-only,
  future backlog, or no change.

## P2: Changelog And Release Notes

- [ ] Add the `v1.0.0-rc.2` correction scope to `CHANGELOG.md` under
  `Unreleased` while work is in progress.
- [ ] Prepare a `1.0.0-rc.2` changelog section before tagging.
- [ ] Add `v1.0.0-rc.2` release notes to `RELEASE.md`.
- [ ] Explain that `rc.2` corrects the intended `1.0.0` contract before stable
  publication and does not make `rc.1` fixtures mutable.
- [ ] List every conformance-content and checker-boundary correction in the
  release notes.
- [ ] State whether LLM/OpenAPI evidence was refreshed or retained only as
  historical `0.12.0` evidence.
- [ ] Keep final `Stable` wording reserved for the later final `v1.0.0` tag.

## P2: Tag And Publish `v1.0.0-rc.2`

- [ ] Confirm the worktree contains only intended `rc.2` changes.
- [ ] Run the complete deterministic release-readiness gate immediately before
  tagging.
- [ ] Run `git diff --check` immediately before tagging.
- [ ] Prepare the public release description from `RELEASE.md`.
- [ ] User creates the `v1.0.0-rc.2` tag.
- [ ] User publishes the `v1.0.0-rc.2` release.
- [ ] After publication, update current-tag wording from `v1.0.0-rc.1` to
  `v1.0.0-rc.2` without changing the publication label to Stable.

## P3: Final Stable Handoff

- [ ] Collect focused feedback on the corrected nine findings during the `rc.2`
  review window.
- [ ] Do not treat unrelated feature requests as blockers; move them to the
  post-`1.0.0` backlog unless they reveal a contradiction or compatibility risk.
- [ ] Proceed to final `v1.0.0` only when no stable-blocking finding remains and
  all deterministic gates pass from a clean worktree.
- [ ] Publish another RC instead of stable if review changes normative behavior,
  conformance content, checker expectations, or the compatibility boundary
  again.
- [ ] Return to `TODO-v1.0.0.md` for the final Stable label, tag, publication,
  and post-publication documentation steps after `rc.2` is accepted.

## Explicit Non-Goals

- [ ] Do not add `enum(...)` as a new Type expression in this correction release.
- [ ] Do not define XPath, XPath subsets, or namespace-prefix grammar as a new
  canonical DocAI field-path syntax.
- [ ] Do not publish a reusable validator API or CLI as part of `rc.2`.
- [ ] Do not make source-to-projection validation a public compatibility promise.
- [ ] Do not mutate tagged `v1.0.0-rc.1` or released `0.12.0` evidence.
- [ ] Do not add optional LLM targets, new APIs, or new benchmark task classes as
  `rc.2` blockers.
- [ ] Do not send live LLM API requests without explicit user approval.
- [ ] Do not create `README.ja.md` until the English final `1.0.0` text is stable.
