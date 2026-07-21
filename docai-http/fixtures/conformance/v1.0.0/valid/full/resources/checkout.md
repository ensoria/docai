> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc3-001 | projection_id: conformance-20260721-rc3-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001 | x-fixture: stable-conformance

## POST /carts/{id}/validate

Validates cart inventory before payment.

### Behavior

- side_effects: reserves no inventory; validates the current cart state
- idempotency: idempotent for the same cart version
- preconditions: the cart exists and contains at least one item
- authorization: authenticated shopper

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | Cart ID, such as `cart_01K0COMPLETE` |

#### Query Parameters

none

#### Headers

none

#### Cookie Parameters

none

#### Body

none

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"cart_id":"cart_01K0COMPLETE","status":"validated"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| cart_id | string | always | no | Validated cart ID |
| status | string | always | no | Always `validated` |

- Response Headers: none

### Errors

none

### Related

- Workflow: workflows/checkout.md
- Next endpoint: POST /payments

## POST /orders

Confirms an order from a validated cart and a payment that is pending or already settled.

### Behavior

- side_effects: creates an order; captures a pending payment once, or associates an already settled payment without capturing it again
- idempotency: safe to retry only with the same `Idempotency-Key`, `cart_id`, and `payment_id`; without a key, do not retry after an ambiguous outcome
- preconditions: POST /payments returned a `payment_id` for the validated cart; the payment may be pending or already settled by `payment.completed`
- authorization: authenticated shopper

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"cart_id":"cart_01K0COMPLETE","payment_id":"pay_01K0COMPLETE"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| cart_id | string | yes | no | Validated cart ID |
| payment_id | string | yes | no | Payment ID returned by POST /payments; may be pending or already settled |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"order_id":"ord_01K0COMPLETE","status":"confirmed"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| order_id | string | always | no | Confirmed order ID |
| status | string | always | no | Always `confirmed` |

- Response Headers: none

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | idempotency_conflict | common:standard-error | The `Idempotency-Key` was already used with a different request | Use the original `cart_id` and `payment_id` or a new key for a new logical operation; do not retry changed input with the same key |

### Related

- Workflow: workflows/checkout.md
- Previous endpoint: POST /payments
