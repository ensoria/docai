# valid: redirect and async responses

Expected: valid complete candidate. Redirect responses document `Location`, and async acceptance states polling, timeout, and failure-time state.

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

Poll `status_url` every 2 seconds for up to 60 seconds. If the operation later fails, the original upload may have partially stored bytes and the client must restart the upload with a new idempotency key.

### Response 302

none

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Location | string | always | Signed download URL; client must read and follow this URL manually |

Clients must not rely on automatic redirect following because the signed URL must be logged with the download attempt.
````
