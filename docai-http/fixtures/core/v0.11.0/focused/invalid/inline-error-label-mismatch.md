# invalid: inline error label mismatch

Expected: invalid. The inline label and following `**error_shape**:` value do not match.

```markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 422 | validation_failed | inline:validation-error | Input is invalid | Do not retry unchanged input |

422 validation_failed inline:validation-error:

**error_shape**: other-error
```
