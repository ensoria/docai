# invalid: non-extension heading

Expected: invalid complete conformance. An ordinary non-standard heading such as `### OAuth2` is unknown non-extension structural text inside a resource file.

````markdown
## GET /users/{id}

Gets one user by ID.

### Behavior

- side_effects: none
- idempotency: safe
- preconditions: user must exist
- authorization: bearer token

### OAuth2

Requires the `users:read` scope.

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none
- Body: none
````
