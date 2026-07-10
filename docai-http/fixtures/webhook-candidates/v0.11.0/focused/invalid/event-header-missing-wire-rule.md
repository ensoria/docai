# invalid: event-specific header missing wire rule

Expected: invalid webhook candidate. Event-specific webhook headers must follow request-header rules and state field-line, comma-combination, order, and example semantics.

````markdown
# payment.completed

Sent when a payment settles.

## Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| X-Payment-Attempt | yes | string | Attempt number |

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

## Related

- Triggered by: POST /payments
````
