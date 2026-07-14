# invalid: index routing metadata contradicts file metadata

Expected: invalid complete candidate. Optional `x-coverage` and `x-knowledge` INDEX routing hints are ignorable, but when present they must not contradict the authoritative set and file metadata.

````markdown
<!-- INDEX.md -->
> docai-http: 0.12.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# API Index

## Endpoints

### resources/reports.md

| Method | Path | Task | Summary | Also read | Conventions | x-coverage | x-knowledge |
|---|---|---|---|---|---|---|---|
| GET | /reports/{id} | download report | Downloads a generated report. | none | Authentication | complete | complete |

## Workflows

none

## Webhooks

none

<!-- resources/reports.md -->
> docai-http: 0.12.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

### Response 200

#### Response Headers

**unsupported**: replaces Response Headers: response includes dynamic caller-relevant `X-Report-*` headers that cannot be enumerated at fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml#/paths/~1reports~1{id}/get/responses/200/headers

**unknown**: report download URL expiration is not documented; requires storage-owner input for GET /reports/{id}
````
