# invalid: same_as missing retrieval unit

Expected: invalid complete candidate. A producer that emits `**same_as**:` must make the intended retrieval unit discoverable to the intended reader or tool.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

## POST /users

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

## GET /users/{id}

### Response 200

**body_presence**: always

**same_as**: POST /users Response 201 application/json
````
