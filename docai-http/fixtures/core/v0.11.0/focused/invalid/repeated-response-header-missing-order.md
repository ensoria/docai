# invalid: repeated response header missing order rule

Expected: invalid. Repeated response headers need an order rule.

```markdown
| Name | Type | Presence | Meaning |
|---|---|---|---|
| Link | string[] | always | list-valued header; may be combined with commas; `Link: </users?page=2>; rel="next"` |
```
