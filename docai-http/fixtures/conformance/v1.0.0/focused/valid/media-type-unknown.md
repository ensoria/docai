# valid: unknown media type

Expected: valid complete conformance. `**media_type**: unknown` is used only when a body representation exists but the concrete media type is absent from authoritative inputs.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-002 | projection_id: conformance-20260721-rc2-002 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

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
