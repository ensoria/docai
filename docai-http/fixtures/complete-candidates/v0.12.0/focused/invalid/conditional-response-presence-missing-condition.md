# invalid: conditional response body presence missing condition

Expected: invalid complete candidate. A conditional response body presence value does not state the exact caller-visible condition.

````markdown
### Response 200

**body_presence**: conditional

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID when present |

- Response Headers: none
````
