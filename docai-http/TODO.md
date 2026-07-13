# DocAI HTTP TODO

This backlog tracks work after the first public `0.11.0` Compatibility Core release. The goal is to move toward a broader first-version contract without losing the current compromise: only promote a feature into the compatibility promise after it has specification text, fixtures, checker coverage, and changelog/release evidence.

## Current Status

- [x] Publish `0.11.0` as a pre-1.0 Compatibility Core implementation target.
- [x] Complete public pre-release review for the Compatibility Core scope.
- [x] Tag and publish the first public Compatibility Core release.
- [x] Provide an initial full-profile core fixture set under `fixtures/core/v0.11.0/`.
- [x] Provide focused valid/invalid core fixtures and `tools/check-core-fixtures.mjs`.
- [x] Define the next target release scope.

## Next Target Release Scope

Target the next pre-1.0 Compatibility Core hardening release. The numeric version is intentionally deferred until the version bump rules below are defined, so this backlog does not accidentally choose between a compatible patch release and a wider draft minor release before the release policy exists.

Scope:

- Preserve the `0.11.0` Compatibility Core surface; do not promote compact, workflows, webhooks, non-JSON representations, selective `Conventions` loading, token-routing metadata, or other non-core structures in this target.
- Finish the remaining P0 checker hardening while keeping `tools/check-core-fixtures.mjs` a corpus-specific fixture expectation checker, not a public reusable validator.
- Split parser and structural checks into named units before adding broader feature validation, so future promotions can reuse the internal pieces without changing the public checker promise.
- Add release-process documentation for version bumps, fixture versioning, tag checks, and release notes before the next tag.
- Permit README clarifications only when they preserve the current Compatibility Core promise or are backed by matching fixtures, checker behavior, coverage notes, and changelog entries.
- Prepare compact-profile promotion decisions and fixture plans, but defer compact promotion itself to a later explicitly scoped release unless its fixture and checker evidence is complete.

Exit criteria:

- All P0 core-validator hardening tasks are complete.
- P1 release-process tasks are complete or explicitly deferred with a reason in this TODO.
- `node docai-http/tools/check-core-fixtures.mjs` passes from the repository root.
- `CHANGELOG.md` has a concrete version section before tagging, and no README-visible change remains only under `Unreleased`.

## Release Rules For This Backlog

- [x] For every promoted feature, update `README.md`, fixtures, checker behavior, `COVERAGE.md`, and `CHANGELOG.md` in the same change set. Documented in `RELEASE.md`.
- [x] Keep non-core features opt-in until they have positive and negative fixtures. Documented in `RELEASE.md`.
- [x] Treat meaning-changing fixture updates after a release as compatibility-impacting changes. Documented in `RELEASE.md`.
- [x] Keep each release label explicit: Compatibility Core target, complete-generator-ready candidate, or stable. Documented in `RELEASE.md`.
- [x] Before each tag, run `node docai-http/tools/check-core-fixtures.mjs`. Documented in `RELEASE.md`.

## P0: Strengthen The Core Validator

- [x] Decide whether `tools/check-core-fixtures.mjs` remains a fixture checker or becomes a reusable validator. Decision: keep it as a corpus-specific fixture expectation checker for the next target; revisit reusable validator extraction after parser units and release packaging are clearer.
- [x] Split parser logic into named units: metadata stamp parser, table parser, heading parser, section parser, field-path parser, and type parser.
- [x] Validate metadata stamp escaping, duplicate keys, missing keys, key order, optional `source_revision`, and extension-key placement more exhaustively.
- [x] Validate that all files in one full-profile set share `profile`, `generated`, `generation_id`, and `projection_id`.
- [x] Validate that INDEX endpoint rows exactly match resource endpoint headings.
- [x] Validate `coverage` / `knowledge` against `**unsupported**:` and `**unknown**:` markers at file and set scope.
- [x] Validate required `CONVENTIONS.md` headings and common error-shape labels.
- [x] Validate endpoint section order, required sections, and response ordering per endpoint.
- [x] Validate request subsection order and leading `none` collapse rules.
- [x] Validate path template variables against `Path Parameters`.
- [x] Validate table column headers for core tables.
- [x] Validate body marker order: `body_required`, `body_presence`, `media_type`, and `body_nullable`.
- [x] Validate JSON body examples against field-table rows where practical.
- [x] Validate common and inline error references, including inline label matching.
- [x] Validate `none`, `unknown`, and core replacement/localized `unsupported` placement.
- [x] Add a clear checker report format that lists fixture name, expected result, actual result, and rule area.

