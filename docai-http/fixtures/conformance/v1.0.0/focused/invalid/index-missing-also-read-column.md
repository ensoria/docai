# invalid: INDEX missing Also read column

Expected: invalid complete conformance. An endpoint INDEX row omits the required `Also read` column.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: conformance-full-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

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
