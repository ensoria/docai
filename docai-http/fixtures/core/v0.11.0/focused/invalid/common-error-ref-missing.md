# invalid: common error reference missing conventions context

Expected: invalid. A `common:<label>` error reference must resolve to an `**error_shape**:` label from `CONVENTIONS.md`.

```markdown
### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | email_taken | common:missing-error | Email already exists | Do not retry unchanged input |
```
