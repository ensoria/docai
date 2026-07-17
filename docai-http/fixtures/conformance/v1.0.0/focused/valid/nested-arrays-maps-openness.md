# valid: nested arrays, dynamic maps, and array-item openness

Expected: valid complete conformance. Nested arrays, dynamic maps, and object-array item openness are represented without schema references.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"matrix":[[1,2],[3,4]],"balances":{"JPY":{"amount":1200,"currency":"JPY"}},"items":[{"id":"it_01","metadata":{"color":"red"}}]}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| matrix | int[][] | always | no | Matrix rows in display order |
| balances | map<string, object> | always | no | Dynamic currency keys; value objects reject additional properties |
| balances.{key}.amount | int | always | no | Amount for representative dynamic key |
| balances.{key}.currency | string | always | no | ISO 4217 currency code matching the dynamic key |
| items | object[] | always | no | Array items reject additional properties |
| items[].id | string | always | no | Item ID |
| items[].metadata | map<string, string> | always | no | Dynamic metadata values by key |
````
