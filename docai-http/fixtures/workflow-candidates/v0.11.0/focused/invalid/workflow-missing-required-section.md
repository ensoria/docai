# invalid: workflow missing required section

Expected: invalid workflow candidate. Workflow files must include all four fixed sections.

```markdown
# Checkout

Validates payment and creates an order.

## Preconditions

- The cart exists.

## Steps

1. POST /payments - Pass `cart_id`. Keep the returned `payment_id`. If payment creation fails, collect another payment method before retrying this step.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.validated | POST /payments succeeds | payment.pending |
```
