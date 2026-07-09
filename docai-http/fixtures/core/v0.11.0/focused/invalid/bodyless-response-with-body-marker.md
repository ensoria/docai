# invalid: body-less response with body marker

Expected: invalid. A body-less response must not include body representation markers.

```markdown
### Response 204

none

- Response Headers: none

**body_presence**: always
```
