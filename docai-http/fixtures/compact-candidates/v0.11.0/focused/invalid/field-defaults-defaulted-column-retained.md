# invalid: field_defaults retained defaulted column

Expected: invalid compact candidate. A column named by `**field_defaults**:` must be omitted from the compact table.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPACT"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Presence | Meaning |
|---|---|---|---|
| id | string | always | User ID |
````
