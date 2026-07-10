> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: webhook-candidate-full-20260710-001 | projection_id: webhook-candidate-20260710-001 | source: fixtures/webhook-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-webhook-candidate-001 | x-fixture: webhook-candidate

## POST /payments

Creates a pending payment.

### Behavior

- side_effects: creates a pending payment and may later trigger payment.completed delivery
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

```json
{"amount":1200}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| amount | int | yes | no | Amount in JPY; minimum 1 |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"payment_id":"pay_01K0HOOK","status":"pending"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| payment_id | string | always | no | Payment ID used by payment.completed |
| status | string | always | no | Always `pending` |

- Response Headers: none

### Errors

none

### Related

- Triggers webhook: webhooks/payment-completed.md

## PATCH /subscriptions/{id}

Updates or cancels a subscription.

### Behavior

- side_effects: updates subscription state and may later trigger subscription delivery
- idempotency: conditionally idempotent when the same request body is retried before the subscription changes again
- preconditions: the subscription exists
- authorization: authenticated merchant

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | Subscription ID, such as `sub_01K0HOOK` |

#### Query Parameters

none

#### Headers

none

#### Cookie Parameters

none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"plan":"pro","cancel":false}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| plan | string | no | no | New plan when updating the subscription |
| cancel | bool | no | no | Set to `true` to cancel the subscription |

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"subscription_id":"sub_01K0HOOK","status":"active"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| subscription_id | string | always | no | Updated subscription ID |
| status | string | always | no | `active` or `cancelled` |

- Response Headers: none

### Errors

none

### Related

- Triggers webhook: webhooks/subscription-events.md
