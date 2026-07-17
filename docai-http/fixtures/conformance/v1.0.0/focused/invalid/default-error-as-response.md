# invalid: default error emitted as response

Expected: invalid complete conformance. A source `default` response with exclusively error semantics belongs in `### Errors` as a `default` row, not as `### Response default`.

````markdown
### Response 200

none

- Response Headers: none

### Response default

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"job_failed","message":"job failed"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Machine-readable error code |
| error.message | string | always | no | Developer-facing message |

- Response Headers: none

### Errors

none
````
