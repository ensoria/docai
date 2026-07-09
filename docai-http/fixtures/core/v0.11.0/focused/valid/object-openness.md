# valid: object openness

Expected: valid object openness on root objects, nested objects, and object-array rows.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{
  "profile": {
    "timezone": "Asia/Tokyo"
  },
  "items": [
    {
      "id": "itm_01"
    }
  ]
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| profile | object | always | no | Additional properties allowed with string values |
| profile.timezone | string | always | no | IANA time zone name |
| items | object[] | always | no | Items; array items reject additional properties |
| items[].id | string | always | no | Item ID |

- Response Headers: none
````
