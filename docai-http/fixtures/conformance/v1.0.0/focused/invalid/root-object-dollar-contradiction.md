# invalid: root object dollar row contradiction

Expected: invalid complete conformance. A root object `$` row contradicts the property rows about additional properties.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","email":"taro@example.com"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties allowed with string values |
| id | string | always | no | User ID; additional properties forbidden by source schema |
| email | string | always | no | User email |
````
