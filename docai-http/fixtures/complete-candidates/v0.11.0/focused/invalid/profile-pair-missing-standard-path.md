# invalid: profile pair missing standard path

Expected: invalid complete candidate. Full and compact profile roots must contain the same standard docs-root-relative file paths.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)
Compact set: ../compact/

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /users | create user | Creates a user. | none |

## Workflows

none

## Webhooks

none

---

> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)
Full set: ../full/

# API Index

## Endpoints

### resources/accounts.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /users | create user | Creates a user. | none |

## Workflows

none

## Webhooks

none
````
