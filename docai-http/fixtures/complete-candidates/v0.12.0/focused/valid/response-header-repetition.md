# valid: repeatable response headers

Expected: valid complete candidate. Repeatable response headers define field-line or list syntax, combination, ordering, and a concrete wire example.

````markdown
#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Link | string[] | always | list-valued header; may be combined with commas; order significant for traversal; `Link: </users?page=2>; rel="next", </users?page=5>; rel="last"` |
| Set-Cookie | string[] | Present when a browser session changes | repeated field lines; not comma-combinable; order significant; `Set-Cookie: sid=abc; HttpOnly` followed by `Set-Cookie: theme=light` |
````
