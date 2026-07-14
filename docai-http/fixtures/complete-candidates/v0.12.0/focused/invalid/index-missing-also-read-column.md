# invalid: INDEX missing Also read column

Expected: invalid complete candidate. An endpoint INDEX row omits the required `Also read` column.

````markdown
> docai-http: 0.12.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary |
|---|---|---|---|
| POST | /users | create user | Creates a user and optionally sends an invitation email. |

## Workflows

none

## Webhooks

none
````
