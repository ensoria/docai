# valid: unknown and coverage state

Expected: valid complete candidate. Unknown facts set `knowledge: requires-input`; unsupported facts set `coverage: requires-source`; both states can coexist.

````markdown
> docai-http: 0.12.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: unknown

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

#### Response Headers

**unsupported**: replaces Response Headers: response includes dynamic caller-relevant `X-Audit-*` headers that cannot be enumerated at fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml#/paths/~1users~1{id}/get/responses/200/headers

**unknown**: response body presence is not documented; requires service-owner response contract for GET /users/{id}
````
