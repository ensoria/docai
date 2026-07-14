# valid: canonical boundary extension heading

Expected: valid complete candidate. An `x-` heading appears after required response content, is exactly one level deeper than the response section, and ends before the next `###` heading.

````markdown
## GET /users/{id}

Gets one user by ID.

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | User ID |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| X-Request-Id | string | always | Request correlation ID |

#### x-Trace Notes

Ignorable non-contract trace note for internal routing.

### Errors

none
````
