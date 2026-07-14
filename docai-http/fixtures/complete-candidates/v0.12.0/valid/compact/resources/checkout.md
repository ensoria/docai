> docai-http: 0.12.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-complete-candidate-001 | x-fixture: complete-candidate

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

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| cart_id | string | Validated cart ID |
| status | string | Always `validated` |

- Response Headers: none

### Errors

none

### Related

- Workflow: workflows/checkout.md
- Next endpoint: POST /payments

## POST /orders

Confirms an order from a validated cart and pending payment.

### Behavior

- side_effects: creates an order and captures the pending payment
- idempotency: not idempotent unless the same cart and payment are submitted with an idempotency key outside this fixture
- preconditions: POST /payments returned a pending `payment_id`
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

**field_defaults**: Required=yes | Nullable=no

| Field | Type | Constraints / Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| cart_id | string | Validated cart ID |
| payment_id | string | Pending payment ID returned by POST /payments |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"order_id":"ord_01K0COMPLETE","status":"confirmed"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| order_id | string | Confirmed order ID |
| status | string | Always `confirmed` |

- Response Headers: none

### Errors

none

### Related

- Workflow: workflows/checkout.md
- Previous endpoint: POST /payments
