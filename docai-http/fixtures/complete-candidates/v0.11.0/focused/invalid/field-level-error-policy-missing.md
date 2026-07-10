# invalid: field-level error policy missing

Expected: invalid complete candidate. Field-level errors must identify the target field, machine-readable code, and UI-display policy when those facts are known.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 422 | validation_failed | inline:validation-error | Request validation failed | Show field-level errors when present; do not retry unchanged input |

422 validation_failed inline:validation-error:

**error_shape**: validation-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"validation_failed","message":"input is invalid","field_errors":[{"message":"Enter a valid email address."}]}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Always `validation_failed` |
| error.message | string | always | no | Developer-facing summary |
| error.field_errors | object[] | always | no | Field-level validation failures |
| error.field_errors[].message | string | always | no | Field error message |

- Response Headers: none
````
