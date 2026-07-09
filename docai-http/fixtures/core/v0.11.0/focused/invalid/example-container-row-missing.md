# invalid: JSON example missing object container row

Expected: invalid. Object containers in the JSON example need field-table rows.

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
| profile.timezone | string | always | no | IANA time zone name |

- Response Headers: none
````
