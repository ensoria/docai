# invalid: profile link after standard content

Expected: invalid compact candidate. `Full set:` / `Compact set:` appears directly after the metadata stamp, before `# API Index`.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

# API Index

Full set: ../full/

## Endpoints

none

## Workflows

none

## Webhooks

none
````
