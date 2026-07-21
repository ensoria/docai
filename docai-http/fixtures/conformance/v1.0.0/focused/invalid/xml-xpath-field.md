# invalid: XPath-like XML field identifier

Expected: invalid complete conformance. Structured non-JSON tables use logical DocAI field paths; the XML wire location belongs in Meaning or prose.

````markdown
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| /report/@status | string | always | no | XML attribute; allowed values are `draft` \| `final` |
````

