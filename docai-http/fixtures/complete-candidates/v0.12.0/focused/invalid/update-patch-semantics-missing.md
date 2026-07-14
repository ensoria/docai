# invalid: update patch semantics missing

Expected: invalid complete candidate. A PATCH endpoint must state merge semantics and non-updatable fields when it represents an update contract.

````markdown
## PATCH /users/{id}

Updates a user.

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"name":"Taro Yamada"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| name | string | no | no | User display name |
````
