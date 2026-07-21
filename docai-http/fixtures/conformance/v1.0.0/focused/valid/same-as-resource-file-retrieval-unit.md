# valid: same_as with resource-file retrieval unit

Expected: valid complete conformance. The compact resource file declares `x-retrieval-unit: resource-file`, defines the response body first, and later uses `**same_as**:` as a same-kind backward reference inside the same file.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc3-001 | projection_id: conformance-20260721-rc3-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | x-retrieval-unit: resource-file

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
