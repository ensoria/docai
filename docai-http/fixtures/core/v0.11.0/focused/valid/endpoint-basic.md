# valid: endpoint section order

Expected: valid core endpoint section order.

````markdown
## GET /users/{id}

Fetches a user by ID.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: the user exists
- authorization: `users:read` scope

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | User ID |

#### Query Parameters

none

#### Headers

none

#### Cookie Parameters

none

#### Body

none

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01J0CORE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none

### Errors

none

### Related

none
````
