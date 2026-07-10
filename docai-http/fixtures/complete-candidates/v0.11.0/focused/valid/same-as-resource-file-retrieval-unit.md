# valid: same_as with resource-file retrieval unit

Expected: valid complete candidate. The compact resource file declares `x-retrieval-unit: resource-file`, defines the response body first, and later uses `**same_as**:` as a same-kind backward reference inside the same file.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | x-retrieval-unit: resource-file

## POST /users

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| id | string | User ID |

## GET /users/{id}

### Response 200

**body_presence**: always

**same_as**: POST /users Response 201 application/json
````
