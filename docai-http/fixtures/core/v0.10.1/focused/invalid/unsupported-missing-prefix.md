# invalid: unsupported marker missing canonical prefix

Expected: invalid. `**unsupported**:` must use either `localized:` or `replaces <unit>:`.

```markdown
### Response 200

**unsupported**: recursive schema at fixtures/core-openapi.yaml#/components/schemas/Node
```
