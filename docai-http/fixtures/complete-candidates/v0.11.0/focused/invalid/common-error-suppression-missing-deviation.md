# invalid: common error suppression missing deviation

Expected: invalid complete candidate. Endpoint-specific suppression of otherwise common error handling must be marked with `**deviation**:`.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | payment_pending | common:standard-error | Payment is still pending | Keep `cart_id` and `payment_id`; retry POST /orders after payment status changes |

500 server errors are intentionally omitted for this endpoint because clients must fetch order state before retrying.
````
