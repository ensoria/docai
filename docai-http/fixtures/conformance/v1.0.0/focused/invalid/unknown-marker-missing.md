# invalid: unknown marker missing

Expected: invalid complete conformance. `unknown` marker values need a matching `**unknown**:` marker and `knowledge: requires-input`.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: conformance-full-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: unknown

- Response Headers: none
````
