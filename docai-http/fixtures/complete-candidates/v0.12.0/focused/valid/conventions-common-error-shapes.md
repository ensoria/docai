# valid: CONVENTIONS common error shapes

Expected: valid complete candidate. A common error table maps rows to a common shape, and the shape contains body markers, a representation, a field table, and response headers.

````markdown
# API Conventions

## Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 401 | token_expired | auth-error | Access token has expired | Refresh once, then retry once |

**error_shape**: auth-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"token_expired","message":"access token expired"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Machine-readable error code |
| error.message | string | always | no | Developer-facing message |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| WWW-Authenticate | string | always | Authentication challenge for refreshing credentials |

## Validation Errors

none
````
