# invalid: repeated request header missing combination rule

Expected: invalid. Repeated request headers need comma-combination and order rules plus a wire example.

```markdown
| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| X-Trace-Hop | no | string[] | multiple field lines allowed; `X-Trace-Hop: edge` |
```
