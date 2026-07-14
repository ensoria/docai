# invalid: enum omits client branch values

Expected: invalid complete candidate. A closed API-specific enum omits values that clients must branch on.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"status":"pending"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| status | string | always | no | Status value; clients branch on `pending`, `active`, and `suspended`, but this row omits the closed enum list |
````
