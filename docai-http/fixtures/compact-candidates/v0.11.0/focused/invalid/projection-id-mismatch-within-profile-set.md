# invalid: projection_id mismatch within one profile set

Expected: invalid compact candidate. Every file in one profile set must share the same `projection_id`; a mixed projection snapshot is not one consistent set.

Full `INDEX.md`:

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-full-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)
Compact set: ../compact/

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /users | create user | Creates a user record. | none |

## Workflows

none

## Webhooks

none
````

Full `resources/users.md`:

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-full-20260709-001 | projection_id: compact-candidate-other-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

## POST /users

Creates a user record.
````
