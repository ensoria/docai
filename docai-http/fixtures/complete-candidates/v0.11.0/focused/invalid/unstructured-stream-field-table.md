# invalid: unstructured stream field table

Expected: invalid complete candidate. Unstructured streams such as SSE omit `body_nullable` and do not use a decoded field table; stream semantics are documented with sample and prose.

````markdown
### Response 200

**body_presence**: always

**media_type**: text/event-stream;charset=UTF-8

**body_nullable**: no

```sse
id: evt_01K0SSE001
event: report.progress
data: {"percent":40}
```

The stream is UTF-8. Each SSE frame is terminated by a blank line.

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| percent | int | always | no | Progress percent from each SSE data object |

- Response Headers: none
````
