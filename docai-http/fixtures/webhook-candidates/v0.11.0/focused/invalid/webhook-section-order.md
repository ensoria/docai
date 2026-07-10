# invalid: webhook section order

Expected: invalid webhook candidate. Webhook sections must appear in the fixed order.

````markdown
# payment.completed

Sent when a payment settles.

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event_id":"evt_01K0HOOK","event":"payment.completed"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event_id | string | always | no | Unique event identifier. Deduplicate repeated delivery attempts by this field |
| event | string | always | no | Always `payment.completed` |

## Headers

none

## Related

- Triggered by: POST /payments
````
