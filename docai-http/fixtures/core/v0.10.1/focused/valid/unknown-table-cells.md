# valid: table-level unknown marker

Expected: valid `unknown` table cells with one marker that identifies the affected cells and expected input.

```markdown
#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| X-Request-ID | string | unknown | Log with support requests |
| X-Trace-ID | string | unknown | Log with support requests |

**unknown**: response-header presence for X-Request-ID and X-Trace-ID is not documented; requires service-owner header contract for GET /users/{id}
```
