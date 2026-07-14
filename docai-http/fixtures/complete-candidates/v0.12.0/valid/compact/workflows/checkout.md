> docai-http: 0.12.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-complete-candidate-001 | x-fixture: complete-candidate

# Checkout

Validates a cart, creates a payment, and confirms an order.

## Preconditions

- The cart exists and contains at least one item.
- The shopper is authenticated.

## Steps

1. POST /carts/{id}/validate - Pass `id`; keep `cart_id`; fix cart and restart on validation failure.
2. POST /payments - Pass `cart_id`, `amount`, `currency`, and one payment-method variant; keep `payment_id`; collect another method and retry this step on payment failure.
3. POST /orders - Pass `cart_id` and `payment_id`; keep `order_id`; on retryable failure, keep both values and retry this step.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.ready | POST /carts/{id}/validate succeeds | cart.validated |
| cart.validated | POST /payments succeeds | payment.pending |
| payment.pending | POST /orders succeeds | order.confirmed |
| payment.pending | POST /orders fails with retryable error | payment.pending |
| payment.pending | payment.completed webhook received | payment.settled |

## Failure and Recovery

- Restart from step 1 after cart changes.
- Retry step 2 only after collecting a different payment method.
- Retry step 3 with the same `cart_id` and `payment_id` when the error is retryable.
- Reconcile early `payment.completed` delivery by `payment_id`.
