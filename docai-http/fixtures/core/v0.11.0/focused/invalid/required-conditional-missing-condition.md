# invalid: conditional requiredness missing condition

Expected: invalid. `Required=conditional` must state the exact condition in `Constraints / Meaning`.

```markdown
| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| include | string | conditional | `summary` or `details` |
```
