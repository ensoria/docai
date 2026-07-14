# invalid: inline error label mismatch

Expected: invalid complete candidate. The label after `inline:` in the table must exactly match the block's `**error_shape**:` value.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | cart_locked | inline:cart-conflict | Cart is locked by another checkout attempt | Wait for the lock to expire, then retry once |

409 cart_locked inline:cart-conflict:

**error_shape**: stale-cart

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
