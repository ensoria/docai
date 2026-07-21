# invalid: field_defaults savings unjustified

Expected: invalid complete conformance. A producer must not emit `field_defaults` when the marker does not reduce measured tokens for that table.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | x-tokenizer: o200k_base | x-tokens: 91

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
