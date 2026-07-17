# invalid: mixed default invents response body

Expected: invalid complete conformance. A mixed error/non-error source default that cannot be split faithfully must not invent response or error body details; it must use the paired replacement markers.

````markdown
### Response 200

none

- Response Headers: none

### Response default

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"imp_01K0COMPLETE","status":"queued"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Import ID |
| status | string | always | no | Guessed non-error state for the source default |

- Response Headers: none

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| default | import_failed | inline:default-error | Guessed error branch for the source default | Retry after checking import status |
````
