# invalid: field path escape

Expected: invalid. `\q` is not a valid field-path escape.

```markdown
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| metadata.\q | string | always | no | Invalid escape |
```
