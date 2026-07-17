# invalid: unknown media type missing marker

Expected: invalid complete conformance. `**media_type**: unknown` omits the required `**unknown**:` marker.

````markdown
### Response 200

**body_presence**: always

**media_type**: unknown

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none
````
