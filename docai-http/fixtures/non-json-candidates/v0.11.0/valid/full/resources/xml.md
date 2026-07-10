> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: non-json-candidate-full-20260710-001 | projection_id: non-json-candidate-20260710-001 | source: fixtures/non-json-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-non-json-candidate-001 | x-fixture: non-json-candidate

## GET /reports/{report_id}/summary

Returns an XML summary for a report.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: report exists
- authorization: authenticated user

### Request

#### Path Parameters

| Name | Type | Required | Meaning |
|---|---|---|---|
| report_id | string | yes | Report ID |

- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

none

### Response 200

**body_presence**: always

**media_type**: application/xml;charset=UTF-8

**body_nullable**: no

```xml
<?xml version="1.0" encoding="UTF-8"?>
<report xmlns="https://api.example.com/reports" xmlns:audit="https://api.example.com/audit" id="rpt_01K0XML" status="final">
  <title>Q2 statement</title>
  <total currency="JPY">1200</total>
  <audit:updated_at>2026-07-10T00:00:00Z</audit:updated_at>
</report>
```

The XML is UTF-8. The XML declaration encoding is UTF-8. The default namespace URI is `https://api.example.com/reports`. The audit namespace URI is `https://api.example.com/audit`. Consumers match namespace URIs, not lexical prefixes. Element order is fixed: `title`, `total`, `audit:updated_at`. Attributes are unordered. No mixed content is used.

| Node | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| /report | object | always | no | Root element in the default namespace |
| /report/@id | string | always | no | Attribute; report ID |
| /report/@status | enum(final, draft) | always | no | Attribute; report status |
| /report/title | string | always | no | First child element in the default namespace |
| /report/total | int | always | no | Second child element in the default namespace |
| /report/total/@currency | enum(JPY, USD) | always | no | Attribute; currency code for total |
| /report/audit:updated_at | datetime | always | no | Third child element in the audit namespace |

### Errors

none

### Related

none
