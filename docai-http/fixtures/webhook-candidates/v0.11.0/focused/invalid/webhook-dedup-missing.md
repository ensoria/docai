# invalid: webhook payload missing deduplication guidance

Expected: invalid webhook candidate. A webhook payload must identify a unique deduplication key or composite strategy.

````markdown
# payment.completed

Sent when a payment settles.

## Headers

none

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event_id":"evt_01K0HOOK","event":"payment.completed"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event_id | string | always | no | Unique event identifier |
| event | string | always | no | Always `payment.completed` |

## Related

- Triggered by: POST /payments
````
