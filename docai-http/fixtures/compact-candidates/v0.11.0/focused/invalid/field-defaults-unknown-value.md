# invalid: field_defaults unknown value

Expected: invalid compact candidate. A compact table must not use `**field_defaults**:` for a column that contains any `unknown` value.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: requires-input | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPACT"}
```

**field_defaults**: Presence=unknown | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| id | string | User ID |

**unknown**: field presence is not documented; requires service-owner response contract.
````
