# invalid: resource file title wrapper

Expected: invalid complete candidate. A resource file adds a resource-level title and prose wrapper before endpoint headings.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# Users

This file describes user endpoints.

## GET /users/{id}

Gets one user.
````
