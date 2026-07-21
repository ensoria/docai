# invalid: safe retry without idempotency wire contract

Expected: invalid complete conformance. Naming an unspecified idempotency key does not define a safe retry contract.

````markdown
## POST /payments

### Behavior

- side_effects: creates a pending payment
- idempotency: safe to retry with an idempotency key
- preconditions: cart is validated
- authorization: authenticated shopper

### Errors

none
````

