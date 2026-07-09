# valid: repeated parameters and headers

Expected: valid repeated query parameter, request header, and response header wire rules.

```markdown
#### Query Parameters

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| tag | string[] | no | repeated query parameter occurrences; order insignificant; `tag=red&tag=blue` |

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| X-Trace-Hop | no | string[] | multiple field lines allowed; values must not be combined with commas; order significant; `X-Trace-Hop: edge` followed by `X-Trace-Hop: app` |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Link | string[] | always | list-valued header; may be combined with commas; order significant for traversal; `Link: </users?page=2>; rel="next", </users?page=5>; rel="last"` |
| Set-Cookie | string[] | Present when a browser session changes | repeated field lines; not comma-combinable; order significant; `Set-Cookie: sid=abc; HttpOnly` followed by `Set-Cookie: theme=light` |
```
