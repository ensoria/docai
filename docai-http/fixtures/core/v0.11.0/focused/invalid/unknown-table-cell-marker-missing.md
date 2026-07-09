# invalid: unknown table cell marker missing

Expected: invalid. Table-cell `unknown` values need a matching `**unknown**:` marker.

```markdown
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | unknown | unknown | unknown | Request field contract is not documented |

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| display_name | string | unknown | unknown | Display name |
```
