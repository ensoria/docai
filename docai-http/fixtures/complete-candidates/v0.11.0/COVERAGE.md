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
| Focused compact opaque-field fixtures | present | `focused/valid/compact-opaque-webhook-payload.md`, `focused/invalid/opaque-fields-before-client-visible-fields.md`, `focused/invalid/opaque-request-field.md` |
| Focused resource/workflow/webhook relation fixture | present | `focused/valid/workflow-webhook-related-links.md` |
| Remaining focused complete-surface fixtures | missing | every remaining README section 9.1 canonical marker, table shape, normalization rule, representation class, and replacement unit |
| Complete-surface checker coverage | missing | future work |
| LLM task evaluation evidence | missing | future work |

## Publication Impact

This candidate satisfies the TODO item for a full/compact complete example pair that includes resources, workflows, and webhooks. It also starts focused complete-surface fixture coverage for profile pairing, selective conventions, `same_as`, opaque fields, and resource/workflow/webhook relations. It does not satisfy the README section 9.1 complete-generator-ready gate by itself.

The README publication label must remain `Compatibility Core implementation target` until focused fixture coverage, checker coverage, and LLM task evaluations are also complete.
