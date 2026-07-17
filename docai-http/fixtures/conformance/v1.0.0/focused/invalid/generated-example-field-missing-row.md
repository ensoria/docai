# invalid: generated example field missing row

Expected: invalid complete conformance. Every generated example field must have a corresponding field-table row unless an allowed opaque descendant exception applies.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","profile":{"timezone":"Asia/Tokyo"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | User ID |
| profile | object | always | no | Additional properties forbidden |

- Response Headers: none
````
