# invalid: grouped webhook incompatible trigger

Expected: invalid complete candidate. A grouped webhook cannot merge events with different triggering endpoint references that cannot be represented as one shared related trigger.

````markdown
# subscription.events

Sent when a subscription changes.

## Headers

none

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

**variant**: event = subscription.cancelled

```json
{"event":"subscription.cancelled","subscription_id":"sub_01K0COMPLETE","occurred_at":"2026-07-10T03:05:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | `subscription.cancelled` \| `subscription.updated`; this variant is `subscription.cancelled`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID |
| occurred_at | string | always | no | Composite deduplication timestamp |

**variant**: event = subscription.updated

```json
{"event":"subscription.updated","subscription_id":"sub_01K0COMPLETE","occurred_at":"2026-07-10T03:04:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | `subscription.cancelled` \| `subscription.updated`; this variant is `subscription.updated`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID |
| occurred_at | string | always | no | Composite deduplication timestamp |

## Related

- Triggered by: DELETE /subscriptions/{id} for `subscription.cancelled`
- Triggered by: PATCH /subscriptions/{id} for `subscription.updated`
````
