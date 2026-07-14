# valid: grouped webhook payload variants

Expected: valid complete candidate. A grouped webhook uses payload variants when grouped events have different payload fields but share compatible delivery and receiver rules.

````markdown
# subscription.events

Sent when a subscription changes.

## Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| X-Subscription-Event-Version | yes | string | Single field line only; not comma-combinable; order not significant; example `X-Subscription-Event-Version: 2026-07-10` |

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

**variant**: event = subscription.cancelled

```json
{"event":"subscription.cancelled","subscription_id":"sub_01K0COMPLETE","cancelled_at":"2026-07-10T03:05:00Z","reason":"customer_request","occurred_at":"2026-07-10T03:05:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | Always `subscription.cancelled`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID |
| cancelled_at | string | always | no | RFC 3339 cancellation timestamp |
| reason | string | always | no | Cancellation reason |
| occurred_at | string | always | no | Composite deduplication timestamp |

**variant**: event = subscription.updated

```json
{"event":"subscription.updated","subscription_id":"sub_01K0COMPLETE","plan":"pro","status":"active","occurred_at":"2026-07-10T03:04:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | Always `subscription.updated`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID |
| plan | string | always | no | New plan |
| status | string | always | no | New subscription status |
| occurred_at | string | always | no | Composite deduplication timestamp |

## Related

- Triggered by: PATCH /subscriptions/{id}
````
