# invalid: unrepresentable endpoint normalized

Expected: invalid complete conformance. An unrepresentable path template variable is silently normalized and emitted as if it were compliant.

````source
GET /reports/{report id}
````

````markdown
## GET /reports/{report_id}

Downloads a report.

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| report_id | string | Silently normalized from source `{report id}` |
````
