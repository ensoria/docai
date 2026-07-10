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
| Focused resource/workflow/webhook relation fixture | present | `focused/valid/workflow-webhook-related-links.md` |
| Focused non-JSON multipart fixtures | present | `focused/valid/non-json-multipart-boundary.md`, `focused/invalid/non-json-multipart-boundary-missing.md` |
| Focused polymorphic variant fixtures | present | `focused/valid/polymorphic-tagged-request-variants.md`, `focused/invalid/polymorphic-variant-incomplete-table.md` |
| Focused replacement `unsupported` fixtures | present | `focused/valid/workflow-section-replacement-unsupported.md`, `focused/invalid/workflow-unsupported-wrong-unit.md`, `focused/valid/response-header-replacement-unsupported.md`, `focused/invalid/response-header-unsupported-wrong-unit.md` |
| Focused grouped webhook variant fixtures | present | `focused/valid/grouped-webhook-payload-variants.md`, `focused/invalid/grouped-webhook-unlabeled-payload-table.md` |
| Focused metadata and extension fixtures | present | `focused/valid/metadata-extension-token-routing.md`, `focused/invalid/metadata-unknown-escape.md` |
| Focused canonical boundary fixtures | present | `focused/valid/canonical-boundary-extension-heading.md`, `focused/invalid/non-extension-heading.md` |
| Focused coverage and knowledge fixtures | present | `focused/valid/unknown-coverage-knowledge-state.md`, `focused/invalid/unknown-marker-missing.md` |
| Focused structured-parameter fixtures | present | `focused/valid/structured-parameter-fields.md`, `focused/invalid/structured-parameter-missing-fields.md` |
| Focused conditional-requiredness fixtures | present | `focused/valid/conditional-requiredness.md`, `focused/invalid/conditional-requiredness-missing-condition.md` |
| Focused repeatable response-header fixtures | present | `focused/valid/response-header-repetition.md`, `focused/invalid/repeated-response-header-missing-wire-rule.md` |
| Focused exactly-null fixtures | present | `focused/valid/exactly-null-body.md`, `focused/invalid/exactly-null-nullable-no.md` |
| Focused inline unknown-code fixtures | present | `focused/valid/inline-error-unknown-code.md`, `focused/invalid/inline-error-unknown-code-missing-marker.md` |
| Focused generated-example fixtures | present | `focused/valid/generated-example-field-coverage.md`, `focused/invalid/generated-example-field-missing-row.md` |
| Focused table and field-path fixtures | present | `focused/valid/table-field-path-normalization.md`, `focused/invalid/field-path-unescaped-pipe.md` |
| Focused media-type uniqueness fixtures | present | `focused/valid/media-type-unique-representations.md`, `focused/invalid/duplicate-media-type-representation.md` |
| Focused error-deviation and recovery-state fixtures | present | `focused/valid/error-deviation-and-recovery-state.md`, `focused/invalid/common-error-suppression-missing-deviation.md` |
| Focused localized `unsupported` fixtures | present | `focused/valid/localized-unsupported-smallest-unit.md` |
| Recursive source fixtures | present | `source/recursive-direct-openapi.yaml`, `source/recursive-indirect-openapi.yaml` |
| Focused recursive fallback fixtures | present | `focused/valid/recursive-direct-unsupported.md`, `focused/valid/recursive-indirect-unsupported.md`, `focused/invalid/recursive-truncated-representation.md` |
| Remaining focused complete-surface fixtures | missing | every remaining README section 9.1 canonical marker, table shape, normalization rule, representation class, and replacement unit |
| Complete-surface checker coverage | present | `tools/check-complete-candidates.mjs` |
| LLM task evaluation evidence | missing | future work |

## Publication Impact

This candidate satisfies the TODO item for a full/compact complete example pair that includes resources, workflows, and webhooks. It also expands focused complete-surface fixture coverage for profile pairing, selective conventions, `same_as`, compact `field_defaults`, compact opaque and error-shape reductions, resource/workflow/webhook relations, non-JSON multipart, polymorphic variants, replacement and localized `unsupported`, grouped webhook variants, metadata and extensions, canonical boundaries, coverage/knowledge states, structured parameters, conditional requiredness, response-header repetition, exactly-null values, inline unknown-code labels, generated-example field coverage, table and field-path syntax, media-type uniqueness, error recovery state, and recursive fallback. It does not satisfy the README section 9.1 complete-generator-ready gate by itself.

The README publication label must remain `Compatibility Core implementation target` until focused fixture coverage and LLM task evaluations are also complete.
