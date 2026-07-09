# invalid: localized unsupported replaces required content

Expected: invalid. Localized `unsupported` cannot replace required response content.

```markdown
### Response 200

**unsupported**: localized: additional dynamic header names are not enumerable at fixtures/core-openapi.yaml#/paths/~1users/get/responses/200/headers
```
