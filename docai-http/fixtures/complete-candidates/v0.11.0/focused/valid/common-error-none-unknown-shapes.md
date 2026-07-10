# valid: common error rows with none and unknown shapes

Expected: valid complete candidate. Common error rows may use `Shape=none` when no body or caller-relevant headers exist, and `Shape=unknown` only with the required `**unknown**:` marker.

````markdown
# API Conventions

## Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 404 | route_not_found | none | Route is not found before an endpoint-specific handler runs | Do not retry the same method and path |
| 502 | upstream_failure | unknown | Upstream gateway failed before returning the endpoint response | Retry once after a short backoff if the request is idempotent; otherwise check operation state first |

**unknown**: common 502 `upstream_failure` body and caller-relevant response-header contract are not documented; requires gateway error catalog

## Validation Errors

none
````
