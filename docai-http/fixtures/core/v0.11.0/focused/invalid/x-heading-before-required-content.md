# invalid: endpoint-level x- heading before required content

Expected: invalid. Endpoint-level `x-` headings must not appear before required endpoint content.

```markdown
## GET /users

Lists users.

### x-Team Notes

Internal note.

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

none
```
