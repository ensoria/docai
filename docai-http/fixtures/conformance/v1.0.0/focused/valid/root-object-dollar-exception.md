# valid: root object dollar row exception

Expected: valid complete conformance. A root object omits `$` when property rows and conventions fully describe object openness.

````markdown
## Data Representation

Root JSON objects reject additional properties unless a field table states otherwise.

---

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","email":"taro@example.com"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |
| email | string | always | no | User email |
````
