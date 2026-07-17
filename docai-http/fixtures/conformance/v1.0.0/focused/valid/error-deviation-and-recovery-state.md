# valid: error deviation and recovery state

Expected: valid complete conformance. Endpoint-specific common-error handling differences are marked with `**deviation**:`, and error-time state that affects recovery is stated in caller action.

````markdown
### Errors

**deviation**: POST /orders suppresses the common `500 server_error` retry guidance; after capture starts, clients must first fetch order state before retrying.

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | payment_pending | common:standard-error | Payment is still pending | Keep `cart_id` and `payment_id`; retry POST /orders after payment status changes |
| 500 | capture_state_unknown | inline:capture-state | Capture state is unknown after a server failure | Fetch the order by client reference before retrying; do not create a second order until state is known |

500 capture_state_unknown inline:capture-state:

**error_shape**: capture-state

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"capture_state_unknown","message":"capture state is unknown"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Always `capture_state_unknown` |
| error.message | string | always | no | Developer-facing message |

- Response Headers: none
````
