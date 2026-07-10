# invalid: unknown marker missing

Expected: invalid complete candidate. `unknown` marker values need a matching `**unknown**:` marker and `knowledge: requires-input`.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: unknown

- Response Headers: none
````
