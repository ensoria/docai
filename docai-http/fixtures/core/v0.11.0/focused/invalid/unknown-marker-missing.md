# invalid: unknown marker missing

Expected: invalid. `unknown` marker values need a matching `**unknown**:` marker.

````markdown
### Response 200

**body_presence**: unknown

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
