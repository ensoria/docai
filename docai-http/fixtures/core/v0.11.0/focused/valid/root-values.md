# valid: root scalar, array, map, and null bodies

Expected: valid root-value `$` notation for scalar, array, dynamic map, and exactly-null JSON bodies.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
"ok"
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | string | always | no | Status value |

- Response Headers: none

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
["admin","member"]
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | string[] | always | no | Roles in display order; may be empty |

- Response Headers: none

### Response 202

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"JPY":1000,"USD":25}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | map<string, int> | always | no | Balance by currency code |

- Response Headers: none

### Response 203

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
