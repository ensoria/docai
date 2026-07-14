# valid: root values and any type

Expected: valid complete candidate. Root scalar, root array, and root dynamic-map bodies use `$`, while `any` is used only for an explicitly arbitrary decoded value.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"beta":true,"checkout":false}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | map<string, bool> | yes | no | Dynamic feature flags by key |

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
["admin","member"]
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | string[] | always | no | Role names in display order; may be empty |

### Response 203

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
"ok"
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | string | always | no | Health state string |

### Response 207

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"payload":{"arbitrary":["decoded","json"]}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| payload | any | always | no | Arbitrary decoded JSON value explicitly allowed by the source contract |
````
