# valid: workflow and webhook related links

Expected: valid complete candidate. A resource endpoint can link to both a workflow and a webhook when both are part of the same complete-surface document set.

````markdown
> docai-http: 0.12.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

## POST /payments

### Related

- Workflow: workflows/checkout.md
- Triggers webhook: webhooks/payment-completed.md

---

> docai-http: 0.12.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# Checkout

## Steps

1. POST /payments - Pass `cart_id`; keep `payment_id`.

---

> docai-http: 0.12.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# payment.completed

## Related

- Triggered by: POST /payments
````
