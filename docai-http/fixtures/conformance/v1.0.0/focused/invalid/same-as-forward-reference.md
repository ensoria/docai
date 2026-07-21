# invalid: same_as forward reference

Expected: invalid complete conformance. `**same_as**:` must reference an earlier representation in the same file, never a later representation.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | x-retrieval-unit: resource-file

## GET /users/{id}

### Response 200

**body_presence**: always

**same_as**: POST /users Response 201 application/json

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
````
