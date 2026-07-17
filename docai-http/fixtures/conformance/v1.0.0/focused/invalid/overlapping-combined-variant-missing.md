# invalid: overlapping combined variant missing

Expected: invalid complete conformance. Overlapping alternatives must document combination semantics and include a combined variant.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

The `high_value` and `churn_risk` alternatives can both be valid for the same customer.

**variant**: churn risk signal

Use this variant when the response has `churn_risk`.

```json
{"customer_id":"cus_01K0CHURN","churn_risk":true,"churn_probability":0.82}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| customer_id | string | always | no | Customer ID |
| churn_risk | bool | always | no | Always `true`; churn-risk signal is present |
| churn_probability | float | always | no | Churn probability from 0 to 1 |

**variant**: high value signal

Use this variant when the response has `high_value`.

```json
{"customer_id":"cus_01K0VALUE","high_value":true,"lifetime_value":500000}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| customer_id | string | always | no | Customer ID |
| high_value | bool | always | no | Always `true`; high-value signal is present |
| lifetime_value | int | always | no | Lifetime value in JPY |
````
