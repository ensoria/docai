# Stable Conformance Token-Saving Notes

These notes describe compact-profile reductions used by the `1.0.0` stable conformance full/compact pair. They are conformance guidance for the stable complete surface, not standalone normative token benchmarks.

## Measurement Policy

Use tokenizer-specific measurements before a producer decides to emit a compact reduction. Token counts without an exact tokenizer identifier are not comparable, so this conformance corpus does not publish normative token counts.

When tokenizer inputs are unavailable, treat the measured-savings condition for `field_defaults` and compact examples as a producer assertion. Check syntax, placement, logical reconstruction, and client-visible contract preservation first.

## Current Conformance Annotations

| Full file | Compact file | Conformance reductions | Contract preservation check |
|---|---|---|---|
| `valid/full/resources/users.md` | `valid/compact/resources/users.md` | Compact request example omits optional `role`; `field_defaults` omits uniform `Nullable`, `Presence`, and response-header `Presence`; GET user response uses `same_as` for the earlier POST user response body representation. | Compact output keeps request fields, response fields, response headers, errors, related links, and `x-retrieval-unit: resource-file` for the `same_as` retrieval requirement. |
| `valid/full/resources/checkout.md` | `valid/compact/resources/checkout.md` | `field_defaults` omits uniform body and response-field columns. | Compact output keeps all workflow-linked endpoints and values passed between steps. |
| `valid/full/resources/payments.md` | `valid/compact/resources/payments.md` | `field_defaults` omits uniform request and response-field columns in variant tables. | Compact output keeps all variant labels, discriminator values, response behavior, and webhook trigger links. |
| `valid/full/resources/documents.md` | `valid/compact/resources/documents.md` | `field_defaults` omits uniform multipart and response-field columns. | Compact output keeps file part name, filename requirement, part content types, size limit, and boundary delegation. |
| `valid/full/webhooks/payment-completed.md` | `valid/compact/webhooks/payment-completed.md` | `field_defaults` omits uniform payload columns; compact payload splits `Client-visible fields` and `Opaque fields`. | Compact output keeps event identity, deduplication field, payment fields, and opaque metadata store/forward contract. |

## Suggested Measurement Record

```markdown
### <fixture path>

- tokenizer:
- full_tokens:
- compact_tokens:
- reduction_tokens:
- reduction_percent:
- reductions_used:
- client_visible_contract_preserved: yes|no
- notes:
```
