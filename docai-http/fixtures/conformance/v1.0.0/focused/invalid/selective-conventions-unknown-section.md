# invalid: selective conventions unknown section

Expected: invalid complete conformance. The optional `Conventions` column must name discoverable fixed CONVENTIONS.md sections, not arbitrary structural names.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /users | create user | Creates a user. | none | Authentication, Billing Rules |

## Workflows

none

## Webhooks

none
````
