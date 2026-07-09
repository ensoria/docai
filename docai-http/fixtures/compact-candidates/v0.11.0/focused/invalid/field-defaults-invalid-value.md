# invalid: field_defaults invalid value

Expected: invalid compact candidate. Valid defaults are only `Required=yes|no`, `Presence=always`, `Nullable=yes|no`, and `Meaning=none`.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPACT"}
```

**field_defaults**: Presence=conditional | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| id | string | User ID |
````
