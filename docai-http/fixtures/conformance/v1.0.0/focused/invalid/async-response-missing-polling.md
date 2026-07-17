# invalid: async response missing polling

Expected: invalid complete conformance. A `202 Accepted` response omits completion polling, timeout, and failure-time state.

````markdown
### Response 202

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"operation_id":"op_01K0COMPLETE","status_url":"/operations/op_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| operation_id | string | always | no | Async operation ID |
| status_url | string | always | no | Poll this endpoint for completion |

- Response Headers: none
````