## P0: Expand Core Fixtures

- [x] Add valid and invalid fixtures for body-less requests.
- [x] Add valid and invalid fixtures for body-less responses, including `204`.
- [x] Add valid and invalid fixtures for response status ranges.
- [x] Add valid and invalid fixtures for `default` responses.
- [x] Add valid and invalid fixtures for overlapping exact status, range, and default precedence prose.
- [x] Add valid and invalid fixtures for `Required=conditional`.
- [x] Add valid and invalid fixtures for `Required=unknown`, `Presence=unknown`, `Nullable=unknown`, and `Type=unknown`.
- [x] Add fixtures for `body_required: unknown`, `body_presence: unknown`, and `body_nullable: unknown`.
- [x] Add fixtures for root scalar, root array, and root dynamic-map bodies using `$`.
- [x] Add fixtures for exactly-null JSON values with `Type=null`.
- [x] Add fixtures for object openness on root objects, nested objects, and `object[]` rows.
- [x] Add fixtures for repeated query parameters, repeated headers, and response-header comma-combination rules.
- [x] Add fixtures for endpoint-local `none` not suppressing common conventions.
- [x] Add fixtures for common error suppression with `**deviation**:`.
- [x] Add fixtures for deprecated endpoints and matching INDEX summary prefix.
- [x] Add fixtures for valid and invalid `x-` metadata, markers, headings, and table columns inside the Core scope.
- [x] Add directly recursive and indirectly recursive source fixtures that demonstrate required `unsupported` output.
- [x] Update `fixtures/core/v0.11.0/COVERAGE.md` after each fixture group lands.

## P1: Prepare Compact Profile Promotion

- [x] Decide the first compact promotion scope: all compact rules or only `field_defaults` plus compact examples. Decision: first candidate scope is profile pairing, compact examples, and `field_defaults`; defer `same_as`, retrieval-unit discovery, `Client-visible fields`, and `Opaque fields`.
- [x] Add a matching full/compact fixture pair with identical standard docs-root-relative paths.
- [x] Add valid and invalid fixtures for `Full set:` and `Compact set:` profile links.
- [x] Add valid and invalid fixtures for shared `projection_id` and different profile `generation_id`.
- [x] Add valid and invalid fixtures for `field_defaults`.
- [ ] Add valid and invalid fixtures for `same_as`, including same-kind and backward-reference rules.
- [ ] Add fixtures for retrieval-unit discoverability when `same_as` is used.
- [ ] Add fixtures for compact `Client-visible fields` and `Opaque fields`.
- [x] Add checker support to compare compact output against the matching full output for client-visible contract preservation.
- [x] Add token-saving measurement guidance or fixture annotations for compact reductions.
- [x] Decide whether compact becomes part of a future Compatibility Core or remains a separate compatibility scope. Decision: keep compact as a separate opt-in compatibility scope candidate; do not fold it into the default Compatibility Core unless a later release explicitly changes that scope with matching fixtures, checker coverage, and release evidence.

Deferred compact expansion work:

- Keep `same_as`, retrieval-unit discovery, `Client-visible fields`, and `Opaque fields` outside the first compact candidate scope.
- Promote those reductions only in a later compact-scope change set with valid/invalid fixtures, checker support, coverage notes, and changelog evidence.

## P1: Strengthen Release Process

