> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc2-001 | x-fixture: stable-conformance

# Checkout

Validates a cart, creates a payment, and confirms an order.

## Preconditions

- The cart exists and contains at least one item.
- The shopper is authenticated.

## Steps

1. POST /carts/{id}/validate - Pass `id`; keep `cart_id`; fix cart and restart on validation failure.
2. POST /payments - Pass `cart_id`, `amount`, `currency`, one payment-method variant, and one `Idempotency-Key` per logical attempt; keep `payment_id`; replay unknown outcomes with the same request and key, but use a new key after correcting rejected details.
3. POST /orders - Pass `cart_id`, `payment_id`, and one `Idempotency-Key`; keep `order_id`; replay an unknown or safely retryable outcome with the same IDs and key.

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
- For a payment request with no definitive response, replay the identical request with the same `Idempotency-Key`; after correcting rejected payment details, use a new key.
- For an order request with no definitive response or a safely retryable error, replay the same `cart_id`, `payment_id`, and `Idempotency-Key`; use a new key only for a new logical attempt.
- Reconcile early `payment.completed` delivery by `payment_id`.
