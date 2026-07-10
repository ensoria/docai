> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: non-json-candidate-full-20260710-001 | projection_id: non-json-candidate-20260710-001 | source: fixtures/non-json-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-non-json-candidate-001 | x-fixture: non-json-candidate

## POST /reports/search

Searches reports using form-urlencoded fields.

### Behavior

- side_effects: none
- idempotency: not idempotent because this fixture uses POST for search, but safe to retry with the same body
- preconditions: none
- authorization: authenticated user

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

**body_required**: yes

**media_type**: application/x-www-form-urlencoded;charset=UTF-8

**body_nullable**: no

```http
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

q=quarterly+statement&tag=finance&tag=quarterly&include_archived=false
```

Encode the form body as UTF-8 before percent-encoding. Encode spaces as `+`. Repeated `tag` values are sent by repeating the `tag` field once per value; order is not significant.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| q | string | yes | no | Form field `q`; encode as UTF-8 before percent-encoding; spaces use `+`; empty string rejected |
| tag | string[] | no | no | Form field `tag`; repeat the field once per value, such as `tag=finance&tag=quarterly`; order is not significant; omit the field when the list is empty |
| include_archived | bool | no | no | Form field `include_archived`; allowed values are `true` and `false`; defaults to `false` when omitted |

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"results":[{"report_id":"rpt_01K0FORM","title":"Q2 statement"}]}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| results | object[] | always | no | Matching reports in relevance order; array items reject additional properties |
| results[].report_id | string | always | no | Report ID |
| results[].title | string | always | no | Report title |

- Response Headers: none

### Errors

none

### Related

none
