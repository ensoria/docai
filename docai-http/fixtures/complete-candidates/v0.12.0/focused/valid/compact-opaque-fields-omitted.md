# valid: compact opaque fields omitted when no opaque root exists

Expected: valid complete candidate. A compact response with no opaque root field omits the `Opaque fields` heading entirely.

````markdown
> docai-http: 0.12.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","email":"ada@example.test","role":"member"}
```

#### Client-visible fields

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| id | string | User ID |
| email | string | Email address |
| role | string | `admin` \| `member` |
````
