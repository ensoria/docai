> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc3-001 | projection_id: conformance-20260721-rc3-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001 | x-fixture: stable-conformance

# Checkout

Validates a cart, creates a payment, and confirms an order.

## Preconditions

- The cart exists and contains at least one item.
- The shopper is authenticated.

## Steps

1. POST /carts/{id}/validate - Pass the cart `id`. Keep the returned `cart_id`. If validation fails, update the cart before continuing.
2. POST /payments - Pass `cart_id`, `amount`, `currency`, and one payment-method variant with one `Idempotency-Key` for this logical payment attempt. Keep the returned `payment_id`. If the outcome is unknown, retry the identical request with the same key. If the server rejects the payment details, correct them and use a new key.
3. POST /orders - Pass `cart_id` and `payment_id` with one `Idempotency-Key` for this logical order. Keep the returned `order_id`. A pending payment is captured once; an already settled payment is associated without another capture. If the outcome is unknown or a retryable error permits replay, keep both IDs and retry the identical request with the same key.

## State Transitions

Payment state and order state are tracked independently. An early
`payment.completed` event settles the payment but does not confirm or invalidate
the order operation.

| From | Endpoint / Event | To |
|---|---|---|
| cart.ready | POST /carts/{id}/validate succeeds | cart.validated |
| cart.validated + order.not_confirmed | POST /payments succeeds | payment.pending + order.not_confirmed |
| payment.pending + order.not_confirmed | payment.completed webhook received | payment.settled + order.not_confirmed |
| payment.pending + order.not_confirmed | POST /orders succeeds and captures once | payment.settled + order.confirmed |
| payment.settled + order.not_confirmed | POST /orders succeeds without another capture | payment.settled + order.confirmed |
| payment.pending or payment.settled + order.not_confirmed | POST /orders fails with retryable error | same payment state + order.not_confirmed |

## Failure and Recovery

- If cart validation fails, update cart contents and restart from step 1.
- If payment creation returns no definitive response, retry the byte-equivalent request with the same `Idempotency-Key`; do not create a second key until that outcome is known. If the payment details are rejected, collect another payment method and retry step 2 with a new key.
- If order confirmation returns no definitive response or a retryable error permits replay, keep the payment state and retry the identical step 3 request with the same `Idempotency-Key`. Use a new key only for a corrected request that represents a new logical order attempt. The replay must not capture an already settled payment again.
- If `payment.completed` arrives before order confirmation is observed, reconcile by `payment_id`, record `payment.settled + order.not_confirmed`, and continue calling or safely retrying POST /orders with the same IDs and logical-operation key. POST /orders remains valid and associates the settled payment without capturing it again.
