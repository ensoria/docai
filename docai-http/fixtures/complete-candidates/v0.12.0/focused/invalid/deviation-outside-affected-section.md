# invalid: deviation outside affected section

Expected: invalid complete candidate. A deviation must be written inside the section it affects, not in an unrelated or global location.

````markdown
## POST /users

**deviation**: this response omits the common `X-Request-ID` header because it is served from an edge cache.

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

none

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none
````
