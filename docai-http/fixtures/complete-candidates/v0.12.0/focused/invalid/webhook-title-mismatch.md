# invalid: webhook title mismatch

Expected: invalid complete candidate. The webhook title should match the INDEX `Name` cell unless the INDEX name is only a shorter retrieval label.

````markdown
# API Index

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles. | webhooks/payment-completed.md |

---

# payment.settled

Sent when a payment settles.

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
