# invalid: file metadata does not propagate local incomplete state

Expected: invalid complete conformance. A file that contains `**unsupported**:` or `**unknown**:` must use `coverage: requires-source` or `knowledge: requires-input` for that file instead of retaining complete metadata.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-002 | projection_id: conformance-20260721-rc2-002 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

## GET /reports/{id}

Downloads a generated report.

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
````
