# valid: table-cell unknown values

Expected: valid complete conformance. `Required`, `Type`, `Presence`, and `Nullable` unknown cells carry required unknown markers, and compact defaults are not used for affected columns.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com","metadata":{"tier":"gold"}}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | unknown | no | User email |
| metadata | unknown | no | unknown | Optional source metadata |

**unknown**: request field requiredness for `email`, type for `metadata`, and nullability for `metadata` are absent from authoritative input; requires source schema for POST /users request body

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","display_name":"Taro Yamada","metadata":{"tier":"gold"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |
| display_name | string | unknown | no | Display name |
| metadata | unknown | present when source metadata exists | unknown | Optional metadata |

- Response Headers: none

**unknown**: response field presence for `display_name`, type for `metadata`, and nullability for `metadata` are absent from authoritative input; requires source schema for GET /users/{id} response 200
````