- [x] Add a release checklist document for DocAI HTTP.
- [x] Define version bump rules for pre-1.0 Core releases versus non-core draft changes.
- [x] Define fixture versioning policy: when to create a new fixture version directory and when to patch existing draft fixtures.
- [x] Add a tag checklist: checker passes, changelog has version section, README version matches fixture version, publication label matches evidence.
- [x] Add a short release note template for Compatibility Core releases.
- [x] Decide whether to add a package/script entry for `check-core-fixtures`. Decision: keep the direct Node command as canonical until the repository has a standard task runner or the checker is published as a package.

## P2: Prepare Workflow Support

- [x] Decide whether workflows should be promoted as one feature or split into minimal workflow structure and advanced recovery semantics. Decision: split workflow support; first candidate scope is minimal workflow discovery and fixed-section structure, while advanced recovery semantics remain separate.
- [x] Add valid workflow fixture with `Preconditions`, `Steps`, `State Transitions`, and `Failure and Recovery`.
- [x] Add invalid fixtures for workflow section order and missing required sections.
- [x] Add fixtures for workflow references from INDEX and endpoint `Related`.
- [x] Add fixtures for values passed between steps and failure branch recovery.
- [x] Add fixtures for workflow-specific `**deviation**:`.
- [x] Add fixtures for workflow-section replacement `unsupported`.
- [x] Add checker support for workflow discovery and section rules.

## P2: Prepare Webhook Support

- [x] Decide whether webhooks should be promoted before or after workflows. Decision: prepare webhook support after workflow support as a separate candidate scope, without promoting either into the default Compatibility Core.
- [x] Add valid single-event webhook fixture.
- [x] Add valid grouped webhook fixture using payload variants.
- [x] Add invalid fixtures for grouping events with incompatible headers, delivery deviations, or receiver requirements.
- [x] Add fixtures for event-specific headers using request-header rules.
- [x] Add fixtures for payload `Presence` semantics separate from `body_required`.
- [x] Add fixtures for deduplication key and composite deduplication strategy.
- [x] Add fixtures for webhook delivery deviations from `CONVENTIONS.md`.
- [x] Add checker support for webhook discovery from INDEX and triggering endpoint `Related`.

## P2: Prepare Non-JSON Representation Support

- [x] Decide the first non-JSON promotion scope: multipart/form-data, form-urlencoded, raw binary, CSV, XML, or SSE. Decision: start with `multipart/form-data` requests as the first non-JSON candidate scope; add form-urlencoded, raw binary, CSV, XML, and SSE as request/response body candidates after fixture evidence; keep future non-JSON forms separate until they have their own fixture evidence.
- [x] Add multipart request fixtures with file parts, filenames, content types, size limits, and boundary delegation.
- [x] Add form-urlencoded request fixtures with character encoding and repeated-field rules.
- [x] Add raw binary upload/download fixtures with size and integrity metadata.
- [x] Add CSV response fixtures with delimiter, record separator, quote/escape, header presence, and column order.
- [x] Add XML fixtures with namespaces, attributes, elements, ordering, and encoding.
- [x] Add SSE fixtures with event names, frame/data format, reconnection, and termination rules.
- [x] Add checker support for media-specific required markers, samples, and prose. Current coverage is scoped to the `multipart/form-data`, `application/x-www-form-urlencoded`, raw binary, `text/csv`, `application/xml`, and `text/event-stream` candidates.

## P2: Prepare Polymorphism And Variants

- [x] Add tagged variant fixtures with complete examples and tables per variant.
- [x] Add untagged variant fixtures with stable labels and selection prose.
- [x] Add invalid fixtures for unlabeled common field tables.
- [x] Add invalid fixtures for missing discriminator enum values in tagged variants.
- [x] Add fixtures for overlapping alternatives and combined variant semantics.
- [x] Add checker support for variant block boundaries and per-variant table completeness.

## P3: Decide Recursive Schema Future

