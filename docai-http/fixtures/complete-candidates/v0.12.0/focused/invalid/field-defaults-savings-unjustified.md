# invalid: field_defaults savings unjustified

Expected: invalid complete candidate. A producer must not emit `field_defaults` when the marker does not reduce measured tokens for that table.

````markdown
> docai-http: 0.12.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | x-tokenizer: o200k_base | x-tokens: 91

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

Measured with `o200k_base`: this table still uses `**field_defaults**:` even though repeating `Presence` and `Nullable` would be smaller for this single-row table.

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| id | string | User ID |
````
