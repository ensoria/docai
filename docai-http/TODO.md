# DocAI HTTP TODO

This backlog tracks work after the first public `0.11.0` Compatibility Core release. The goal is to move toward a broader first-version contract without losing the current compromise: only promote a feature into the compatibility promise after it has specification text, fixtures, checker coverage, and changelog/release evidence.

## Current Status

- [x] Publish `0.11.0` as a pre-1.0 Compatibility Core implementation target.
- [x] Complete public pre-release review for the Compatibility Core scope.
- [x] Tag and publish the first public Compatibility Core release.
- [x] Provide an initial full-profile core fixture set under `fixtures/core/v0.11.0/`.
- [x] Provide focused valid/invalid core fixtures and `tools/check-core-fixtures.mjs`.
- [ ] Define the next target release scope.

## Release Rules For This Backlog

- [ ] For every promoted feature, update `README.md`, fixtures, checker behavior, `COVERAGE.md`, and `CHANGELOG.md` in the same change set.
- [ ] Keep non-core features opt-in until they have positive and negative fixtures.
- [ ] Treat meaning-changing fixture updates after a release as compatibility-impacting changes.
- [ ] Keep each release label explicit: Compatibility Core target, complete-generator-ready candidate, or stable.
- [ ] Before each tag, run `node docai-http/tools/check-core-fixtures.mjs`.

## P0: Strengthen The Core Validator

- [ ] Decide whether `tools/check-core-fixtures.mjs` remains a fixture checker or becomes a reusable validator.
- [ ] Split parser logic into named units: metadata stamp parser, table parser, heading parser, section parser, field-path parser, and type parser.
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
- [ ] Add a clear checker report format that lists fixture name, expected result, actual result, and rule area.

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

- [ ] Decide the first compact promotion scope: all compact rules or only `field_defaults` plus compact examples.
- [ ] Add a matching full/compact fixture pair with identical standard docs-root-relative paths.
- [ ] Add valid and invalid fixtures for `Full set:` and `Compact set:` profile links.
- [ ] Add valid and invalid fixtures for shared `projection_id` and different profile `generation_id`.
- [ ] Add valid and invalid fixtures for `field_defaults`.
- [ ] Add valid and invalid fixtures for `same_as`, including same-kind and backward-reference rules.
- [ ] Add fixtures for retrieval-unit discoverability when `same_as` is used.
- [ ] Add fixtures for compact `Client-visible fields` and `Opaque fields`.
- [ ] Add checker support to compare compact output against the matching full output for client-visible contract preservation.
- [ ] Add token-saving measurement guidance or fixture annotations for compact reductions.
- [ ] Decide whether compact becomes part of a future Compatibility Core or remains a separate compatibility scope.

## P1: Strengthen Release Process

- [ ] Add a release checklist document for DocAI HTTP.
- [ ] Define version bump rules for pre-1.0 Core releases versus non-core draft changes.
- [ ] Define fixture versioning policy: when to create a new fixture version directory and when to patch existing draft fixtures.
- [ ] Add a tag checklist: checker passes, changelog has version section, README version matches fixture version, publication label matches evidence.
- [ ] Add a short release note template for Compatibility Core releases.
- [ ] Decide whether to add a package/script entry for `check-core-fixtures`.

## P2: Prepare Workflow Support

- [ ] Decide whether workflows should be promoted as one feature or split into minimal workflow structure and advanced recovery semantics.
- [ ] Add valid workflow fixture with `Preconditions`, `Steps`, `State Transitions`, and `Failure and Recovery`.
- [ ] Add invalid fixtures for workflow section order and missing required sections.
- [ ] Add fixtures for workflow references from INDEX and endpoint `Related`.
- [ ] Add fixtures for values passed between steps and failure branch recovery.
- [ ] Add fixtures for workflow-specific `**deviation**:`.
- [ ] Add fixtures for workflow-section replacement `unsupported`.
- [ ] Add checker support for workflow discovery and section rules.

## P2: Prepare Webhook Support

- [ ] Decide whether webhooks should be promoted before or after workflows.
- [ ] Add valid single-event webhook fixture.
- [ ] Add valid grouped webhook fixture using payload variants.
- [ ] Add invalid fixtures for grouping events with incompatible headers, delivery deviations, or receiver requirements.
- [ ] Add fixtures for event-specific headers using request-header rules.
- [ ] Add fixtures for payload `Presence` semantics separate from `body_required`.
- [ ] Add fixtures for deduplication key and composite deduplication strategy.
- [ ] Add fixtures for webhook delivery deviations from `CONVENTIONS.md`.
- [ ] Add checker support for webhook discovery from INDEX and triggering endpoint `Related`.

## P2: Prepare Non-JSON Representation Support

- [ ] Decide the first non-JSON promotion scope: multipart/form-data, form-urlencoded, raw binary, CSV, XML, or SSE.
- [ ] Add multipart request fixtures with file parts, filenames, content types, size limits, and boundary delegation.
- [ ] Add form-urlencoded request fixtures with character encoding and repeated-field rules.
- [ ] Add raw binary upload/download fixtures with size and integrity metadata.
- [ ] Add CSV response fixtures with delimiter, record separator, quote/escape, header presence, and column order.
- [ ] Add XML fixtures with namespaces, attributes, elements, ordering, and encoding.
- [ ] Add SSE fixtures with event names, frame/data format, reconnection, and termination rules.
- [ ] Add checker support for media-specific required markers, samples, and prose.

## P2: Prepare Polymorphism And Variants

- [ ] Add tagged variant fixtures with complete examples and tables per variant.
- [ ] Add untagged variant fixtures with stable labels and selection prose.
- [ ] Add invalid fixtures for unlabeled common field tables.
- [ ] Add invalid fixtures for missing discriminator enum values in tagged variants.
- [ ] Add fixtures for overlapping alternatives and combined variant semantics.
- [ ] Add checker support for variant block boundaries and per-variant table completeness.

## P3: Decide Recursive Schema Future

- [ ] Keep recursive schemas explicitly unsupported for the first stable release unless a strong finite representation is designed.
- [ ] Add source fixtures for direct recursion and indirect recursion.
- [ ] Add generated projection fixtures showing smallest applicable `unsupported` forms.
- [ ] Document the compatibility impact if recursive representation is ever added.
- [ ] Decide whether recursive support would require a new major version after 1.0.

## P3: Move Toward Complete Generator Readiness

- [ ] Define the minimum complete-surface fixture corpus required before advertising complete-generator-ready.
- [ ] Add full and compact complete example sets that include resources, workflows, and webhooks.
- [ ] Add focused valid/invalid fixtures for every canonical marker and table shape in §9.1.
- [ ] Add checker coverage for non-core features promoted into the complete surface.
- [ ] Run LLM task evaluations against the valid corpus for request construction, response handling, error handling, and token load.
- [ ] Update README publication label only after fixture and checker evidence supports the broader claim.

## Parking Lot

- [ ] Decide whether `README.ja.md` should remain TODO until after 1.0 or be removed from release artifacts.
- [ ] Decide whether fixture source files should include full OpenAPI inputs for every generated fixture set.
- [ ] Decide whether to publish the checker as a standalone package or keep it repository-local.
- [ ] Decide whether to add CI once the repository has a standard task runner.
