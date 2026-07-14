# valid: field-level error target, code, and UI-display policy

Expected: valid complete candidate. Field-level errors identify the target field, machine-readable code, and whether the message can be shown in user-facing input UI.

````markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 422 | validation_failed | inline:validation-error | Request validation failed | Show field-level errors next to their target fields when `display_to_user` is `yes`; do not retry unchanged input |

422 validation_failed inline:validation-error:

**error_shape**: validation-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"validation_failed","message":"input is invalid","field_errors":[{"target":"email","code":"invalid_format","message":"Enter a valid email address.","display_to_user":true}]}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Always `validation_failed` |
| error.message | string | always | no | Developer-facing summary; do not display directly to users |
| error.field_errors | object[] | always | no | Field-level validation failures; array items reject additional properties |
| error.field_errors[].target | string | always | no | Request field targeted by the error, using the request field path such as `email` |
| error.field_errors[].code | string | always | no | Machine-readable field error code, such as `invalid_format` |
| error.field_errors[].message | string | always | no | Show next to the target field only when `display_to_user` is `true` |
| error.field_errors[].display_to_user | bool | always | no | UI-display policy for the field error message |

- Response Headers: none
````
