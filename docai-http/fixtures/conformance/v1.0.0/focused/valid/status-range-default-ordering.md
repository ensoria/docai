# valid: status range and default ordering

Expected: valid complete conformance. Exact response statuses are ordered before ranges, ranges before `default`, and overlap precedence is stated.

````markdown
### Response 200

none

- Response Headers: none

### Response 202

none

- Response Headers: none

### Response 2XX

none

- Response Headers: none

This range covers non-error success statuses other than the exact 200 and 202 cases above; exact status definitions take precedence.

### Response default

**unsupported**: replaces Response default: mixed non-error default outcome at fixtures/conformance/v1.0.0/source/complete-openapi.yaml#/paths/~1jobs/get/responses/default

### Errors

**unsupported**: replaces Errors: error branch is inseparable from the mixed default response at fixtures/conformance/v1.0.0/source/complete-openapi.yaml#/paths/~1jobs/get/responses/default
````
