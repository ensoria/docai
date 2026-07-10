# valid: profile pair with selective conventions

Expected: valid complete candidate. Full and compact INDEX files share the same standard paths, link each other, and use the optional `Conventions` column with fixed CONVENTIONS.md section names.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)
Compact set: ../compact/

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /users | create user | Creates a user. | none | Authentication, Request Formats |

## Workflows

none

## Webhooks

none

---

> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)
Full set: ../full/

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /users | create user | Creates a user. | none | Authentication, Request Formats |

## Workflows

none

## Webhooks

none
````
