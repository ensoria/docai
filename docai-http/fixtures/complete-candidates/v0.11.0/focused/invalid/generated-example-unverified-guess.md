# invalid: generated example presents unverified values as authoritative

Expected: invalid complete candidate. A generator-created example that lacks credible source-backed values must not be emitted as if it were verified; it needs the representation-level `**unknown**:` marker and `knowledge: requires-input`.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"type":"card","cart_id":"cart_illustrative","amount":1200,"currency":"JPY","card_token":"card_illustrative"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| type | string | yes | no | Discriminator; this variant is `card` |
| cart_id | string | yes | no | Existing cart identifier accepted by the payment service |
| amount | int | yes | no | Amount in the minor unit of `currency`; minimum 1 |
| currency | enum(JPY, USD) | yes | no | Currency for `amount` |
| card_token | string | yes | no | Card token accepted by the payment service |
````
