# invalid: grouped webhook unlabeled payload table

Expected: invalid webhook candidate. Grouped webhook payload differences must use variant blocks, not an unlabeled common table.

````markdown
# subscription.events

Sent when a subscription changes.

## Headers

none

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | `subscription.cancelled` \| `subscription.updated`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID |
| occurred_at | string | always | no | Composite deduplication timestamp |

**variant**: event = subscription.cancelled

```json
{"event":"subscription.cancelled","subscription_id":"sub_01K0HOOK","occurred_at":"2026-07-10T03:05:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | `subscription.cancelled` \| `subscription.updated`; this variant is `subscription.cancelled`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID |
| occurred_at | string | always | no | Composite deduplication timestamp |

**variant**: event = subscription.updated

```json
{"event":"subscription.updated","subscription_id":"sub_01K0HOOK","occurred_at":"2026-07-10T03:04:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | `subscription.cancelled` \| `subscription.updated`; this variant is `subscription.updated`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID |
| occurred_at | string | always | no | Composite deduplication timestamp |

## Related

- Triggered by: PATCH /subscriptions/{id}
````
