# invalid: unknown response headers missing marker

Expected: invalid complete conformance. `Response Headers` uses `unknown` but omits the required `**unknown**:` marker.

````markdown
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

#### Response Headers

unknown
````
