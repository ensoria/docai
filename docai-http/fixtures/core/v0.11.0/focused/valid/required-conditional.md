# valid: conditional requiredness

Expected: valid `Required=conditional` rows with exact conditions in `Constraints / Meaning`.

```markdown
| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| mode | string | yes | `standard` or `custom` |
| include | string | conditional | Required when `mode=custom`; `summary` or `details` |

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | conditional | no | Required when `invite=false`; RFC 5322 email address |
| invite | bool | no | no | Defaults to `false` |
```
