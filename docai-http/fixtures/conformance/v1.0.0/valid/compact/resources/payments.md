> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc2-001 | x-fixture: stable-conformance

## POST /payments

Creates a pending payment from one supported payment-method variant.

### Behavior

- side_effects: creates a pending payment and may later trigger payment.completed delivery
- idempotency: safe to retry only with the same `Idempotency-Key` and semantically identical request; without a key, do not retry after an ambiguous outcome
- preconditions: the cart is validated when this endpoint is used in the checkout workflow
- authorization: authenticated merchant or shopper

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

**variant**: type = bank

```json
{"type":"bank","cart_id":"cart_01K0COMPLETE","amount":1200,"currency":"JPY","bank_account_id":"ba_01K0COMPLETE"}
```

**field_defaults**: Required=yes | Nullable=no

| Field | Type | Constraints / Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| type | string | Discriminator; allowed values are `bank` \| `card`; this variant is `bank` |
| cart_id | string | Validated cart ID when called from checkout |
| amount | int | Amount in the minor unit of `currency`; minimum 1 |
| currency | string | Currency for `amount`; allowed values are `JPY` \| `USD` |
| bank_account_id | string | Bank account token for this variant |

**variant**: type = card

```json
{"type":"card","cart_id":"cart_01K0COMPLETE","amount":1200,"currency":"JPY","card_token":"card_01K0COMPLETE"}
```

**field_defaults**: Required=yes | Nullable=no

| Field | Type | Constraints / Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| type | string | Discriminator; allowed values are `bank` \| `card`; this variant is `card` |
| cart_id | string | Validated cart ID when called from checkout |
| amount | int | Amount in the minor unit of `currency`; minimum 1 |
| currency | string | Currency for `amount`; allowed values are `JPY` \| `USD` |
| card_token | string | Card token for this variant |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"payment_id":"pay_01K0COMPLETE","status":"pending"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| payment_id | string | Payment ID to pass to POST /orders and match with payment.completed |
| status | string | Payment status after creation; always `pending` |

- Response Headers: none

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | idempotency_conflict | common:standard-error | The `Idempotency-Key` was already used with a different request | Use the original request or a new key for a new logical operation; do not retry the changed request with the same key |

### Related

- Workflow: workflows/checkout.md
- Triggers webhook: webhooks/payment-completed.md
- Previous workflow endpoint: POST /carts/{id}/validate
- Next workflow endpoint: POST /orders
