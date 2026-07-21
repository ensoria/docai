# valid: tagged request body variants

Expected: valid complete conformance. Each tagged request variant has its own label, example, and complete applicable field table.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

**variant**: type = bank

```json
{"type":"bank","amount":1200,"currency":"JPY","bank_account_id":"ba_01K0COMPLETE"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; allowed values are `bank` \| `card`; this variant is `bank` |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | string | yes | no | Currency for `amount`; allowed values are `JPY` \| `USD` |
| bank_account_id | string | yes | no | Bank account token for this variant |

**variant**: type = card

```json
{"type":"card","amount":1200,"currency":"JPY","card_token":"card_01K0COMPLETE"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; allowed values are `bank` \| `card`; this variant is `card` |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | string | yes | no | Currency for `amount`; allowed values are `JPY` \| `USD` |
| card_token | string | yes | no | Card token for this variant |
````
