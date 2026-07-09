# invalid: projection_id mismatch between profiles

Expected: invalid compact candidate. Matching full and compact sets must share the same `projection_id`; readers must not combine sets whose `projection_id` differs.

Full `INDEX.md`:

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-full-20260709-001 | projection_id: compact-candidate-full-only-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)
Compact set: ../compact/

# API Index

## Endpoints

none

## Workflows

none

## Webhooks

none
````

Compact `INDEX.md`:

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-compact-only-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)
Full set: ../full/

# API Index

## Endpoints

none

## Workflows

none

## Webhooks

none
````
