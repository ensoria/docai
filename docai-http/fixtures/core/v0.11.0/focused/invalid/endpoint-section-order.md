# invalid: endpoint section order

Expected: invalid. `Request` must appear before `Response`.

```markdown
## GET /users/{id}

Fetches a user by ID.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: the user exists
- authorization: `users:read` scope

### Response 200

none

- Response Headers: none

### Request

none

### Errors

none

### Related

none
```
