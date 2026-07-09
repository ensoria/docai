# invalid: object openness missing

Expected: invalid. Object rows must state whether additional properties are forbidden or allowed.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"profile":{"timezone":"Asia/Tokyo"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| profile | object | always | no | User profile |
| profile.timezone | string | always | no | IANA time zone name |

- Response Headers: none
````
