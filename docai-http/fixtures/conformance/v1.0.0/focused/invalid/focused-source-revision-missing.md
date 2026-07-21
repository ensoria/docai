# invalid: focused source revision missing

Expected: invalid complete conformance. A focused metadata stamp that references an authoritative input set with a stable revision must include the matching `source_revision`.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

## GET /users/{id}

### Response 200

**body_presence**: always
````
