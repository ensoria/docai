# invalid: compact contract preservation failures

Expected: invalid complete conformance. Compact reductions must not omit request parameters, response statuses, error rows, or change client-visible constraints compared with the matching full profile.

`````markdown
Full profile excerpt:

````markdown
#### Query Parameters

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| include_inactive | bool | no | Defaults to `false`; when `true`, includes inactive users |

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"users":[{"id":"usr_01K0COMPLETE","role":"member"}]}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| users | object[] | always | no | Users in stable order |
| users[].id | string | always | no | User ID |
| users[].role | string | always | no | `admin` \| `member`; clients branch on this value |

### Response 409

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"sync_in_progress"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error.code | string | always | no | Always `sync_in_progress` |

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 422 | validation_failed | common:validation-error | Query parameter is invalid | Fix the query parameter; do not retry unchanged input |
````

Invalid compact excerpt:

````markdown
#### Query Parameters

none

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"users":[{"id":"usr_01K0COMPLETE","role":"member"}]}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| users | object[] | Users in stable order |
| users[].id | string | User ID |
| users[].role | string | `member`; clients branch on this value |

### Errors

none
````
`````
