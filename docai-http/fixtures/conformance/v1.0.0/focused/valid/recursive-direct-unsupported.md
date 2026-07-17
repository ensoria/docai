# valid: direct recursive schema unsupported

Expected: valid complete conformance. A directly recursive source schema uses representation replacement `unsupported` rather than finite-depth approximation.

````markdown
### Response 200

**body_presence**: always

**unsupported**: replaces response representation 200 application/json: directly recursive schema at fixtures/conformance/v1.0.0/source/recursive-direct-openapi.yaml#/components/schemas/Node
````
