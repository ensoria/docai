# Changelog

DocAI HTTP draft history. Specification versioning and compatibility rules are defined in [README.md](README.md#31-format-versioning-and-compatibility).

## Unreleased

- Strengthens the Compatibility Core fixture checker with request-subsection order, body marker order, body-less request/response, conditional requiredness, and deprecated INDEX-summary checks.
- Expands focused Compatibility Core fixture coverage for body-less requests/responses, `unknown` table/body values, root `$` bodies, exactly-null JSON values, common-error suppression, and deprecated endpoints.
- Adds checker and focused fixture coverage for core table headers, `x-` extension placement, response status ranges, `default` responses, and overlap precedence prose.
- Adds checker and focused fixture coverage for JSON example-to-field-table rows and body object-openness rules.
- Adds checker and focused fixture coverage for repeated query/header wire rules and endpoint-local `none` common-convention boundaries.
- Adds checker and focused fixture coverage for `none`/`unknown`/`unsupported` placement and direct/indirect recursive source fallbacks.
- Improves the Compatibility Core checker failure report with fixture name, expected result, actual result, rule area, and detail fields.
- Defines the next pre-1.0 Compatibility Core hardening scope and keeps the core checker positioned as a corpus-specific fixture expectation checker.
- Splits the Compatibility Core checker parsing logic into named metadata-stamp, table, heading, section, field-path, and type parser units.
- Adds release-process guidance for labels, version bumps, fixture versioning, tag checks, release notes, and the canonical core checker command.
- Adds compact-profile candidate fixtures for profile pairing, compact examples, and valid `field_defaults` without promoting compact into the current Compatibility Core.
- Adds focused invalid compact-candidate fixtures for missing, misplaced, and mislabeled `Full set:` / `Compact set:` profile links.
- Adds focused invalid compact-candidate fixtures for profile-pair `projection_id` mismatch and within-set `generation_id` / `projection_id` mismatch.
- Adds focused invalid compact-candidate fixtures for `field_defaults` invalid values, invalid table applicability, retained defaulted columns, and unknown-value defaults.
- Adds compact-candidate token-saving measurement guidance and fixture-level reduction annotations.
- Adds a compact-candidate fixture checker for profile links, profile identity, `field_defaults` reconstruction, and full/compact table contract comparison.
- Records the compact profile as a separate opt-in compatibility scope candidate rather than part of the default Compatibility Core.
- Adds a workflow candidate fixture corpus for minimal workflow discovery and fixed-section structure without promoting workflows into the current Compatibility Core.
- Adds focused workflow-candidate fixtures and a candidate checker for workflow discovery, required sections, references, passed values, failure branches, deviations, and workflow-section replacement `unsupported`.
- Adds a webhook candidate fixture corpus and checker for webhook discovery, triggering endpoint references, fixed sections, event-specific headers, single-event payloads, grouped variants, delivery deviations, and deduplication guidance without promoting webhooks into the current Compatibility Core.
- Adds a non-JSON candidate fixture corpus and checker for `multipart/form-data` request markers, samples, file parts, filename requirements, part content types, size limits, boundary delegation, `application/x-www-form-urlencoded` character encoding, percent-encoding, repeated-field rules, raw binary upload/download size, integrity, and filename metadata, `text/csv` response charset, delimiter, record separator, quote/escape, header presence, and column order, `application/xml` response charset, declaration encoding, namespaces, attributes, child element ordering, and node mapping, and `text/event-stream` event names, frame and data formats, reconnection, and termination rules without promoting non-JSON representations into the current Compatibility Core.
- Adds a polymorphism candidate fixture corpus and checker for tagged, untagged, and overlapping body variants, including invalid snippets for unlabeled common tables, missing discriminator enum values, incomplete per-variant tables, and missing combined variants, without promoting polymorphic body variants into the current Compatibility Core.
- Records the recursive-schema future decision: keep recursive schemas unsupported for the intended `1.0.0` stable contract unless finite representation fixtures land before the pre-v1.0.0 release-candidate stage, and treat post-`1.0.0` recursive support as major-version work when existing readers must understand it.
- Adds a complete-generator-readiness evidence plan and publication gate without changing the current Compatibility Core release label.
- Adds a complete-surface candidate full/compact example pair with resources, a workflow, a webhook, compact `field_defaults`, compact `same_as`, and compact opaque webhook payload fields without changing the current Compatibility Core release label.
- Adds initial focused complete-candidate fixtures for profile pairing, selective conventions, compact `same_as`, compact opaque fields, and resource/workflow/webhook related links.
- Expands focused complete-candidate fixtures for non-JSON multipart boundaries, polymorphic variants, workflow and response-header replacement `unsupported`, and grouped webhook payload variants.
- Expands focused complete-candidate fixtures for metadata and extensions, coverage/knowledge states, structured parameters, conditional requiredness, repeatable response headers, exactly-null values, inline unknown-code labels, and generated-example field coverage.
- Expands focused complete-candidate fixtures for table and field-path syntax, media-type uniqueness, endpoint-specific error recovery state, common-error suppression deviations, and recursive-schema source fallback.
- Expands focused complete-candidate fixtures for compact field-default reconstruction, compact error-shape reduction, localized `unsupported`, and canonical extension/non-extension heading boundaries.
- Adds a complete-candidate fixture checker for full/compact path pairing, INDEX references, compact reductions, focused fixture expectations, and complete-surface evidence, and aligns complete-candidate INDEX separators with the README rules.
- Adds a complete-candidate LLM evaluation task packet, local context metrics, and an evaluation packet checker without claiming live LLM evaluation evidence.
- Expands focused complete-candidate fixtures for deprecated endpoint signaling, Behavior unknown facts, PATCH update semantics, root-value bodies, status range/default ordering, and whole-section `CONVENTIONS.md` states.
- Expands focused complete-candidate fixtures for body-less and unknown body states, parameter wire serialization, value omission/default behavior, and webhook payload presence.
- Expands focused complete-candidate fixtures for INDEX routing, endpoint section/path-parameter structure, and `CONVENTIONS.md` common error-shape contracts, and aligns selective-convention fixture cells with comma-separated `Conventions` syntax.
- Expands focused complete-candidate fixtures for redirect and async responses, multiple media-type branching, and unknown response-header/body-nullability states, and adds the required `body_nullable` marker to the CSV media-type uniqueness fixture.
- Expands focused complete-candidate fixtures for single-prose-language output and English-only structural text boundaries.
- Expands focused complete-candidate fixtures for unrepresentable endpoint omission, structural identifier spelling, `media_type=unknown`, and resource-file boundaries.
- Expands focused complete-candidate fixtures for body-marker ordering, conditional response-body presence, conditional response-header presence, and response-specific common-header deviations.
- Expands focused complete-candidate fixtures for table-cell unknown values, cross-file reference rejection, nested arrays/maps, root-object `$` row usage, and enum documentation.
- Expands focused complete-candidate fixtures for request media-type selection and non-JSON form, binary, CSV, XML, and SSE representation classes.
- Expands focused complete-candidate fixtures for untagged and overlapping polymorphic variants and invalid pre-variant content.
- Expands focused complete-candidate fixtures for inline error-shape reuse and ordering, field-level error UI policy, and common error `Shape=none` / `Shape=unknown`.
- Expands focused complete-candidate fixtures for deviation placement and compact contract-preservation, opaque-field omission, and field-default savings evidence.
- Expands focused complete-candidate fixtures for workflow structure, value passing, recovery, deviations, and whole-section unknown states.
- Expands focused complete-candidate fixtures for webhook structure, delivery contracts, trigger references, and grouped-event incompatibility boundaries.
- Expands focused complete-candidate fixtures for INDEX and metadata propagation of `unsupported` coverage and `unknown` knowledge states.
- Expands focused complete-candidate fixtures for source-backed generated examples that require `unknown` knowledge when no credible valid example can be generated.
- Expands focused complete-candidate fixtures for response default classification between exclusively error defaults and mixed error/non-error defaults.
- Expands focused complete-candidate fixtures for common response-header contracts in `CONVENTIONS.md` and endpoint-level suppression or override deviations.
- Adds a final complete-candidate focused coverage audit that maps README section 9.1 requirements to fixtures, checker expectations, coverage rows, and changelog evidence.
- Records the complete-candidate live LLM target list and extends the evaluation checker to validate target coverage.
- Adds a deterministic complete-candidate evaluation prompt exporter for request-construction live runs and aligns the evaluation packet with the README workflow-completion requirement without claiming live LLM evidence.
- Adds a live result JSONL record format and checker validation for complete-candidate LLM evaluation runs.
- Adds automated request-construction grading for complete-candidate live result records.
- Adds a live LLM evaluation procedure covering gate order, target order rationale, stop criteria, authentication, cost controls, result review, and publication impact.
- Adds a Google Interactions API runner for complete-candidate request-construction live evaluation records.
- Normalizes request-construction live grading for base paths, bearer-token placeholders, multipart part content-type forms, and explicit boundary delegation.
- Records a passing Google request-construction live smoke run after request-construction grader-policy review.
- Adds OpenAI and Anthropic live request-construction runners that reuse the shared prompt, grading, and JSONL result format.
- Documents managed-environment export blocking behavior for OpenAI and Anthropic live request-construction runs.
- Omits `temperature` from OpenAI and Anthropic live request-construction runners after the required target models reject that parameter.
- Records passing request-construction live results for all required complete-candidate target models.
- Adds response-handling live grading support and records a managed-environment block for the first Google response-handling attempt.
- Records passing response-handling live results for all required complete-candidate target models.
- Adds error-handling live grading support and records a managed-environment block for the first Google error-handling attempt.
- Normalizes error-handling live grading for common shape labels and behavior-equivalent endpoint/common grouping.
- Records passing error-handling live results for all required complete-candidate target models.
- Adds workflow-completion live grading support and records a managed-environment block for the first Google workflow-completion attempt.
- Normalizes workflow-completion live grading for concrete path values and surrounding preserved state.
- Makes live runners parse Markdown-fenced JSON responses and JSON with surrounding prose.
- Records passing Google and OpenAI workflow-completion live results while Anthropic awaits a rerun after parser normalization.

## 0.11.0 (Draft - Compatibility Core)

- Moves draft history from README.md to this changelog and adds a non-normative LLM reader quick path.
- Clarifies that compact opaque-field reduction applies to response, error-shape, and webhook variants.
- Defines a pre-1.0 Compatibility Core and stages fixture requirements so early implementation targets can preserve compatibility for core full-profile structures before non-core features stabilize.
- Adds a draft 0.11.0 Compatibility Core fixture corpus with a valid full-profile document set, coverage matrix, focused valid/invalid snippets, and a core fixture checker.

## 0.10.1 (Draft)

- Clarifies normative imperative wording, token-saving producer assertions, media-type structural spelling, generated-example readiness, event-specific webhook delivery deviations, structural fixed-token coverage, and token-routing guidance.

## 0.10.0 (Draft)

- Clarifies full/compact profile path pairing, same-kind `same_as` boundaries, structural identifier failure handling, always-null value representation, common-error suppression deviations, common-header `none` boundaries, inline errors with unknown codes, representation media-type uniqueness, error-time state placement, workflow unsupported replacement units, INDEX token-routing guidance, recursive-schema 1.0 posture, pre-v1.0 fixture staging, and design-review publication boundaries.

## 0.9.0 (Draft)

- Tightens pre-1.0 version handling, convention-section selection, collapsed response-header boundaries, endpoint-specific common-error deviations, `same_as` retrieval metadata, token-routing metadata, `unknown` placement, endpoint-path token safety, `any` type semantics, and recursive-schema stabilization risk.

## 0.8.8 (Draft)

- Clarifies non-standard heading prohibition, common calling-rule placement in conventions, recursive-schema publication risk, and design-review publication readiness.

## 0.8.7 (Draft)

- Clarifies endpoint-specific error rows that use common shapes, webhook payload boundaries, whole-section unknown handling for workflows and webhooks, and convention-loading token guidance.

## 0.8.6 (Draft)

- Clarifies response-header prose boundaries, `same_as` media identity and retrieval guidance, selective convention loading, extension headings, and standardized enum references.

## 0.8.5 (Draft)

- Defines response-header replacement units, clarifies response whole-section unknown handling, permits compact error-shape field reductions, and clarifies field-default validation.

## 0.8.4 (Draft)

- Fixes example navigation consistency, strengthens workflow examples, clarifies compact field-default applicability, and makes the design-review publication label explicit.

## 0.8.3 (Draft)

- Explains why recursive schemas are represented as `unsupported` instead of finite-depth expansion.

## 0.8.2 (Draft)

- Clarifies cross-file convention factoring versus same-file compact reuse, states the compact retrieval-unit self-containment rule in the core principles, declares recursive schemas outside the stable 1.0 supported scope, and adds a non-normative retrieval recipe.

## 0.8.1 (Draft)

- Clarifies compact `same_as` representation exceptions, field-path pipe escaping, nested field presence semantics, Related `none` handling, and recursive-schema publication readiness.

## 0.8.0 (Draft)

- Defines table-cell normalization for validation, clarifies empty compact `Opaque fields` output, sharpens generator-readiness publication labels, and clarifies compact omission wording.

## 0.7.0 (Draft)

- Defines canonical replacement forms for unrepresentable required content, removes heading-boundary ambiguity, distinguishes format compliance from implementation readiness, clarifies optional revision stamps and unknown/body-less forms, and adds safe compact-generation optimizations.

## 0.6.0 (Draft)

- Separates source representability from missing authoritative knowledge, resolves root-value presence semantics for compact reuse, defines conservative opaque-field and example-generation rules, and makes recursive schemas explicitly unsupported pending a pre-1.0 design.

## 0.5.0 (Draft)

- Defines conditional request requiredness, clarifies compact examples and projection identity, makes selective-convention references unambiguous, and strengthens non-JSON representation requirements.

## 0.4.0 (Draft)

- Defines escaped field paths and structured parameter fields, makes object openness and response-header presence explicit, aligns webhook field semantics, and adds compact table and example reductions.

## 0.3.0 (Draft)

- Makes compact projections structurally complete, adds projection coverage and compact field defaults, renames source revision metadata, strengthens minor-version compatibility and canonical syntax, and adds API-wide HTTP semantics.

## 0.2.0 (Draft)

- Makes the full profile required, defines common and inline error-shape mapping, fixes polymorphic representation order, classifies body-nullability requirements, and completes response and parameter wire rules.

## 0.1.0 (Draft)

- Initial public draft. Defines the metadata stamp, full and compact profiles, endpoint/workflow/webhook structures, body semantics, extension rules, and compliance checklist.
