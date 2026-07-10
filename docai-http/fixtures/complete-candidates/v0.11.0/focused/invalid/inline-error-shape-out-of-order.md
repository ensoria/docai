# invalid: inline error shape out of first-use order

Expected: invalid complete candidate. Inline error shapes must be defined after the table in first-use table-row order.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | cart_locked | inline:cart-conflict | Cart is locked by another checkout attempt | Wait for the lock to expire, then retry once |
| 423 | checkout_paused | inline:checkout-paused | Checkout is paused by risk review | Do not retry until the operator resumes checkout |

423 checkout_paused inline:checkout-paused:

**error_shape**: checkout-paused

none

- Response Headers: none

409 cart_locked inline:cart-conflict:

**error_shape**: cart-conflict

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"cart_locked","message":"cart is locked"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope |
| error.code | string | always | no | Always `cart_locked` |
| error.message | string | always | no | Developer-facing message |

- Response Headers: none
````
