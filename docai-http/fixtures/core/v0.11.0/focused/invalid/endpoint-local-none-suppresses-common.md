# invalid: endpoint-local none suppresses common conventions

Expected: invalid. Suppressing a common convention requires `**deviation**:`.

```markdown
## GET /public-status

Reads public service status.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: none
- authorization: none

### Request

Common Authorization does not apply for this endpoint.

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
