# invalid: deprecated index summary missing prefix

Expected: invalid complete conformance. A deprecated endpoint marker must have a matching `(deprecated)` prefix in the INDEX summary.

````markdown
# API Index

## Endpoints

### resources/legacy-users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| GET | /legacy-users | list users | Lists legacy users; use GET /users instead. | none | Authentication, Errors |

## GET /legacy-users

**deprecated**: use GET /users instead.
````
