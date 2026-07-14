# invalid: same_as error shape

Expected: invalid complete candidate. Error shapes must not use `**same_as**:` even in the compact profile.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | payment_conflict | inline:payment-conflict | Payment state changed before capture | Fetch the payment state before retrying |

409 payment_conflict inline:payment-conflict:

**error_shape**: payment-conflict

**body_presence**: always

**same_as**: POST /payments Response 409 application/json
````
