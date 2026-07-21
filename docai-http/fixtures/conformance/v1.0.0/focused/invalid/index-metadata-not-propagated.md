# invalid: index metadata does not propagate incomplete set state

Expected: invalid complete conformance. INDEX.md summarizes the whole set, so it cannot remain `coverage: complete` and `knowledge: complete` when a referenced file contains `**unsupported**:` and `**unknown**:`.

````markdown
<!-- INDEX.md -->
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

# API Index

## Endpoints

### resources/reports.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| GET | /reports/{id} | download report | Downloads a generated report. | none | Authentication |

## Workflows

none

## Webhooks

none

<!-- resources/reports.md -->
> docai-http: 1.0.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

### Response 200

#### Response Headers

**unsupported**: replaces Response Headers: response includes dynamic caller-relevant `X-Report-*` headers that cannot be enumerated at fixtures/conformance/v1.0.0/source/complete-openapi.yaml#/paths/~1reports~1{id}/get/responses/200/headers

**unknown**: report download URL expiration is not documented; requires storage-owner input for GET /reports/{id}
````
