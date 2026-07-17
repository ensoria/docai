# valid: metadata extension and token-routing hint

Expected: valid complete conformance. Extension metadata uses the `x-` prefix after standard stamp keys and can publish ignorable retrieval guidance.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: conformance-compact-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-conformance-001 | x-retrieval-unit: resource-file | x-fixture: stable-conformance

## GET /users/{id}

Gets one user by ID.
````
