# valid: exactly-null body

Expected: valid complete candidate. An authoritatively exactly-null decoded value uses `Type=null`, `Nullable=yes`, and a `null` example.

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
| $ | null | always | yes | Decoded value is exactly null |

- Response Headers: none
````
