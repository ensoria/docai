# invalid: x- table column before standard columns

Expected: invalid. `x-` table columns must follow every standard column.

```markdown
| Name | Type | x-owner | Presence | Meaning |
|---|---|---|---|---|
| ETag | string | docs | always | Entity tag |
```
