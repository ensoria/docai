# invalid: enum used as a Type expression

Expected: invalid complete conformance. Enum values belong in constraints or meaning; `enum(...)` is not part of the canonical Type grammar.

````markdown
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| currency | enum(JPY, USD) | yes | no | Currency for `amount` |
````

