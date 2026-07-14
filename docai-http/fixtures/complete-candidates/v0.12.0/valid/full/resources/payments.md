> docai-http: 0.12.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-complete-candidate-001 | x-fixture: complete-candidate

## POST /payments

Creates a pending payment from one supported payment-method variant.

### Behavior

- side_effects: creates a pending payment and may later trigger payment.completed delivery
- idempotency: not idempotent without an idempotency key outside this fixture
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

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; allowed values are `bank` \| `card`; this variant is `bank` |
| cart_id | string | yes | no | Validated cart ID when called from checkout |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | enum(JPY, USD) | yes | no | Currency for `amount` |
| bank_account_id | string | yes | no | Bank account token for this variant |

**variant**: type = card

```json
{"type":"card","cart_id":"cart_01K0COMPLETE","amount":1200,"currency":"JPY","card_token":"card_01K0COMPLETE"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; allowed values are `bank` \| `card`; this variant is `card` |
| cart_id | string | yes | no | Validated cart ID when called from checkout |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | enum(JPY, USD) | yes | no | Currency for `amount` |
| card_token | string | yes | no | Card token for this variant |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"payment_id":"pay_01K0COMPLETE","status":"pending"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| payment_id | string | always | no | Payment ID to pass to POST /orders and match with payment.completed |
| status | enum(pending) | always | no | Payment status after creation |

- Response Headers: none

### Errors

none

### Related

- Workflow: workflows/checkout.md
- Triggers webhook: webhooks/payment-completed.md
- Previous workflow endpoint: POST /carts/{id}/validate
- Next workflow endpoint: POST /orders
