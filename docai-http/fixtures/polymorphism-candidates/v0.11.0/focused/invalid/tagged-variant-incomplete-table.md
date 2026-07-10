# invalid: tagged variant incomplete table

Expected: invalid polymorphism candidate. Every tagged variant table must repeat all common fields and include the variant-specific field.

````markdown
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
````
