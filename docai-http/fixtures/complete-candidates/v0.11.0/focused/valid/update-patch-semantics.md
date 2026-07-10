# valid: update patch semantics

Expected: valid complete candidate. A PATCH endpoint states merge semantics and identifies non-updatable fields before the request field table.

````markdown
## PATCH /users/{id}

Updates mutable user fields.

### Request

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"name":"Taro Yamada"}
```

This request uses JSON Merge Patch semantics: omitted fields are unchanged. `id`, `created_at`, and `email_verified` are non-updatable and must not be sent.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| name | string | no | no | New display name; omit to leave unchanged |
| role | string | no | no | `admin` \| `member`; omit to leave unchanged |
````
