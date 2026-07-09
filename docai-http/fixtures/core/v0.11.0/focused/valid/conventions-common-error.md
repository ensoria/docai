# valid: conventions common error shape

Expected: valid common error table and matching shape block.

````markdown
## Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 401 | token_expired | standard-error | Access token has expired | Refresh once, then retry once |

**error_shape**: standard-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"token_expired","message":"access token expired"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Machine-readable code |
| error.message | string | always | no | Developer-facing message |

- Response Headers: none
````
