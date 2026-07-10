# invalid: workflow step missing failure branch

Expected: invalid workflow candidate. Each workflow step must describe its failure branch.

```markdown
# Checkout

Validates payment and creates an order.

## Preconditions

- The cart exists.

## Steps

1. POST /payments - Pass `cart_id`. Keep the returned `payment_id`.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.validated | POST /payments succeeds | payment.pending |

## Failure and Recovery

- If payment creation fails, collect another payment method and retry step 1.
```
