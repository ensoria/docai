> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: webhook-candidate-full-20260710-001 | projection_id: webhook-candidate-20260710-001 | source: fixtures/webhook-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-webhook-candidate-001 | x-fixture: webhook-candidate

# subscription.events

Sent when a subscription is updated or cancelled. Delivered as `POST` to the registered URL.

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
{"event":"subscription.cancelled","subscription_id":"sub_01K0HOOK","cancelled_at":"2026-07-10T03:05:00Z","reason":"customer_request","occurred_at":"2026-07-10T03:05:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| event | string | always | no | `subscription.cancelled` \| `subscription.updated`; this variant is `subscription.cancelled`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID returned by PATCH /subscriptions/{id} |
| cancelled_at | string | always | no | RFC 3339 timestamp for when cancellation became effective |
| reason | string | always | no | Machine-readable cancellation reason |
| occurred_at | string | always | no | RFC 3339 timestamp used with the composite deduplication strategy |

**variant**: event = subscription.updated

```json
{"event":"subscription.updated","subscription_id":"sub_01K0HOOK","plan":"pro","status":"active","occurred_at":"2026-07-10T03:04:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| event | string | always | no | `subscription.cancelled` \| `subscription.updated`; this variant is `subscription.updated`; deduplicate by composite (`event`, `subscription_id`, `occurred_at`) |
| subscription_id | string | always | no | Subscription ID returned by PATCH /subscriptions/{id} |
| plan | string | always | no | Current plan after the update |
| status | string | always | no | Always `active` |
| occurred_at | string | always | no | RFC 3339 timestamp used with the composite deduplication strategy |

## Related

- Triggered by: PATCH /subscriptions/{id}
