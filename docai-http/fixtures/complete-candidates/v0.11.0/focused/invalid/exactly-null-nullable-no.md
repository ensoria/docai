# invalid: exactly-null nullable no

Expected: invalid complete candidate. A row with `Type=null` must use `Nullable=yes`.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: yes

```json
null
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | null | always | no | Decoded value is exactly null |

- Response Headers: none
````
