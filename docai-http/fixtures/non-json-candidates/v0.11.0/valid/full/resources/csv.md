> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: non-json-candidate-full-20260710-001 | projection_id: non-json-candidate-20260710-001 | source: fixtures/non-json-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-non-json-candidate-001 | x-fixture: non-json-candidate

## GET /reports/export

Downloads a CSV export of reports.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: none
- authorization: authenticated user

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

none

### Response 200

**body_presence**: always

**media_type**: text/csv;charset=UTF-8

**body_nullable**: no

```csv
report_id,title,total
rpt_01K0CSV,"Q2, statement",1200
```

The CSV is UTF-8. The delimiter is comma(`,`). The record separator on the wire is CRLF. The first record is a header row. The column order is exactly `report_id`, `title`, `total`. Fields containing comma, quote, CR, or LF are quoted with double quotes; a double quote inside a field is escaped as two double quotes.

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| report_id | string | always | no | First column; report ID |
| title | string | always | no | Second column; quoted when required by CSV rules |
| total | int | always | no | Third column; report total in JPY |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Content-Disposition | string | always | Attachment filename for the CSV export, such as `reports.csv` |

### Errors

none

### Related

none
