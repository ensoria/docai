# valid: unknown media type

Expected: valid complete conformance. `**media_type**: unknown` is used only when a body representation exists but the concrete media type is absent from authoritative inputs.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-10 | generation_id: conformance-full-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: always

**media_type**: unknown

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none

**unknown**: concrete response media type is not documented; requires source response content entry for GET /users/{id} 200
````
