# valid: indirect recursive schema unsupported

Expected: valid response representation replacement for an indirectly recursive source schema.

```markdown
### Response 200

**body_presence**: always

**unsupported**: replaces response representation 200 application/json: indirectly recursive schema at source/recursive-indirect-openapi.yaml#/components/schemas/Person
```
