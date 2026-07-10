> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: non-json-candidate-full-20260710-001 | projection_id: non-json-candidate-20260710-001 | source: fixtures/non-json-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-non-json-candidate-001 | x-fixture: non-json-candidate

## GET /reports/{report_id}/events

Streams status events for a report.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to reconnect
- preconditions: report exists
- authorization: authenticated user

### Request

#### Path Parameters

| Name | Type | Required | Meaning |
|---|---|---|---|
| report_id | string | yes | Report ID |

- Query Parameters: none

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| Last-Event-ID | no | string | Last received SSE event ID; send only on reconnect to resume after that event |

- Cookie Parameters: none

#### Body

none

### Response 200

**body_presence**: always

**media_type**: text/event-stream;charset=UTF-8

```sse
retry: 5000

id: evt_01K0SSE001
event: report.progress
data: {"report_id":"rpt_01K0SSE","state":"processing","percent":40}

id: evt_01K0SSE002
event: report.complete
data: {"report_id":"rpt_01K0SSE","state":"complete","download_url":"https://api.example.com/reports/rpt_01K0SSE"}

id: evt_01K0SSE003
event: stream.end
data: {"reason":"complete"}
```

The stream is UTF-8. Each SSE frame is terminated by a blank line. Each event frame uses exactly one `id:` line, exactly one `event:` line, and one `data:` line. The `data:` line contains one compact JSON object. Multiple `data:` lines are not used in this fixture. Event names are exactly `report.progress`, `report.complete`, and `stream.end`. The `retry:` field is 5000 milliseconds and may appear before the first event. Clients reconnect after transport errors using the `Last-Event-ID` request header. Events after the supplied ID may be replayed. The `stream.end` event is terminal; after receiving it, clients must not reconnect for this stream. The server closes the connection after `stream.end`.

- Response Headers: none

### Errors

none

### Related

none
