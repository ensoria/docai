# invalid: untagged variant incomplete table

Expected: invalid complete conformance. Every untagged variant table must include the complete common and variant-specific fields for that alternative.

````markdown
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
````
