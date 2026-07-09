# valid: table normalization and field paths

Expected: valid response field table. The field name `campaign.code|source` contains a literal dot and pipe.

```markdown
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| metadata | object | always | no | Additional properties forbidden |
| metadata.campaign\.code\|source | string | always | no | Campaign attribution |
```
