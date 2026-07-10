> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: webhook-candidate-full-20260710-001 | projection_id: webhook-candidate-20260710-001 | source: fixtures/webhook-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-webhook-candidate-001 | x-fixture: webhook-candidate

# payment.completed

Sent when a payment settles. Delivered as `POST` to the registered URL.

**deviation**: delivery of this event is retried for up to 24 hours with exponential backoff; receivers must still return any 2xx status within 5 seconds, and deliveries remain at-least-once and unordered.

## Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| X-Payment-Attempt | yes | string | Single field line only; not comma-combinable; order not significant; example `X-Payment-Attempt: 1` |

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event_id":"evt_01K0HOOK","event":"payment.completed","payment_id":"pay_01K0HOOK","amount":1200,"occurred_at":"2026-07-10T03:00:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| event_id | string | always | no | Unique event identifier. Deduplicate repeated delivery attempts by this field |
| event | string | always | no | Always `payment.completed` |
| payment_id | string | always | no | Payment ID returned by POST /payments |
| amount | int | always | no | Settled amount in JPY |
| occurred_at | string | always | no | RFC 3339 timestamp for when the payment settled |

## Related

- Triggered by: POST /payments
