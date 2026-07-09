# invalid: unsupported response representation wrong status

Expected: invalid. A response representation replacement must name the containing response status.

```markdown
### Response 200

**body_presence**: always

**unsupported**: replaces response representation 201 application/json: recursive schema at fixtures/core-openapi.yaml#/components/schemas/Node
```
