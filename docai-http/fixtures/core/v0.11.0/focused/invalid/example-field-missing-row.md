# invalid: JSON example missing field row

Expected: invalid. Every field in the JSON example needs a field-table row.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01J0CORE","email":"taro@example.com"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none
````
