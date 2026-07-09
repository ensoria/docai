# valid: endpoint-local none preserves common conventions

Expected: valid. Endpoint-local `none` means no endpoint-specific additions; common conventions still apply.

```markdown
## GET /users

Lists users.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: none
- authorization: `users:read` scope from the common Authentication convention still applies

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

none
```
