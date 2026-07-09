# valid: common error suppression deviation

Expected: valid endpoint-specific common error suppression using `**deviation**:` before `none`.

```markdown
## POST /users

Creates a user.

### Behavior

- side_effects: creates a user account
- idempotency: not idempotent without an idempotency key
- preconditions: none
- authorization: `users:write` scope

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none
- Body: none

### Response 204

none

- Response Headers: none

### Errors

**deviation**: common 404 `not_found` does not apply because this endpoint creates a new resource rather than reading an existing one

none

### Related

none
```
