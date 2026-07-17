# valid: field_defaults measured-savings producer assertion

Expected: valid complete conformance. A compact table may use `field_defaults` when the producer has measurement evidence or a producer assertion; the fixture exposes tokenizer metadata as ignorable `x-` routing evidence.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: conformance-compact-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | x-tokenizer: o200k_base | x-tokens: 142

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","email":"ada@example.test","name":"Ada"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| id | string | User ID |
| email | string | Email address |
| name | string | Display name |
````
