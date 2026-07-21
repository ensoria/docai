> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc3-001 | projection_id: conformance-20260721-rc3-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001 | x-fixture: stable-conformance

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
{"event_id":"evt_01K0COMPLETE","event":"payment.completed","payment_id":"pay_01K0COMPLETE","amount":1200,"occurred_at":"2026-07-10T03:05:00Z","metadata":{"processor_trace":"opaque-store-forward"}}
```

#### Client-visible fields

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| event_id | string | Unique event identifier. Deduplicate repeated delivery attempts by this field |
| event | string | Always `payment.completed` |
| payment_id | string | Payment ID returned by POST /payments |
| amount | int | Settled amount in JPY |
| occurred_at | string | RFC 3339 timestamp for when the payment settled |

#### Opaque fields

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| metadata | object | Store or forward only; source annotation `x-docai-opaque` |

## Related

- Triggered by: POST /payments
- Used by workflow: workflows/checkout.md
