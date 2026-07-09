# valid: response status range and default overlap

Expected: valid exact, range, and default responses with precedence prose.

```markdown
### Response 200

none

- Response Headers: none

### Response 2XX

none

- Response Headers: none

The exact `200` response takes precedence over `2XX`; `2XX` covers other successful statuses documented by the source.

### Response default

none

- Response Headers: none

`default` applies when no exact or range response matches.
```
