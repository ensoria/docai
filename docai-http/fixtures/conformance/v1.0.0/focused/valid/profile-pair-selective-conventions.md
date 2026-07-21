# valid: profile pair with selective conventions

Expected: valid complete conformance. Full and compact INDEX files share the same standard paths, link each other, and use the optional `Conventions` column with fixed CONVENTIONS.md section names.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)
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

> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)
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
