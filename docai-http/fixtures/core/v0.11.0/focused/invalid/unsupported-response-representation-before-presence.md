# invalid: unsupported response representation before body presence

Expected: invalid. A response representation replacement must retain representable `body_presence` first.

```markdown
### Response 200

**unsupported**: replaces response representation 200 application/json: recursive schema at fixtures/core-openapi.yaml#/components/schemas/Node
```
