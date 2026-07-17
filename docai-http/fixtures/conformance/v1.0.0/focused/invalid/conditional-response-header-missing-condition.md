# invalid: conditional response header missing condition

Expected: invalid complete conformance. A response header presence value is conditional but lacks the exact condition.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"exp_01K0COMPLETE","status":"processing"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Export ID |
| status | string | always | no | `processing` or `ready` |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Retry-After | string | conditional | Seconds to wait before polling again |
````