- [x] Keep recursive schemas explicitly unsupported for the first stable release unless a strong finite representation is designed. Decision: keep recursive schemas outside the intended `1.0.0` representable scope unless a finite, self-contained representation and versioned fixtures land before the pre-v1.0.0 release-candidate stage; see README §3.4 and `RELEASE.md`.
- [x] Add source fixtures for direct recursion and indirect recursion. Evidence: `fixtures/core/v0.11.0/source/recursive-direct-openapi.yaml` and `fixtures/core/v0.11.0/source/recursive-indirect-openapi.yaml`.
- [x] Add generated projection fixtures showing smallest applicable `unsupported` forms. Evidence: `fixtures/core/v0.11.0/focused/valid/recursive-direct-unsupported.md`, `fixtures/core/v0.11.0/focused/valid/recursive-indirect-unsupported.md`, and `fixtures/core/v0.11.0/valid/full/resources/users.md`.
- [x] Document the compatibility impact if recursive representation is ever added. Decision: adding a recursive representation after `1.0.0` is compatibility-impacting when existing readers must understand it to call the API correctly; see README §3.4 and `RELEASE.md`.
- [x] Decide whether recursive support would require a new major version after 1.0. Decision: treat post-`1.0.0` recursive-schema support as requiring a new major version by default when it replaces the current required `unsupported` fallback for implementation-ready projections; a minor version is only acceptable for optional, self-bounding metadata or capabilities that older readers can ignore without losing the existing fallback.

## P3: Move Toward Complete Generator Readiness

