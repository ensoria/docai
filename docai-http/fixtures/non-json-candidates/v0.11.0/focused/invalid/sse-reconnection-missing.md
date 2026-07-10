# invalid: SSE reconnection missing

Expected: invalid non-JSON candidate. SSE responses must state retry and `Last-Event-ID` reconnection behavior.

````markdown
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

The stream is UTF-8. Each SSE frame is terminated by a blank line. Each event frame uses exactly one `id:` line, exactly one `event:` line, and one `data:` line. The `data:` line contains one compact JSON object. Multiple `data:` lines are not used in this fixture. Event names are exactly `report.progress`, `report.complete`, and `stream.end`. The `stream.end` event is terminal; after receiving it, clients must not reconnect for this stream. The server closes the connection after `stream.end`.

- Response Headers: none
````
