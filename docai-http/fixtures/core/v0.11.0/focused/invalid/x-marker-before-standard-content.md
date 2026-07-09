# invalid: x- marker before standard response content

Expected: invalid. An `x-` marker must not split or precede required standard content.

````markdown
### Response 200

**x-audit**: internal note

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01J0CORE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none
````