- [x] Define the minimum complete-surface fixture corpus required before advertising complete-generator-ready. Decision: the minimum corpus, evidence matrix, checker plan, LLM evaluation plan, and publication gate are defined in `COMPLETE-GENERATOR-READINESS.md`; README section 9.1 remains authoritative.
- [x] Add full and compact complete example sets that include resources, workflows, and webhooks. Evidence: `fixtures/complete-candidates/v0.11.0/valid/full/` and `fixtures/complete-candidates/v0.11.0/valid/compact/` share the same standard paths and include resources, `workflows/checkout.md`, and `webhooks/payment-completed.md`.
- [x] Add focused valid/invalid fixtures for every canonical marker and table shape in §9.1.
  - [x] Add complete-candidate focused fixtures for full/compact profile pairing and selective `Conventions` loading.
  - [x] Add complete-candidate focused fixtures for compact `same_as` retrieval boundaries.
  - [x] Add complete-candidate focused fixtures for compact `Client-visible fields` and `Opaque fields`.
  - [x] Add complete-candidate focused fixture for resource, workflow, and webhook related links.
  - [x] Add complete-candidate focused fixtures for non-JSON multipart representation boundaries.
  - [x] Add complete-candidate focused fixtures for polymorphic request variants.
  - [x] Add complete-candidate focused fixtures for workflow-section and response-header replacement `unsupported`.
  - [x] Add complete-candidate focused fixtures for grouped webhook payload variants.
  - [x] Add complete-candidate focused fixtures for metadata stamps, `x-` extensions, and token-routing hints.
  - [x] Add complete-candidate focused fixtures for `unknown`, coverage, and knowledge states.
  - [x] Add complete-candidate focused fixtures for structured parameters and conditional requiredness.
  - [x] Add complete-candidate focused fixtures for repeatable response headers.
  - [x] Add complete-candidate focused fixtures for exactly-null values, inline error labels with `code=unknown`, and generated-example field coverage.
  - [x] Add complete-candidate focused fixtures for table normalization, field-path escaping, object openness, and media-type uniqueness.
  - [x] Add complete-candidate focused fixtures for endpoint-specific common-error deviation/suppression and error-time recovery state.
  - [x] Add complete-candidate source and focused fixtures for direct and indirect recursive-schema `unsupported` fallback.
  - [x] Add complete-candidate focused fixtures for compact `field_defaults` reconstruction and invalid defaulted-column usage.
  - [x] Add complete-candidate focused fixtures for compact error-shape field reduction and invalid `same_as` use in error shapes.
  - [x] Add complete-candidate focused fixtures for localized `unsupported` placement and canonical extension/non-extension heading boundaries.
  - [x] Add complete-candidate focused fixtures for deprecated endpoint signaling, Behavior unknown facts, PATCH update semantics, root-value bodies, status range/default ordering, and whole-section `CONVENTIONS.md` states.
  - [x] Add complete-candidate focused fixtures for body-less and unknown body states, parameter wire serialization, value omission/default behavior, and webhook payload presence.
  - [x] Add complete-candidate focused fixtures for INDEX routing, endpoint section/path-parameter structure, and `CONVENTIONS.md` common error-shape contracts.
  - [x] Add complete-candidate focused fixtures for redirect/async responses, multiple media-type branching, and unknown response-header/body-nullability states.
  - [x] Add remaining complete-surface focused fixtures for every §9.1 canonical marker, table shape, normalization rule, representation class, and replacement unit.
    - [x] Add focused fixtures for single-prose-language output and English-only structural text boundaries.
    - [x] Add focused fixtures for unsupported or unrepresentable endpoint method/path handling, including the rule that such operations are not emitted as compliant endpoints.
    - [x] Add focused fixtures for concrete method, status, media-type spelling, standard variable headings, and invalid non-`x-` structural identifiers.
    - [x] Add focused fixtures for `**media_type**: unknown` with required `**unknown**:` marker and invalid missing-marker cases.
    - [x] Add focused fixtures for resource-file boundaries: exactly one bounded resource file per endpoint and no resource-level title/prose wrapper.
    - [x] Add focused fixtures for body marker ordering across request bodies, responses, inline error shapes, common error shapes, and webhook payloads.
    - [x] Add focused fixtures for conditional response-body presence and caller-visible branching separate from body omission.
    - [x] Add focused fixtures for conditional response-header presence and response-specific common-header deviations.
    - [x] Add focused fixtures for table-cell `unknown` values across `Required`, `Type`, `Presence`, and `Nullable`, including compact defaulting prohibition for unknown columns.
    - [x] Add focused fixtures for invalid cross-file schema reference notation such as `$ref` outside the compact `**same_as**:` rule.
    - [x] Add focused fixtures for nested arrays, nested dynamic maps, and array-item object openness beyond the current root-value examples.
    - [x] Add focused fixtures for root-object `$` row exception and invalid unnecessary or contradictory `$` rows.
    - [x] Add focused fixtures for standardized enum documentation, subset enum documentation, and invalid enum omission where clients must branch.
    - [x] Add focused fixtures for request media-type selection when multiple request representations are available.
    - [x] Add focused fixtures for complete-candidate non-JSON representation classes beyond multipart: form-urlencoded, raw binary upload/download, CSV, XML, and SSE.
    - [x] Add focused fixtures for raw binary and unstructured stream sample-and-prose exceptions, including invalid field-table requirements where they do not apply.
    - [x] Add focused fixtures for untagged polymorphic alternatives and overlapping/combined variant semantics in the complete-candidate corpus.
    - [x] Add focused fixtures for invalid unlabeled examples or common tables before polymorphic `**variant**:` blocks.
    - [x] Add focused fixtures for endpoint-specific inline error shape reuse, first-use ordering, mismatched inline labels, and body-less inline error shapes.
    - [x] Add focused fixtures for field-level error target/code/UI-display policy beyond the current generated-example coverage.
    - [x] Add focused fixtures for common error rows with `Shape=none` and `Shape=unknown`, including required unknown markers.
    - [x] Add focused fixtures for request, response, body, payload, and parameter `**deviation**:` placement outside endpoint-specific common-error suppression.
    - [x] Add focused fixtures for compact contract preservation failures: omitted request parameter, omitted response status, omitted error row, or changed client-visible constraint.
    - [x] Add focused fixtures for compact `Opaque fields` omitted when no opaque root exists and invalid empty `Opaque fields` headings.
    - [x] Add focused fixtures for compact `field_defaults` measured-savings annotations or producer assertions when token-saving evidence is represented.
    - [x] Add focused fixtures for workflow title matching, fixed section order, value passing, failure branches, recovery state, and workflow-specific deviations in the complete-candidate corpus.
    - [x] Add focused fixtures for workflow whole-section `unknown` states, not only replacement `unsupported`.
    - [x] Add focused fixtures for webhook title, INDEX listing, event-specific headers, safe deduplication key/strategy, delivery deviations, and triggering endpoint references in the complete-candidate corpus.
    - [x] Add focused fixtures for webhook grouped-event incompatibility boundaries beyond payload variants.
    - [x] Add focused fixtures for INDEX/metadata coverage propagation when a focused file contains `**unsupported**:` or `**unknown**:` in a complete-candidate set context.
    - [x] Add focused fixtures for source-backed generated examples that require `**unknown**:` because no credible valid example can be generated.
    - [x] Add focused fixtures for response default rows that are exclusively error semantics versus mixed non-error/error defaults.
    - [x] Add focused fixtures for common response-header contracts in `CONVENTIONS.md` and endpoint-level suppression or override.
    - [x] Add focused fixtures for final coverage audit: each README §9.1 focused requirement is mapped to at least one fixture, checker expectation, `COVERAGE.md` row, and changelog entry.
