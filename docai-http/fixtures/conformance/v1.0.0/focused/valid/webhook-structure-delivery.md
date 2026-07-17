# valid: webhook structure, delivery, and trigger references

Expected: valid complete conformance. A webhook is listed in INDEX, has a matching title, fixed sections, event-specific header wire rules, a complete delivery deviation, a safe deduplication key, and a triggering endpoint reference.

````markdown
# API Index

## Endpoints

### resources/payments.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /payments | create payment | Creates a pending payment and later triggers settlement notification. | webhooks/payment-completed.md |

## Workflows

none

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles. | webhooks/payment-completed.md |

---

## POST /payments

Creates a pending payment.

### Related

- Triggers webhook: webhooks/payment-completed.md

---

# payment.completed

Sent when a payment settles. Delivered as `POST` to the registered URL.

**deviation**: delivery of this event is retried for up to 24 hours with exponential backoff; receivers must return any 2xx status within 5 seconds; delivery remains at-least-once and unordered; deduplicate repeated delivery attempts by `event_id`.

## Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| X-Payment-Attempt | yes | string | Single field line only; not comma-combinable; order not significant; example `X-Payment-Attempt: 1` |

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event_id":"evt_01K0COMPLETE","event":"payment.completed","payment_id":"pay_01K0COMPLETE","amount":1200,"occurred_at":"2026-07-10T03:05:00Z"}
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
````
