# valid: deprecated endpoint index summary

Expected: valid deprecated endpoint with matching `(deprecated)` INDEX summary prefix.

```markdown
| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| GET | /legacy-users | read legacy users | (deprecated) Lists legacy users; use GET /users instead | none |

## GET /legacy-users

Lists legacy users.

**deprecated**: use GET /users instead.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: none
- authorization: `users:read` scope

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

none

### Related

- Replacement: GET /users
```
