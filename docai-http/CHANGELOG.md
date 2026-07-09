# Changelog

DocAI HTTP draft history. Specification versioning and compatibility rules are defined in [README.md](README.md#31-format-versioning-and-compatibility).

## Unreleased

- Strengthens the Compatibility Core fixture checker with request-subsection order, body marker order, body-less request/response, conditional requiredness, and deprecated INDEX-summary checks.
- Expands focused Compatibility Core fixture coverage for body-less requests/responses, `unknown` table/body values, root `$` bodies, exactly-null JSON values, common-error suppression, and deprecated endpoints.

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
