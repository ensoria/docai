# valid: JSON example field coverage

Expected: valid JSON example whose object, array, dynamic-map, and escaped-name fields all have rows.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{
  "id": "usr_01J0CORE",
  "profile": {
    "display.name": "Taro"
  },
  "items": [
    {
      "sku": "sku_01",
      "quantity": 2
    }
  ],
  "balances": {
    "JPY": {
      "amount": 1000
    }
  }
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | User ID |
| profile | object | always | no | Additional properties forbidden |
| profile.display\.name | string | always | no | Display name; field name contains a literal dot |
| items | object[] | always | no | Cart items; array items reject additional properties |
| items[].sku | string | always | no | SKU |
| items[].quantity | int | always | no | Quantity |
| balances | map<string, object> | always | no | Balance by currency code |
| balances.{key}.amount | int | always | no | Amount for the represented currency key |

- Response Headers: none
````
