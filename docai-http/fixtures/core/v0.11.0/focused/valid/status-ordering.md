# valid: response status ordering

Expected: valid response heading order: exact statuses, ranges, then default.

```markdown
### Response 200

none

- Response Headers: none

### Response 204

none

- Response Headers: none

### Response 4XX

none

- Response Headers: none

### Response default

none

- Response Headers: none

The exact `200` and `204` sections take precedence over the range response. `default` applies when no exact or range response matches.
```
