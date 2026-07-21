# invalid: unknown marker missing

Expected: invalid complete conformance. `unknown` marker values need a matching `**unknown**:` marker and `knowledge: requires-input`.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-002 | projection_id: conformance-20260721-rc2-002 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

### Response 200

**body_presence**: unknown

- Response Headers: none
````
