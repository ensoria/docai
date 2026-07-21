# invalid: request same_as target lacks a request body representation

Expected: invalid complete conformance. A Request `**same_as**:` target must resolve to a full request body representation in the named endpoint.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc3-001 | projection_id: conformance-20260721-rc3-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001 | x-retrieval-unit: resource-file

## POST /users

### Request

- Body: none

### Response 204

**body_presence**: never

- Response Headers: none

## POST /user-imports

### Request

#### Body

**body_required**: yes

**same_as**: POST /users Request application/json
````

