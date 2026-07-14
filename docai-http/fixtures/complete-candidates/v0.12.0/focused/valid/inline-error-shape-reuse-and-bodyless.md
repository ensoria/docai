# valid: inline error shape reuse and body-less inline shape

Expected: valid complete candidate. Inline error shapes are defined once in first-use order; multiple rows may reuse an identical inline shape, and a body-less inline shape writes `none` directly after `**error_shape**:`.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | cart_locked | inline:cart-conflict | Cart is locked by another checkout attempt | Wait for the lock to expire, then retry once |
| 409 | cart_version_conflict | inline:cart-conflict | Cart version is stale | Reload the cart before retrying |
| 423 | checkout_paused | inline:checkout-paused | Checkout is paused by risk review | Do not retry until the operator resumes checkout |

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
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | One of `cart_locked` or `cart_version_conflict` |
| error.message | string | always | no | Developer-facing message; do not display directly to users |

- Response Headers: none

423 checkout_paused inline:checkout-paused:

**error_shape**: checkout-paused

none

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Retry-After | int | always | Seconds before the caller may check the paused checkout again |
````
