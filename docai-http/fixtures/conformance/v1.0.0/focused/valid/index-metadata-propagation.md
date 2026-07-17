# valid: index and metadata propagation for incomplete set state

Expected: valid complete conformance. When a file contains `**unsupported**:` or `**unknown**:`, that file's metadata and the set-level INDEX metadata propagate the incomplete coverage and knowledge state; optional INDEX routing hints agree with those states.

````markdown
<!-- INDEX.md -->
> docai-http: 1.0.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-10 | generation_id: conformance-full-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# API Index

## Endpoints

### resources/reports.md

| Method | Path | Task | Summary | Also read | Conventions | x-coverage | x-knowledge |
|---|---|---|---|---|---|---|---|
| GET | /reports/{id} | download report | Downloads a generated report. | none | Authentication | requires-source | requires-input |

## Workflows

none

## Webhooks

none

<!-- resources/reports.md -->
> docai-http: 1.0.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-10 | generation_id: conformance-full-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

## GET /reports/{id}

Downloads a generated report.

### Request

- Path Parameters:

| Name | Type | Meaning |
|---|---|---|
| id | string | Report ID |

- Query Parameters: none
- Header Parameters: none
- Cookie Parameters: none
- Body: none

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"rpt_01K0COMPLETE","download_url":"https://cdn.example.test/reports/rpt_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Report ID |
| download_url | string | always | no | Temporary URL for the generated report |

#### Response Headers

**unsupported**: replaces Response Headers: response includes dynamic caller-relevant `X-Report-*` headers that cannot be enumerated at fixtures/conformance/v1.0.0/source/complete-openapi.yaml#/paths/~1reports~1{id}/get/responses/200/headers

**unknown**: report download URL expiration is not documented; requires storage-owner input for GET /reports/{id}

### Errors

none

### Behavior

- side_effects: none
- idempotency: safe
- preconditions: report exists
- authorization: bearer token with `reports:read`

### Related

none
````
