# invalid: generated example violates machine-verifiable source constraint

Expected: invalid complete candidate. The `**unknown**:` marker covers missing credible example values; it does not permit violating machine-verifiable source constraints such as enum values or numeric minima.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"type":"card","cart_id":"cart_illustrative","amount":0,"currency":"EUR","card_token":"card_illustrative"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; this variant is `card` |
| cart_id | string | yes | no | Existing cart identifier accepted by the payment service |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | enum(JPY, USD) | yes | no | Currency for `amount` |
| card_token | string | yes | no | Card token accepted by the payment service |

**unknown**: valid example values require seeded cart and card-token fixtures or a source validator for fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml#/paths/~1payments/post/requestBody; `cart_id` and `card_token` values above are structurally illustrative only
````
