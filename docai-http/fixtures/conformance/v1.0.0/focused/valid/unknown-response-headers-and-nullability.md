# valid: unknown response headers and body nullability

Expected: valid complete conformance. Unknown body nullability and unknown response headers use the canonical `unknown` placement and marker.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: unknown

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

#### Response Headers

unknown

**unknown**: response body nullability and caller-relevant response headers are not documented; requires service-owner response contract for GET /users/{id}
````
