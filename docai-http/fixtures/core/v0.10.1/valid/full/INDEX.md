> docai-http: 0.10.1 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-09 | generation_id: core-full-20260709-001 | projection_id: core-20260709-001 | source: fixtures/core-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-core-001 | x-fixture: core-valid-full

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /users | create user | Creates a user and sends a confirmation email | none |
| GET | /users/{id} | read user | Returns a user profile; response body presence has missing source knowledge | none |
| PATCH | /users/{id} | update user | Updates editable user fields using ETag concurrency | none |
| GET | /users/{id}/manager-tree | read user hierarchy | Requires source fallback because the JSON response schema is recursive | none |

## Workflows

none

## Webhooks

none
