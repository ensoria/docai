# invalid: webhook delivery deviation incomplete

Expected: invalid complete candidate. A webhook delivery deviation must state the complete event-specific receiver contract needed by the client, not only that it differs from the default.

````markdown
# payment.completed

Sent when a payment settles.

**deviation**: this event uses different retry and receiver handling than the default webhook delivery convention.

## Headers

none

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event_id":"evt_01K0COMPLETE","event":"payment.completed"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event_id | string | always | no | Unique event identifier. Deduplicate repeated delivery attempts by this field |
| event | string | always | no | Always `payment.completed` |

## Related

- Triggered by: POST /payments
````
