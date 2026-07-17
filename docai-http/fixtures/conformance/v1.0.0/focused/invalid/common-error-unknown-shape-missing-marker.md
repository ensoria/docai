# invalid: common error unknown shape missing marker

Expected: invalid complete conformance. A common error row with `Shape=unknown` must carry the required `**unknown**:` marker.

````markdown
# API Conventions

## Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 502 | upstream_failure | unknown | Upstream gateway failed before returning the endpoint response | Retry once after a short backoff if the request is idempotent; otherwise check operation state first |

## Validation Errors

none
````
