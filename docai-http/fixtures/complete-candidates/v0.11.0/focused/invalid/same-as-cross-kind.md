# invalid: same_as cross kind

Expected: invalid complete candidate. A request body representation must not use `**same_as**:` to reference a response body representation.

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

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

## PATCH /users/{id}

#### Body

**body_required**: yes

**same_as**: POST /users Response 201 application/json
````
