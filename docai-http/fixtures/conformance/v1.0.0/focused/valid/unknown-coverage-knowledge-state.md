# valid: unknown and coverage state

Expected: valid complete conformance. Unknown facts set `knowledge: requires-input`; unsupported facts set `coverage: requires-source`; both states can coexist.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

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

**unsupported**: replaces Response Headers: response includes dynamic caller-relevant `X-Audit-*` headers that cannot be enumerated at fixtures/conformance/v1.0.0/source/complete-openapi.yaml#/paths/~1users~1{id}/get/responses/200/headers

**unknown**: response body presence is not documented; requires service-owner response contract for GET /users/{id}
````
