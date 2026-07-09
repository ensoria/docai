# invalid: body marker order

Expected: invalid. `body_presence` must appear before `media_type`.

````markdown
### Response 200

**media_type**: application/json

**body_presence**: always

**body_nullable**: no

```json
{"id":"usr_01J0CORE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none
````
