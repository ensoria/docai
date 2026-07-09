# invalid: request subsection order

Expected: invalid. Request subsections must follow Path, Query, Headers, Cookie, Body order.

```markdown
## GET /users

Lists users.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: none
- authorization: `users:read` scope

### Request

- Path Parameters: none

#### Headers

none

#### Query Parameters

none

#### Cookie Parameters

none

#### Body

none

### Response 204

none

- Response Headers: none

### Errors

none

### Related

none
```
