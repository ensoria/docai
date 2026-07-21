# invalid: resource file title wrapper

Expected: invalid complete conformance. A resource file adds a resource-level title and prose wrapper before endpoint headings.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001

# Users

This file describes user endpoints.

## GET /users/{id}

Gets one user.
````
