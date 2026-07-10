# Complete Candidate Coverage

This file records evidence for the first complete-surface candidate example pair. It is not a promotion record.

## Current Evidence

| Requirement | Status | Evidence |
|---|---|---|
| Versioned complete-surface candidate directory | present | `fixtures/complete-candidates/v0.11.0/` |
| Valid full-profile example set | present | `valid/full/` |
| Matching compact-profile example set | present | `valid/compact/` |
| Same standard docs-root-relative paths in full and compact | present | `README.md` path list |
| Shared `projection_id` across full and compact | present | `complete-candidate-20260710-001` |
| INDEX.md and CONVENTIONS.md | present | `valid/full/` and `valid/compact/` |
| Resource files | present | users, checkout, payments, documents |
| Workflow file | present | `workflows/checkout.md` |
| Webhook file | present | `webhooks/payment-completed.md` |
| Compact `field_defaults` | present | compact resource and webhook tables |
| Compact `same_as` | present | `valid/compact/resources/users.md` |
| Compact opaque payload fields | present | `valid/compact/webhooks/payment-completed.md` |
| Focused full/compact profile-pair fixtures | present | `focused/valid/profile-pair-selective-conventions.md`, `focused/invalid/profile-pair-missing-standard-path.md` |
| Focused selective convention loading fixtures | present | `focused/valid/profile-pair-selective-conventions.md`, `focused/invalid/selective-conventions-unknown-section.md` |
| Focused compact `same_as` fixtures | present | `focused/valid/same-as-resource-file-retrieval-unit.md`, `focused/invalid/same-as-forward-reference.md`, `focused/invalid/same-as-cross-kind.md`, `focused/invalid/same-as-missing-retrieval-unit.md` |
| Focused compact `field_defaults` fixtures | present | `focused/valid/field-defaults-reconstruction.md`, `focused/invalid/field-defaults-retained-column.md`, `focused/invalid/field-defaults-unknown-value.md` |
| Focused compact opaque-field fixtures | present | `focused/valid/compact-opaque-webhook-payload.md`, `focused/invalid/opaque-fields-before-client-visible-fields.md`, `focused/invalid/opaque-request-field.md` |
| Focused compact error-shape reduction fixtures | present | `focused/valid/compact-error-shape-client-visible-fields.md`, `focused/invalid/same-as-error-shape.md` |
| Focused INDEX routing fixtures | present | `focused/valid/index-routing-task-conventions.md`, `focused/invalid/index-missing-also-read-column.md` |
| Focused deprecated endpoint fixtures | present | `focused/valid/deprecated-index-and-endpoint.md`, `focused/invalid/deprecated-index-summary-missing-prefix.md` |
| Focused resource/workflow/webhook relation fixture | present | `focused/valid/workflow-webhook-related-links.md` |
| Focused endpoint structure and path-parameter fixtures | present | `focused/valid/endpoint-section-order-path-parameters.md`, `focused/invalid/path-parameter-name-mismatch.md` |
| Focused unrepresentable endpoint method/path fixtures | present | `focused/valid/unrepresentable-endpoint-omitted.md`, `focused/invalid/unrepresentable-endpoint-normalized.md` |
| Focused structural identifier spelling fixtures | present | `focused/valid/structural-identifier-spelling.md`, `focused/invalid/invalid-structural-identifier-spelling.md` |
| Focused Behavior unknown fixtures | present | `focused/valid/behavior-unknown-marker.md`, `focused/invalid/behavior-unknown-missing-marker.md` |
| Focused update semantics fixtures | present | `focused/valid/update-patch-semantics.md`, `focused/invalid/update-patch-semantics-missing.md` |
| Focused body marker ordering fixtures | present | `focused/valid/body-marker-ordering-all-units.md`, `focused/invalid/body-marker-ordering-wrong.md` |
| Focused body-less and unknown body fixtures | present | `focused/valid/bodyless-and-unknown-body.md`, `focused/invalid/bodyless-request-missing-none.md` |
| Focused response header/body nullability unknown fixtures | present | `focused/valid/unknown-response-headers-and-nullability.md`, `focused/invalid/unknown-response-headers-missing-marker.md` |
| Focused conditional response-body fixtures | present | `focused/valid/conditional-response-body-presence.md`, `focused/invalid/conditional-response-presence-missing-condition.md` |
| Focused conditional response-header and deviation fixtures | present | `focused/valid/conditional-response-header-deviation.md`, `focused/invalid/conditional-response-header-missing-condition.md`, `focused/invalid/common-header-suppression-missing-deviation.md` |
| Focused `media_type=unknown` fixtures | present | `focused/valid/media-type-unknown.md`, `focused/invalid/media-type-unknown-missing-marker.md` |
| Focused table-cell unknown fixtures | present | `focused/valid/table-cell-unknown-values.md`, `focused/invalid/compact-default-hides-unknown-column.md` |
| Focused parameter wire-serialization fixtures | present | `focused/valid/parameter-wire-serialization.md`, `focused/invalid/parameter-array-missing-wire-rule.md` |
| Focused cross-file reference fixtures | present | `focused/invalid/cross-file-ref-notation.md` |
| Focused non-JSON multipart fixtures | present | `focused/valid/non-json-multipart-boundary.md`, `focused/invalid/non-json-multipart-boundary-missing.md` |
| Focused request media-type selection fixtures | present | `focused/valid/request-media-type-selection.md`, `focused/invalid/request-media-type-selection-missing.md` |
| Focused non-JSON representation class fixtures | present | `focused/valid/non-json-representation-classes.md` |
| Focused raw/stream sample-and-prose exception fixtures | present | `focused/valid/non-json-representation-classes.md`, `focused/invalid/raw-binary-field-table.md`, `focused/invalid/unstructured-stream-field-table.md` |
| Focused polymorphic variant fixtures | present | `focused/valid/polymorphic-tagged-request-variants.md`, `focused/invalid/polymorphic-variant-incomplete-table.md` |
| Focused untagged and overlapping polymorphic fixtures | present | `focused/valid/untagged-overlapping-polymorphic-variants.md`, `focused/invalid/untagged-variant-incomplete-table.md`, `focused/invalid/overlapping-combined-variant-missing.md` |
| Focused polymorphic pre-variant boundary fixtures | present | `focused/invalid/polymorphic-unlabeled-common-table.md`, `focused/invalid/polymorphic-unlabeled-example-before-variants.md` |
| Focused replacement `unsupported` fixtures | present | `focused/valid/workflow-section-replacement-unsupported.md`, `focused/invalid/workflow-unsupported-wrong-unit.md`, `focused/valid/response-header-replacement-unsupported.md`, `focused/invalid/response-header-unsupported-wrong-unit.md` |
| Focused grouped webhook variant fixtures | present | `focused/valid/grouped-webhook-payload-variants.md`, `focused/invalid/grouped-webhook-unlabeled-payload-table.md` |
| Focused metadata and extension fixtures | present | `focused/valid/metadata-extension-token-routing.md`, `focused/invalid/metadata-unknown-escape.md` |
| Focused canonical boundary fixtures | present | `focused/valid/canonical-boundary-extension-heading.md`, `focused/invalid/non-extension-heading.md` |
| Focused prose language and structural text fixtures | present | `focused/valid/single-prose-language-english-structure.md`, `focused/invalid/non-english-structural-text.md`, `focused/invalid/mixed-prose-language.md` |
| Focused resource-file boundary fixtures | present | `focused/valid/structural-identifier-spelling.md`, `focused/invalid/resource-file-title-wrapper.md` |
| Focused coverage and knowledge fixtures | present | `focused/valid/unknown-coverage-knowledge-state.md`, `focused/invalid/unknown-marker-missing.md` |
| Focused common error-shape fixtures | present | `focused/valid/conventions-common-error-shapes.md`, `focused/invalid/common-error-shape-missing-response-headers.md` |
| Focused inline error-shape fixtures | present | `focused/valid/inline-error-shape-reuse-and-bodyless.md`, `focused/invalid/inline-error-shape-out-of-order.md`, `focused/invalid/inline-error-label-mismatch.md` |
| Focused field-level error-policy fixtures | present | `focused/valid/field-level-error-policy.md`, `focused/invalid/field-level-error-policy-missing.md` |
| Focused common error `Shape=none` / `Shape=unknown` fixtures | present | `focused/valid/common-error-none-unknown-shapes.md`, `focused/invalid/common-error-unknown-shape-missing-marker.md` |
| Focused deviation placement fixtures | present | `focused/valid/deviation-placement.md`, `focused/invalid/deviation-outside-affected-section.md` |
| Focused compact contract-preservation fixtures | present | `focused/invalid/compact-contract-preservation-failures.md` |
| Focused compact opaque-fields omission fixtures | present | `focused/valid/compact-opaque-fields-omitted.md`, `focused/invalid/compact-empty-opaque-fields-heading.md` |
| Focused compact `field_defaults` savings-evidence fixtures | present | `focused/valid/field-defaults-measured-savings.md`, `focused/invalid/field-defaults-savings-unjustified.md` |
| Focused workflow structure and deviation fixtures | present | `focused/valid/workflow-structure-deviation.md`, `focused/invalid/workflow-title-mismatch.md`, `focused/invalid/workflow-section-order-complete.md`, `focused/invalid/workflow-step-missing-values-failure.md`, `focused/invalid/workflow-deviation-wrong-placement-complete.md` |
| Focused workflow whole-section unknown fixtures | present | `focused/valid/workflow-whole-section-unknown.md`, `focused/invalid/workflow-unknown-missing-marker.md` |
| Focused webhook structure and delivery fixtures | present | `focused/valid/webhook-structure-delivery.md`, `focused/invalid/webhook-title-mismatch.md`, `focused/invalid/index-webhook-missing-details-complete.md`, `focused/invalid/endpoint-related-missing-webhook-complete.md`, `focused/invalid/event-header-missing-wire-rule-complete.md`, `focused/invalid/webhook-dedup-missing-complete.md`, `focused/invalid/webhook-deviation-incomplete.md`, `focused/invalid/webhook-section-order-complete.md` |
| Focused webhook grouped-event incompatibility fixtures | present | `focused/invalid/grouped-webhook-incompatible-headers.md`, `focused/invalid/grouped-webhook-incompatible-deviation.md`, `focused/invalid/grouped-webhook-incompatible-receiver.md`, `focused/invalid/grouped-webhook-incompatible-trigger.md` |
| Focused `CONVENTIONS.md` whole-section state fixtures | present | `focused/valid/conventions-whole-section-states.md`, `focused/invalid/conventions-unsupported-wrong-unit.md` |
| Focused structured-parameter fixtures | present | `focused/valid/structured-parameter-fields.md`, `focused/invalid/structured-parameter-missing-fields.md` |
| Focused conditional-requiredness fixtures | present | `focused/valid/conditional-requiredness.md`, `focused/invalid/conditional-requiredness-missing-condition.md` |
| Focused repeatable response-header fixtures | present | `focused/valid/response-header-repetition.md`, `focused/invalid/repeated-response-header-missing-wire-rule.md` |
| Focused exactly-null fixtures | present | `focused/valid/exactly-null-body.md`, `focused/invalid/exactly-null-nullable-no.md` |
| Focused inline unknown-code fixtures | present | `focused/valid/inline-error-unknown-code.md`, `focused/invalid/inline-error-unknown-code-missing-marker.md` |
| Focused generated-example fixtures | present | `focused/valid/generated-example-field-coverage.md`, `focused/invalid/generated-example-field-missing-row.md` |
| Focused root-value and `any` type fixtures | present | `focused/valid/root-values-and-any-type.md`, `focused/invalid/any-used-for-missing-type.md` |
| Focused nested arrays, maps, and object-openness fixtures | present | `focused/valid/nested-arrays-maps-openness.md`, `focused/invalid/nested-map-flattened-literal-key.md` |
| Focused root-object `$` row fixtures | present | `focused/valid/root-object-dollar-exception.md`, `focused/invalid/root-object-dollar-contradiction.md` |
| Focused enum documentation fixtures | present | `focused/valid/enum-documentation.md`, `focused/invalid/enum-omits-client-branch-values.md` |
| Focused table and field-path fixtures | present | `focused/valid/table-field-path-normalization.md`, `focused/invalid/field-path-unescaped-pipe.md` |
| Focused status ordering fixtures | present | `focused/valid/status-range-default-ordering.md`, `focused/invalid/status-order-default-before-range.md` |
| Focused redirect and async-response fixtures | present | `focused/valid/redirect-and-async-responses.md`, `focused/invalid/redirect-missing-location-header.md`, `focused/invalid/async-response-missing-polling.md` |
| Focused multiple media-type branching fixtures | present | `focused/valid/multiple-media-type-branching.md`, `focused/invalid/multiple-media-type-missing-branching.md` |
| Focused media-type uniqueness fixtures | present | `focused/valid/media-type-unique-representations.md`, `focused/invalid/duplicate-media-type-representation.md` |
| Focused value omission/default fixtures | present | `focused/valid/value-omission-empty-defaults.md`, `focused/invalid/value-default-behavior-missing.md` |
| Focused webhook payload-presence fixtures | present | `focused/valid/webhook-payload-presence.md`, `focused/invalid/webhook-payload-presence-missing-condition.md` |
| Focused error-deviation and recovery-state fixtures | present | `focused/valid/error-deviation-and-recovery-state.md`, `focused/invalid/common-error-suppression-missing-deviation.md` |
| Focused localized `unsupported` fixtures | present | `focused/valid/localized-unsupported-smallest-unit.md` |
| Recursive source fixtures | present | `source/recursive-direct-openapi.yaml`, `source/recursive-indirect-openapi.yaml` |
| Focused recursive fallback fixtures | present | `focused/valid/recursive-direct-unsupported.md`, `focused/valid/recursive-indirect-unsupported.md`, `focused/invalid/recursive-truncated-representation.md` |
| Remaining focused complete-surface fixtures | missing | every remaining README section 9.1 canonical marker, table shape, normalization rule, representation class, and replacement unit |
| Complete-surface checker coverage | present | `tools/check-complete-candidates.mjs` |
| LLM task evaluation packet | present | `evaluations/tasks.json`, `evaluations/RESULTS.md`, `tools/check-complete-evaluations.mjs` |
| Live LLM task evaluation evidence | missing | future work |