- [x] Add checker coverage for non-core features promoted into the complete surface. Evidence: `tools/check-complete-candidates.mjs` checks the complete-candidate full/compact pair, focused fixture expectations, coverage references, compact reductions, INDEX references, workflow/webhook/resource links, non-JSON, polymorphism, and recursive-source evidence as a corpus-specific expectation checker.
- [ ] Run LLM task evaluations against the valid corpus for request construction, response handling, error handling, workflow completion, and token load.
  - [x] Add the complete-candidate evaluation task packet, expected outcomes, local context-metrics results, and `tools/check-complete-evaluations.mjs`.
  - [x] Decide and record the target LLM list for live evaluation.
  - [x] Add deterministic request-construction prompt export for required and optional target runs without leaking `expected_outcome`.
  - [x] Add the missing workflow-completion task group to the evaluation packet and required target coverage.
  - [x] Add live result JSONL record format and checker validation before executing provider calls.
  - [x] Add automated request-construction result grading against `tasks.json` expected outcomes.
  - [x] Add a live LLM execution procedure with gate order, provider order rationale, stop criteria, authentication, and cost controls.
  - [x] Add a Google Interactions API runner for the `google-stable-agentic` request-construction smoke run.
  - [x] Run the Google `request_construction` smoke run and record fixture/grader review findings.
  - [x] Review request-construction expected outcomes and grader handling for base paths, bearer-token placeholders, multipart part headers, and boundary delegation before running more providers.
  - [x] Re-run the Google `request_construction` smoke run after grader-policy normalization and record passing results.
  - [x] Add OpenAI and Anthropic request-construction live runners with the same result JSONL format.
  - [x] Get explicit approval to send repository-derived evaluation prompts and fixture context to OpenAI and Anthropic.
  - [x] Attempt OpenAI and Anthropic request-construction runs from the Codex managed environment and document that external provider data export is policy-blocked there.
  - [x] Remove `temperature` from the OpenAI and Anthropic request-construction runners after both required target models rejected that parameter.
  - [x] Re-run the OpenAI and Anthropic request-construction commands locally and replace the `temperature` blocked records with provider results.
  - [x] Run request-construction tasks against each target LLM and record model-specific results.
  - [ ] Run response-handling tasks against each target LLM and record model-specific results.
  - [ ] Run error-handling tasks against each target LLM and record model-specific results.
  - [ ] Run workflow-completion tasks against each target LLM and record model-specific results.
  - [ ] Record token-load measurements for each task/model/profile combination.
  - [ ] Summarize failures, fixture gaps found by the evaluations, and publication impact in the evaluation results.
- [x] Keep the README publication label unchanged until fixture and checker evidence supports the broader claim. Decision: keep the current README publication label as `Compatibility Core implementation target`; do not advertise complete-generator-ready until the evidence gate in `COMPLETE-GENERATOR-READINESS.md` is complete.

## Parking Lot

- [ ] Decide whether `README.ja.md` should remain TODO until after 1.0 or be removed from release artifacts.
- [ ] Decide whether fixture source files should include full OpenAPI inputs for every generated fixture set.
- [ ] Decide whether to publish the checker as a standalone package or keep it repository-local.
- [ ] Decide whether to add CI once the repository has a standard task runner.
