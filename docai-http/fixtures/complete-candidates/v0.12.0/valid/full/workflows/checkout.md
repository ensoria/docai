> docai-http: 0.12.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-complete-candidate-001 | x-fixture: complete-candidate

# Checkout

Validates a cart, creates a payment, and confirms an order.

## Preconditions

- The cart exists and contains at least one item.
- The shopper is authenticated.

## Steps

1. POST /carts/{id}/validate - Pass the cart `id`. Keep the returned `cart_id`. If validation fails, update the cart before continuing.
2. POST /payments - Pass `cart_id`, `amount`, `currency`, and one payment-method variant. Keep the returned `payment_id`. If payment creation fails, collect a different payment method before retrying this step.
3. POST /orders - Pass `cart_id` and `payment_id`. Keep the returned `order_id`. If order confirmation fails with a retryable error, keep both values and retry this step.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.ready | POST /carts/{id}/validate succeeds | cart.validated |
| cart.validated | POST /payments succeeds | payment.pending |
| payment.pending | POST /orders succeeds | order.confirmed |
| payment.pending | POST /orders fails with retryable error | payment.pending |
| payment.pending | payment.completed webhook received | payment.settled |

## Failure and Recovery

- If cart validation fails, update cart contents and restart from step 1.
- If payment creation fails, collect another payment method and retry step 2.
- If order confirmation fails with a retryable error, keep the pending payment and retry step 3.
- If `payment.completed` arrives before order confirmation is observed, reconcile by `payment_id` and continue polling or retrying the order confirmation step according to the caller's order state.
