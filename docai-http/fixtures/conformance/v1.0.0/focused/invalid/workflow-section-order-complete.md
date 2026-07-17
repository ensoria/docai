# invalid: workflow section order

Expected: invalid complete conformance. Workflow files must use `Preconditions`, `Steps`, `State Transitions`, and `Failure and Recovery` in that order.

````markdown
# Checkout

Validates a cart, creates a payment, and confirms an order.

## Steps

1. POST /payments - Pass `cart_id`. Keep the returned `payment_id`. If payment creation fails, collect another payment method before retrying this step.

## Preconditions

- The cart exists.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.validated | POST /payments succeeds | payment.pending |

## Failure and Recovery

- If payment creation fails, collect another payment method and retry step 1.
````
