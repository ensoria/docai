# invalid: nested dynamic map flattened literal key

Expected: invalid complete candidate. Dynamic map object fields are documented with a literal example key instead of the `{key}` placeholder.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"balances":{"JPY":{"amount":1200,"currency":"JPY"}}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| balances | map<string, object> | always | no | Dynamic currency keys |
| balances.JPY.amount | int | always | no | Amount for JPY |
| balances.JPY.currency | string | always | no | Currency for JPY |
````
