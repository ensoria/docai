# valid: compact error shape client-visible fields

Expected: valid complete candidate. A compact inline error shape uses `Client-visible fields` and `Opaque fields` after the example, preserving caller-visible error fields while reducing opaque detail.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | payment_conflict | inline:payment-conflict | Payment state changed before capture | Fetch the payment state before retrying |

409 payment_conflict inline:payment-conflict:

**error_shape**: payment-conflict

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"payment_conflict","message":"Payment already captured","details":{"processor_trace":"opaque-store-forward"}}}
```

#### Client-visible fields

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| error | object | Error envelope |
| error.code | string | Stable error code |
| error.message | string | Developer-facing message |

#### Opaque fields

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| error.details | object | Store or forward only; source annotation `x-docai-opaque` |

- Response Headers: none
````
