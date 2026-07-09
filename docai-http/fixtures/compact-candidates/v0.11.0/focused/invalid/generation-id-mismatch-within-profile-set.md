# invalid: generation_id mismatch within one profile set

Expected: invalid compact candidate. Every file in one profile set must share the same `generation_id`; files with different generation runs must not be treated as one consistent set.

Compact `INDEX.md`:

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)
Full set: ../full/

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

Compact `resources/users.md`:

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-002 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

## POST /users

Creates a user record.
````
