# valid: untagged and overlapping polymorphic variants

Expected: valid complete candidate. Untagged alternatives use stable variant labels and selection prose; overlapping alternatives document combination semantics and include a combined variant.

````markdown
## GET /payment-methods/{id}

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

## GET /customers/{id}/signals

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

The `high_value` and `churn_risk` alternatives can both be valid for the same customer. Use `both signals` for the combined case; do not treat these variants as mutually exclusive.

**variant**: both signals

Use this variant when the response has both `high_value` and `churn_risk`.

```json
{"customer_id":"cus_01K0COMBO","high_value":true,"lifetime_value":500000,"churn_risk":true,"churn_probability":0.82}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| customer_id | string | always | no | Customer ID |
| high_value | bool | always | no | Always `true`; high-value signal is present |
| lifetime_value | int | always | no | Lifetime value in JPY |
| churn_risk | bool | always | no | Always `true`; churn-risk signal is present |
| churn_probability | float | always | no | Churn probability from 0 to 1 |

**variant**: churn risk signal

Use this variant when the response has `churn_risk` and does not have `high_value`.

```json
{"customer_id":"cus_01K0CHURN","churn_risk":true,"churn_probability":0.82}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| customer_id | string | always | no | Customer ID |
| churn_risk | bool | always | no | Always `true`; churn-risk signal is present |
| churn_probability | float | always | no | Churn probability from 0 to 1 |

**variant**: high value signal

Use this variant when the response has `high_value` and does not have `churn_risk`.

```json
{"customer_id":"cus_01K0VALUE","high_value":true,"lifetime_value":500000}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| customer_id | string | always | no | Customer ID |
| high_value | bool | always | no | Always `true`; high-value signal is present |
| lifetime_value | int | always | no | Lifetime value in JPY |

- Response Headers: none
````
