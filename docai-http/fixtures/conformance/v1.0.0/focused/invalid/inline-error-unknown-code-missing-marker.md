# invalid: inline error unknown code missing marker

Expected: invalid complete conformance. A row with `code=unknown` must carry the required `**unknown**:` marker.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | unknown | inline:payment-conflict | Payment conflict code is not documented | Fetch payment state before retrying |

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
