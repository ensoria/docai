# invalid: workflow step missing passed values

Expected: invalid workflow candidate. Each workflow step must describe values passed or retained.

```markdown
# Checkout

Validates payment and creates an order.

## Preconditions

- The cart exists.

## Steps

1. POST /payments - Create a pending payment. If payment creation fails, collect another payment method before retrying this step.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.validated | POST /payments succeeds | payment.pending |

## Failure and Recovery

- If payment creation fails, collect another payment method and retry step 1.
```
