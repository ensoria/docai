# invalid: non-extension table column

Expected: invalid. Unknown table columns must use the `x-` prefix and follow standard columns.

```markdown
| Name | Type | Presence | Meaning | Internal |
|---|---|---|---|---|
| ETag | string | always | Entity tag | docs |
```
