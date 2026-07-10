# valid: workflow structure, value passing, and deviations

Expected: valid complete candidate. A workflow title matches the INDEX workflow name, uses fixed sections in order, documents values passed, failure branches, recovery state, and places workflow-specific deviations correctly.

````markdown
# API Index

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | Validate cart, create payment, and confirm order. | workflows/checkout.md |

---

# Checkout

Validates a cart, creates a payment, and confirms an order.

**deviation**: high-risk carts require manual review between payment creation and order confirmation.

## Preconditions

- The cart exists and contains at least one item.
- The shopper is authenticated.

## Steps

**deviation**: manual review must finish before `POST /orders` can run.

1. POST /carts/{id}/validate - Pass the cart `id`. Keep the returned `cart_id`. If validation fails, update the cart before continuing.
2. POST /payments - Pass `cart_id`, `amount`, and `currency`. Keep the returned `payment_id`. If payment creation fails, collect a different payment method before retrying this step.
3. POST /reviews - Pass `cart_id` and `payment_id`. Keep the returned `review_id`. If review creation fails, keep the pending payment and retry this step after updating risk data.
4. POST /orders - Pass `cart_id`, `payment_id`, and `review_id`. Keep the returned `order_id`. If order confirmation fails with a retryable error, keep all three values and retry this step.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.ready | POST /carts/{id}/validate succeeds | cart.validated |
| cart.validated | POST /payments succeeds | payment.pending |
| payment.pending | POST /reviews succeeds | review.approved |
| review.approved | POST /orders succeeds | order.confirmed |
| review.approved | POST /orders fails with retryable error | review.approved |

## Failure and Recovery

- If cart validation fails, update cart contents and restart from step 1.
- If payment creation fails, collect another payment method and retry step 2.
- If review creation fails, keep `payment_id`, update risk data, and retry step 3.
- If order confirmation fails with a retryable error, keep `cart_id`, `payment_id`, and `review_id`, then retry step 4.
````
