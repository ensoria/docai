# valid: metadata extension and token-routing hint

Expected: valid complete conformance. Extension metadata uses the `x-` prefix after standard stamp keys and can publish ignorable retrieval guidance.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-002 | projection_id: conformance-20260721-rc2-002 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc2-002 | x-retrieval-unit: resource-file | x-fixture: stable-conformance

## GET /users/{id}

Gets one user by ID.
````
