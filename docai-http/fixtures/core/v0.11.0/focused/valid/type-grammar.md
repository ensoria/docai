# valid: core type grammar

Expected: valid core type grammar for JSON body fields.

```markdown
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | User ID |
| count | int | always | no | Count |
| active | bool | always | no | Whether the user is active |
| score | float | always | no | Ranking score |
| tags | string[] | always | no | Tags |
| balances | map<string, int> | always | no | Balance by currency-like key |
```
