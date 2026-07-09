# valid: body-less request and response

Expected: valid endpoint with body-less request and `204` body-less response headers.

```markdown
## DELETE /users/{id}

Deletes a user account.

### Behavior

- side_effects: deletes the user account
- idempotency: idempotent when the user is already absent
- preconditions: the user exists or has already been deleted
- authorization: `users:write` scope

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

### Response 204

none

- Response Headers: none

### Errors

none

### Related

none
```
