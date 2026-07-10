# invalid: webhook payload uses Required column

Expected: invalid webhook candidate. Webhook payload field tables must use `Presence`, not request-body `Required`.

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

| Field | Type | Required | Nullable | Meaning |
|---|---|---|---|---|
| event_id | string | yes | no | Unique event identifier. Deduplicate repeated delivery attempts by this field |
| event | string | yes | no | Always `payment.completed` |

## Related

- Triggered by: POST /payments
````
