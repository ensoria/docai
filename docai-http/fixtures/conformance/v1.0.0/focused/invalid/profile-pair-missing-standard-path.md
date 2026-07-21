# invalid: profile pair missing standard path

Expected: invalid complete conformance. Full and compact profile roots must contain the same standard docs-root-relative file paths.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-002 | projection_id: conformance-20260721-rc2-002 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)
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

> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-002 | projection_id: conformance-20260721-rc2-002 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)
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
