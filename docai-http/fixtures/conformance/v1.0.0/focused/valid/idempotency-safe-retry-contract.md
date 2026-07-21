# valid: idempotency safe retry contract

Expected: valid complete conformance. Safe create-operation retries name the wire header, replay identity, retention, conflict behavior, and no-key ambiguous-outcome rule.

````markdown
## HTTP Semantics

POST /payments accepts `Idempotency-Key` as an opaque, operation-unique string of 1-128 visible ASCII characters. The server retains it for at least 24 hours. Replaying a semantically identical request with the same key returns the original status, body, and headers without repeating the side effect. Reusing the key with changed content returns `409 idempotency_conflict`; do not retry changed content with that key. Without a key, do not retry after an ambiguous outcome.

## POST /payments

### Behavior

- side_effects: creates a pending payment
- idempotency: safe to retry only with the same `Idempotency-Key` and semantically identical request; without a key, do not retry after an ambiguous outcome
- preconditions: cart is validated
- authorization: authenticated shopper

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | idempotency_conflict | common:standard-error | The key was used with changed content | Use the original request or a new key for a new logical operation; do not retry changed content with the same key |
````

