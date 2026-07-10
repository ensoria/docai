# invalid: mixed default missing error replacement

Expected: invalid complete candidate. When one source default response mixes error and non-error outcomes and cannot be split faithfully, `### Response default` and `### Errors` must both use the paired replacement markers.

````markdown
### Response 200

none

- Response Headers: none

### Response default

**unsupported**: replaces Response default: mixed error and non-error outcome at fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml#/paths/~1imports~1{id}/get/responses/default

### Errors

none
````
