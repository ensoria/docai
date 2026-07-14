# valid: inline error label with unknown code

Expected: valid complete candidate. A row with `code=unknown` may use an inline error label whose code token is the sentinel `unknown` when the row has the required `**unknown**:` marker.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | unknown | inline:payment-conflict | Payment conflict code is not documented | Fetch payment state before retrying |

**unknown**: error code for payment conflict is not documented; requires service-owner error catalog for POST /payments

409 unknown inline:payment-conflict:

**error_shape**: payment-conflict

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"message":"payment conflict"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.message | string | always | no | Developer-facing message |

- Response Headers: none
````
