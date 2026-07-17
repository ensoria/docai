# invalid: field path unescaped pipe

Expected: invalid complete conformance. Literal `|` inside a field path must be escaped at the table level and as a field-path character.

````markdown
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| metadata.campaign.code|source | string | no | no | Source field name contains a literal dot and pipe |
````