## Publication Impact

This candidate satisfies the TODO item for a full/compact complete example pair that includes resources, workflows, and webhooks. It also expands focused complete-surface fixture coverage for profile pairing, selective conventions, `same_as`, compact `field_defaults`, compact opaque and error-shape reductions, compact contract preservation, compact opaque-heading omission, compact `field_defaults` savings evidence, INDEX routing, deprecated endpoints, resource/workflow/webhook relations, workflow structure/deviation/unknown states, webhook structure/delivery/trigger references, webhook grouped-event incompatibility boundaries, endpoint structure and path parameters, unrepresentable endpoint omission, structural identifier spelling, Behavior unknown facts, update semantics, body marker ordering, body-less and unknown body states, response header/body nullability unknown states, conditional response-body and response-header presence, `media_type=unknown`, table-cell unknown states, parameter wire serialization, cross-file reference rejection, non-JSON multipart, request media-type selection, non-JSON form/binary/CSV/XML/SSE classes, raw/stream sample-and-prose exceptions, tagged, untagged, and overlapping polymorphic variants, polymorphic pre-variant boundary rejection, inline error-shape reuse/order/label/body-less forms, field-level error UI policy, common error `Shape=none` / `Shape=unknown`, deviation placement, replacement and localized `unsupported`, grouped webhook variants, metadata and extensions, canonical boundaries, prose language and structural text boundaries, resource-file boundaries, coverage/knowledge states, common error shapes, `CONVENTIONS.md` whole-section states, structured parameters, conditional requiredness, response-header repetition, exactly-null values, inline unknown-code labels, generated-example field coverage, root-value bodies, nested arrays and dynamic maps, root-object `$` row usage, enum documentation, table and field-path syntax, status ordering, redirect and async response handling, multiple media-type branching, media-type uniqueness, value omission/default behavior, webhook payload presence, error recovery state, and recursive fallback. It does not satisfy the README section 9.1 complete-generator-ready gate by itself.

The README publication label must remain `Compatibility Core implementation target` until focused fixture coverage and live LLM task evaluations are also complete.
