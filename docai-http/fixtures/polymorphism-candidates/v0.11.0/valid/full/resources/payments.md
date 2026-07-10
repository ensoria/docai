> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: polymorphism-candidate-full-20260710-001 | projection_id: polymorphism-candidate-20260710-001 | source: fixtures/polymorphism-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-polymorphism-candidate-001 | x-fixture: polymorphism-candidate

## GET /payment-methods/{id}

Gets one payment method. The response body is polymorphic without a discriminator field.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: payment method exists
- authorization: authenticated merchant

### Request

#### Path Parameters

| Name | Type | Required | Meaning |
|---|---|---|---|
| id | string | yes | Payment method ID |

- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

none

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

**variant**: bank account method

Use this variant when the response has `bank_account_id`. This variant never has `card_last4`.

```json
{"id":"pm_01K0UNTAGBANK","label":"Primary bank account","bank_account_id":"ba_01K0UNTAG"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | Payment method ID |
| label | string | always | no | Merchant-visible payment method label |
| bank_account_id | string | always | no | Present only for the bank account method variant |

**variant**: card method

Use this variant when the response has `card_last4`. This variant never has `bank_account_id`.

```json
{"id":"pm_01K0UNTAGCARD","label":"Primary card","card_last4":"4242"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | Payment method ID |
| label | string | always | no | Merchant-visible payment method label |
| card_last4 | string | always | no | Present only for the card method variant |

- Response Headers: none

### Errors

none

### Related

none

## POST /payments

Creates a payment from one of the supported tagged request variants.

### Behavior

- side_effects: creates a pending payment
- idempotency: not idempotent without an idempotency key outside this fixture
- preconditions: none
- authorization: authenticated merchant

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
{"type":"bank","amount":1200,"currency":"JPY","bank_account_id":"ba_01K0VAR"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; allowed values are `bank` \| `card`; this variant is `bank` |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | enum(JPY, USD) | yes | no | Currency for `amount` |
| bank_account_id | string | yes | no | Bank account token for this variant |

**variant**: type = card

```json
{"type":"card","amount":1200,"currency":"JPY","card_token":"card_01K0VAR"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; allowed values are `bank` \| `card`; this variant is `card` |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | enum(JPY, USD) | yes | no | Currency for `amount` |
| card_token | string | yes | no | Card token for this variant |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"payment_id":"pay_01K0VAR","status":"pending"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| payment_id | string | always | no | Created payment ID |
| status | enum(pending) | always | no | Payment status after creation |

- Response Headers: none

### Errors

none

### Related

none
