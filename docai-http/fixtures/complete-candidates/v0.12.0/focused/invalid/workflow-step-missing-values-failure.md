# invalid: workflow step missing values and failure branch

Expected: invalid complete candidate. Each workflow step must document values passed or retained and its failure branch.

````markdown
# Checkout

Validates a cart, creates a payment, and confirms an order.

## Preconditions

- The cart exists.

## Steps

1. POST /payments - Create a pending payment.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.validated | POST /payments succeeds | payment.pending |

## Failure and Recovery

- If payment creation fails, collect another payment method and retry step 1.
````
