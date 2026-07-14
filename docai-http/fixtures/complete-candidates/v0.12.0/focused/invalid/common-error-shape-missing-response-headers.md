# invalid: common error shape missing response headers

Expected: invalid complete candidate. A represented common error shape must end with a response-header table or `- Response Headers: none`.

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

## Validation Errors

none
````
