# valid: response default classification

Expected: valid complete candidate. A source `default` with exclusively error semantics is documented as a `default` row in `### Errors`; a source `default` that mixes non-error and error outcomes and cannot be split faithfully uses paired replacement markers in `### Response default` and `### Errors`.

````markdown
## GET /jobs/{id}

Gets one job.

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"job_01K0COMPLETE","status":"succeeded"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Job ID |
| status | string | always | no | `queued` \| `running` \| `succeeded` |

- Response Headers: none

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| default | job_failed | inline:default-error | Source default response has exclusively error semantics and no exact error status is documented | Do not treat the response as success; parse the error shape |

default job_failed inline:default-error:

**error_shape**: default-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"job_failed","message":"job failed"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Machine-readable error code |
| error.message | string | always | no | Developer-facing message |

- Response Headers: none

## GET /imports/{id}

Gets one import.

### Response 200

none

- Response Headers: none

### Response default

**unsupported**: replaces Response default: mixed error and non-error outcome at fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml#/paths/~1imports~1{id}/get/responses/default

### Errors

**unsupported**: replaces Errors: error branch is inseparable from the mixed default response at fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml#/paths/~1imports~1{id}/get/responses/default
````
