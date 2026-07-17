# invalid: polymorphic unlabeled common table

Expected: invalid complete conformance. Polymorphic representations must not use an unlabeled common field table before variant blocks.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Common discriminator field |
| amount | int | yes | no | Common amount field |
| currency | enum(JPY, USD) | yes | no | Common currency field |

**variant**: type = bank

```json
{"type":"bank","amount":1200,"currency":"JPY","bank_account_id":"ba_01K0COMPLETE"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; allowed values are `bank` \| `card`; this variant is `bank` |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | enum(JPY, USD) | yes | no | Currency for `amount` |
| bank_account_id | string | yes | no | Bank account token for this variant |
````
