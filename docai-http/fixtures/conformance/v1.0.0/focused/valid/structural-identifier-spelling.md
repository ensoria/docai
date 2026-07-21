# valid: structural identifier spelling

Expected: valid complete conformance. Endpoint method/path, response status, resource heading, and concrete media type use canonical structural spelling.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc3-001 | projection_id: conformance-20260721-rc3-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

## GET /reports/{id}

Downloads a report.

### Response 2XX

**body_presence**: always

**media_type**: application/vnd.example.report+json;version=1

**body_nullable**: no

```json
{"id":"rpt_01K0COMPLETE","status":"ready"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Report ID |
| status | string | always | no | `ready` |

- Response Headers: none

Exact `200` responses use this representation; other non-error `2XX` responses are not emitted by the source.
````
