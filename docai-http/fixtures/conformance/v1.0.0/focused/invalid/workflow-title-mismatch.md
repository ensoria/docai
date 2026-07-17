# invalid: workflow title mismatch

Expected: invalid complete conformance. The workflow title should match the INDEX `Name` cell unless the INDEX name is only a shorter retrieval label.

````markdown
# API Index

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | Validate cart, create payment, and confirm order. | workflows/checkout.md |

---

# Payment Flow

Validates a cart, creates a payment, and confirms an order.

## Preconditions

- The cart exists.

## Steps

1. POST /payments - Pass `cart_id`. Keep the returned `payment_id`. If payment creation fails, collect another payment method before retrying this step.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.validated | POST /payments succeeds | payment.pending |

## Failure and Recovery

- If payment creation fails, collect another payment method and retry step 1.
````
