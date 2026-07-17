# invalid: repeatable response header missing wire rule

Expected: invalid complete conformance. Repeatable response headers must define combination, ordering, and a concrete wire example.

````markdown
#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Set-Cookie | string[] | Present when a browser session changes | Browser cookies returned by the API |
````
